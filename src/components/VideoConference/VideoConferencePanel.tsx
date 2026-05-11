import React, { useEffect, useRef } from 'react';
import { useWebRTC } from '../../hooks/useWebRTC';
export interface VideoConferencePanelProps {
    stream: MediaStream | null;
    error: string | null;
    isVideoEnabled: boolean;
    isAudioEnabled: boolean;
}

export const VideoConferencePanel: React.FC<VideoConferencePanelProps> = ({
    stream,
    error,
    isVideoEnabled,
    isAudioEnabled,
}) => {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const { remoteStream } = useWebRTC(stream);

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
                            muted // Local video must be muted to avoid echo
                            className="video-element"
                        />
                    ) : (
                        <div className="video-avatar">
                            <span className="avatar-initial">T</span>
                        </div>
                    )}
                    <div className="video-overlay">
                        <span className="participant-name">Tú</span>
                        {!isAudioEnabled && <span className="participant-muted">🔇</span>}
                    </div>
                </div>

                {/* Remote Participant Placeholder or Stream */}
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
                            {remoteStream ? 'Profesor / Alumno' : 'Esperando a alguien...'}
                        </span>
                        {!remoteStream && <span className="participant-muted">🔇</span>}
                    </div>
                </div>
            </div>

        </div>
    );
};
