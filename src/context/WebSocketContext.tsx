import React, { createContext, useContext } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

type WebSocketContextType = ReturnType<typeof useWebSocket> | null;

const WebSocketContext = createContext<WebSocketContextType>(null);

export const WebSocketProvider: React.FC<{ roomId: string | null; children: React.ReactNode }> = ({ roomId, children }) => {
    const ws = useWebSocket(roomId);
    
    return (
        <WebSocketContext.Provider value={ws}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocketContext = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocketContext must be used within a WebSocketProvider');
    }
    return context;
};
