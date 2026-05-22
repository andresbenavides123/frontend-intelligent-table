import { useState, useCallback, useRef } from 'react';
import type { ReactSketchCanvasRef, CanvasPath } from 'react-sketch-canvas';

export const useSmartBoard = (
    initialSubject: string = 'Mathematics',
    onStrokeAdded?: (path: CanvasPath, isEraser: boolean) => void,
    onCleared?: () => void
) => {
    const canvasRef = useRef<ReactSketchCanvasRef>(null);
    const [subject, setSubject] = useState<string>(initialSubject);
    const [strokeColor, setStrokeColor] = useState<string>('#000000');
    const [strokeWidth, setStrokeWidth] = useState<number>(4);
    const [isEraser, setIsEraser] = useState<boolean>(false);
    const [hasContent, setHasContent] = useState<boolean>(false);
    const [canUndo, setCanUndo] = useState<boolean>(false);
    const [canRedo, setCanRedo] = useState<boolean>(false);

    const effectiveColor = isEraser ? '#ffffff' : strokeColor;
    const effectiveStrokeWidth = isEraser ? 24 : strokeWidth;

    const handleStroke = useCallback((path: CanvasPath, isEraserPath: boolean) => {
        setHasContent(true);
        setCanUndo(true);
        onStrokeAdded?.(path, isEraserPath);
    }, [onStrokeAdded]);

    const handleUndo = useCallback(() => {
        canvasRef.current?.undo();
        setCanRedo(true);
    }, []);

    const handleRedo = useCallback(() => {
        canvasRef.current?.redo();
    }, []);

    const handleClear = useCallback(() => {
        canvasRef.current?.clearCanvas();
        setHasContent(false);
        setCanUndo(false);
        setCanRedo(false);
        onCleared?.();
    }, [onCleared]);

    const toggleEraser = useCallback(() => {
        setIsEraser(prev => !prev);
    }, []);

    const setDrawingColor = useCallback((color: string) => {
        setStrokeColor(color);
        setIsEraser(false);
    }, []);

    const setDrawingWidth = useCallback((width: number) => {
        setStrokeWidth(width);
        setIsEraser(false);
    }, []);

    return {
        canvasRef,
        subject,
        setSubject,
        strokeColor,
        strokeWidth,
        isEraser,
        hasContent,
        canUndo,
        canRedo,
        effectiveColor,
        effectiveStrokeWidth,
        handleStroke,
        handleUndo,
        handleRedo,
        handleClear,
        toggleEraser,
        setDrawingColor,
        setDrawingWidth,
    };
};
