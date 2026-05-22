import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Manages camera, microphone and screen-share streams.
 *
 * ⚠️  IMPORTANT: stream / screenStream must NOT be listed as effect deps.
 *     Doing so causes an infinite loop:
 *       initializeMedia() → setStream() → effect re-runs → initializeMedia() → …
 *     Instead we track the live streams via refs for cleanup purposes only.
 */
export const useMediaControls = () => {
    const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(true);
    const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
    const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    // Tracks whether the stream is ready; prevents toggle calls from silently failing
    const [isStreamReady, setIsStreamReady] = useState<boolean>(false);

    // Refs mirror the latest state so the cleanup function always has the
    // current stream without needing to re-run the effect on every change.
    const streamRef = useRef<MediaStream | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);

    useEffect(() => { streamRef.current = stream; }, [stream]);
    useEffect(() => { screenStreamRef.current = screenStream; }, [screenStream]);

    // Runs ONCE on mount. Dependency array is intentionally empty.
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true,
                });
                if (!cancelled) {
                    setStream(mediaStream);
                    streamRef.current = mediaStream;
                    setIsStreamReady(true);
                    // Sync initial track states with state
                    const videoTrack = mediaStream.getVideoTracks()[0];
                    const audioTrack = mediaStream.getAudioTracks()[0];
                    if (videoTrack) setIsVideoEnabled(videoTrack.enabled);
                    if (audioTrack) setIsAudioEnabled(audioTrack.enabled);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('[useMediaControls] getUserMedia failed:', err);
                    setError(
                        'No se pudo acceder a la cámara o el micrófono. ' +
                        'Por favor, verifica los permisos de tu navegador.'
                    );
                    setIsVideoEnabled(false);
                    setIsAudioEnabled(false);
                    setIsStreamReady(false);
                }
            }
        })();

        // Cleanup: stop all tracks on unmount
        return () => {
            cancelled = true;
            streamRef.current?.getTracks().forEach(t => t.stop());
            screenStreamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, []); // ← intentionally empty

    const toggleVideo = useCallback(() => {
        const currentStream = streamRef.current;
        if (!currentStream) return;
        const videoTrack = currentStream.getVideoTracks()[0];
        if (!videoTrack) return;
        // Toggle by directly inverting the enabled state — no race condition
        const nextEnabled = !videoTrack.enabled;
        videoTrack.enabled = nextEnabled;
        setIsVideoEnabled(nextEnabled);
    }, []);

    const toggleAudio = useCallback(() => {
        const currentStream = streamRef.current;
        if (!currentStream) return;
        const audioTrack = currentStream.getAudioTracks()[0];
        if (!audioTrack) return;
        // Toggle by directly inverting the enabled state — no race condition
        const nextEnabled = !audioTrack.enabled;
        audioTrack.enabled = nextEnabled;
        setIsAudioEnabled(nextEnabled);
    }, []);

    const stopAllMedia = useCallback(() => {
        // Stop camera & microphone tracks
        streamRef.current?.getTracks().forEach(t => t.stop());
        setStream(null);
        streamRef.current = null;
        // Stop screen share if active
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        setScreenStream(null);
        screenStreamRef.current = null;
        setIsScreenSharing(false);
        setIsStreamReady(false);
    }, []);

    const stopScreenShare = useCallback(() => {
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        setScreenStream(null);
        screenStreamRef.current = null;
        setIsScreenSharing(false);
    }, []);

    const toggleScreenShare = useCallback(async () => {
        if (isScreenSharing) {
            stopScreenShare();
            return;
        }
        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
            });

            // Handle browser-native "stop sharing" button
            displayStream.getVideoTracks()[0].onended = stopScreenShare;

            setScreenStream(displayStream);
            screenStreamRef.current = displayStream;
            setIsScreenSharing(true);
        } catch (err) {
            // User cancelled or browser doesn't support it — not an error
            console.warn('[useMediaControls] getDisplayMedia cancelled or failed:', err);
        }
    }, [isScreenSharing, stopScreenShare]);

    return {
        stream,
        screenStream,
        isVideoEnabled,
        isAudioEnabled,
        isScreenSharing,
        isStreamReady,
        error,
        toggleVideo,
        toggleAudio,
        toggleScreenShare,
        stopAllMedia,
    };
};
