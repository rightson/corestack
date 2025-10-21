import { WebSocketServer, WebSocket } from 'ws';
import * as dotenv from 'dotenv';

dotenv.config();

const WS_PORT = parseInt(process.env.WS_PORT || '3001');

const wss = new WebSocketServer({ port: WS_PORT });

interface Client {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
}

const clients = new Map<string, Client>();

function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

wss.on('connection', (ws: WebSocket) => {
  const clientId = generateClientId();
  const client: Client = {
    id: clientId,
    ws,
    subscriptions: new Set(),
  };

  clients.set(clientId, client);

  console.log(`Client connected: ${clientId} (Total: ${clients.size})`);

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: 'connected',
      clientId,
      message: 'Connected to WebSocket server',
    })
  );

  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe':
          if (message.channel) {
            client.subscriptions.add(message.channel);
            ws.send(
              JSON.stringify({
                type: 'subscribed',
                channel: message.channel,
              })
            );
          }
          break;

        case 'unsubscribe':
          if (message.channel) {
            client.subscriptions.delete(message.channel);
            ws.send(
              JSON.stringify({
                type: 'unsubscribed',
                channel: message.channel,
              })
            );
          }
          break;

        case 'broadcast':
          // Broadcast to all clients subscribed to the channel
          const channel = message.channel || 'default';
          clients.forEach((c) => {
            if (c.subscriptions.has(channel) && c.ws.readyState === WebSocket.OPEN) {
              c.ws.send(
                JSON.stringify({
                  type: 'message',
                  channel,
                  data: message.data,
                  from: clientId,
                })
              );
            }
          });
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        default:
          ws.send(
            JSON.stringify({
              type: 'error',
              message: 'Unknown message type',
            })
          );
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        })
      );
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`Client disconnected: ${clientId} (Total: ${clients.size})`);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
  });
});

// Broadcast function for external use
export function broadcast(channel: string, data: any) {
  clients.forEach((client) => {
    if (client.subscriptions.has(channel) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(
        JSON.stringify({
          type: 'message',
          channel,
          data,
        })
      );
    }
  });
}

console.log(`WebSocket server running on port ${WS_PORT}`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down WebSocket server...');
  wss.close(() => {
    console.log('WebSocket server closed');
    process.exit(0);
  });
});
