import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { IncomingMessage } from 'node:http';
import { Subscription } from 'rxjs';
import { WebSocket } from 'ws';
import { parseNodeFilter, PUBLIC_EVENT_TYPES } from './events';
import { RealtimeService } from './realtime.service';

/**
 * WebSocket push for the mobile app: ws://<host>/ws[?nodes=ID,ID]
 * Server → client only for now; each frame is one RealtimeEvent as JSON.
 */
@WebSocketGateway({ path: '/ws' })
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly subs = new Map<WebSocket, Subscription>();

  constructor(private readonly realtime: RealtimeService) {}

  handleConnection(client: WebSocket, req: IncomingMessage): void {
    const url = new URL(req.url ?? '/ws', 'http://localhost');
    const nodes = parseNodeFilter(url.searchParams.get('nodes'));
    const sub = this.realtime.stream(nodes).subscribe((event) => {
      // Citizens get readings and alerts only — never SOS (personal data).
      if (!PUBLIC_EVENT_TYPES.has(event.type)) return;
      if (client.readyState === WebSocket.OPEN)
        client.send(JSON.stringify(event));
    });
    this.subs.set(client, sub);
    client.send(
      JSON.stringify({
        type: 'hello',
        data: {
          nodes: nodes ? [...nodes] : 'all',
          time: new Date().toISOString(),
        },
      }),
    );
    this.logger.log(`ws client connected (${this.subs.size} open)`);
  }

  handleDisconnect(client: WebSocket): void {
    this.subs.get(client)?.unsubscribe();
    this.subs.delete(client);
  }
}
