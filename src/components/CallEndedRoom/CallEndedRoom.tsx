import React from 'react';
import './CallEndedRoom.css';

interface CallEndedRoomProps {
    onRejoin: () => void;
    onGoHome: () => void;
    hasReturnUrl?: boolean;
}

export const CallEndedRoom: React.FC<CallEndedRoomProps> = ({ onRejoin, onGoHome, hasReturnUrl }) => {
    return (
        <div className="call-ended-container">
            <div className="call-ended-card">
                <div className="call-ended-icon"></div>
                <h2>Has abandonado la reunión</h2>
                <p>La videollamada y la sesión de pizarra han finalizado para ti.</p>
                <div className="call-ended-actions">
                    <button className="btn-primary" onClick={onRejoin}>
                        Volver a unirse
                    </button>
                    <button className="btn-secondary" onClick={onGoHome}>
                        {hasReturnUrl ? 'Volver a la aplicación principal' : 'Ir al inicio (Nueva Sala)'}
                    </button>
                </div>
            </div>
        </div>
    );
};
