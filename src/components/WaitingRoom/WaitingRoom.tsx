import React, { useState, useEffect, useRef } from 'react';
import './WaitingRoom.css';

interface WaitingRoomProps {
    stream: MediaStream | null;
    roomId: string | null;
    isVideoEnabled: boolean;
    isAudioEnabled: boolean;
    toggleVideo: () => void;
    toggleAudio: () => void;
    error: string | null;
    initialName?: string;
    onJoin: (name: string) => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({
    stream,
    roomId,
    isVideoEnabled,
    isAudioEnabled,
    toggleVideo,
    toggleAudio,
    error,
    initialName = '',
    onJoin,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [name, setName] = useState(initialName);

    useEffect(() => {
        if (initialName) setName(initialName);
    }, [initialName]);

    useEffect(() => {
        if (videoRef.current && stream) {
            if (videoRef.current.srcObject !== stream) {
                videoRef.current.srcObject = stream;
            }
        }
    }, [stream]);

    const handleJoinClick = () => {
        if (name.trim()) onJoin(name.trim());
    };

    return (
        <div className="waiting-room-container">
            <div className="waiting-room-card">
                <div className="waiting-room-header">
                    <h2>¿Listo para unirte?</h2>
                    <p>Sala: <strong>{roomId ?? 'Cargando...'}</strong></p>
                </div>

                <div className="preview-container">
                    {isVideoEnabled && stream ? (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="preview-video"
                        />
                    ) : (
                        <div className="preview-fallback">
                            <span className="camera-off-icon"> Cámara apagada</span>
                        </div>
                    )}

                    <div className="preview-controls">
                        <button
                            className={`control-btn ${isAudioEnabled ? 'on' : 'off'}`}
                            onClick={toggleAudio}
                            title={isAudioEnabled ? 'Apagar micrófono' : 'Encender micrófono'}
                            aria-label={isAudioEnabled ? 'Apagar micrófono' : 'Encender micrófono'}
                        >
                            {isAudioEnabled ? '' : ''}
                        </button>
                        <button
                            className={`control-btn ${isVideoEnabled ? 'on' : 'off'}`}
                            onClick={toggleVideo}
                            title={isVideoEnabled ? 'Apagar cámara' : 'Encender cámara'}
                            aria-label={isVideoEnabled ? 'Apagar cámara' : 'Encender cámara'}
                        >
                            {isVideoEnabled ? '' : ''}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="error-message" role="alert">
                        {error}
                    </div>
                )}

                <div className="join-form">
                    <input
                        type="text"
                        className="name-input"
                        placeholder="¿Cuál es tu nombre?"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleJoinClick()}
                        maxLength={30}
                        aria-label="Tu nombre"
                    />
                    <button
                        className="join-btn"
                        onClick={handleJoinClick}
                        disabled={!name.trim() || !roomId}
                        aria-label="Unirse a la sala"
                    >
                        Unirse a la sala
                    </button>
                </div>
            </div>
        </div>
    );
};
