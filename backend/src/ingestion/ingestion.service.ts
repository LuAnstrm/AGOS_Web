import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ReadingRaw, SensorNode } from '../database/entities';
import { PipelineService } from '../pipeline/pipeline.service';
import { CreateReadingDto } from './dto/create-reading.dto';

export type IngestResult =
  | { status: 'accepted'; readingId: string; nodeId: string }
  | { status: 'duplicate'; nodeId: string };

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly pipeline: PipelineService,
  ) {}

  /**
   * Stores a raw reading, then hands it to the processing pipeline
   * (filter → ML → alerts) without making the sender wait for it.
   *
   * A packet with the same (nodeId, timestamp) as one already stored — i.e.
   * the same reading delivered on a second channel during failover — is
   * reported as a duplicate and not stored or processed again.
   *
   * Unknown node IDs are registered on first contact so simulated nodes need
   * no seeding; their location comes from the packet's GPS fix.
   */
  async ingest(dto: CreateReadingDto): Promise<IngestResult> {
    const recordedAt = new Date(dto.timestamp);
    const values = {
      nodeId: dto.nodeId,
      recordedAt,
      waterDepthCm: dto.waterDepthCm,
      tiltDeg: dto.imu?.tiltDeg ?? null,
      vibrationG: dto.imu?.vibrationG ?? null,
      temperatureC: dto.temperatureC ?? null,
      lat: dto.gps?.lat ?? null,
      lng: dto.gps?.lng ?? null,
      batteryPct: dto.power?.batteryPct ?? null,
      solarChargePct: dto.power?.solarChargePct ?? null,
      channel: dto.channel,
    };

    const inserted = await this.db.transaction(async (em) => {
      await em
        .createQueryBuilder()
        .insert()
        .into(SensorNode)
        .values({
          id: dto.nodeId,
          lat: dto.gps?.lat ?? null,
          lng: dto.gps?.lng ?? null,
          lastSeenAt: recordedAt,
        })
        .orUpdate(['lastSeenAt'], ['id'], {
          skipUpdateIfNoValuesChanged: true,
        })
        .execute();

      const result = await em
        .createQueryBuilder()
        .insert()
        .into(ReadingRaw)
        .values(values)
        .orIgnore()
        .returning(['id', 'receivedAt'])
        .execute();
      const rows = result.raw as Array<{ id: string; receivedAt: Date }>;
      return rows[0];
    });

    if (!inserted) {
      this.logger.debug(
        `duplicate ${dto.nodeId}@${dto.timestamp} via ${dto.channel}`,
      );
      return { status: 'duplicate', nodeId: dto.nodeId };
    }

    const raw = Object.assign(new ReadingRaw(), values, {
      id: String(inserted.id),
      receivedAt: new Date(inserted.receivedAt),
    });
    this.pipeline.enqueue(raw);
    return { status: 'accepted', readingId: raw.id, nodeId: dto.nodeId };
  }

  async latest(
    nodeId: string | undefined,
    limit: number,
  ): Promise<ReadingRaw[]> {
    return this.db.getRepository(ReadingRaw).find({
      where: nodeId ? { nodeId } : {},
      order: { recordedAt: 'DESC' },
      take: limit,
    });
  }
}
