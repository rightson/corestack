# WebSocket Guide

## Overview

The WebSocket server provides real-time bidirectional communication between clients and the server.

## Server Configuration

WebSocket server runs on port 3001 (configurable via `WS_PORT` environment variable).

### Starting the Server

```bash
npm run ws:server
```

## Client Usage

### Browser Client

```typescript
import { WebSocketClient } from '@/lib/websocket/client';

const client = new WebSocketClient('ws://localhost:3001');

// Subscribe to a channel
client.subscribe('my-channel', (data) => {
  console.log('Received message:', data);
});

// Send a message
client.broadcast('my-channel', { message: 'Hello!' });

// Unsubscribe
client.unsubscribe('my-channel');

// Close connection
client.close();
```

### CLI Client

```bash
# Listen to a channel
npm run cli ws listen demo

# Send a message to a channel
npm run cli ws send demo "Hello, World!"
```

## Message Protocol

### Subscribe to a Channel

**Send**:
```json
{
  "type": "subscribe",
  "channel": "channel-name"
}
```

**Response**:
```json
{
  "type": "subscribed",
  "channel": "channel-name"
}
```

### Unsubscribe from a Channel

**Send**:
```json
{
  "type": "unsubscribe",
  "channel": "channel-name"
}
```

**Response**:
```json
{
  "type": "unsubscribed",
  "channel": "channel-name"
}
```

### Broadcast a Message

**Send**:
```json
{
  "type": "broadcast",
  "channel": "channel-name",
  "data": { "any": "data" }
}
```

**Notification** (sent to all channel subscribers):
```json
{
  "type": "message",
  "channel": "channel-name",
  "data": { "any": "data" }
}
```

### Ping/Pong

**Send**:
```json
{
  "type": "ping"
}
```

**Response**:
```json
{
  "type": "pong"
}
```

## Channel-Based Communication

The WebSocket server uses a channel-based pub/sub model:

1. Clients subscribe to channels by name
2. Messages broadcast to a channel are sent to all subscribers
3. Clients can be subscribed to multiple channels simultaneously
4. Each client maintains its own set of subscriptions

## React Component Example

```typescript
'use client';

import { useEffect, useState } from 'react';
import { WebSocketClient } from '@/lib/websocket/client';

export function ChatComponent() {
  const [client, setClient] = useState<WebSocketClient | null>(null);
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const ws = new WebSocketClient('ws://localhost:3001');

    ws.subscribe('chat', (data) => {
      setMessages(prev => [...prev, data.message]);
    });

    setClient(ws);

    return () => ws.close();
  }, []);

  const sendMessage = (message: string) => {
    client?.broadcast('chat', { message });
  };

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>{msg}</div>
      ))}
      <button onClick={() => sendMessage('Hello!')}>
        Send
      </button>
    </div>
  );
}
```

## Server Implementation

The WebSocket server is implemented in `server/websocket.ts`. It maintains:

- Connection pool of all connected clients
- Channel subscriptions for each client
- Message routing between clients on the same channel

## Environment Variables

```env
WS_PORT=3001
```

## Production Considerations

### Scaling

For production deployments with multiple server instances, consider using Redis Pub/Sub to synchronize messages across WebSocket servers:

```typescript
// Example pattern
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });
await redis.subscribe('channel', (message) => {
  // Broadcast to local WebSocket clients
});
```

### Security

Add authentication to WebSocket connections:

```typescript
ws.on('connection', (socket, request) => {
  const token = new URL(request.url!, 'ws://base').searchParams.get('token');
  // Verify token
});
```
