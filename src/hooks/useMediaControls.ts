import { useState, useEffect, useCallback } from 'react';

export const useMediaControls = () => {
    const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(true);
    const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
    const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

    const initializeMedia = useCallback(async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            setStream(mediaStream);
        } catch (err) {
            console.error('Error accessing media devices:', err);
            setError('No se pudo acceder a la cámara o el micrófono. Por favor, verifica los permisos de tu navegador.');
            setIsVideoEnabled(false);
            setIsAudioEnabled(false);
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        initializeMedia();

        return () => {
            // Cleanup: stop all tracks when unmounting
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
            if (screenStream) {
                screenStream.getTracks().forEach((track) => track.stop());
            }
        };
    }, [initializeMedia, stream, screenStream]);

    const toggleVideo = useCallback(() => {
        if (stream) {
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
            }
        }
    }, [stream]);

    const toggleAudio = useCallback(() => {
        if (stream) {
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioEnabled(audioTrack.enabled);
            }
        }
    }, [stream]);

    const stopScreenShare = useCallback(() => {
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
            setScreenStream(null);
            setIsScreenSharing(false);
        }
    }, [screenStream]);

    const toggleScreenShare = useCallback(async () => {
        if (isScreenSharing) {
            stopScreenShare();
            return;
        }

        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true, // Optional, can capture system audio
            });

            // If user stops sharing via browser UI button
            displayStream.getVideoTracks()[0].onended = () => {
                stopScreenShare();
            };

            setScreenStream(displayStream);
            setIsScreenSharing(true);
        } catch (err) {
            console.error('Error sharing screen:', err);
            // User cancelled or browser doesn't support it
        }
    }, [isScreenSharing, stopScreenShare]);

    return {
        stream,
        screenStream,
        isVideoEnabled,
        isAudioEnabled,
        isScreenSharing,
        error,
        toggleVideo,
        toggleAudio,
        toggleScreenShare,
    };
};
