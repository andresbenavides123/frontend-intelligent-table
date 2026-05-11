import { useState, useEffect, useRef, useCallback } from 'react';
import { THINKING_STEPS } from '../constants/board.constants';

export const useAIFeedback = (isLoading: boolean, feedback: string | null) => {
    const [currentStep, setCurrentStep] = useState<number>(0);
    const [copied, setCopied] = useState<boolean>(false);
    const [analysisTime, setAnalysisTime] = useState<number | null>(null);
    const startTimeRef = useRef<number>(0);
    const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Handle loading animation steps
    useEffect(() => {
        if (isLoading) {
            startTimeRef.current = Date.now();
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCurrentStep(0);
            stepTimerRef.current = setInterval(() => {
                setCurrentStep((prev) => Math.min(prev + 1, THINKING_STEPS.length - 1));
            }, 900);
        } else {
            if (stepTimerRef.current) {
                clearInterval(stepTimerRef.current);
                stepTimerRef.current = null;
            }
            if (startTimeRef.current > 0 && feedback) {
                setAnalysisTime(Math.round((Date.now() - startTimeRef.current) / 100) / 10);
                startTimeRef.current = 0;
            }
        }

        return () => {
            if (stepTimerRef.current) clearInterval(stepTimerRef.current);
        };
    }, [isLoading, feedback]);

    const handleCopy = useCallback(async () => {
        if (!feedback) return;
        try {
            await navigator.clipboard.writeText(feedback);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback if clipboard API is not available
        }
    }, [feedback]);

    const formattedTime = useCallback(() => {
        const now = new Date();
        return now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    }, []);

    return {
        currentStep,
        copied,
        analysisTime,
        handleCopy,
        formattedTime
    };
};
