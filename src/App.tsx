import { useState, useEffect, useCallback } from 'react';
import { SmartBoard } from './components/SmartBoard';
import { AIFeedbackPanel } from './components/AIFeedbackPanel';
import { VideoConferencePanel } from './components/VideoConference/VideoConferencePanel';
import { MediaControls } from './components/VideoConference/MediaControls';
import { useMediaControls } from './hooks/useMediaControls';
import { checkBackendHealth } from './services/apiService';
import { WebSocketProvider } from './context/WebSocketContext';
import './index.css';

function App() {
    const [feedback, setFeedback] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [analysisCount, setAnalysisCount] = useState<number>(0);
    const [currentSubject, setCurrentSubject] = useState<string>('Matemáticas');
    const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'unknown'>('unknown');
    const [roomId, setRoomId] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        let room = params.get('room');
        if (!room) {
            room = Math.random().toString(36).substring(2, 10);
            window.history.replaceState({}, '', `?room=${room}`);
        }
        setRoomId(room);
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
        toggleScreenShare 
    } = useMediaControls();

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

    return (
        <>
        <WebSocketProvider roomId={roomId}>
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
                    <VideoConferencePanel 
                        stream={isScreenSharing && screenStream ? screenStream : stream}
                        error={error}
                        isVideoEnabled={isVideoEnabled}
                        isAudioEnabled={isAudioEnabled}
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
                        <span className="time-display">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        <span className="separator">|</span>
                        <span className="meeting-id" title="Comparte este enlace para invitar a otros">{roomId}</span>
                        <button 
                            className="footer-btn" 
                            style={{marginLeft: '8px', fontSize: '14px', padding: '4px 8px'}}
                            onClick={() => {
                                navigator.clipboard.writeText(window.location.href);
                                alert('Enlace de la sala copiado al portapapeles');
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
                        />
                    </div>
                    <div className="footer-right">
                        <button className="footer-btn" title="Detalles">ℹ️</button>
                        <button className="footer-btn" title="Chat">💬</button>
                    </div>
                </footer>
            </div>
        </WebSocketProvider>
        </>
    );
}

export default App;
