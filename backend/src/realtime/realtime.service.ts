import { Injectable } from '@nestjs/common';
import { filter, Observable, Subject } from 'rxjs';
import { RealtimeEvent } from './events';

/**
 * In-process event bus feeding both transports. Single backend instance for
 * the pilot; scaling out would put Redis / Postgres LISTEN-NOTIFY behind
 * publish() without changing the gateways.
 */
@Injectable()
export class RealtimeService {
  private readonly bus = new Subject<RealtimeEvent>();

  publish(event: RealtimeEvent): void {
    this.bus.next(event);
  }

  stream(nodes: Set<string> | null): Observable<RealtimeEvent> {
    return nodes
      ? this.bus.pipe(filter((e) => nodes.has(e.data.nodeId)))
      : this.bus.asObservable();
  }
}
