import { Injectable, Logger } from '@nestjs/common';
import { rank } from '../alerts/alert-policy';
import { AlertsService } from '../alerts/alerts.service';
import { ReadingRaw } from '../database/entities';
import { AlertTier } from '../database/enums';
import { FilteringService } from '../filtering/filtering.service';
import { MlService } from '../ml/ml.service';
import { RealtimeService } from '../realtime/realtime.service';

/**
 * Processes each accepted raw reading:
 *   EKF → ML (classify ∥ forecast) → five-tier alert policy → realtime push.
 * Readings for the same node run strictly in order so filter and alert state
 * stay consistent; different nodes run concurrently.
 */
@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);
  private readonly chains = new Map<string, Promise<void>>();

  constructor(
    private readonly filtering: FilteringService,
    private readonly ml: MlService,
    private readonly alerts: AlertsService,
    private readonly realtime: RealtimeService,
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
    const outcome = await this.alerts.evaluate(
      filtered,
      classification,
      forecast,
    );
    const receivedAt = raw.receivedAt.toISOString();

    this.realtime.publish({
      type: 'reading',
      data: {
        nodeId: raw.nodeId,
        recordedAt: raw.recordedAt.toISOString(),
        receivedAt,
        rawCm: raw.waterDepthCm,
        filteredCm: filtered.waterDepthCm,
        rateCmPerMin: filtered.rateCmPerMin,
        rejected: filtered.rejected,
        riskClass: classification?.riskClass ?? null,
        confidence: classification?.confidence ?? null,
        forecast: forecast
          ? { h1Cm: forecast.h1Cm, h6Cm: forecast.h6Cm, h24Cm: forecast.h24Cm }
          : null,
        modelVersion:
          classification?.modelVersion ?? forecast?.modelVersion ?? null,
        tier: outcome.tier,
      },
    });

    const a = outcome.alert;
    if (a) {
      this.realtime.publish({
        type: 'alert',
        data: {
          id: a.id,
          nodeId: a.nodeId,
          tier: a.tier,
          previousTier: a.previousTier,
          messageEn: a.messageEn,
          messageFil: a.messageFil,
          createdAt: a.createdAt.toISOString(),
          receivedAt,
          notify: rank(a.tier) >= rank(AlertTier.WATCH),
        },
      });
      this.logger.log(
        `${a.nodeId}: ${a.previousTier ?? '-'} → ${a.tier} at ${filtered.waterDepthCm} cm`,
      );
    }
  }
}
