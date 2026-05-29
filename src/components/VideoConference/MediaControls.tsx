import React from 'react';
import type { MediaControlsProps } from '../../types/video.types';

export const MediaControls: React.FC<MediaControlsProps> = ({
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    onToggleVideo,
    onToggleAudio,
    onToggleScreenShare,
    onEndCall,
}) => {
    return (
        <div className="media-controls">
            {/* Micrófono */}
            <button
                className={`media-btn ${isAudioEnabled ? 'active' : 'inactive'}`}
                onClick={onToggleAudio}
                title={isAudioEnabled ? 'Silenciar Micrófono' : 'Activar Micrófono'}
                aria-label={isAudioEnabled ? 'Silenciar Micrófono' : 'Activar Micrófono'}
                type="button"
            >
                {isAudioEnabled ? '🎙️' : '🔇'}
            </button>

            {/* Cámara */}
            <button
                className={`media-btn ${isVideoEnabled ? 'active' : 'inactive'}`}
                onClick={onToggleVideo}
                title={isVideoEnabled ? 'Apagar Cámara' : 'Encender Cámara'}
                aria-label={isVideoEnabled ? 'Apagar Cámara' : 'Encender Cámara'}
                type="button"
            >
                {isVideoEnabled ? '📷' : '🚫'}
            </button>

            {/* Compartir Pantalla */}
            <button
                className={`media-btn ${isScreenSharing ? 'active-share' : 'active'}`}
                onClick={onToggleScreenShare}
                title={isScreenSharing ? 'Dejar de Presentar' : 'Compartir Pantalla'}
                aria-label={isScreenSharing ? 'Dejar de Presentar' : 'Compartir Pantalla'}
                type="button"
            >
                {isScreenSharing ? '' : ''}
            </button>

            {/* Terminar Llamada — ahora con onClick y feedback visual */}
            <button
                className="media-btn end-call"
                title="Finalizar Llamada"
                aria-label="Finalizar Llamada"
                type="button"
                onClick={onEndCall}
            >
                ☎️
            </button>
        </div>
    );
};
