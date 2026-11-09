import { Injectable, Logger } from '@nestjs/common';
import { ReadingRaw } from '../database/entities';
import { FilteringService } from '../filtering/filtering.service';
import { MlService } from '../ml/ml.service';

/**
 * Processes each accepted raw reading: EKF → ML (→ alerts + realtime push in
 * step 4). Readings for the same node run strictly in order so filter state
 * stays consistent; different nodes run concurrently.
 */
@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);
  private readonly chains = new Map<string, Promise<void>>();

  constructor(
    private readonly filtering: FilteringService,
    private readonly ml: MlService,
  ) {}

  enqueue(raw: ReadingRaw): void {
    const prev = this.chains.get(raw.nodeId) ?? Promise.resolve();
    const next = prev
      .then(() => this.run(raw))
      .catch((e: unknown) =>
        this.logger.error(
          `pipeline failed for ${raw.nodeId} reading ${raw.id}`,
          e instanceof Error ? e.stack : String(e),
        ),
      );
    this.chains.set(raw.nodeId, next);
    void next.finally(() => {
      if (this.chains.get(raw.nodeId) === next) this.chains.delete(raw.nodeId);
    });
  }

  /** Resolves once every queued reading has been processed (tests, shutdown). */
  async drain(): Promise<void> {
    while (this.chains.size) await Promise.all([...this.chains.values()]);
  }

  private async run(raw: ReadingRaw): Promise<void> {
    const filtered = await this.filtering.process(raw);
    if (!filtered) return;
    const { classification, forecast } = await this.ml.infer(filtered);
    // Step 4: alerts module maps (classification, forecast) → five-tier alert,
    // realtime gateway pushes to clients.
    const ms = Date.now() - raw.receivedAt.getTime();
    this.logger.debug(
      `${raw.nodeId} ${filtered.waterDepthCm}cm` +
        (filtered.rejected ? ' (outlier rejected)' : '') +
        ` risk=${classification?.riskClass ?? '-'} h1=${forecast?.h1Cm ?? '-'} ${ms}ms`,
    );
  }
}
