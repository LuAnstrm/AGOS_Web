import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { SensorNode, SosEvent, SosRequest } from '../database/entities';
import { recommend } from '../evac/evac-rules';
import { EvacService } from '../evac/evac.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateSosDto, UpdateSosDto } from './sos.dto';
import {
  allowedNext,
  canTransition,
  haversineM,
  OPEN_STATUSES,
  SosStatus,
} from './sos-status';

/** Signed-in user acting on or sending a request. */
export interface SosActor {
  id: string;
  displayName: string;
}

const STATUS_ORDER: Record<SosStatus, number> = {
  [SosStatus.NEW]: 0,
  [SosStatus.ACKNOWLEDGED]: 1,
  [SosStatus.DISPATCHED]: 2,
  [SosStatus.RESOLVED]: 3,
  [SosStatus.CANCELLED]: 4,
};

@Injectable()
export class SosService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly realtime: RealtimeService,
    private readonly evac: EvacService,
  ) {}

  /** Adds the nearest safe open evacuation centre to each request, for dispatch. */
  async withShelter<T extends SosRequest>(rows: T[]) {
    const [centres, sensors] = await Promise.all([
      this.evac.list(),
      this.evac.hazards(),
    ]);
    return rows.map((r) => {
      const best = recommend(
        { lat: r.lat, lng: r.lng },
        centres,
        sensors,
        1,
      )[0];
      return {
        ...r,
        shelter: best
          ? {
              id: best.centre.id,
              name: best.centre.name,
              distanceM: best.distanceM,
              compass: best.compass,
              safety: best.safety,
              placeholder: best.centre.placeholder,
            }
          : null,
      };
    });
  }

  /**
   * Records a distress request. Re-delivery of the same clientId (a mesh
   * message reaching the gateway by two routes, or an app retry) returns the
   * existing request instead of creating a second one.
   */
  async create(
    dto: CreateSosDto,
    reporter: SosActor | null,
  ): Promise<{ request: SosRequest; duplicate: boolean }> {
    const repo = this.db.getRepository(SosRequest);
    const existing = await repo.findOneBy({ clientId: dto.clientId });
    if (existing) return { request: existing, duplicate: true };

    const nearest = await this.nearestNode(dto.lat, dto.lng);
    let raced = false;
    const saved = await this.db
      .transaction(async (em) => {
        const req = await em.getRepository(SosRequest).save({
          clientId: dto.clientId,
          channel: dto.channel,
          relayNodeId: dto.relayNodeId ?? null,
          relayHops: dto.relayHops ?? null,
          reporterUserId: reporter?.id ?? null,
          reporterName: dto.reporterName ?? reporter?.displayName ?? null,
          reporterPhone: dto.reporterPhone ?? null,
          lat: dto.lat,
          lng: dto.lng,
          peopleCount: dto.peopleCount ?? 1,
          needs: [...new Set(dto.needs ?? [])],
          message: dto.message ?? null,
          reportedAt: dto.reportedAt ? new Date(dto.reportedAt) : null,
          nearestNodeId: nearest?.id ?? null,
          nearestNodeDistanceM: nearest ? Math.round(nearest.distanceM) : null,
        });
        await em.getRepository(SosEvent).save({
          sosId: req.id,
          status: SosStatus.NEW,
          note: `received via ${dto.channel}`,
          actor: null,
          actorUserId: null,
        });
        return req;
      })
      .catch(async (e: unknown) => {
        // Two deliveries racing past the findOneBy above: the unique index wins.
        const again = await repo.findOneBy({ clientId: dto.clientId });
        if (!again) throw e;
        raced = true;
        return again;
      });

    if (raced) return { request: saved, duplicate: true };
    this.publish(saved, 'created');
    return { request: saved, duplicate: false };
  }

  async list(scope: 'open' | 'all', limit: number): Promise<SosRequest[]> {
    const rows = await this.db.getRepository(SosRequest).find({
      where: scope === 'open' ? { status: In([...OPEN_STATUSES]) } : {},
      order: { createdAt: scope === 'open' ? 'ASC' : 'DESC' },
      take: limit,
    });
    // Open queue: untouched requests first, then oldest first within a status.
    if (scope === 'open') {
      rows.sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          a.createdAt.getTime() - b.createdAt.getTime(),
      );
    }
    return rows;
  }

  async get(id: string): Promise<SosRequest & { events: SosEvent[] }> {
    const req = await this.db.getRepository(SosRequest).findOneBy({ id });
    if (!req) throw new NotFoundException(`SOS ${id}`);
    const events = await this.db
      .getRepository(SosEvent)
      .find({ where: { sosId: id }, order: { createdAt: 'ASC' } });
    return { ...req, events };
  }

  /**
   * A citizen's own requests, with only what they need to see ("help is on
   * the way") — no other people's data, no internal notes.
   */
  async mine(userId: string) {
    const rows = await this.db.getRepository(SosRequest).find({
      where: { reporterUserId: userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    return rows.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      status: r.status,
      assignedTeam: r.status === SosStatus.DISPATCHED ? r.assignedTeam : null,
      peopleCount: r.peopleCount,
      createdAt: r.createdAt,
      acknowledgedAt: r.acknowledgedAt,
      dispatchedAt: r.dispatchedAt,
      closedAt: r.closedAt,
    }));
  }

  async update(
    id: string,
    dto: UpdateSosDto,
    actor: SosActor,
  ): Promise<SosRequest> {
    if (!dto.status && dto.assignedTeam === undefined && !dto.note) {
      throw new BadRequestException('nothing to update');
    }

    const updated = await this.db.transaction(async (em) => {
      const repo = em.getRepository(SosRequest);
      const req = await repo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!req) throw new NotFoundException(`SOS ${id}`);

      if (dto.status && dto.status !== req.status) {
        if (!canTransition(req.status, dto.status)) {
          const next = allowedNext(req.status);
          throw new ConflictException(
            `cannot go from ${req.status} to ${dto.status}` +
              (next.length
                ? `; allowed: ${next.join(', ')}`
                : ' (request is closed)'),
          );
        }
        if (
          dto.status === SosStatus.DISPATCHED &&
          !(dto.assignedTeam ?? req.assignedTeam)
        ) {
          throw new BadRequestException('assignedTeam is required to dispatch');
        }
        const now = new Date();
        req.status = dto.status;
        if (dto.status === SosStatus.ACKNOWLEDGED) req.acknowledgedAt = now;
        if (dto.status === SosStatus.DISPATCHED) req.dispatchedAt = now;
        if (
          dto.status === SosStatus.RESOLVED ||
          dto.status === SosStatus.CANCELLED
        ) {
          req.closedAt = now;
        }
      }
      if (dto.assignedTeam !== undefined)
        req.assignedTeam = dto.assignedTeam || null;

      const saved = await repo.save(req);
      await em.getRepository(SosEvent).save({
        sosId: id,
        status: saved.status,
        note:
          [
            dto.assignedTeam ? `team: ${dto.assignedTeam}` : null,
            dto.note ?? null,
          ]
            .filter(Boolean)
            .join(' · ') || null,
        actor: actor.displayName,
        actorUserId: actor.id,
      });
      return saved;
    });

    this.publish(updated, 'updated');
    return updated;
  }

  private async nearestNode(lat: number, lng: number) {
    const nodes = await this.db.getRepository(SensorNode).find();
    let best: { id: string; distanceM: number } | null = null;
    for (const n of nodes) {
      if (n.lat == null || n.lng == null) continue;
      const d = haversineM({ lat, lng }, { lat: n.lat, lng: n.lng });
      if (!best || d < best.distanceM) best = { id: n.id, distanceM: d };
    }
    return best;
  }

  private publish(req: SosRequest, action: 'created' | 'updated') {
    // Include the shelter suggestion, same as GET /sos, so live cards match.
    void this.withShelter([req])
      .catch(() => [{ ...req, shelter: null }])
      .then(([r]) => this.emit(r, action));
  }

  private emit(
    req: SosRequest & { shelter: unknown },
    action: 'created' | 'updated',
  ) {
    this.realtime.publish({
      type: 'sos',
      data: {
        action,
        nodeId: req.nearestNodeId ?? '',
        request: {
          ...req,
          reportedAt: req.reportedAt?.toISOString() ?? null,
          createdAt: req.createdAt.toISOString(),
          updatedAt: req.updatedAt.toISOString(),
          acknowledgedAt: req.acknowledgedAt?.toISOString() ?? null,
          dispatchedAt: req.dispatchedAt?.toISOString() ?? null,
          closedAt: req.closedAt?.toISOString() ?? null,
        },
      },
    });
  }
}
