'use client';

import { useEffect, useState } from 'react';
import { WebSocketClient } from '@/lib/websocket/client';

export function WebSocketDemo() {
  const [ws, setWs] = useState<WebSocketClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [channel, setChannel] = useState('demo');
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    const wsClient = new WebSocketClient();
    setWs(wsClient);

    wsClient
      .connect()
      .then(() => {
        setIsConnected(true);
      })
      .catch((error) => {
        console.error('Failed to connect:', error);
      });

    return () => {
      wsClient.disconnect();
    };
  }, []);

  useEffect(() => {
    if (ws && isConnected) {
      const unsubscribe = ws.subscribe(channel, (data) => {
        setMessages((prev) => [
          ...prev,
          { channel, data, timestamp: new Date().toISOString() },
        ]);
      });

      return () => {
        unsubscribe();
      };
    }
  }, [ws, isConnected, channel]);

  const handleSendMessage = () => {
    if (ws && messageText) {
      ws.broadcast(channel, { message: messageText });
      setMessageText('');
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">WebSocket Demo</h2>

      <div className="mb-4">
        <div className="flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Channel</label>
        <input
          type="text"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Send Message</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSendMessage}
            disabled={!isConnected || !messageText}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Messages</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {messages.map((msg, idx) => (
            <div key={idx} className="p-3 bg-gray-100 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">
                {new Date(msg.timestamp).toLocaleTimeString()} - Channel:{' '}
                {msg.channel}
              </div>
              <div>{JSON.stringify(msg.data)}</div>
            </div>
          ))}
          {messages.length === 0 && (
            <p className="text-gray-500 text-center py-4">No messages yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
