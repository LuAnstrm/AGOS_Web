import { haversineM } from '../sos/sos-status';

/** Phones within this distance of the alerting sensor get the push. */
export const PUSH_RADIUS_M = 3000;
/** Expo accepts up to 100 messages per request. */
export const EXPO_BATCH = 100;

export const EXPO_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$/;

export interface Recipient {
  token: string;
  locale: 'en' | 'fil';
  lat: number | null;
  lng: number | null;
}

export interface AlertForPush {
  id: string;
  nodeId: string;
  tierLabelEn: string;
  tierLabelFil: string;
  messageEn: string;
  messageFil: string;
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  priority: 'high';
  channelId: 'flood-alerts';
  data: { alertId: string; nodeId: string };
}

/**
 * Who gets an alert: phones within PUSH_RADIUS_M of the sensor. Phones that
 * never shared a location get every alert (better to over-warn than miss).
 */
export function selectRecipients(
  sensor: { lat: number | null; lng: number | null },
  phones: Recipient[],
): Recipient[] {
  if (sensor.lat == null || sensor.lng == null) return phones;
  const at = { lat: sensor.lat, lng: sensor.lng };
  return phones.filter(
    (p) =>
      p.lat == null ||
      p.lng == null ||
      haversineM(at, { lat: p.lat, lng: p.lng }) <= PUSH_RADIUS_M,
  );
}

/** One message per phone, in that phone's language, batched for Expo. */
export function buildBatches(
  alert: AlertForPush,
  phones: Recipient[],
): ExpoMessage[][] {
  const msgs: ExpoMessage[] = phones.map((p) => ({
    to: p.token,
    title: `AGOS · ${p.locale === 'en' ? alert.tierLabelEn : alert.tierLabelFil}`,
    body: p.locale === 'en' ? alert.messageEn : alert.messageFil,
    sound: 'default',
    priority: 'high',
    channelId: 'flood-alerts',
    data: { alertId: alert.id, nodeId: alert.nodeId },
  }));
  const out: ExpoMessage[][] = [];
  for (let i = 0; i < msgs.length; i += EXPO_BATCH)
    out.push(msgs.slice(i, i + EXPO_BATCH));
  return out;
}
