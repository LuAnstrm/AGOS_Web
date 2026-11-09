import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  Classification,
  Forecast,
  ReadingFiltered,
} from '../database/entities';
import { RiskClass } from '../database/enums';

/** Filtered readings sent as model input: 3 h at one uplink per minute. */
const HISTORY_POINTS = 180;

export interface HistoryPoint {
  t: string;
  depthCm: number;
  rateCmPerMin: number | null;
}

interface ClassifyResponse {
  riskClass: RiskClass;
  confidence: number | null;
  modelVersion: string;
}

interface ForecastResponse {
  h1Cm: number;
  h6Cm: number;
  h24Cm: number;
  modelVersion: string;
}

export interface Inference {
  classification: Classification | null;
  forecast: Forecast | null;
}

/**
 * Calls the Python inference service (ml-service/) for both models in
 * parallel and stores the results. If the service is down or slow, the
 * reading still flows on with no ML result rather than blocking the pipeline.
 */
@Injectable()
export class MlService {
  private readonly logger = new Logger(MlService.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private lastWarn = 0;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    config: ConfigService,
  ) {
    this.baseUrl = config
      .get<string>('ML_URL', 'http://localhost:8000')
      .replace(/\/$/, '');
    this.timeoutMs = Number(config.get<string>('ML_TIMEOUT_MS', '1200'));
  }

  async infer(f: ReadingFiltered): Promise<Inference> {
    const rows = await this.db.getRepository(ReadingFiltered).find({
      where: { nodeId: f.nodeId },
      order: { recordedAt: 'DESC' },
      take: HISTORY_POINTS,
    });
    const history: HistoryPoint[] = rows.reverse().map((r) => ({
      t: r.recordedAt.toISOString(),
      depthCm: r.waterDepthCm,
      rateCmPerMin: r.rateCmPerMin,
    }));
    const body = { nodeId: f.nodeId, history };

    const [cls, fc] = await Promise.allSettled([
      this.post<ClassifyResponse>('/classify', body),
      this.post<ForecastResponse>('/forecast', body),
    ]);

    let classification: Classification | null = null;
    let forecast: Forecast | null = null;
    if (cls.status === 'fulfilled') {
      classification = await this.db.getRepository(Classification).save({
        filteredId: f.id,
        nodeId: f.nodeId,
        recordedAt: f.recordedAt,
        riskClass: cls.value.riskClass,
        confidence: cls.value.confidence,
        modelVersion: cls.value.modelVersion,
      });
    } else this.warn('classify', cls.reason);

    if (fc.status === 'fulfilled') {
      forecast = await this.db.getRepository(Forecast).save({
        filteredId: f.id,
        nodeId: f.nodeId,
        recordedAt: f.recordedAt,
        h1Cm: fc.value.h1Cm,
        h6Cm: fc.value.h6Cm,
        h24Cm: fc.value.h24Cm,
        modelVersion: fc.value.modelVersion,
      });
    } else this.warn('forecast', fc.reason);

    return { classification, forecast };
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(this.baseUrl + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  /** At most one warning per 30 s so a stopped ML service doesn't flood logs. */
  private warn(what: string, err: unknown) {
    const now = Date.now();
    if (now - this.lastWarn < 30_000) return;
    this.lastWarn = now;
    const msg = err instanceof Error ? err.message : String(err);
    this.logger.warn(
      `ML ${what} unavailable at ${this.baseUrl} (${msg}); readings continue without ML results`,
    );
  }
}
