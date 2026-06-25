/**
 * server/utils/sseService.ts
 * Server-Sent Events manager.
 * Maintains a Map of userId → Express Response objects.
 * Any backend service can call notifyUser() to push events to connected clients.
 */

import { Request, Response } from 'express';
import { SSEEvent, SSEEventName } from '../types';

// userId (MongoDB _id string) → active SSE Response
const connections = new Map<string, Response>();

/**
 * handleSSEConnection
 * Called when a client hits GET /api/events/subscribe.
 * Sets SSE headers and registers the connection.
 */
export function handleSSEConnection(req: Request, res: Response): void {
  const userId = (req as any).userId as string | undefined;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // SSE headers
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
  res.flushHeaders();

  // Register connection
  connections.set(userId, res);
  console.log(`[SSE] Client connected: ${userId}. Total: ${connections.size}`);

  // Heartbeat every 25 seconds to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25_000);

  // Send a connected confirmation
  writeSSE(res, 'order:status_changed', { message: 'SSE connection established.' });

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    connections.delete(userId);
    console.log(`[SSE] Client disconnected: ${userId}. Total: ${connections.size}`);
  });
}

/**
 * notifyUser
 * Push a named SSE event to a specific user if they are connected.
 */
export function notifyUser(userId: string, event: SSEEventName, data: Record<string, unknown>): void {
  const res = connections.get(userId);
  if (!res) return; // User not currently connected — no-op
  writeSSE(res, event, data);
}

/**
 * notifyByState
 * Broadcast an event to all connected users in a given state.
 * Used for: order:broadcast (auto-dispatch to all riders in region).
 */
export function notifyByState(
  userIdsInState: string[],
  event: SSEEventName,
  data: Record<string, unknown>
): void {
  for (const uid of userIdsInState) {
    notifyUser(uid, event, data);
  }
}

/** Low-level SSE write helper */
function writeSSE(res: Response, event: string, data: Record<string, unknown>): void {
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch {
    // Client disconnected mid-write — silently ignore
  }
}

export function getConnectionCount(): number {
  return connections.size;
}
