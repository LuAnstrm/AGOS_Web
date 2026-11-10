import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
  Alert,
  SensorNode,
  SmsBroadcast,
  SmsMessage,
  SmsSubscriber,
} from '../database/entities';
import { AlertTier } from '../database/enums';
import {
  AUTO_COOLDOWN_MS,
  autoSmsText,
  maskPhone,
  normalizePhMobile,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_HOUR,
  OTP_TTL_MS,
  shouldAutoSms,
  smsInfo,
  withinRadius,
} from './sms-rules';
import {
  ConsoleSmsDriver,
  SemaphoreSmsDriver,
  SendResult,
  SmsDriver,
} from './sms.driver';

const AUTO_RADIUS_M = 3000;

const OTP_TEXT = {
  en: 'AGOS: Your code is {otp}. It expires in 10 minutes. Do not share it with anyone.',
  fil: 'AGOS: Ang iyong code ay {otp}. Mag-e-expire ito sa loob ng 10 minuto. Huwag itong ibigay sa iba.',
};

export type Audience =
  | { kind: 'all' }
  | {
      kind: 'near';
      nodeId: string;
      radiusM: number;
      includeUnlocated: boolean;
    };

export interface Officer {
  id: string;
  displayName: string;
}

@Injectable()
export class SmsService {
  private readonly log = new Logger(SmsService.name);
  private readonly driver: SmsDriver;
  private readonly otpSecret: string;
  /** node:tier → last automatic send, for the 30-minute cooldown. */
  private readonly lastAuto = new Map<string, number>();

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    config: ConfigService,
  ) {
    const kind = config.get<string>('SMS_DRIVER', 'console');
    if (kind === 'semaphore') {
      const key = config.get<string>('SEMAPHORE_API_KEY');
      if (!key) throw new Error('SMS_DRIVER=semaphore needs SEMAPHORE_API_KEY');
      this.driver = new SemaphoreSmsDriver(
        key,
        config.get<string>('SEMAPHORE_SENDER'),
      );
    } else {
      this.driver = new ConsoleSmsDriver();
      if (config.get<string>('NODE_ENV') === 'production') {
        this.log.warn(
          'SMS_DRIVER=console in production: NO SMS will actually be sent',
        );
      }
    }
    this.otpSecret = config.get<string>('JWT_SECRET') ?? 'agos-dev-otp-secret';
  }

  get driverName() {
    return this.driver.name;
  }

  // ---------------------------------------------------------------- sign-up

  /**
   * Sends a one-time code to confirm sign-up or opt-out. The answer is the
   * same whether or not the number is subscribed, so it can't be used to
   * discover who is.
   */
  async requestCode(input: {
    phone: string;
    purpose: 'subscribe' | 'unsubscribe';
    locale: 'en' | 'fil';
    consent?: boolean;
    lat?: number;
    lng?: number;
    userId: string | null;
  }) {
    const phone = this.normalize(input.phone);
    if (input.purpose === 'subscribe' && !input.consent) {
      throw new BadRequestException(
        'consent is required to receive SMS alerts',
      );
    }
    const repo = this.db.getRepository(SmsSubscriber);
    let row = await repo.findOneBy({ phone });
    if (!row && input.purpose === 'unsubscribe') return { sent: true };

    row ??= repo.create({
      phone,
      active: false,
      source: 'app',
      otpSentInWindow: 0,
    });
    const now = Date.now();
    if (!row.otpWindowStart || now - row.otpWindowStart.getTime() > 3600_000) {
      row.otpWindowStart = new Date(now);
      row.otpSentInWindow = 0;
    }
    if (row.otpSentInWindow >= OTP_MAX_PER_HOUR) {
      throw new HttpException(
        'too many codes requested; try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    row.otpHash = this.hash(phone, code);
    row.otpPurpose = input.purpose;
    row.otpExpiresAt = new Date(now + OTP_TTL_MS);
    row.otpAttempts = 0;
    row.otpSentInWindow += 1;
    if (input.purpose === 'subscribe') {
      // Held until the code is confirmed; only then does the number go active.
      row.locale = input.locale;
      row.lat = input.lat ?? null;
      row.lng = input.lng ?? null;
      row.userId = input.userId ?? row.userId ?? null;
    }
    await repo.save(row);

    const r = await this.driver.sendOtp(phone, OTP_TEXT[input.locale], code);
    await this.record(
      'otp',
      [r],
      OTP_TEXT[input.locale].replace('{otp}', '******'),
    );
    return { sent: true, expiresInSec: OTP_TTL_MS / 1000 };
  }

  async verifyCode(phoneRaw: string, code: string) {
    const phone = this.normalize(phoneRaw);
    const repo = this.db.getRepository(SmsSubscriber);
    const row = await repo.findOneBy({ phone });
    const fail = () => new BadRequestException('wrong or expired code');
    if (!row?.otpHash || !row.otpExpiresAt || !row.otpPurpose) throw fail();
    if (
      row.otpExpiresAt.getTime() < Date.now() ||
      row.otpAttempts >= OTP_MAX_ATTEMPTS
    ) {
      throw fail();
    }
    const ok = this.safeEqual(row.otpHash, this.hash(phone, code));
    if (!ok) {
      row.otpAttempts += 1;
      await repo.save(row);
      throw fail();
    }

    if (row.otpPurpose === 'unsubscribe') {
      // Data minimisation: opting out removes the number entirely.
      await repo.delete({ phone });
      return { phone: maskPhone(phone), active: false };
    }
    row.active = true;
    row.consentAt = new Date();
    row.otpHash = null;
    row.otpPurpose = null;
    row.otpExpiresAt = null;
    row.otpAttempts = 0;
    await repo.save(row);
    return { phone: maskPhone(phone), active: true };
  }

  // ------------------------------------------------------- officer registry

  /** In-person registration (e.g. a barangay drive), consent confirmed by the officer. */
  async officerAdd(
    input: {
      phone: string;
      locale: 'en' | 'fil';
      barangay?: string;
      lat?: number;
      lng?: number;
    },
    officer: Officer,
  ) {
    const phone = this.normalize(input.phone);
    await this.db.getRepository(SmsSubscriber).save({
      phone,
      locale: input.locale,
      barangay: input.barangay ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      active: true,
      source: 'officer',
      consentAt: new Date(),
      addedBy: officer.displayName,
    });
    return { phone: maskPhone(phone), active: true };
  }

  async officerRemove(phoneRaw: string) {
    const phone = this.normalize(phoneRaw);
    const r = await this.db.getRepository(SmsSubscriber).delete({ phone });
    if (!r.affected) throw new NotFoundException('not subscribed');
  }

  async summary() {
    const rows = await this.db.getRepository(SmsSubscriber).find({
      where: { active: true },
      select: { locale: true, source: true, lat: true },
    });
    return {
      driver: this.driver.name,
      active: rows.length,
      fil: rows.filter((r) => r.locale === 'fil').length,
      en: rows.filter((r) => r.locale === 'en').length,
      viaApp: rows.filter((r) => r.source === 'app').length,
      viaOfficer: rows.filter((r) => r.source === 'officer').length,
      withoutLocation: rows.filter((r) => r.lat == null).length,
    };
  }

  // ------------------------------------------------------------- automatic

  /** Called for every new alert; texts nearby subscribers on escalation to Warning/Critical. */
  async autoAlert(alert: Alert, depthCm: number): Promise<number> {
    if (!shouldAutoSms(alert.tier, alert.previousTier)) return 0;
    const key = `${alert.nodeId}:${alert.tier}`;
    const last = this.lastAuto.get(key);
    if (last && Date.now() - last < AUTO_COOLDOWN_MS) return 0;
    this.lastAuto.set(key, Date.now());

    const node = await this.db
      .getRepository(SensorNode)
      .findOneBy({ id: alert.nodeId });
    const at =
      node?.lat != null && node.lng != null
        ? { lat: node.lat, lng: node.lng }
        : null;
    const people = withinRadius(
      at,
      AUTO_RADIUS_M,
      await this.activeSubscribers(),
    );
    if (!people.length) return 0;

    const place = node?.barangay ?? node?.name ?? alert.nodeId;
    const tier = alert.tier as AlertTier.WARNING | AlertTier.CRITICAL;
    let sent = 0;
    for (const locale of ['fil', 'en'] as const) {
      const phones = people
        .filter((p) => p.locale === locale)
        .map((p) => p.phone);
      if (!phones.length) continue;
      const text = autoSmsText(tier, locale, place, depthCm);
      const results = await this.driver.send(phones, text, true);
      await this.record('auto', results, text, { alertId: alert.id });
      sent += results.filter((r) => r.status !== 'failed').length;
    }
    this.log.log(
      `auto SMS for ${alert.nodeId} ${alert.tier}: ${sent}/${people.length}`,
    );
    return sent;
  }

  // ------------------------------------------------------------- broadcasts

  async preview(audience: Audience, messageEn: string, messageFil: string) {
    const people = await this.audience(audience);
    const en = smsInfo(messageEn);
    const fil = smsInfo(messageFil);
    const enCount = people.filter((p) => p.locale === 'en').length;
    const filCount = people.length - enCount;
    return {
      recipients: people.length,
      en: { recipients: enCount, ...en },
      fil: { recipients: filCount, ...fil },
      totalSegments: enCount * en.segments + filCount * fil.segments,
      driver: this.driver.name,
    };
  }

  async broadcast(
    input: {
      audience: Audience;
      messageEn: string;
      messageFil: string;
      confirmRecipients: number;
    },
    officer: Officer,
  ) {
    const p = await this.preview(
      input.audience,
      input.messageEn,
      input.messageFil,
    );
    if (p.recipients !== input.confirmRecipients) {
      throw new ConflictException(
        `the audience changed: it is now ${p.recipients} people, not ${input.confirmRecipients}. Preview again.`,
      );
    }
    if (p.recipients === 0)
      throw new BadRequestException('no subscribers in this audience');

    const people = await this.audience(input.audience);
    const b = await this.db.getRepository(SmsBroadcast).save({
      audience: input.audience,
      messageEn: input.messageEn,
      messageFil: input.messageFil,
      recipients: p.recipients,
      segments: p.totalSegments,
      createdBy: officer.displayName,
      createdByUserId: officer.id,
    });
    let failed = 0;
    for (const locale of ['fil', 'en'] as const) {
      const phones = people
        .filter((x) => x.locale === locale)
        .map((x) => x.phone);
      if (!phones.length) continue;
      const text = locale === 'en' ? input.messageEn : input.messageFil;
      const results = await this.driver.send(phones, text, false);
      await this.record('broadcast', results, text, { broadcastId: b.id });
      failed += results.filter((r) => r.status === 'failed').length;
    }
    b.failed = failed;
    await this.db.getRepository(SmsBroadcast).save(b);
    return b;
  }

  broadcasts(limit = 20) {
    return this.db
      .getRepository(SmsBroadcast)
      .find({ order: { createdAt: 'DESC' }, take: limit });
  }

  /** Recent outbox, numbers masked. */
  async messages(limit = 50) {
    const rows = await this.db
      .getRepository(SmsMessage)
      .find({ order: { createdAt: 'DESC' }, take: limit });
    return rows.map((m) => ({ ...m, phone: maskPhone(m.phone) }));
  }

  // ---------------------------------------------------------------- helpers

  private async audience(a: Audience) {
    const people = await this.activeSubscribers();
    if (a.kind === 'all') return people;
    const node = await this.db
      .getRepository(SensorNode)
      .findOneBy({ id: a.nodeId });
    if (!node || node.lat == null || node.lng == null) {
      throw new BadRequestException(`sensor ${a.nodeId} has no location`);
    }
    return withinRadius(
      { lat: node.lat, lng: node.lng },
      a.radiusM,
      people,
      a.includeUnlocated,
    );
  }

  private activeSubscribers() {
    return this.db.getRepository(SmsSubscriber).find({
      where: { active: true },
      select: { phone: true, locale: true, lat: true, lng: true },
    });
  }

  private async record(
    kind: SmsMessage['kind'],
    results: SendResult[],
    body: string,
    link: { alertId?: string; broadcastId?: string } = {},
  ) {
    if (!results.length) return;
    await this.db.getRepository(SmsMessage).insert(
      results.map((r) => ({
        kind,
        phone: r.phone,
        body,
        status: r.status,
        providerId: r.providerId,
        error: r.error,
        alertId: link.alertId ?? null,
        broadcastId: link.broadcastId ?? null,
      })),
    );
  }

  private normalize(raw: string) {
    const phone = normalizePhMobile(raw);
    if (!phone)
      throw new BadRequestException(
        'enter a Philippine mobile number, e.g. 0917 123 4567',
      );
    return phone;
  }

  private hash(phone: string, code: string) {
    return createHmac('sha256', this.otpSecret)
      .update(`${phone}:${code}`)
      .digest('hex');
  }

  private safeEqual(a: string, b: string) {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
  }
}
