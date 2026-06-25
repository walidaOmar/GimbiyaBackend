"use strict";
/**
 * server/utils/sseService.ts
 * Server-Sent Events manager.
 * Maintains a Map of userId → Express Response objects.
 * Any backend service can call notifyUser() to push events to connected clients.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSSEConnection = handleSSEConnection;
exports.notifyUser = notifyUser;
exports.notifyByState = notifyByState;
exports.getConnectionCount = getConnectionCount;
// userId (MongoDB _id string) → active SSE Response
const connections = new Map();
/**
 * handleSSEConnection
 * Called when a client hits GET /api/events/subscribe.
 * Sets SSE headers and registers the connection.
 */
function handleSSEConnection(req, res) {
    const userId = req.userId;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
    res.flushHeaders();
    // Register connection
    connections.set(userId, res);
    console.log(`[SSE] Client connected: ${userId}. Total: ${connections.size}`);
    // Heartbeat every 25 seconds to keep connection alive through proxies
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 25000);
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
function notifyUser(userId, event, data) {
    const res = connections.get(userId);
    if (!res)
        return; // User not currently connected — no-op
    writeSSE(res, event, data);
}
/**
 * notifyByState
 * Broadcast an event to all connected users in a given state.
 * Used for: order:broadcast (auto-dispatch to all riders in region).
 */
function notifyByState(userIdsInState, event, data) {
    for (const uid of userIdsInState) {
        notifyUser(uid, event, data);
    }
}
/** Low-level SSE write helper */
function writeSSE(res, event, data) {
    try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
    catch {
        // Client disconnected mid-write — silently ignore
    }
}
function getConnectionCount() {
    return connections.size;
}
//# sourceMappingURL=sseService.js.map