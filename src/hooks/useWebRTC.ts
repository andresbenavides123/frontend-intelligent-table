import { useEffect, useRef, useState, useCallback } from 'react';
import { useWebSocketContext } from '../context/WebSocketContext';

/**
 * useWebRTC — handles peer-to-peer video/audio between exactly two participants.
 *
 * Signaling flow:
 *  1. Both users A and B connect to the WS room.
 *  2. When B joins, B sends "join".
 *  3. A (already in the room) receives "join" from B → A creates an offer and sends it to B.
 *  4. B receives A's offer → B creates an answer and sends it back to A.
 *  5. Both exchange ICE candidates.
 *
 * Key fixes applied:
 *  - "join" is only sent ONCE after WS connects, using a ref flag so it doesn't re-fire on re-renders.
 *  - PeerConnection is torn down & rebuilt when a new "join" arrives (handles reconnects / page reload).
 *  - Tracks are added to the PC as soon as both localStream AND pc exist, via an effect.
 *  - ICE candidates that arrive before remoteDescription is set are queued and applied afterwards.
 */
export const useWebRTC = (localStream: MediaStream | null) => {
    const ws = useWebSocketContext();
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
    const hasJoinedRef = useRef(false);     // prevents double "join" on re-render
    const remoteIdRef = useRef<string>(''); // track who we are talking to

    // ── Create (or recreate) the PeerConnection ───────────────────────────────
    const createPeerConnection = useCallback((targetId: string): RTCPeerConnection => {
        // Tear down any existing connection first
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        pendingCandidates.current = [];
        remoteIdRef.current = targetId;

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ],
        });

        // Attach local tracks immediately if the stream is already available
        if (localStream) {
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });
        }

        // Receive remote track → expose as remoteStream
        pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                setRemoteStream(event.streams[0]);
            }
        };

        // Send ICE candidates through the signaling channel
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                ws.sendSignaling({
                    type: 'ice-candidate',
                    targetId,
                    payload: JSON.stringify(event.candidate),
                });
            }
        };

        pc.onconnectionstatechange = () => {
            console.log('[WebRTC] Connection state:', pc.connectionState);
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                setRemoteStream(null);
            }
        };

        pcRef.current = pc;
        return pc;
    }, [localStream, ws]);

    // ── When localStream becomes available AFTER the PC was created, add tracks ─
    useEffect(() => {
        const pc = pcRef.current;
        if (!pc || !localStream) return;

        const senders = pc.getSenders();
        localStream.getTracks().forEach(track => {
            const existingSender = senders.find(s => s.track?.kind === track.kind);
            if (existingSender) {
                // Replace the track (e.g. camera ↔ screen share)
                existingSender.replaceTrack(track).catch(console.error);
            } else {
                pc.addTrack(track, localStream);
            }
        });
    }, [localStream]);

    // ── Announce presence once WS connects ───────────────────────────────────
    useEffect(() => {
        if (ws.isConnected && !hasJoinedRef.current) {
            hasJoinedRef.current = true;
            ws.sendSignaling({ type: 'join' });
            console.log('[WebRTC] Sent join signal');
        }
        // Reset flag when disconnected so it fires again on reconnect
        if (!ws.isConnected) {
            hasJoinedRef.current = false;
        }
    }, [ws.isConnected, ws]);

    // ── Helper: flush queued ICE candidates after remoteDescription is set ────
    const flushPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
        const queue = [...pendingCandidates.current];
        pendingCandidates.current = [];
        for (const candidate of queue) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
                console.warn('[WebRTC] Failed to add queued ICE candidate:', err);
            }
        }
    }, []);

    // ── Main signaling handler ────────────────────────────────────────────────
    useEffect(() => {
        return ws.subscribeRtc(async (msg) => {
            // Ignore our own messages
            if (msg.senderId === ws.senderId) return;
            // For targeted messages (offer/answer/ice), ignore those not for us
            if (msg.targetId && msg.targetId !== ws.senderId) return;

            try {
                if (msg.type === 'join') {
                    // A new participant entered. We (the existing user) create the offer.
                    console.log('[WebRTC] Received "join" from', msg.senderId, '— creating offer');
                    const pc = createPeerConnection(msg.senderId);
                    const offer = await pc.createOffer({
                        offerToReceiveAudio: true,
                        offerToReceiveVideo: true,
                    });
                    await pc.setLocalDescription(offer);
                    ws.sendSignaling({
                        type: 'offer',
                        targetId: msg.senderId,
                        payload: JSON.stringify(offer),
                    });

                } else if (msg.type === 'offer' && msg.payload) {
                    // We received an offer → create answer
                    console.log('[WebRTC] Received offer from', msg.senderId);
                    const pc = createPeerConnection(msg.senderId);
                    const offerDesc = JSON.parse(msg.payload);
                    await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));
                    await flushPendingCandidates(pc);

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    ws.sendSignaling({
                        type: 'answer',
                        targetId: msg.senderId,
                        payload: JSON.stringify(answer),
                    });

                } else if (msg.type === 'answer' && msg.payload && pcRef.current) {
                    console.log('[WebRTC] Received answer from', msg.senderId);
                    const answerDesc = JSON.parse(msg.payload);
                    await pcRef.current.setRemoteDescription(new RTCSessionDescription(answerDesc));
                    await flushPendingCandidates(pcRef.current);

                } else if (msg.type === 'ice-candidate' && msg.payload) {
                    const candidate = JSON.parse(msg.payload);
                    const pc = pcRef.current;

                    if (pc && pc.remoteDescription) {
                        // Remote description already set → add immediately
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    } else {
                        // Remote description not set yet → queue for later
                        pendingCandidates.current.push(candidate);
                    }
                }
            } catch (err) {
                console.error('[WebRTC] Error handling signaling message:', err);
            }
        });
    }, [ws, createPeerConnection, flushPendingCandidates]);

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            pcRef.current?.close();
            pcRef.current = null;
        };
    }, []);

    return { remoteStream };
};
