import {
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { EvacCenter, EvacStatus, SensorNode } from '../database/entities';
import { RealtimeService } from '../realtime/realtime.service';
import { HazardSensor, recommend } from './evac-rules';

@Injectable()
export class EvacService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EvacService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly realtime: RealtimeService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Development convenience: an empty table gets the placeholder centres, so
   * the feature works out of the box. Never in production — the real list
   * must be loaded deliberately (npm run seed-centers -- <file>).
   */
  async onApplicationBootstrap() {
    if (this.config.get<string>('NODE_ENV') === 'production') return;
    const repo = this.db.getRepository(EvacCenter);
    if ((await repo.count()) > 0) return;
    const n = await this.load(
      join(__dirname, '../../seed/evac-centers.placeholder.json'),
      true,
    );
    this.logger.warn(
      `seeded ${n} PLACEHOLDER evacuation centres (not real sites)`,
    );
  }

  /** Upserts centres from a JSON file ({ centers: [...] }). */
  async load(file: string, placeholder: boolean): Promise<number> {
    const { centers } = JSON.parse(readFileSync(file, 'utf8')) as {
      centers: Array<
        Partial<EvacCenter> & {
          id: string;
          name: string;
          lat: number;
          lng: number;
        }
      >;
    };
    await this.db.getRepository(EvacCenter).upsert(
      centers.map((c) => ({ status: EvacStatus.OPEN, ...c, placeholder })),
      ['id'],
    );
    return centers.length;
  }

  list(): Promise<EvacCenter[]> {
    return this.db.getRepository(EvacCenter).find({ order: { name: 'ASC' } });
  }

  async recommend(lat: number, lng: number, limit = 3) {
    const [centres, sensors] = await Promise.all([this.list(), this.hazards()]);
    return recommend({ lat, lng }, centres, sensors, limit);
  }

  async setStatus(id: string, status: EvacStatus, capacity?: number | null) {
    const repo = this.db.getRepository(EvacCenter);
    const c = await repo.findOneBy({ id });
    if (!c) throw new NotFoundException(`centre ${id}`);
    c.status = status;
    if (capacity !== undefined) c.capacity = capacity;
    const saved = await repo.save(c);
    this.realtime.publish({
      type: 'centre',
      data: {
        nodeId: '',
        centre: { ...saved, updatedAt: saved.updatedAt.toISOString() },
      },
    });
    return saved;
  }

  async hazards(): Promise<HazardSensor[]> {
    const nodes = await this.db.getRepository(SensorNode).find();
    return nodes
      .filter((n) => n.lat != null && n.lng != null)
      .map((n) => ({
        id: n.id,
        lat: n.lat!,
        lng: n.lng!,
        tier: n.currentTier,
      }));
  }
}
