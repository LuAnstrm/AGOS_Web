import { Logger } from '@nestjs/common';
import { toProviderNumber } from './sms-rules';

export interface SendResult {
  phone: string;
  status: 'queued' | 'sent' | 'failed' | 'simulated';
  providerId: string | null;
  error: string | null;
}

/** An SMS gateway. Numbers are E.164 (+639…). */
export interface SmsDriver {
  readonly name: string;
  /** Same text to many numbers. priority = time-critical route (alerts). */
  send(
    phones: string[],
    text: string,
    priority: boolean,
  ): Promise<SendResult[]>;
  /** One-time code; `text` contains "{otp}" where the code goes. */
  sendOtp(phone: string, text: string, code: string): Promise<SendResult>;
}

/**
 * Development driver: nothing leaves the machine. Messages are logged and
 * recorded in the outbox as "simulated" so the whole flow can be exercised.
 */
export class ConsoleSmsDriver implements SmsDriver {
  readonly name = 'console';
  private readonly log = new Logger('SMS(console)');

  send(phones: string[], text: string): Promise<SendResult[]> {
    this.log.log(`→ ${phones.length} number(s): ${text}`);
    return Promise.resolve(
      phones.map((phone) => ({
        phone,
        status: 'simulated' as const,
        providerId: null,
        error: null,
      })),
    );
  }

  sendOtp(phone: string, text: string, code: string): Promise<SendResult> {
    this.log.log(`→ OTP ${phone}: ${text.replace('{otp}', code)}`);
    return Promise.resolve({
      phone,
      status: 'simulated',
      providerId: null,
      error: null,
    });
  }
}

interface SemaphoreRow {
  message_id?: number | string;
  recipient?: string;
  status?: string;
}

/**
 * Semaphore (semaphore.co), a Philippine SMS gateway.
 *   alerts      → /api/v4/priority (no rate limit)
 *   broadcasts  → /api/v4/messages (≤1000 numbers per call)
 *   codes       → /api/v4/otp
 */
export class SemaphoreSmsDriver implements SmsDriver {
  readonly name = 'semaphore';
  private static readonly BASE = 'https://api.semaphore.co/api/v4';
  private static readonly BATCH = 1000;

  constructor(
    private readonly apiKey: string,
    private readonly senderName: string | undefined,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(
    phones: string[],
    text: string,
    priority: boolean,
  ): Promise<SendResult[]> {
    const out: SendResult[] = [];
    for (let i = 0; i < phones.length; i += SemaphoreSmsDriver.BATCH) {
      const batch = phones.slice(i, i + SemaphoreSmsDriver.BATCH);
      out.push(
        ...(await this.post(priority ? 'priority' : 'messages', batch, text)),
      );
    }
    return out;
  }

  async sendOtp(
    phone: string,
    text: string,
    code: string,
  ): Promise<SendResult> {
    const [r] = await this.post('otp', [phone], text, code);
    return r;
  }

  private async post(
    route: string,
    phones: string[],
    text: string,
    code?: string,
  ): Promise<SendResult[]> {
    const body = new URLSearchParams({
      apikey: this.apiKey,
      number: phones.map(toProviderNumber).join(','),
      message: text,
      ...(this.senderName ? { sendername: this.senderName } : {}),
      ...(code ? { code } : {}),
    });
    try {
      const res = await this.fetchImpl(`${SemaphoreSmsDriver.BASE}/${route}`, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        const err = `HTTP ${res.status}`;
        return phones.map((phone) => ({
          phone,
          status: 'failed',
          providerId: null,
          error: err,
        }));
      }
      const rows = (await res.json()) as SemaphoreRow[];
      const byNumber = new Map(rows.map((r) => [String(r.recipient ?? ''), r]));
      return phones.map((phone, i) => {
        // Match by number; Semaphore may echo it as 639… or 09…, so fall back
        // to position when it doesn't match.
        const n = toProviderNumber(phone);
        const r = byNumber.get(n) ?? byNumber.get(`0${n.slice(2)}`) ?? rows[i];
        const st = String(r?.status ?? '').toLowerCase();
        return {
          phone,
          status:
            st === 'failed' || st === 'refunded'
              ? 'failed'
              : st === 'sent'
                ? 'sent'
                : 'queued',
          providerId: r?.message_id != null ? String(r.message_id) : null,
          error: st === 'failed' || st === 'refunded' ? st : null,
        };
      });
    } catch (e) {
      const err = (e as Error).message;
      return phones.map((phone) => ({
        phone,
        status: 'failed',
        providerId: null,
        error: err,
      }));
    }
  }
}
