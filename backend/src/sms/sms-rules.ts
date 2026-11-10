import { AlertTier } from '../database/enums';
import { haversineM } from '../sos/sos-status';

/** Philippine mobile number → E.164 (+639XXXXXXXXX), or null if not one. */
export function normalizePhMobile(input: string): string | null {
  const digits = input.replace(/[\s()-]/g, '');
  const m =
    /^(?:\+?63|0)?(9\d{9})$/.exec(digits) ?? /^(?:\+?63)(9\d{9})$/.exec(digits);
  return m ? `+63${m[1]}` : null;
}

/** For officers' screens: +63917•••4567. */
export const maskPhone = (e164: string) =>
  e164.length > 8 ? `${e164.slice(0, 6)}•••${e164.slice(-4)}` : '•••';

/** Semaphore wants 639XXXXXXXXX. */
export const toProviderNumber = (e164: string) => e164.replace(/^\+/, '');

// --- message length -------------------------------------------------------

const GSM7 =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM7_EXT = '^{}\\[~]|€';

/**
 * How many SMS a text will be billed as. GSM-7 text: 160 chars in one SMS,
 * 153 per part when split. Any other character (e.g. "—", curly quotes,
 * emoji) forces UCS-2: 70 / 67. Extended GSM chars count double.
 */
export function smsInfo(text: string): {
  encoding: 'gsm7' | 'ucs2';
  length: number;
  segments: number;
  nonGsm: string[];
} {
  const nonGsm = [
    ...new Set(
      [...text].filter((ch) => !GSM7.includes(ch) && !GSM7_EXT.includes(ch)),
    ),
  ];
  if (nonGsm.length) {
    const length = [...text].length;
    return {
      encoding: 'ucs2',
      length,
      segments: length <= 70 ? 1 : Math.ceil(length / 67),
      nonGsm,
    };
  }
  const length = [...text].reduce(
    (n, ch) => n + (GSM7_EXT.includes(ch) ? 2 : 1),
    0,
  );
  return {
    encoding: 'gsm7',
    length,
    segments: length <= 160 ? 1 : Math.ceil(length / 153),
    nonGsm,
  };
}

// --- automatic alerts ------------------------------------------------------

const RANK: Record<AlertTier, number> = {
  [AlertTier.SAFE]: 0,
  [AlertTier.ADVISORY]: 1,
  [AlertTier.WATCH]: 2,
  [AlertTier.WARNING]: 3,
  [AlertTier.CRITICAL]: 4,
};
export const AUTO_SMS_TIERS: readonly AlertTier[] = [
  AlertTier.WARNING,
  AlertTier.CRITICAL,
];

/**
 * Automatic SMS only when a sensor ESCALATES into Warning or Critical — not
 * on de-escalation, and not for lower tiers (those go to the app only), so
 * people without the app get the alerts that matter without being spammed.
 */
export function shouldAutoSms(
  tier: AlertTier,
  previous: AlertTier | null,
): boolean {
  return (
    AUTO_SMS_TIERS.includes(tier) &&
    (previous == null || RANK[tier] > RANK[previous])
  );
}

/** Re-sending the same sensor + tier within this window is suppressed. */
export const AUTO_COOLDOWN_MS = 30 * 60_000;

/**
 * One-SMS alert text (≤160 GSM-7 chars), ASCII only so it never switches to
 * the 70-char UCS-2 encoding. DRAFT wording — review with the CDRRMO.
 */
export function autoSmsText(
  tier: AlertTier.WARNING | AlertTier.CRITICAL,
  locale: 'en' | 'fil',
  place: string,
  depthCm: number,
): string {
  const d = Math.round(depthCm);
  const t = {
    en: {
      [AlertTier.WARNING]: (p: string) =>
        `AGOS WARNING: Dangerous flooding at ${p} (${d}cm). Prepare to evacuate. Follow your barangay and CDRRMO.`,
      [AlertTier.CRITICAL]: (p: string) =>
        `AGOS CRITICAL: Severe flooding at ${p} (${d}cm). Evacuate now to higher ground. Call 911 if trapped.`,
    },
    fil: {
      [AlertTier.WARNING]: (p: string) =>
        `AGOS BABALA: Mapanganib na baha sa ${p} (${d}cm). Maghanda sa paglikas. Sundin ang barangay at CDRRMO.`,
      [AlertTier.CRITICAL]: (p: string) =>
        `AGOS KRITIKAL: Matinding baha sa ${p} (${d}cm). Lumikas na sa mataas na lugar. Tumawag sa 911 kung naiipit.`,
    },
  }[locale][tier];
  // Shorten the place name if needed to stay within one SMS.
  const ascii = place.normalize('NFKD').replace(/[^\x20-\x7e]/g, '');
  if (t(ascii).length <= 160) return t(ascii);
  // Too long: cut the place name and mark the cut with "." (counted too).
  let p = ascii;
  while (p.length > 3 && t(`${p.trimEnd()}.`).length > 160) p = p.slice(0, -1);
  return t(`${p.trimEnd()}.`);
}

// --- recipients ------------------------------------------------------------

export interface SmsRecipient {
  phone: string;
  locale: 'en' | 'fil';
  lat: number | null;
  lng: number | null;
}

/** Same reach as push: within radius of the point; no-location = included. */
export function withinRadius<T extends SmsRecipient>(
  at: { lat: number; lng: number } | null,
  radiusM: number,
  people: T[],
  includeUnlocated = true,
): T[] {
  if (!at) return people;
  return people.filter((p) =>
    p.lat == null || p.lng == null
      ? includeUnlocated
      : haversineM(at, { lat: p.lat, lng: p.lng }) <= radiusM,
  );
}

export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_PER_HOUR = 3;
