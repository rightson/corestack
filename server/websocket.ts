import { WebSocketServer, WebSocket } from 'ws';
import * as dotenv from 'dotenv';
import { createLogger } from '@/lib/observability/logger';
import {
  wsConnectionsActive,
  wsConnectionsTotal,
  wsMessagesTotal,
  wsChannelSubscriptions,
} from '@/lib/observability/metrics';

dotenv.config();

const WS_PORT = parseInt(process.env.WS_PORT || '3001');
const logger = createLogger({ service: 'websocket' });

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

  // Update metrics
  wsConnectionsActive.inc();
  wsConnectionsTotal.inc({ event: 'connect' });

  logger.info({ clientId, totalClients: clients.size }, 'Client connected');

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
      wsMessagesTotal.inc({ direction: 'inbound', type: message.type || 'unknown' });

      switch (message.type) {
        case 'subscribe':
          if (message.channel) {
            client.subscriptions.add(message.channel);
            wsChannelSubscriptions.inc({ channel: message.channel });
            logger.debug({ clientId, channel: message.channel }, 'Client subscribed to channel');
            ws.send(
              JSON.stringify({
                type: 'subscribed',
                channel: message.channel,
              })
            );
            wsMessagesTotal.inc({ direction: 'outbound', type: 'subscribed' });
          }
          break;

        case 'unsubscribe':
          if (message.channel) {
            client.subscriptions.delete(message.channel);
            wsChannelSubscriptions.dec({ channel: message.channel });
            logger.debug({ clientId, channel: message.channel }, 'Client unsubscribed from channel');
            ws.send(
              JSON.stringify({
                type: 'unsubscribed',
                channel: message.channel,
              })
            );
            wsMessagesTotal.inc({ direction: 'outbound', type: 'unsubscribed' });
          }
          break;

        case 'broadcast':
          // Broadcast to all clients subscribed to the channel
          const channel = message.channel || 'default';
          let broadcastCount = 0;
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
              wsMessagesTotal.inc({ direction: 'outbound', type: 'message' });
              broadcastCount++;
            }
          });
          logger.debug({ clientId, channel, recipients: broadcastCount }, 'Broadcast message sent');
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          wsMessagesTotal.inc({ direction: 'outbound', type: 'pong' });
          break;

        default:
          logger.warn({ clientId, messageType: message.type }, 'Unknown message type');
          ws.send(
            JSON.stringify({
              type: 'error',
              message: 'Unknown message type',
            })
          );
          wsMessagesTotal.inc({ direction: 'outbound', type: 'error' });
      }
    } catch (error) {
      logger.error({ error, clientId }, 'Error processing message');
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        })
      );
      wsMessagesTotal.inc({ direction: 'outbound', type: 'error' });
    }
  });

  ws.on('close', () => {
    // Decrement channel subscriptions
    client.subscriptions.forEach((channel) => {
      wsChannelSubscriptions.dec({ channel });
    });

    clients.delete(clientId);

    // Update metrics
    wsConnectionsActive.dec();
    wsConnectionsTotal.inc({ event: 'disconnect' });

    logger.info({ clientId, totalClients: clients.size }, 'Client disconnected');
  });

  ws.on('error', (error) => {
    logger.error({ error, clientId }, 'WebSocket error');
  });
});

// Broadcast function for external use
export function broadcast(channel: string, data: any) {
  let broadcastCount = 0;
  clients.forEach((client) => {
    if (client.subscriptions.has(channel) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(
        JSON.stringify({
          type: 'message',
          channel,
          data,
        })
      );
      wsMessagesTotal.inc({ direction: 'outbound', type: 'message' });
      broadcastCount++;
    }
  });
  logger.debug({ channel, recipients: broadcastCount }, 'External broadcast sent');
}

logger.info({ port: WS_PORT }, 'WebSocket server running');

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down WebSocket server');
  wss.close(() => {
    logger.info('WebSocket server closed');
    process.exit(0);
  });
});
