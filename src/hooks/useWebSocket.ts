import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { BoardSyncMessageDto, WebRtcMessageDto } from '../types/board.types';


/**
 * Resolves the WebSocket endpoint URL.
 * - In dev  → uses VITE_WS_URL env var, or falls back to localhost:8080
 * - In prod → uses the same host/protocol as the page (supports wss://)
 */
function resolveWsUrl(): string {
    if (import.meta.env.VITE_WS_URL) {
        return import.meta.env.VITE_WS_URL as string;
    }
    if (import.meta.env.DEV) {
        return 'http://localhost:8080/ws-board';
    }
    const apiUrl = import.meta.env.VITE_API_URL;
    if (apiUrl) {
        // Strip trailing slash if present
        const sanitizedUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
        return `${sanitizedUrl}/ws-board`;
    }
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${window.location.host}/ws-board`;
}

const WS_URL = resolveWsUrl();

export const useWebSocket = (roomId: string | null, token: string | null) => {
    const [isConnected, setIsConnected] = useState(false);
    const clientRef = useRef<Client | null>(null);
    const [senderId] = useState(() => Math.random().toString(36).substring(2, 10));

    // Listeners for incoming messages
    const boardListenersRef     = useRef<Set<(msg: BoardSyncMessageDto) => void>>(new Set());
    const rtcListenersRef       = useRef<Set<(msg: WebRtcMessageDto) => void>>(new Set());
    // Listeners for board history (init event sent only to this client)
    const boardInitListenersRef = useRef<Set<(msg: BoardSyncMessageDto) => void>>(new Set());

    useEffect(() => {
        if (!roomId) return;

        const client = new Client({
            webSocketFactory: () => new SockJS(WS_URL),
            connectHeaders: token ? {
                Authorization: `Bearer ${token}`
            } : {},
            /**
             * Reconnect delay in milliseconds.
             * 8 s gives Render's free-tier service time to wake up from a cold start
             * before we attempt the first reconnect, avoiding rapid failed retries.
             */
            reconnectDelay: 8000,
            /**
             * Heartbeat intervals (ms). 10 s keeps the WS connection alive through
             * Render's idle-connection timeout without spamming the channel.
             */
            heartbeatIncoming: 10000,
            heartbeatOutgoing: 10000,
            onConnect: () => {
                setIsConnected(true);
                console.log(`Connected to WebSocket in room: ${roomId}`);

                // Subscribe to board events (broadcasts to all room participants)
                client.subscribe(`/topic/room/${roomId}/board`, (message) => {
                    if (message.body) {
                        const parsed: BoardSyncMessageDto = JSON.parse(message.body);
                        boardListenersRef.current.forEach(listener => listener(parsed));
                    }
                });

                // Subscribe to personal board-init channel (history only for this client)
                // Spring routes to /user/{sessionId}/queue/board-init
                client.subscribe(`/user/queue/board-init`, (message) => {
                    if (message.body) {
                        const parsed: BoardSyncMessageDto = JSON.parse(message.body);
                        boardInitListenersRef.current.forEach(listener => listener(parsed));
                    }
                });

                // Subscribe to WebRTC signaling
                client.subscribe(`/topic/room/${roomId}/signaling`, (message) => {
                    if (message.body) {
                        const parsed: WebRtcMessageDto = JSON.parse(message.body);
                        rtcListenersRef.current.forEach(listener => listener(parsed));
                    }
                });

                // Request board history from server for this room
                // The server responds on /user/queue/board-init with the persisted elements
                client.publish({
                    destination: `/app/room/${roomId}/board/init`,
                    body: JSON.stringify({ roomId }),
                });
                console.log(`Requested board history for room: ${roomId}`);
            },
            onDisconnect: () => {
                setIsConnected(false);
                console.log('[WS] Disconnected from WebSocket');
            },
            onStompError: (frame) => {
                console.error('[WS] Broker error:', frame.headers['message'], frame.body);
            },
            onWebSocketClose: (evt) => {
                console.warn('[WS] WebSocket closed — code:', evt.code, '— will reconnect…');
            },
        });

        client.activate();
        clientRef.current = client;

        return () => {
            client.deactivate();
            clientRef.current = null;
            setIsConnected(false);
        };
    }, [roomId, token]);

    const sendBoardSync = useCallback((message: Omit<BoardSyncMessageDto, 'senderId' | 'roomId'>) => {
        if (clientRef.current?.connected && roomId) {
            clientRef.current.publish({
                destination: `/app/room/${roomId}/board`,
                body: JSON.stringify({
                    ...message,
                    senderId,
                    roomId
                }),
            });
        }
    }, [roomId, senderId]);

    const sendSignaling = useCallback((message: Omit<WebRtcMessageDto, 'senderId' | 'roomId'>) => {
        if (clientRef.current?.connected && roomId) {
            clientRef.current.publish({
                destination: `/app/room/${roomId}/signaling`,
                body: JSON.stringify({
                    ...message,
                    senderId,
                    roomId
                }),
            });
        }
    }, [roomId, senderId]);

    const subscribeBoard = useCallback((callback: (msg: BoardSyncMessageDto) => void) => {
        boardListenersRef.current.add(callback);
        return () => {
            boardListenersRef.current.delete(callback);
        };
    }, []);

    const subscribeRtc = useCallback((callback: (msg: WebRtcMessageDto) => void) => {
        rtcListenersRef.current.add(callback);
        return () => {
            rtcListenersRef.current.delete(callback);
        };
    }, []);

    /**
     * Subscribes to "init" events sent exclusively to this client,
     * containing the room's whiteboard history at connection time.
     */
    const subscribeInit = useCallback((callback: (msg: BoardSyncMessageDto) => void) => {
        boardInitListenersRef.current.add(callback);
        return () => {
            boardInitListenersRef.current.delete(callback);
        };
    }, []);

    const wsValue = React.useMemo(() => ({
        isConnected,
        senderId,
        sendBoardSync,
        sendSignaling,
        subscribeBoard,
        subscribeRtc,
        subscribeInit,
    }), [
        isConnected,
        senderId,
        sendBoardSync,
        sendSignaling,
        subscribeBoard,
        subscribeRtc,
        subscribeInit
    ]);

    return wsValue;
};
