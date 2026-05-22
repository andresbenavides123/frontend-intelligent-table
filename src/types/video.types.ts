export interface MediaControlState {
    isVideoEnabled: boolean;
    isAudioEnabled: boolean;
}

export interface MediaControlsProps {
    isVideoEnabled: boolean;
    isAudioEnabled: boolean;
    isScreenSharing: boolean;
    onToggleVideo: () => void;
    onToggleAudio: () => void;
    onToggleScreenShare: () => void;
    onEndCall?: () => void;
}

export interface Participant {
    id: string;
    name: string;
    isMuted: boolean;
    isCameraOff: boolean;
    isLocal?: boolean;
}
