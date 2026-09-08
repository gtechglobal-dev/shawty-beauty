import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';

// Thin WebSocket hub so every admin screen (Diary) updates in real time.
// Clients connect to /realtime and receive JSON `{ type, payload }` events.
// Broadcasts are fire-and-forget; there is no persistence/replay.

let wss: WebSocketServer | null = null;

export type RealtimeEventType =
  | 'registrations'
  | 'contacts'
  | 'subscribers'
  | 'sponsors'
  | 'events'
  | 'attendance';

export function initRealtime(server: HttpServer): void {
  wss = new WebSocketServer({ server, path: '/realtime' });
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'hello' }));
  });
}

export function broadcastRealtime(type: RealtimeEventType, payload?: unknown): void {
  if (!wss) return;
  const message = JSON.stringify({ type, payload: payload ?? null });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}