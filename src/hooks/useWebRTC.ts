import { useEffect, useRef, useState, useCallback } from 'react';
import { useWebSocketContext } from '../context/WebSocketContext';

export const useWebRTC = (localStream: MediaStream | null) => {
    const ws = useWebSocketContext();
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);

    const initPeerConnection = useCallback((targetId: string) => {
        if (pcRef.current) {
            return pcRef.current; // Don't recreate if it exists!
        }

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
            ]
        });

        // Add local tracks if they exist at initialization time
        if (localStream) {
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });
        }

        pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                setRemoteStream(event.streams[0]);
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                ws.sendSignaling({
                    type: 'ice-candidate',
                    targetId,
                    payload: JSON.stringify(event.candidate)
                });
            }
        };

        pcRef.current = pc;
        return pc;
    }, [localStream, ws]);

    // Handle stream changes dynamically (e.g. switching to screen share)
    useEffect(() => {
        const pc = pcRef.current;
        if (pc && localStream) {
            const senders = pc.getSenders();
            const currentTracks = localStream.getTracks();
            
            // Add new tracks or replace existing ones
            currentTracks.forEach(track => {
                const sender = senders.find(s => s.track?.kind === track.kind);
                if (sender) {
                    sender.replaceTrack(track);
                } else {
                    pc.addTrack(track, localStream);
                }
            });
        }
    }, [localStream]);

    useEffect(() => {
        // Announce presence when connected
        if (ws.isConnected) {
            ws.sendSignaling({ type: 'join' });
        }
    }, [ws.isConnected, ws]);

    useEffect(() => {
        return ws.subscribeRtc(async (msg) => {
            if (msg.senderId === ws.senderId) return;
            if (msg.targetId && msg.targetId !== ws.senderId) return;

            try {
                if (msg.type === 'join') {
                    // Only the existing person creates an offer, to avoid glare
                    if (!pcRef.current) {
                        const pc = initPeerConnection(msg.senderId);
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        ws.sendSignaling({
                            type: 'offer',
                            targetId: msg.senderId,
                            payload: JSON.stringify(offer)
                        });
                    }
                } else if (msg.type === 'offer' && msg.payload) {
                    // We received an offer, so we are the new person (or answering)
                    const pc = initPeerConnection(msg.senderId);
                    const offerDesc = JSON.parse(msg.payload);
                    await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    ws.sendSignaling({
                        type: 'answer',
                        targetId: msg.senderId,
                        payload: JSON.stringify(answer)
                    });
                } else if (msg.type === 'answer' && msg.payload && pcRef.current) {
                    const answerDesc = JSON.parse(msg.payload);
                    await pcRef.current.setRemoteDescription(new RTCSessionDescription(answerDesc));
                } else if (msg.type === 'ice-candidate' && msg.payload && pcRef.current) {
                    const candidate = JSON.parse(msg.payload);
                    await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                }
            } catch (err) {
                console.error('Error handling WebRTC message:', err);
            }
        });
    }, [ws, initPeerConnection]);

    return { remoteStream };
};
