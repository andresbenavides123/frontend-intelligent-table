import { useState, useEffect, useCallback } from 'react';
import { SmartBoard } from './components/SmartBoard';
import { AIFeedbackPanel } from './components/AIFeedbackPanel';
import { VideoConferencePanel } from './components/VideoConference/VideoConferencePanel';
import { MediaControls } from './components/VideoConference/MediaControls';
import { useMediaControls } from './hooks/useMediaControls';
import { checkBackendHealth, getToken } from './services/apiService';
import { WebSocketProvider } from './context/WebSocketContext';
import { WaitingRoom } from './components/WaitingRoom/WaitingRoom';
import { CallEndedRoom } from './components/CallEndedRoom/CallEndedRoom';
import { generateRoomId, decodeJwtPayload } from './utils/appUtils';
import { SUBJECTS } from './constants/board.constants';
import './index.css';

// ── Minimal toast (no external library needed) ──────────────────────────────
function useToast() {
    const [toast, setToast] = useState<string | null>(null);
    const showToast = useCallback((msg: string, duration = 2500) => {
        setToast(msg);
        setTimeout(() => setToast(null), duration);
    }, []);
    return { toast, showToast };
}

function App() {
    const [feedback, setFeedback] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [analysisCount, setAnalysisCount] = useState<number>(0);
    const [currentSubject, setCurrentSubject] = useState<string>(SUBJECTS[0].value);
    const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'unknown'>('unknown');
    const [roomId, setRoomId] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [hasJoined, setHasJoined] = useState<boolean>(false);
    const [callEnded, setCallEnded] = useState<boolean>(false);
    const [userName, setUserName] = useState<string>('');
    const { toast, showToast } = useToast();

    const [returnUrl, setReturnUrl] = useState<string | null>(null);

    // Live clock — evaluates every second (not just on first render)
    const [currentTime, setCurrentTime] = useState(() => new Date());
    useEffect(() => {
        const tick = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(tick);
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        let room = params.get('room');
        const tokenParam = params.get('token');
        const returnUrlParam = params.get('returnUrl');

        if (returnUrlParam) {
            setReturnUrl(returnUrlParam);
        }

        if (!room) {
            room = generateRoomId();
            // Preserve returnUrl in the URL when redirecting to a new room
            const url = new URL(window.location.href);
            url.searchParams.set('room', room);
            window.history.replaceState({}, '', url.toString());
        }
        setRoomId(room);

        if (tokenParam) {
            setToken(tokenParam);
            const payload = decodeJwtPayload(tokenParam);
            if (payload && payload.name) {
                setUserName(payload.name);
            }
        }
    }, []);

    // Poll backend health on mount and every 10 seconds
    const pollHealth = useCallback(async () => {
        const isOnline = await checkBackendHealth();
        setBackendStatus(isOnline ? 'online' : 'offline');
    }, []);

    useEffect(() => {
        pollHealth();
        const interval = setInterval(pollHealth, 10_000);
        return () => clearInterval(interval);
    }, [pollHealth]);
    
    // Media controls managed at app level for the bottom bar
    const { 
        stream, 
        screenStream,
        isVideoEnabled, 
        isAudioEnabled, 
        isScreenSharing,
        error, 
        toggleVideo, 
        toggleAudio,
        toggleScreenShare,
        stopAllMedia,
    } = useMediaControls();

    const handleEndCall = useCallback(() => {
        stopAllMedia();
        // Return to waiting room on call end and show end screen
        setHasJoined(false);
        setCallEnded(true);
    }, [stopAllMedia]);

    const handleFeedbackReceived = (newFeedback: string) => {
        setFeedback(newFeedback);
        if (!newFeedback) {
            // When clearing canvas
            return;
        }
        // A successful response means the backend is reachable
        const looksLikeError = /error de conexión|sin respuesta|backend no está/i.test(newFeedback);
        setBackendStatus(looksLikeError ? 'offline' : 'online');
    };

    const handleNewAnalysis = () => {
        setAnalysisCount((prev) => prev + 1);
    };

    if (callEnded) {
        return (
            <CallEndedRoom 
                onRejoin={() => {
                    setCallEnded(false);
                }}
                hasReturnUrl={!!returnUrl}
                onGoHome={() => {
                    if (returnUrl) {
                        window.location.href = returnUrl;
                        return;
                    }
                    // Generate new room
                    const newRoom = generateRoomId();
                    window.history.pushState({}, '', `?room=${newRoom}`);
                    setRoomId(newRoom);
                    setToken(null);
                    setCallEnded(false);
                    setHasJoined(false);
                }}
            />
        );
    }

    if (!hasJoined) {
        return (
            <WaitingRoom
                stream={stream}
                roomId={roomId}
                isVideoEnabled={isVideoEnabled}
                isAudioEnabled={isAudioEnabled}
                toggleVideo={toggleVideo}
                toggleAudio={toggleAudio}
                error={error}
                initialName={userName}
                onJoin={async (name) => {
                    setUserName(name);
                    // Obtain JWT token before joining room
                    if (roomId) {
                        try {
                            const jwt = await getToken(roomId, name);
                            setToken(jwt);
                        } catch (e) {
                            console.error('Failed to obtain JWT token:', e);
                        }
                    }
                    setHasJoined(true);
                }}
            />
        );
    }

    return (
        <>
        <WebSocketProvider roomId={roomId} token={token}>
            {/* App Wrapper */}
            <div className="app-wrapper">
                {/* Header */}
                <header className="app-header">
                    <div className="header-brand">
                        <div className="header-logo" aria-label="Smart Edu Board Logo">
                            🎓
                        </div>
                        <div className="header-title-group">
                            <h1>Smart Edu Board</h1>
                            <span className="header-subtitle">Pizarra Inteligente · Powered by Gemini AI</span>
                        </div>
                    </div>

                    <div className="header-badges">
                        <span className="header-version">v1.0.0</span>
                        <div
                            className={`status-badge ${backendStatus === 'online' ? 'online' : backendStatus === 'offline' ? 'offline' : 'offline'}`}
                            title={`Backend ${backendStatus === 'online' ? 'conectado' : 'desconectado'}`}
                        >
                            <span className="status-dot" />
                            {backendStatus === 'online' ? 'Backend Online' :
                             backendStatus === 'offline' ? 'Backend Offline' : 'Esperando...'}
                        </div>
                    </div>
                </header>

                {/* Main Layout */}
                <main className="main-content">
                    {/* Left: Video Call */}
                    {/* stream is always the camera; screenStream is passed separately so
                        WebRTC can replace the outgoing video track without changing the
                        local preview (local video always shows the camera, not the screen). */}
                    <VideoConferencePanel
                        stream={stream}
                        screenStream={isScreenSharing ? screenStream : null}
                        error={error}
                        isVideoEnabled={isVideoEnabled}
                        isAudioEnabled={isAudioEnabled}
                        userName={userName}
                    />

                    {/* Center: Smart Board or Screen Share */}
                    <div className="center-workspace">
                        {isScreenSharing && screenStream ? (
                            <div className="panel screen-share-panel">
                                <div className="panel-header">
                                    <div className="panel-title">
                                        <span className="panel-title-icon">💻</span>
                                        Presentando Pantalla
                                    </div>
                                </div>
                                <video 
                                    autoPlay 
                                    playsInline 
                                    muted 
                                    className="screen-share-video"
                                    ref={(video) => {
                                        if (video && video.srcObject !== screenStream) {
                                            video.srcObject = screenStream;
                                        }
                                    }}
                                />
                            </div>
                        ) : (
                            <SmartBoard
                                onFeedbackReceived={handleFeedbackReceived}
                                onLoadingStateChange={setIsLoading}
                                onNewAnalysis={handleNewAnalysis}
                                onSubjectChange={setCurrentSubject}
                                isLoading={isLoading}
                                token={token}
                            />
                        )}
                    </div>
                    <AIFeedbackPanel
                        feedback={feedback}
                        isLoading={isLoading}
                        analysisCount={analysisCount}
                        subject={currentSubject}
                    />
                </main>
                
                {/* Bottom Control Bar (Meet Style) */}
                <footer className="app-footer">
                    <div className="footer-left">
                        <span className="time-display">
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="separator">|</span>
                        <span className="meeting-id" title="Comparte este enlace para invitar a otros">{roomId}</span>
                        <button
                            className="footer-btn"
                            style={{ marginLeft: '8px', fontSize: '14px', padding: '4px 8px' }}
                            onClick={() => {
                                navigator.clipboard
                                    .writeText(window.location.href)
                                    .then(() => showToast('✅ Enlace copiado al portapapeles'))
                                    .catch(() => showToast('❌ No se pudo copiar el enlace'));
                            }}
                            title="Copiar enlace de la sala"
                        >
                            🔗 Copiar Enlace
                        </button>
                    </div>
                    <div className="footer-center">
                        <MediaControls 
                            isVideoEnabled={isVideoEnabled}
                            isAudioEnabled={isAudioEnabled}
                            isScreenSharing={isScreenSharing}
                            onToggleVideo={toggleVideo}
                            onToggleAudio={toggleAudio}
                            onToggleScreenShare={toggleScreenShare}
                            onEndCall={handleEndCall}
                        />
                    </div>
                    <div className="footer-right">
                        <button className="footer-btn" title="Detalles">ℹ️</button>
                        <button className="footer-btn" title="Chat">💬</button>
                    </div>
                </footer>
            </div>

            {/* Toast notification */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    bottom: '96px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(30,30,30,0.92)',
                    color: '#fff',
                    padding: '0.6rem 1.25rem',
                    borderRadius: '9999px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                    zIndex: 9999,
                    pointerEvents: 'none',
                    backdropFilter: 'blur(8px)',
                    animation: 'fb-fadein 0.25s ease',
                }}>
                    {toast}
                </div>
            )}
        </WebSocketProvider>
        </>
    );
}

export default App;
// Mejoras visuales y optimización del frontend