export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(url?: string) {
    this.url = url || `ws://localhost:${process.env.NEXT_PUBLIC_WS_PORT || 3001}`;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.handleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(message: any) {
    const { type, channel, data } = message;

    if (type === 'message' && channel) {
      const channelListeners = this.listeners.get(channel);
      if (channelListeners) {
        channelListeners.forEach((callback) => callback(data));
      }
    }

    // Also notify type-specific listeners
    const typeListeners = this.listeners.get(`__type:${type}`);
    if (typeListeners) {
      typeListeners.forEach((callback) => callback(message));
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
      );
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  subscribe(channel: string, callback: (data: any) => void) {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)!.add(callback);

    // Send subscribe message to server
    this.send({
      type: 'subscribe',
      channel,
    });

    // Return unsubscribe function
    return () => {
      this.unsubscribe(channel, callback);
    };
  }

  unsubscribe(channel: string, callback?: (data: any) => void) {
    if (callback) {
      const channelListeners = this.listeners.get(channel);
      if (channelListeners) {
        channelListeners.delete(callback);
        if (channelListeners.size === 0) {
          this.listeners.delete(channel);
        }
      }
    } else {
      this.listeners.delete(channel);
    }

    // Send unsubscribe message to server
    this.send({
      type: 'unsubscribe',
      channel,
    });
  }

  broadcast(channel: string, data: any) {
    this.send({
      type: 'broadcast',
      channel,
      data,
    });
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
