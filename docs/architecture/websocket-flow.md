# WebSocket Flow

## Real-Time Message Flow

This document details how WebSocket messages flow through the application.

### Flow Diagram

```
Browser/CLI Client (lib/websocket/client.ts or cli/index.ts)
    │
    │ ws.send({ type: 'subscribe', channel: 'demo' })
    │ Connect to ws://localhost:3001
    ▼
WebSocket Server (server/websocket.ts)
    │
    │ Handles connection and message
    │ Registers client to channel
    ▼
Client subscribed to channel
    │
    │ Another client broadcasts message
    ▼
WebSocket Server (server/websocket.ts)
    │
    │ Finds all subscribers to 'demo' channel
    │ Iterates through subscribed clients
    │ Sends message to each subscriber
    ▼
All Subscribed Clients Receive Message
    │
    │ { type: 'message', channel: 'demo', data: {...} }
    ▼
Client callback handles message
```

## Message Types

### 1. Subscribe

Client subscribes to a channel:

```json
{
  "type": "subscribe",
  "channel": "channel-name"
}
```

Server response:

```json
{
  "type": "subscribed",
  "channel": "channel-name"
}
```

### 2. Unsubscribe

Client unsubscribes from a channel:

```json
{
  "type": "unsubscribe",
  "channel": "channel-name"
}
```

Server response:

```json
{
  "type": "unsubscribed",
  "channel": "channel-name"
}
```

### 3. Broadcast

Client sends a message to all subscribers:

```json
{
  "type": "broadcast",
  "channel": "channel-name",
  "data": { "any": "data" }
}
```

All subscribers receive:

```json
{
  "type": "message",
  "channel": "channel-name",
  "data": { "any": "data" }
}
```

### 4. Ping/Pong

Keep-alive mechanism:

```json
{
  "type": "ping"
}
```

Server responds:

```json
{
  "type": "pong"
}
```

## Connection Lifecycle

### 1. Client Connects

```typescript
const ws = new WebSocket('ws://localhost:3001');

ws.on('open', () => {
  console.log('Connected to WebSocket server');
});
```

### 2. Server Accepts Connection

```typescript
wss.on('connection', (ws) => {
  console.log('New client connected');
  connections.add(ws);
});
```

### 3. Message Exchange

Client and server exchange messages based on the protocol above.

### 4. Disconnection

```typescript
ws.on('close', () => {
  console.log('Disconnected from server');
  // Cleanup subscriptions
});
```

## Channel-Based Pub/Sub

The WebSocket server implements a channel-based publish-subscribe pattern:

- Clients subscribe to named channels
- Messages are only sent to subscribers of that channel
- Multiple clients can subscribe to the same channel
- Clients can subscribe to multiple channels

## Example Usage

### Browser Client

```typescript
import { createWebSocketClient } from '@/lib/websocket/client';

const ws = createWebSocketClient('ws://localhost:3001');

// Subscribe to channel
ws.subscribe('notifications', (data) => {
  console.log('Received notification:', data);
});

// Broadcast message
ws.broadcast('chat', { message: 'Hello!' });
```

### CLI Client

```bash
# Subscribe to a channel
npm run cli ws listen demo

# Broadcast to a channel
npm run cli ws send demo "Hello from CLI"
```

## Server Implementation

The WebSocket server maintains:

1. **Connection Pool** - Set of active WebSocket connections
2. **Channel Subscriptions** - Map of channels to subscribers
3. **Message Handler** - Routes messages based on type

## Error Handling

The server handles:
- Invalid message formats
- Unknown message types
- Disconnected clients
- Channel errors

Errors are sent back to the client:

```json
{
  "type": "error",
  "message": "Error description"
}
```

## Configuration

WebSocket server port is configured via environment variable:

```env
WS_PORT=3001
```

## Security Considerations

For production:
- Implement authentication
- Add message validation
- Rate limiting
- CORS configuration
- Use WSS (WebSocket Secure) over TLS
