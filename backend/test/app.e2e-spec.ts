import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { ReadingFiltered } from '../src/database/entities';
import { RiskClass, UserRole } from '../src/database/enums';
import { MlService } from '../src/ml/ml.service';
import { PipelineService } from '../src/pipeline/pipeline.service';
import { SmsService } from '../src/sms/sms.service';
import { configureApp } from '../src/setup';

const DEVICE = { 'x-device-key': 'agos-dev-device-key' };

/**
 * Deterministic stand-in for the Python service: depth bands for the class,
 * and a forecast 50 cm above the current depth (i.e. always "rising").
 */
const mlStub = {
  infer: (f: ReadingFiltered) => {
    const d = f.waterDepthCm;
    const riskClass =
      d >= 90 ? RiskClass.HIGH : d >= 45 ? RiskClass.MODERATE : RiskClass.LOW;
    return Promise.resolve({
      classification: { riskClass, confidence: null, modelVersion: 'e2e-stub' },
      forecast: {
        h1Cm: d + 50,
        h6Cm: d + 50,
        h24Cm: d + 50,
        modelVersion: 'e2e-stub',
      },
    });
  },
};

describe('AGOS backend (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let officer: string;
  let citizen: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MlService)
      .useValue(mlStub)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());

    await app.get(AuthService).createUser({
      email: 'officer@e2e.test',
      password: 'officer-password-1',
      displayName: 'E2E Officer',
      role: UserRole.OFFICER,
    });
    officer = (
      await http
        .post('/auth/login')
        .send({ email: 'officer@e2e.test', password: 'officer-password-1' })
        .expect(200)
    ).body.accessToken;

    await http
      .post('/auth/register')
      .send({
        email: 'citizen@e2e.test',
        password: 'citizen-password-1',
        displayName: 'E2E Citizen',
      })
      .expect(201);
    citizen = (
      await http
        .post('/auth/login')
        .send({ email: 'citizen@e2e.test', password: 'citizen-password-1' })
        .expect(200)
    ).body.accessToken;
  });

  afterAll(async () => {
    await app.get(PipelineService).drain();
    await app.close();
  });

  describe('access control', () => {
    it('public flood data needs no sign-in', async () => {
      await http.get('/health').expect(200);
      await http.get('/nodes').expect(200);
      await http.get('/alerts').expect(200);
      await http.get('/evac/centers').expect(200);
    });

    it('ingestion is device-only', async () => {
      const body = {
        nodeId: 'E2E-AUTH',
        timestamp: new Date().toISOString(),
        waterDepthCm: 5,
        channel: 'lorawan',
      };
      await http.post('/readings').send(body).expect(401);
      await http
        .post('/readings')
        .set('authorization', `Bearer ${officer}`)
        .send(body)
        .expect(403);
      await http
        .post('/readings')
        .set({ 'x-device-key': 'wrong' })
        .send(body)
        .expect(401);
      await http.post('/readings').set(DEVICE).send(body).expect(202);
    });

    it('the SOS queue and officer stream are officer-only', async () => {
      await http.get('/sos').expect(401);
      await http
        .get('/sos')
        .set('authorization', `Bearer ${citizen}`)
        .expect(403);
      await http
        .get('/sos')
        .set('authorization', `Bearer ${officer}`)
        .expect(200);
      await http
        .get('/events')
        .set('authorization', `Bearer ${citizen}`)
        .expect(403);
    });

    it('sign-up cannot create an officer', async () => {
      await http
        .post('/auth/register')
        .send({
          email: 'sneaky@e2e.test',
          password: 'whatever-123',
          displayName: 'x',
          role: 'officer',
        })
        .expect(400);
    });
  });

  describe('ingestion → filter → ML → alert pipeline', () => {
    const t0 = Date.parse('2030-01-01T00:00:00Z');
    const reading = (i: number, depth: number, channel = 'lorawan') => ({
      nodeId: 'E2E-NODE',
      timestamp: new Date(t0 + i * 60_000).toISOString(),
      waterDepthCm: depth,
      gps: { lat: 14.846, lng: 120.8125 },
      channel,
    });

    it('stores, deduplicates failover copies, and escalates to Critical', async () => {
      await http
        .put('/nodes/E2E-NODE')
        .set(DEVICE)
        .send({ name: 'E2E node', mountHeightCm: 400 })
        .expect(200);

      // Calm, then a jump to 150 cm held for a few minutes.
      const depths = [10, 10, 11, 10, 150, 150, 151, 150];
      for (let i = 0; i < depths.length; i++) {
        const r = await http
          .post('/readings')
          .set(DEVICE)
          .send(reading(i, depths[i]))
          .expect(202);
        expect(r.body.status).toBe('accepted');
      }
      // Same reading again on a backup channel: a duplicate, not stored twice.
      const dup = await http
        .post('/readings')
        .set(DEVICE)
        .send(reading(7, 150, 'lte'))
        .expect(202);
      expect(dup.body.status).toBe('duplicate');

      await app.get(PipelineService).drain();

      const series = (
        await http.get('/nodes/E2E-NODE/series?limit=20').expect(200)
      ).body as Array<{
        filteredCm: number;
        riskClass: string;
      }>;
      expect(series).toHaveLength(8);
      expect(series.at(-1)!.filteredCm).toBeGreaterThan(130);
      // (riskClass in the series comes from stored ML rows; the stub doesn't
      // store any — the alert tier below proves the classification flowed.)

      const alerts = (await http.get('/alerts?nodeId=E2E-NODE').expect(200))
        .body as Array<{ tier: string }>;
      expect(alerts[0].tier).toBe('critical');

      const node = (await http.get('/nodes').expect(200)).body.find(
        (n: { id: string }) => n.id === 'E2E-NODE',
      );
      expect(node.currentTier).toBe('critical');
    });
  });

  describe('SOS lifecycle', () => {
    it('citizen sends, officer works it, citizen sees status only', async () => {
      const sos = {
        clientId: 'e2e-sos-000001',
        channel: 'app',
        lat: 14.846,
        lng: 120.8125,
        peopleCount: 3,
        reporterPhone: '0900 000 0000',
      };
      const created = await http
        .post('/sos')
        .set('authorization', `Bearer ${citizen}`)
        .send(sos)
        .expect(201);
      // Mesh re-delivery of the same request is a duplicate.
      const again = await http.post('/sos').set(DEVICE).send(sos).expect(200);
      expect(again.body).toMatchObject({
        id: created.body.id,
        duplicate: true,
      });

      const auth = { authorization: `Bearer ${officer}` };
      await http
        .patch(`/sos/${created.body.id}`)
        .set(auth)
        .send({ status: 'dispatched', assignedTeam: 'T1' })
        .expect(409);
      await http
        .patch(`/sos/${created.body.id}`)
        .set(auth)
        .send({ status: 'acknowledged' })
        .expect(200);
      await http
        .patch(`/sos/${created.body.id}`)
        .set(auth)
        .send({ status: 'dispatched', assignedTeam: 'Rescue 1' })
        .expect(200);

      const queue = (await http.get('/sos').set(auth).expect(200))
        .body as Array<{ id: string; shelter: unknown }>;
      expect(queue.find((r) => r.id === created.body.id)?.shelter).toBeTruthy();

      const detail = (
        await http.get(`/sos/${created.body.id}`).set(auth).expect(200)
      ).body as {
        events: Array<{ status: string; actor: string | null }>;
      };
      expect(detail.events.map((e) => e.status)).toEqual([
        'new',
        'acknowledged',
        'dispatched',
      ]);
      expect(detail.events.at(-1)!.actor).toBe('E2E Officer');

      const mine = (
        await http
          .get('/sos/mine')
          .set('authorization', `Bearer ${citizen}`)
          .expect(200)
      ).body as Array<Record<string, unknown>>;
      expect(mine).toHaveLength(1);
      expect(mine[0]).toMatchObject({
        status: 'dispatched',
        assignedTeam: 'Rescue 1',
      });
      expect(mine[0]).not.toHaveProperty('reporterPhone');
      expect(mine[0]).not.toHaveProperty('lat');
    });
  });

  describe('push registration', () => {
    it('accepts only Expo tokens, no account needed', async () => {
      await http
        .post('/push/register')
        .send({ token: 'https://evil.example/hook', locale: 'en' })
        .expect(400);
      await http
        .post('/push/register')
        .send({
          token: 'ExponentPushToken[e2eTOKEN12345]',
          locale: 'fil',
          lat: 14.85,
          lng: 120.81,
        })
        .expect(204);
      await http
        .delete('/push/register')
        .send({ token: 'ExponentPushToken[e2eTOKEN12345]' })
        .expect(204);
    });
  });

  describe('SMS alerts', () => {
    // Capture one-time codes from the development (console) driver.
    let lastCode = '';
    beforeAll(() => {
      const service: SmsService = app.get(SmsService);
      const sms = service as unknown as {
        driver: {
          sendOtp: (p: string, t: string, c: string) => Promise<unknown>;
        };
      };
      const orig = sms.driver.sendOtp.bind(sms.driver);
      sms.driver.sendOtp = (p, t, c) => {
        lastCode = c;
        return orig(p, t, c);
      };
    });
    const auth = () => ({ authorization: `Bearer ${officer}` });

    it('self sign-up needs consent and the right one-time code', async () => {
      await http
        .post('/sms/code')
        .send({ phone: '0917 555 0001', purpose: 'subscribe', locale: 'fil' })
        .expect(400);
      await http
        .post('/sms/code')
        .send({
          phone: '12345',
          purpose: 'subscribe',
          locale: 'fil',
          consent: true,
        })
        .expect(400);
      await http
        .post('/sms/code')
        .send({
          phone: '0917 555 0001',
          purpose: 'subscribe',
          locale: 'fil',
          consent: true,
          lat: 14.86,
          lng: 120.83,
        })
        .expect(200);
      const wrong = lastCode === '000000' ? '111111' : '000000';
      await http
        .post('/sms/verify')
        .send({ phone: '09175550001', code: wrong })
        .expect(400);
      const ok = await http
        .post('/sms/verify')
        .send({ phone: '+639175550001', code: lastCode })
        .expect(200);
      expect(ok.body).toEqual({ phone: '+63917•••0001', active: true });
      // A used code can't be replayed.
      await http
        .post('/sms/verify')
        .send({ phone: '09175550001', code: lastCode })
        .expect(400);
    });

    it('officers register people in person, with consent confirmed', async () => {
      const body = {
        phone: '0918 555 0002',
        locale: 'en',
        barangay: 'Caingin',
        lat: 14.8462,
        lng: 120.8127,
      };
      await http.post('/sms/subscribers').set(auth()).send(body).expect(400);
      await http
        .post('/sms/subscribers')
        .set('authorization', `Bearer ${citizen}`)
        .send({ ...body, consentConfirmed: true })
        .expect(403);
      await http
        .post('/sms/subscribers')
        .set(auth())
        .send({ ...body, consentConfirmed: true })
        .expect(201);
      const s = (await http.get('/sms/summary').set(auth()).expect(200)).body;
      expect(s).toMatchObject({
        active: 2,
        viaApp: 1,
        viaOfficer: 1,
        driver: 'console',
      });
    });

    it('broadcasts must match the previewed audience, and are audited', async () => {
      const draft = {
        audience: { kind: 'all' },
        messageEn: 'AGOS: Evacuation order for Caingin.',
        messageFil: 'AGOS: Utos ng paglikas para sa Caingin.',
      };
      await http
        .post('/sms/broadcasts/preview')
        .set('authorization', `Bearer ${citizen}`)
        .send(draft)
        .expect(403);
      const p = (
        await http
          .post('/sms/broadcasts/preview')
          .set(auth())
          .send(draft)
          .expect(200)
      ).body;
      expect(p).toMatchObject({
        recipients: 2,
        totalSegments: 2,
        en: { recipients: 1 },
        fil: { recipients: 1 },
      });

      await http
        .post('/sms/broadcasts')
        .set(auth())
        .send({ ...draft, confirmRecipients: 5 })
        .expect(409);
      const sent = (
        await http
          .post('/sms/broadcasts')
          .set(auth())
          .send({ ...draft, confirmRecipients: 2 })
          .expect(201)
      ).body;
      expect(sent).toMatchObject({
        recipients: 2,
        failed: 0,
        createdBy: 'E2E Officer',
      });

      const msgs = (await http.get('/sms/messages').set(auth()).expect(200))
        .body as Array<{ kind: string; phone: string; status: string }>;
      const bc = msgs.filter((m) => m.kind === 'broadcast');
      expect(bc).toHaveLength(2);
      expect(
        bc.every((m) => m.status === 'simulated' && m.phone.includes('•••')),
      ).toBe(true);
    });

    it('automatically texts nearby subscribers when a sensor escalates to Critical', async () => {
      await http
        .put('/nodes/E2E-SMS')
        .set(DEVICE)
        .send({
          name: 'SMS node',
          barangay: 'Caingin',
          lat: 14.8461,
          lng: 120.8126,
          mountHeightCm: 400,
        })
        .expect(200);
      const t0 = Date.parse('2031-01-01T00:00:00Z');
      for (const [i, d] of [10, 10, 150, 150].entries()) {
        await http
          .post('/readings')
          .set(DEVICE)
          .send({
            nodeId: 'E2E-SMS',
            timestamp: new Date(t0 + i * 60_000).toISOString(),
            waterDepthCm: d,
            channel: 'lorawan',
          })
          .expect(202);
      }
      await app.get(PipelineService).drain();
      // Auto SMS is fire-and-forget after the alert; give it a moment.
      let auto: Array<{ body: string }> = [];
      for (let i = 0; i < 20 && auto.length < 2; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const msgs = (await http.get('/sms/messages').set(auth()).expect(200))
          .body as Array<{ kind: string; body: string }>;
        auto = msgs.filter((m) => m.kind === 'auto');
      }
      expect(auto.length).toBe(2); // both subscribers are within 3 km
      expect(auto.map((m) => m.body.split(':')[0]).sort()).toEqual([
        'AGOS CRITICAL',
        'AGOS KRITIKAL',
      ]);
    });
  });

  describe('evacuation centres', () => {
    it('recommends open centres and lets only officers change status', async () => {
      const centres = (await http.get('/evac/centers').expect(200))
        .body as Array<{ id: string }>;
      // NODE_ENV=test is not production, so the placeholders are seeded.
      expect(centres.length).toBeGreaterThan(0);
      const id = centres[0].id;

      await http
        .patch(`/evac/centers/${id}`)
        .send({ status: 'full' })
        .expect(401);
      await http
        .patch(`/evac/centers/${id}`)
        .set('authorization', `Bearer ${citizen}`)
        .send({ status: 'full' })
        .expect(403);
      await http
        .patch(`/evac/centers/${id}`)
        .set('authorization', `Bearer ${officer}`)
        .send({ status: 'closed' })
        .expect(200);

      const recs = (
        await http
          .get('/evac/recommend?lat=14.846&lng=120.8125&limit=10')
          .expect(200)
      ).body as Array<{
        centre: { id: string };
      }>;
      expect(recs.length).toBeGreaterThan(0);
      expect(recs.some((r) => r.centre.id === id)).toBe(false);
    });
  });
});
