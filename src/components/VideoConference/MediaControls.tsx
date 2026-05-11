import React from 'react';
import type { MediaControlsProps } from '../../types/video.types';

export const MediaControls: React.FC<MediaControlsProps> = ({
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    onToggleVideo,
    onToggleAudio,
    onToggleScreenShare,
}) => {
    return (
        <div className="media-controls">
            <button
                className={`media-btn ${isAudioEnabled ? 'active' : 'inactive'}`}
                onClick={onToggleAudio}
                title={isAudioEnabled ? 'Silenciar Micrófono' : 'Activar Micrófono'}
                aria-label={isAudioEnabled ? 'Silenciar Micrófono' : 'Activar Micrófono'}
            >
                {isAudioEnabled ? '🎙️' : '🔇'}
            </button>
            <button
                className={`media-btn ${isVideoEnabled ? 'active' : 'inactive'}`}
                onClick={onToggleVideo}
                title={isVideoEnabled ? 'Apagar Cámara' : 'Encender Cámara'}
                aria-label={isVideoEnabled ? 'Apagar Cámara' : 'Encender Cámara'}
            >
                {isVideoEnabled ? '📷' : '🚫'}
            </button>
            <button
                className={`media-btn ${isScreenSharing ? 'active-share' : 'active'}`}
                onClick={onToggleScreenShare}
                title={isScreenSharing ? 'Dejar de Presentar' : 'Compartir Pantalla'}
                aria-label={isScreenSharing ? 'Dejar de Presentar' : 'Compartir Pantalla'}
            >
                {isScreenSharing ? '🛑' : '💻'}
            </button>
            <button
                className="media-btn end-call"
                title="Finalizar Llamada"
                aria-label="Finalizar Llamada"
            >
                ☎️
            </button>
        </div>
    );
};
