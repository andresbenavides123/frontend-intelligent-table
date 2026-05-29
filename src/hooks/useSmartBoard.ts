import { useState, useCallback, useRef } from 'react';
import type { ReactSketchCanvasRef, CanvasPath } from 'react-sketch-canvas';

// Chalk-mode color palettes
export const NORMAL_COLORS = [
    { value: '#000000', label: 'Negro' },
    { value: '#1e40af', label: 'Azul' },
    { value: '#15803d', label: 'Verde' },
    { value: '#b91c1c', label: 'Rojo' },
    { value: '#7c3aed', label: 'Violeta' },
    { value: '#d97706', label: 'Naranja' },
    { value: '#be185d', label: 'Rosa' },
];

export const CHALK_COLORS = [
    { value: '#ffffff', label: 'Tiza blanca' },
    { value: '#93c5fd', label: 'Azul cielo' },
    { value: '#86efac', label: 'Verde menta' },
    { value: '#fca5a5', label: 'Rosa coral' },
    { value: '#c4b5fd', label: 'Lavanda' },
    { value: '#fde68a', label: 'Amarillo' },
    { value: '#6ee7b7', label: 'Turquesa' },
];

export const CANVAS_BG_NORMAL = '#ffffff';
export const CANVAS_BG_CHALK = '#1a1a2e';

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
    const [chalkMode, setChalkMode] = useState<boolean>(false);

    const canvasBackground = chalkMode ? CANVAS_BG_CHALK : CANVAS_BG_NORMAL;

    // Eraser color adapts to canvas background
    const eraserColor = canvasBackground;
    const effectiveColor = isEraser ? eraserColor : strokeColor;
    const effectiveStrokeWidth = isEraser ? 24 : strokeWidth;

    const handleStroke = useCallback((path: CanvasPath, isEraserPath: boolean) => {
        canvasRef.current?.exportPaths().then(paths => {
            if (paths.length > 500) {
                alert("⚠️ Auditoría de Sistema: Has alcanzado el límite de 500 trazos por seguridad. Se deshará el último trazo.");
                canvasRef.current?.undo();
                return;
            }
            setHasContent(true);
            setCanUndo(true);
            onStrokeAdded?.(path, isEraserPath);
        }).catch(err => {
            console.error("[SmartBoard] Failed to export paths", err);
            // Fallback in case of error, still allow basic function
            setHasContent(true);
            setCanUndo(true);
            onStrokeAdded?.(path, isEraserPath);
        });
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

    const toggleChalkMode = useCallback(() => {
        setChalkMode(prev => {
            const next = !prev;
            // Auto-switch stroke color to match the new mode
            setStrokeColor(next ? '#ffffff' : '#000000');
            setIsEraser(false);
            return next;
        });
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
        chalkMode,
        canvasBackground,
        effectiveColor,
        effectiveStrokeWidth,
        handleStroke,
        handleUndo,
        handleRedo,
        handleClear,
        toggleEraser,
        setDrawingColor,
        setDrawingWidth,
        toggleChalkMode,
    };
};
