import { AlertTier as T } from '../database/enums';
import {
  autoSmsText,
  maskPhone,
  normalizePhMobile,
  shouldAutoSms,
  smsInfo,
  withinRadius,
} from './sms-rules';

describe('Philippine mobile numbers', () => {
  it.each([
    ['09171234567', '+639171234567'],
    ['0917 123 4567', '+639171234567'],
    ['+63 917-123-4567', '+639171234567'],
    ['639171234567', '+639171234567'],
    ['9171234567', '+639171234567'],
  ])('%s → %s', (raw, e164) => expect(normalizePhMobile(raw)).toBe(e164));

  it.each(['0217123456', '+1 917 123 4567', '0917123456', 'hello', ''])(
    'rejects %s',
    (raw) => expect(normalizePhMobile(raw)).toBeNull(),
  );

  it('masks numbers for officer screens', () => {
    expect(maskPhone('+639171234567')).toBe('+63917•••4567');
  });
});

describe('SMS length', () => {
  it('counts GSM-7 text: 160 in one, then 153 per part', () => {
    expect(smsInfo('a'.repeat(160))).toMatchObject({
      encoding: 'gsm7',
      segments: 1,
    });
    expect(smsInfo('a'.repeat(161))).toMatchObject({ segments: 2 });
    expect(smsInfo('a'.repeat(306))).toMatchObject({ segments: 2 });
    expect(smsInfo('a'.repeat(307))).toMatchObject({ segments: 3 });
  });

  it('flags characters that force the expensive 70-char encoding', () => {
    const r = smsInfo('Evacuate now — go to the gym');
    expect(r.encoding).toBe('ucs2');
    expect(r.nonGsm).toEqual(['—']);
    expect(smsInfo('x'.repeat(71)).segments).toBe(1);
    expect(smsInfo('—'.repeat(71)).segments).toBe(2);
  });
});

describe('automatic SMS', () => {
  it('only on escalation into Warning or Critical', () => {
    expect(shouldAutoSms(T.WARNING, T.WATCH)).toBe(true);
    expect(shouldAutoSms(T.CRITICAL, T.WARNING)).toBe(true);
    expect(shouldAutoSms(T.CRITICAL, null)).toBe(true);
    expect(shouldAutoSms(T.WATCH, T.ADVISORY)).toBe(false); // app only
    expect(shouldAutoSms(T.WARNING, T.CRITICAL)).toBe(false); // receding
    expect(shouldAutoSms(T.SAFE, T.WATCH)).toBe(false);
  });

  it('every template fits one GSM-7 SMS, even with a long place name', () => {
    const long =
      'Placeholder Centre and a very long barangay name, Santo Rosario poblacion area';
    for (const tier of [T.WARNING, T.CRITICAL] as const) {
      for (const locale of ['en', 'fil'] as const) {
        for (const place of ['Caingin', long, 'Sto. Niño']) {
          const text = autoSmsText(tier, locale, place, 152.4);
          const info = smsInfo(text);
          expect(info.encoding).toBe('gsm7');
          expect(info.segments).toBe(1);
          expect(text.startsWith('AGOS')).toBe(true); // never "TEST…" (dropped by the gateway)
          expect(text).toContain('152cm');
        }
      }
    }
  });
});

describe('recipients', () => {
  const at = { lat: 14.846, lng: 120.8125 };
  const people = [
    { phone: 'near', locale: 'fil' as const, lat: 14.85, lng: 120.815 },
    { phone: 'far', locale: 'fil' as const, lat: 14.9, lng: 120.9 },
    { phone: 'unknown', locale: 'en' as const, lat: null, lng: null },
  ];

  it('radius with unlocated people included by default', () => {
    expect(withinRadius(at, 3000, people).map((p) => p.phone)).toEqual([
      'near',
      'unknown',
    ]);
  });

  it('can exclude unlocated people (targeted broadcasts)', () => {
    expect(withinRadius(at, 3000, people, false).map((p) => p.phone)).toEqual([
      'near',
    ]);
  });

  it('no point = everyone', () => {
    expect(withinRadius(null, 3000, people)).toHaveLength(3);
  });
});
