import React, { useEffect, useRef } from 'react';
import { useWebRTC } from '../../hooks/useWebRTC';

export interface VideoConferencePanelProps {
    stream: MediaStream | null;
    error: string | null;
    isVideoEnabled: boolean;
    isAudioEnabled: boolean;
    /** Name of the local user — used to render the avatar initial when camera is off */
    userName?: string;
}

export const VideoConferencePanel: React.FC<VideoConferencePanelProps> = ({
    stream,
    error,
    isVideoEnabled,
    isAudioEnabled,
    userName = '',
}) => {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const { remoteStream } = useWebRTC(stream);

    // Derive avatar initial from the user's name, falling back to "?"
    const localInitial = userName.trim().charAt(0).toUpperCase() || '?';

    useEffect(() => {
        if (localVideoRef.current && stream) {
            localVideoRef.current.srcObject = stream;
        }
    }, [stream]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    return (
        <div className="panel video-panel">
            <div className="panel-header">
                <div className="panel-title">
                    <span className="panel-title-icon">👥</span>
                    Sesión en Vivo
                </div>
            </div>

            <div className="video-grid">
                {error && <div className="video-error">{error}</div>}

                {/* Local Video */}
                <div className="video-container local-video">
                    {isVideoEnabled ? (
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="video-element"
                        />
                    ) : (
                        <div className="video-avatar">
                            <span className="avatar-initial">{localInitial}</span>
                        </div>
                    )}
                    <div className="video-overlay">
                        <span className="participant-name">Tú</span>
                        {!isAudioEnabled && <span className="participant-muted">🔇</span>}
                    </div>
                </div>

                {/* Remote Participant */}
                <div className="video-container remote-video">
                    {remoteStream ? (
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="video-element"
                        />
                    ) : (
                        <div className="video-avatar">
                            <span className="avatar-initial">⏳</span>
                        </div>
                    )}
                    <div className="video-overlay">
                        <span className="participant-name">
                            {remoteStream ? 'Profesor / Alumno' : 'Esperando participante...'}
                        </span>
                        {!remoteStream && <span className="participant-muted">🔇</span>}
                    </div>
                </div>
            </div>
        </div>
    );
};
