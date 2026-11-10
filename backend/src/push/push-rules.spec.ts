import {
  buildBatches,
  EXPO_TOKEN,
  Recipient,
  selectRecipients,
} from './push-rules';

const sensor = { lat: 14.846, lng: 120.8125 };
const phone = (
  token: string,
  lat: number | null,
  lng: number | null,
  locale: 'en' | 'fil' = 'fil',
): Recipient => ({ token, lat, lng, locale });

const alert = {
  id: '42',
  nodeId: 'MAL-CAINGIN-01',
  tierLabelEn: 'Critical',
  tierLabelFil: 'Kritikal',
  messageEn: 'CRITICAL: evacuate',
  messageFil: 'KRITIKAL: lumikas',
};

describe('push targeting', () => {
  it('selects phones within 3 km, and phones with no location', () => {
    const near = phone('near', 14.85, 120.815); // ~0.5 km
    const far = phone('far', 14.9, 120.9); // ~11 km
    const unknown = phone('unknown', null, null);
    expect(
      selectRecipients(sensor, [near, far, unknown]).map((p) => p.token),
    ).toEqual(['near', 'unknown']);
  });

  it('a sensor without coordinates alerts everyone', () => {
    const all = [phone('a', 14.9, 120.9), phone('b', 14.8, 120.8)];
    expect(selectRecipients({ lat: null, lng: null }, all)).toHaveLength(2);
  });
});

describe('push messages', () => {
  it("are written in each phone's language", () => {
    const [batch] = buildBatches(alert, [
      phone('ExponentPushToken[aaaaaaaaaaaa]', 1, 1, 'en'),
      phone('ExponentPushToken[bbbbbbbbbbbb]', 1, 1, 'fil'),
    ]);
    expect(batch[0]).toMatchObject({
      title: 'AGOS · Critical',
      body: 'CRITICAL: evacuate',
      channelId: 'flood-alerts',
      priority: 'high',
      data: { alertId: '42', nodeId: 'MAL-CAINGIN-01' },
    });
    expect(batch[1]).toMatchObject({
      title: 'AGOS · Kritikal',
      body: 'KRITIKAL: lumikas',
    });
  });

  it('are batched 100 per request', () => {
    const many = Array.from({ length: 250 }, (_, i) =>
      phone(`t${i}`, null, null),
    );
    expect(buildBatches(alert, many).map((b) => b.length)).toEqual([
      100, 100, 50,
    ]);
  });

  it('only accepts real Expo token shapes', () => {
    expect(EXPO_TOKEN.test('ExponentPushToken[abcDEF123_-xyz]')).toBe(true);
    expect(EXPO_TOKEN.test('ExpoPushToken[abcDEF123_-xyz]')).toBe(true);
    expect(EXPO_TOKEN.test('https://evil.example/hook')).toBe(false);
    expect(EXPO_TOKEN.test('ExponentPushToken[]')).toBe(false);
  });
});
