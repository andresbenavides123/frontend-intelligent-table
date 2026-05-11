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
    onJoin
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [name, setName] = useState('');

    useEffect(() => {
        if (videoRef.current && stream) {
            // Check if the stream is already attached to prevent flicker
            if (videoRef.current.srcObject !== stream) {
                videoRef.current.srcObject = stream;
            }
        }
    }, [stream]);

    const handleJoinClick = () => {
        if (name.trim()) {
            onJoin(name.trim());
        }
    };

    return (
        <div className="waiting-room-container">
            <div className="waiting-room-card">
                <div className="waiting-room-header">
                    <h2>Ready to join?</h2>
                    <p>Room ID: <strong>{roomId || 'Loading...'}</strong></p>
                </div>

                <div className="preview-container">
                    {isVideoEnabled && stream ? (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted // Always mute local preview
                            className="preview-video"
                        />
                    ) : (
                        <div className="preview-fallback">
                            <span className="camera-off-icon">📷 Camera Off</span>
                        </div>
                    )}
                    
                    <div className="preview-controls">
                        <button 
                            className={`control-btn ${isAudioEnabled ? 'on' : 'off'}`}
                            onClick={toggleAudio}
                            title={isAudioEnabled ? "Turn off microphone" : "Turn on microphone"}
                        >
                            {isAudioEnabled ? '🎤' : '🔇'}
                        </button>
                        <button 
                            className={`control-btn ${isVideoEnabled ? 'on' : 'off'}`}
                            onClick={toggleVideo}
                            title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
                        >
                            {isVideoEnabled ? '📹' : '📷'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                <div className="join-form">
                    <input 
                        type="text" 
                        className="name-input"
                        placeholder="What's your name?"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleJoinClick()}
                        maxLength={30}
                    />
                    <button 
                        className="join-btn"
                        onClick={handleJoinClick}
                        disabled={!name.trim() || !roomId}
                    >
                        Join Room
                    </button>
                </div>
            </div>
        </div>
    );
};
