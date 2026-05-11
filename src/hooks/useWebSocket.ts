import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { BoardSyncMessageDto, WebRtcMessageDto } from '../types/board.types';

const WS_URL = 'http://localhost:8080/ws-board';

export const useWebSocket = (roomId: string | null) => {
    const [isConnected, setIsConnected] = useState(false);
    const clientRef = useRef<Client | null>(null);
    const [senderId] = useState(() => Math.random().toString(36).substring(2, 10));

    // Listeners for incoming messages
    const boardListenersRef = useRef<Set<(msg: BoardSyncMessageDto) => void>>(new Set());
    const rtcListenersRef = useRef<Set<(msg: WebRtcMessageDto) => void>>(new Set());

    useEffect(() => {
        if (!roomId) return;

        const client = new Client({
            webSocketFactory: () => new SockJS(WS_URL),
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
            onConnect: () => {
                setIsConnected(true);
                console.log(`Connected to WebSocket in room: ${roomId}`);

                // Subscribe to board events
                client.subscribe(`/topic/room/${roomId}/board`, (message) => {
                    if (message.body) {
                        const parsed: BoardSyncMessageDto = JSON.parse(message.body);
                        boardListenersRef.current.forEach(listener => listener(parsed));
                    }
                });

                // Subscribe to WebRTC signaling
                client.subscribe(`/topic/room/${roomId}/signaling`, (message) => {
                    if (message.body) {
                        const parsed: WebRtcMessageDto = JSON.parse(message.body);
                        rtcListenersRef.current.forEach(listener => listener(parsed));
                    }
                });
            },
            onDisconnect: () => {
                setIsConnected(false);
                console.log('Disconnected from WebSocket');
            },
            onStompError: (frame) => {
                console.error('Broker reported error: ' + frame.headers['message']);
                console.error('Additional details: ' + frame.body);
            },
        });

        client.activate();
        clientRef.current = client;

        return () => {
            client.deactivate();
            clientRef.current = null;
            setIsConnected(false);
        };
    }, [roomId]);

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

    return {
        isConnected,
        senderId,
        sendBoardSync,
        sendSignaling,
        subscribeBoard,
        subscribeRtc,
    };
};
