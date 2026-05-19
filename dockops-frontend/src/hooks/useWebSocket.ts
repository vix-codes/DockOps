import { useEffect, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import type { StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const WS_URL = import.meta.env.VITE_WS_URL || '/ws';

interface UseWebSocketOptions {
  topics: string[];
  onMessage: (topic: string, data: unknown) => void;
  enabled?: boolean;
}

export function useWebSocket({ topics, onMessage, enabled = true }: UseWebSocketOptions) {
  const clientRef = useRef<Client | null>(null);
  const subscriptionsRef = useRef<StompSubscription[]>([]);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (!enabled) return;

    const token = localStorage.getItem('accessToken');
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,

      onConnect: () => {
        subscriptionsRef.current = topics.map((topic) =>
          client.subscribe(topic, (message) => {
            try {
              const data = JSON.parse(message.body);
              onMessageRef.current(topic, data);
            } catch {
              onMessageRef.current(topic, message.body);
            }
          })
        );
      },

      onDisconnect: () => {
        subscriptionsRef.current = [];
      },
    });

    client.activate();
    clientRef.current = client;
  }, [enabled, topics]);

  useEffect(() => {
    connect();
    return () => {
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      clientRef.current?.deactivate();
    };
  }, [connect]);
}
