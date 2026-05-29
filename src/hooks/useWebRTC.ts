import { useEffect, useRef, useState, useCallback } from 'react';
import { useWebSocketContext } from '../context/WebSocketContext';

/**
 * ICE server configuration.
 *
 * Order matters — the browser tries them in sequence:
 *  1. Google STUN (free, fastest for direct P2P connections)
 *  2. Open Relay TURN (free relay for symmetric-NAT scenarios — no account required)
 *
 * Note: open-relay.metered.ca is a community TURN server. It may be unstable
 * at peak hours. Replace with a paid TURN (Metered, Twilio, etc.) for production.
 */
const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
        urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp',
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
];

/**
 * useWebRTC — manages a peer-to-peer WebRTC session for exactly two participants.
 *
 * Signaling flow (over STOMP WebSocket):
 *  1. Both peers A and B connect to the WS room.
 *  2. B (late joiner) broadcasts a "join" signal.
 *  3. A (already present) receives "join" → creates an SDP offer → sends to B.
 *  4. B receives the offer → creates an SDP answer → sends to A.
 *  5. Both peers exchange ICE candidates until a P2P (or TURN-relayed) path is found.
 *
 * Screen share support:
 *  Pass a non-null `screenStream` to silently replace the outgoing video track
 *  in the PeerConnection (replaceTrack — no renegotiation required).
 *  When `screenStream` returns to null, the camera video track is restored.
 *  The local camera preview is NOT affected by `screenStream`.
 *
 * Reliability:
 *  - Open Relay TURN servers are used as a relay fallback when direct P2P fails
 *    (e.g., symmetric NAT, which is common in consumer ISPs).
 *  - ICE is automatically restarted when the connection state reaches "failed".
 *  - ICE candidates that arrive before remoteDescription is set are queued and
 *    flushed once the remote description becomes available.
 *
 * @param cameraStream  Local camera + microphone MediaStream.
 * @param screenStream  Active screen-share MediaStream, or null when not sharing.
 */
