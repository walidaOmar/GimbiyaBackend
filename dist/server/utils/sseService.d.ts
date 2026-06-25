/**
 * server/utils/sseService.ts
 * Server-Sent Events manager.
 * Maintains a Map of userId → Express Response objects.
 * Any backend service can call notifyUser() to push events to connected clients.
 */
import { Request, Response } from 'express';
import { SSEEventName } from '../types';
/**
 * handleSSEConnection
 * Called when a client hits GET /api/events/subscribe.
 * Sets SSE headers and registers the connection.
 */
export declare function handleSSEConnection(req: Request, res: Response): void;
/**
 * notifyUser
 * Push a named SSE event to a specific user if they are connected.
 */
export declare function notifyUser(userId: string, event: SSEEventName, data: Record<string, unknown>): void;
/**
 * notifyByState
 * Broadcast an event to all connected users in a given state.
 * Used for: order:broadcast (auto-dispatch to all riders in region).
 */
export declare function notifyByState(userIdsInState: string[], event: SSEEventName, data: Record<string, unknown>): void;
export declare function getConnectionCount(): number;
//# sourceMappingURL=sseService.d.ts.map