import { Controller, MessageEvent, Query, Sse } from '@nestjs/common';
import { interval, map, merge, Observable } from 'rxjs';
import { parseNodeFilter } from './events';
import { RealtimeService } from './realtime.service';

/**
 * Server-Sent Events for the web dashboard: GET /events[?nodes=ID,ID]
 *
 *   const es = new EventSource('/events');
 *   es.addEventListener('reading', (e) => JSON.parse(e.data));
 *   es.addEventListener('alert',   (e) => JSON.parse(e.data));
 *
 * A `ping` every 25 s keeps proxies from closing an idle stream.
 */
@Controller('events')
export class EventsController {
  constructor(private readonly realtime: RealtimeService) {}

  @Sse()
  stream(@Query('nodes') nodes?: string): Observable<MessageEvent> {
    const events = this.realtime
      .stream(parseNodeFilter(nodes))
      .pipe(map((e): MessageEvent => ({ type: e.type, data: e.data })));
    const pings = interval(25_000).pipe(
      map((): MessageEvent => ({
        type: 'ping',
        data: { time: new Date().toISOString() },
      })),
    );
    return merge(events, pings);
  }
}