export const useWebRTC = (
    cameraStream: MediaStream | null,
    screenStream: MediaStream | null,
) => {
    const ws = useWebSocketContext();

    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    const pcRef             = useRef<RTCPeerConnection | null>(null);
    const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
    const hasJoinedRef      = useRef(false);
    const remoteIdRef       = useRef<string>('');

    /**
     * Refs mirror the latest stream values so closures (like createPeerConnection)
     * always read the current stream without needing to re-declare as dependencies,
     * which would cause signaling subscriptions to be torn down and re-created on
     * every stream change.
     */
    const cameraStreamRef = useRef<MediaStream | null>(cameraStream);
    const screenStreamRef = useRef<MediaStream | null>(screenStream);
    useEffect(() => { cameraStreamRef.current = cameraStream; }, [cameraStream]);
    useEffect(() => { screenStreamRef.current = screenStream; }, [screenStream]);

    // ── Create (or recreate) a fresh RTCPeerConnection ────────────────────────
    /**
     * Tears down any existing peer connection and creates a new one.
     * Attaches whichever stream is currently active (screen > camera).
     */
    const createPeerConnection = useCallback((targetId: string): RTCPeerConnection => {
        // Tear down the previous connection cleanly
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        pendingCandidates.current = [];
        remoteIdRef.current = targetId;

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        // Attach active local tracks: screen share overrides camera video
        const activeStream = screenStreamRef.current ?? cameraStreamRef.current;
        activeStream?.getTracks().forEach(track => pc.addTrack(track, activeStream));

        // Expose the remote participant's stream once tracks arrive
        pc.ontrack = ({ streams }) => {
            if (streams?.[0]) setRemoteStream(streams[0]);
        };

        // Forward our ICE candidates to the remote peer via STOMP
        pc.onicecandidate = ({ candidate }) => {
            if (!candidate) return;
            ws.sendSignaling({
                type: 'ice-candidate',
                targetId,
                payload: JSON.stringify(candidate),
            });
        };

        pc.onicegatheringstatechange = () =>
            console.debug('[WebRTC] ICE gathering state:', pc.iceGatheringState);

        pc.onconnectionstatechange = () => {
            console.log('[WebRTC] Connection state:', pc.connectionState);

            if (pc.connectionState === 'failed') {
                // Attempt an ICE restart before giving up entirely
                console.warn('[WebRTC] Connection failed — restarting ICE');
                pc.restartIce();
            }

            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                setRemoteStream(null);
            }
        };

        pcRef.current = pc;
        return pc;
    }, [ws]);

    // ── Replace camera tracks when cameraStream changes ───────────────────────
    /**
     * Replaces existing senders with updated camera tracks.
     * Skips track kinds currently covered by an active screen share to avoid
     * unintentionally overriding the screen video track.
     */
    useEffect(() => {
        const pc = pcRef.current;
        if (!pc || !cameraStream) return;

        const senders = pc.getSenders();

        cameraStream.getTracks().forEach(track => {
            const sender = senders.find(s => s.track?.kind === track.kind);

            if (!sender) {
                pc.addTrack(track, cameraStream);
                return;
            }

            // Do NOT overwrite the video sender while a screen share is active
            const coveredByScreen = !!screenStreamRef.current
                ?.getTracks().find(t => t.kind === track.kind);

            if (!coveredByScreen) {
                sender.replaceTrack(track).catch(err =>
                    console.error('[WebRTC] replaceTrack (camera update) failed:', err)
                );
            }
        });
    }, [cameraStream]);

    // ── Replace video track when screenStream changes ─────────────────────────
    /**
     * When screen sharing starts, silently swaps the video sender's track to the
     * screen capture track (replaceTrack — no renegotiation needed).
     * When screen sharing stops, restores the camera video track.
     */
    useEffect(() => {
        const pc = pcRef.current;
        if (!pc) return;

        const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (!videoSender) return;

        const nextVideoTrack = screenStream
            ? screenStream.getVideoTracks()[0]                          // screen share active
            : cameraStreamRef.current?.getVideoTracks()[0] ?? null;    // restore camera

        if (nextVideoTrack) {
            videoSender.replaceTrack(nextVideoTrack).catch(err =>
                console.error('[WebRTC] replaceTrack (screen share) failed:', err)
            );
        }
    }, [screenStream]);

    // ── Flush ICE candidates queued before remoteDescription was set ──────────
    const flushPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
        const queued = pendingCandidates.current.splice(0);
        for (const init of queued) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(init));
            } catch (err) {
                console.warn('[WebRTC] Failed to apply queued ICE candidate:', err);
            }
        }
    }, []);

    // ── Announce presence once WebSocket connects ─────────────────────────────
    useEffect(() => {
        if (ws.isConnected && !hasJoinedRef.current) {
            hasJoinedRef.current = true;
            ws.sendSignaling({ type: 'join' });
            console.log('[WebRTC] Sent join signal');
        }
        // Reset flag on disconnect so we re-announce on the next reconnect
        if (!ws.isConnected) hasJoinedRef.current = false;
    }, [ws.isConnected, ws]);

    // ── Main signaling handler ────────────────────────────────────────────────
    useEffect(() => {
        return ws.subscribeRtc(async (msg) => {
            // Ignore our own echoed messages
            if (msg.senderId === ws.senderId) return;
            // Ignore targeted messages not addressed to this peer
            if (msg.targetId && msg.targetId !== ws.senderId) return;

            try {
                switch (msg.type) {
                    case 'join': {
                        console.log('[WebRTC] "join" from', msg.senderId, '— creating offer');
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
                        break;
                    }

                    case 'offer': {
                        if (!msg.payload) break;
                        console.log('[WebRTC] Received offer from', msg.senderId);
                        const pc = createPeerConnection(msg.senderId);
                        await pc.setRemoteDescription(
                            new RTCSessionDescription(JSON.parse(msg.payload))
                        );
                        await flushPendingCandidates(pc);
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        ws.sendSignaling({
                            type: 'answer',
                            targetId: msg.senderId,
                            payload: JSON.stringify(answer),
                        });
                        break;
                    }

                    case 'answer': {
                        if (!msg.payload || !pcRef.current) break;
                        console.log('[WebRTC] Received answer from', msg.senderId);
                        await pcRef.current.setRemoteDescription(
                            new RTCSessionDescription(JSON.parse(msg.payload))
                        );
                        await flushPendingCandidates(pcRef.current);
                        break;
                    }

                    case 'ice-candidate': {
                        if (!msg.payload) break;
                        const candidate = JSON.parse(msg.payload) as RTCIceCandidateInit;
                        const pc = pcRef.current;
                        if (pc?.remoteDescription) {
                            await pc.addIceCandidate(new RTCIceCandidate(candidate));
                        } else {
                            // Queue until remote description is set
                            pendingCandidates.current.push(candidate);
                        }
                        break;
                    }
                }
            } catch (err) {
                console.error('[WebRTC] Error in signaling handler:', err);
            }
        });
    }, [ws, createPeerConnection, flushPendingCandidates]);

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    useEffect(() => () => {
        pcRef.current?.close();
        pcRef.current = null;
    }, []);

    return { remoteStream };
};
