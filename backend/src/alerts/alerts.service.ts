import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  Alert,
  Classification,
  Forecast,
  ReadingFiltered,
  SensorNode,
} from '../database/entities';
import { AlertTier } from '../database/enums';
import {
  decide,
  DEFAULT_POLICY,
  initialPolicyState,
  PolicyState,
} from './alert-policy';
import { renderMessages } from './messages';

export interface AlertOutcome {
  /** Node's published tier after this reading. */
  tier: AlertTier;
  /** Written only when the tier changed. */
  alert: Alert | null;
  rising: boolean;
}

/**
 * Applies the five-tier policy per node and records tier changes. Policy
 * state is kept in memory; after a restart it resumes from the node's stored
 * current tier (hold timers and calm counters start fresh).
 *
 * Callers must process one node's readings sequentially (PipelineService does).
 */
@Injectable()
export class AlertsService {
  private readonly states = new Map<string, PolicyState>();

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async evaluate(
    filtered: ReadingFiltered,
    classification: Classification | null,
    forecast: Forecast | null,
  ): Promise<AlertOutcome> {
    const node = await this.db
      .getRepository(SensorNode)
      .findOneBy({ id: filtered.nodeId });
    const prev =
      this.states.get(filtered.nodeId) ??
      initialPolicyState(node?.currentTier ?? AlertTier.SAFE);

    // Without a classification there is nothing to decide on: hold the tier.
    if (!classification) {
      this.states.set(filtered.nodeId, prev);
      return { tier: prev.tier, alert: null, rising: false };
    }

    const d = decide(
      prev,
      {
        t: filtered.recordedAt.getTime(),
        riskClass: classification.riskClass,
        depthCm: filtered.waterDepthCm,
        h1Cm: forecast?.h1Cm ?? null,
      },
      DEFAULT_POLICY,
    );
    this.states.set(filtered.nodeId, d.state);
    if (!d.changedFrom)
      return { tier: d.state.tier, alert: null, rising: d.rising };

    const place =
      [node?.name, node?.barangay].filter(Boolean).join(', ') ||
      filtered.nodeId;
    const msg = renderMessages({
      tier: d.state.tier,
      previousTier: d.changedFrom,
      place,
      depthCm: filtered.waterDepthCm,
      rising: d.rising,
    });

    const alert = await this.db.transaction(async (em) => {
      const saved = await em.getRepository(Alert).save({
        nodeId: filtered.nodeId,
        tier: d.state.tier,
        previousTier: d.changedFrom,
        filteredId: filtered.id,
        messageEn: msg.en,
        messageFil: msg.fil,
      });
      await em
        .getRepository(SensorNode)
        .update({ id: filtered.nodeId }, { currentTier: d.state.tier });
      return saved;
    });
    return { tier: d.state.tier, alert, rising: d.rising };
  }

  recent(nodeId: string | undefined, limit: number): Promise<Alert[]> {
    return this.db.getRepository(Alert).find({
      where: nodeId ? { nodeId } : {},
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
