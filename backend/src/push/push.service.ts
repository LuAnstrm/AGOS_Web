import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { Alert, PushToken, SensorNode } from '../database/entities';
import { AlertTier } from '../database/enums';
import { buildBatches, ExpoMessage, selectRecipients } from './push-rules';

const LABEL: Record<AlertTier, { en: string; fil: string }> = {
  [AlertTier.SAFE]: { en: 'Safe', fil: 'Ligtas' },
  [AlertTier.ADVISORY]: { en: 'Advisory', fil: 'Abiso' },
  [AlertTier.WATCH]: { en: 'Watch', fil: 'Bantay' },
  [AlertTier.WARNING]: { en: 'Warning', fil: 'Babala' },
  [AlertTier.CRITICAL]: { en: 'Critical', fil: 'Kritikal' },
};
const NOTIFY_FROM: AlertTier[] = [
  AlertTier.WATCH,
  AlertTier.WARNING,
  AlertTier.CRITICAL,
];

interface ExpoTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

/**
 * Remote push for phones whose app is closed, via Expo's push service.
 * Live WebSocket delivery to open apps is unchanged; this is the fallback.
 * Disabled with PUSH_ENABLED=false (e.g. on an offline test bench).
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly enabled: boolean;
  private readonly endpoint: string;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    config: ConfigService,
  ) {
    this.enabled = config.get<string>('PUSH_ENABLED', 'true') !== 'false';
    this.endpoint = config.get<string>(
      'EXPO_PUSH_URL',
      'https://exp.host/--/api/v2/push/send',
    );
  }

  async register(input: {
    token: string;
    locale: 'en' | 'fil';
    lat?: number;
    lng?: number;
    userId: string | null;
  }) {
    await this.db.getRepository(PushToken).upsert(
      {
        token: input.token,
        locale: input.locale,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        userId: input.userId,
      },
      ['token'],
    );
  }

  async unregister(token: string) {
    await this.db.getRepository(PushToken).delete({ token });
  }

  /** Called for every new alert; sends only for Watch and above. */
  async notifyAlert(alert: Alert): Promise<number> {
    if (!this.enabled || !NOTIFY_FROM.includes(alert.tier)) return 0;
    const [node, phones] = await Promise.all([
      this.db.getRepository(SensorNode).findOneBy({ id: alert.nodeId }),
      this.db.getRepository(PushToken).find(),
    ]);
    const to = selectRecipients(
      { lat: node?.lat ?? null, lng: node?.lng ?? null },
      phones,
    );
    if (!to.length) return 0;

    const batches = buildBatches(
      {
        id: alert.id,
        nodeId: alert.nodeId,
        tierLabelEn: LABEL[alert.tier].en,
        tierLabelFil: LABEL[alert.tier].fil,
        messageEn: alert.messageEn,
        messageFil: alert.messageFil,
      },
      to,
    );
    let sent = 0;
    for (const batch of batches) sent += await this.send(batch);
    return sent;
  }

  private async send(batch: ExpoMessage[]): Promise<number> {
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn(`Expo push HTTP ${res.status}`);
        return 0;
      }
      const { data } = (await res.json()) as { data?: ExpoTicket[] };
      // Forget phones that uninstalled the app or revoked permission.
      const dead = (data ?? [])
        .map((t, i) =>
          t.details?.error === 'DeviceNotRegistered' ? batch[i].to : null,
        )
        .filter((t): t is string => t != null);
      if (dead.length)
        await this.db.getRepository(PushToken).delete({ token: In(dead) });
      return (data ?? []).filter((t) => t.status === 'ok').length;
    } catch (e) {
      this.logger.warn(`Expo push failed: ${(e as Error).message}`);
      return 0;
    }
  }
}
