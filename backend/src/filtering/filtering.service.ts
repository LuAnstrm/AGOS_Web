import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ReadingFiltered, ReadingRaw, SensorNode } from '../database/entities';
import { EkfState, initState, Measurement, step } from './ekf';

const DEFAULT_MOUNT_CM = 400;

/**
 * Runs every raw reading through the node's Extended Kalman Filter and stores
 * the result. Filter state is kept in memory per node and restored from the
 * latest stored filtered reading after a restart.
 *
 * Callers must process one node's readings sequentially (PipelineService does).
 */
@Injectable()
export class FilteringService {
  private readonly logger = new Logger(FilteringService.name);
  private readonly states = new Map<string, EkfState>();

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async process(raw: ReadingRaw): Promise<ReadingFiltered | null> {
    const node = await this.db
      .getRepository(SensorNode)
      .findOneBy({ id: raw.nodeId });

    const m: Measurement = {
      t: raw.recordedAt.getTime(),
      z: raw.waterDepthCm,
      mountHeightCm: node?.mountHeightCm ?? DEFAULT_MOUNT_CM,
      tiltDeg: raw.tiltDeg,
      temperatureC: raw.temperatureC,
      vibrationG: raw.vibrationG,
    };

    const prev =
      this.states.get(raw.nodeId) ?? (await this.restore(raw.nodeId));
    let next: EkfState;
    let rejected = false;
    if (!prev) {
      next = initState(m);
    } else {
      const r = step(prev, m);
      if (!r) {
        this.logger.warn(
          `late packet ${raw.nodeId}@${raw.recordedAt.toISOString()} not filtered`,
        );
        return null;
      }
      next = r.state;
      rejected = r.rejected;
    }
    this.states.set(raw.nodeId, next);

    return this.db.getRepository(ReadingFiltered).save({
      rawId: raw.id,
      nodeId: raw.nodeId,
      recordedAt: raw.recordedAt,
      waterDepthCm: round(next.x[0]),
      rateCmPerMin: round(next.x[1], 4),
      variance: round(next.P[0], 4),
      covariance: next.P.map((v) => round(v, 6)),
      rejected,
    });
  }

  private async restore(nodeId: string): Promise<EkfState | undefined> {
    const last = await this.db.getRepository(ReadingFiltered).findOne({
      where: { nodeId },
      order: { recordedAt: 'DESC' },
    });
    if (!last?.covariance || last.covariance.length !== 4) return undefined;
    const [a, b, c, d] = last.covariance;
    return {
      x: [last.waterDepthCm, last.rateCmPerMin ?? 0],
      P: [a, b, c, d],
      t: last.recordedAt.getTime(),
      gateStreak: 0,
    };
  }
}

function round(x: number, d = 2): number {
  const f = 10 ** d;
  return Math.round(x * f) / f;
}
