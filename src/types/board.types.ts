export interface ExerciseRequest {
    subject: string;
    base64Image: string;
}

export interface ExerciseResponse {
    id?: string;
    subject: string;
    aiFeedback: string;
}

export interface SmartBoardProps {
    onFeedbackReceived: (feedback: string) => void;
    onLoadingStateChange: (isLoading: boolean) => void;
    onNewAnalysis: () => void;
    onSubjectChange: (subject: string) => void;
    isLoading: boolean;
    token: string | null;
}

export interface FeedbackPanelProps {
    feedback: string | null;
    isLoading: boolean;
    analysisCount: number;
    subject: string;
}

export interface ColorSwatch {
    value: string;
    label: string;
}

export interface StrokeSize {
    size: number;
    label: string;
}

export interface SubjectOption {
    value: string;
    emoji: string;
}

export interface ThinkingStep {
    label: string;
    duration: number;
}

export interface BoardElementDto {
    id: string;
    type: 'text' | 'image' | 'path';
    x: number;
    y: number;
    content: string;
    color: string;
    size: number;
}

export interface BoardSyncMessageDto {
    action: 'add' | 'update' | 'delete' | 'clear' | 'feedback' | 'init';
    roomId: string;
    senderId: string;
    element?: BoardElementDto;
    payload?: string;
}

export interface WebRtcMessageDto {
    type: 'join' | 'leave' | 'offer' | 'answer' | 'ice-candidate';
    roomId: string;
    senderId: string;
    targetId?: string;
    payload?: string; // JSON string of RTCSessionDescriptionInit or RTCIceCandidateInit
}
