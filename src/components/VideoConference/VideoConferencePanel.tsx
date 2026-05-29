import React, { useEffect, useRef } from 'react';
import { useWebRTC } from '../../hooks/useWebRTC';

export interface VideoConferencePanelProps {
    /** Local camera + microphone stream. Always the camera, even when screen sharing. */
    stream: MediaStream | null;
    /**
     * Active screen-share stream, or null when not sharing.
     * This stream replaces the outgoing video track in the peer connection
     * without affecting the local camera preview.
     */
    screenStream?: MediaStream | null;
    error: string | null;
    isVideoEnabled: boolean;
    isAudioEnabled: boolean;
    /** Local user's display name — used to render an avatar initial when the camera is off */
    userName?: string;
}

/**
 * VideoConferencePanel — renders local and remote video feeds for a 1-on-1 session.
 *
 * The local preview always shows the camera stream regardless of screen sharing.
 * Screen share is sent to the remote peer via WebRTC track replacement.
 */
export const VideoConferencePanel: React.FC<VideoConferencePanelProps> = ({
    stream,
    screenStream = null,
    error,
    isVideoEnabled,
    isAudioEnabled,
    userName = '',
}) => {
    const localVideoRef  = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    // Pass both streams to the WebRTC hook:
    //  - `stream`       → camera tracks added to the peer connection + shown in local preview
    //  - `screenStream` → replaces only the outgoing video track (no local preview change)
    const { remoteStream } = useWebRTC(stream, screenStream);

    const localInitial = userName.trim().charAt(0).toUpperCase() || '?';

    // Bind the camera stream to the local <video> element
    useEffect(() => {
        const el = localVideoRef.current;
        if (el && stream) {
            el.srcObject = stream;
        }
    }, [stream]);

    // Bind the remote stream to the remote <video> element
    useEffect(() => {
        const el = remoteVideoRef.current;
        if (el && remoteStream) {
            el.srcObject = remoteStream;
            el.play().catch(e => console.warn('[VideoConference] Auto-play prevented:', e));
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

                {/* ── Local video — always camera, never screen share ── */}
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

                {/* ── Remote participant ── */}
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
