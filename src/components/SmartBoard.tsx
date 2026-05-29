import React from 'react';
import { ReactSketchCanvas } from 'react-sketch-canvas';
import type { CanvasPath } from 'react-sketch-canvas';
import { analyzeBoard } from '../services/apiService';
import type { SmartBoardProps, BoardElementDto } from '../types/board.types';
import { SUBJECTS } from '../constants/board.constants';
import { useSmartBoard } from '../hooks/useSmartBoard';
import { useBoardElements } from '../hooks/useBoardElements';
import { BoardToolbar } from './BoardToolbar';
import { DraggableElement } from './DraggableElement';
import html2canvas from 'html2canvas';
import { useWebSocketContext } from '../context/WebSocketContext';

/** Throttle delay (ms) for board-sync WS messages.
 *  200 ms strikes a balance between real-time feel and avoiding WS flooding,
 *  which is especially important on free-tier backends (e.g. Render) that may
 *  have limited throughput or introduce latency on incoming messages. */
const BOARD_SYNC_DEBOUNCE_MS = 200;


export const SmartBoard: React.FC<SmartBoardProps> = ({
    onFeedbackReceived,
    onLoadingStateChange,
    onNewAnalysis,
    onSubjectChange,
    isLoading,
    token,
}) => {
    const ws = useWebSocketContext();

    // Debounce timer so rapid strokes don't flood the WS channel and freeze the UI
    const strokeDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingStrokeRef = React.useRef<CanvasPath | null>(null);

    // ── Sync callbacks ───────────────────────────────────────────────────────
    const handleStrokeAdded = React.useCallback((path: CanvasPath) => {
        pendingStrokeRef.current = path;
        if (strokeDebounceRef.current) clearTimeout(strokeDebounceRef.current);
        strokeDebounceRef.current = setTimeout(() => {
            const pendingPath = pendingStrokeRef.current;
            if (!pendingPath) return;
            pendingStrokeRef.current = null;
            ws.sendBoardSync({
                action: 'add',
                element: {
                    id: Date.now().toString(),
                    type: 'path',
                    x: 0,
                    y: 0,
                    content: JSON.stringify(pendingPath),
                    color: pendingPath.strokeColor,
                    size: pendingPath.strokeWidth,
                },
            });
        }, BOARD_SYNC_DEBOUNCE_MS);
    }, [ws]);

    const {
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
    } = useSmartBoard(
        SUBJECTS[0].value,
        handleStrokeAdded,
    );

    const handleElementAdded = React.useCallback((element: BoardElementDto) => {
        ws.sendBoardSync({ action: 'add', element });
    }, [ws]);

    const {
        elements,
        isTyping,
        tempTextPos,
        addImage,
        addText,
        updateElement,
        startTyping,
        finishTyping,
        cancelTyping,
        clearElements,
    } = useBoardElements(handleElementAdded);

    const boardContainerRef = React.useRef<HTMLDivElement>(null);

    // Clean up debounce timer on unmount
    React.useEffect(() => {
        return () => {
            if (strokeDebounceRef.current) clearTimeout(strokeDebounceRef.current);
        };
    }, []);

    // ── Receive remote board events ──────────────────────────────────────────
    React.useEffect(() => {
        return ws.subscribeBoard(async (msg) => {
            if (msg.senderId === ws.senderId) return;

            if (msg.action === 'clear') {
                canvasRef.current?.clearCanvas();
                clearElements(true);
            } else if (msg.action === 'feedback' && msg.payload) {
                try {
                    const data = JSON.parse(msg.payload) as { subject?: string; feedback?: string };
                    if (data.subject) onSubjectChange(data.subject);
                    if (data.feedback) onFeedbackReceived(data.feedback);
                } catch (e) {
                    console.error('[SmartBoard] Failed to parse remote feedback payload', e);
                }
            } else if (msg.action === 'update' && msg.element) {
                // Remote drag/resize — update local element position/size
                updateElement(msg.element.id, {
                    x: msg.element.x,
                    y: msg.element.y,
                    width: (msg.element as any).width,
                    height: (msg.element as any).height,
                }, true);
            } else if (msg.action === 'add' && msg.element) {
                if (msg.element.type === 'path') {
                    try {
                        const pathData = JSON.parse(msg.element.content) as CanvasPath;
                        const currentPaths = await canvasRef.current?.exportPaths() ?? [];
                        canvasRef.current?.loadPaths([...currentPaths, pathData]);
                    } catch (e) {
                        console.error('[SmartBoard] Failed to parse remote path', e);
                    }
                } else if (msg.element.type === 'text') {
                    addText(msg.element.content, msg.element.x, msg.element.y, true, msg.element.id);
                } else if (msg.element.type === 'image') {
                    addImage(msg.element.content, msg.element.x, msg.element.y, true, msg.element.id);
                }
            }
        });
    }, [ws, clearElements, addText, addImage, updateElement, canvasRef, onSubjectChange, onFeedbackReceived]);

    // ── Restore board state from server history (fires once on (re)connect) ──
    React.useEffect(() => {
        return ws.subscribeInit(async (msg) => {
            if (msg.action !== 'init' || !msg.payload) return;
            console.log('[SmartBoard] Restoring board history from server...');

            let elements: Array<{
                id: string; type: string; x: number; y: number;
                content: string; color: string; size: number;
            }>;

            try {
                elements = JSON.parse(msg.payload);
            } catch (e) {
                console.error('[SmartBoard] Failed to parse board history payload', e);
                return;
            }

            const paths: CanvasPath[] = [];
            for (const el of elements) {
                if (el.type === 'path') {
                    try {
                        const path = JSON.parse(el.content) as CanvasPath;
                        paths.push(path);
                    } catch {
                        console.warn('[SmartBoard] Skipping unparseable path in history');
                    }
                } else if (el.type === 'text') {
                    addText(el.content, el.x, el.y, true, el.id);
                } else if (el.type === 'image') {
                    addImage(el.content, el.x, el.y, true, el.id);
                }
            }

            if (paths.length > 0) await canvasRef.current?.loadPaths(paths);
            console.log(`[SmartBoard] Board restored: ${paths.length} paths, ${elements.length - paths.length} overlay elements`);
        });
    }, [ws, addText, addImage, canvasRef]);

    /**
     * Clears the board locally AND notifies all peers.
     * Single broadcast — no duplicate WS messages.
     */
    const clearCanvas = () => {
        handleClear();
        clearElements();
        ws.sendBoardSync({ action: 'clear' });
        onFeedbackReceived('');
    };

    const boardHasContent = hasContent || elements.length > 0;

    const handleAnalyze = async () => {
        if (!boardContainerRef.current || !boardHasContent) return;
        onLoadingStateChange(true);
        onNewAnalysis();

        try {
            const canvas = await html2canvas(boardContainerRef.current, {
                backgroundColor: canvasBackground,
                useCORS: true,
            });
            const base64Data = canvas.toDataURL('image/png');
            const response = await analyzeBoard(
                {
                    subject,
                    base64Image: base64Data.split(',')[1] ?? base64Data,
                },
                token ?? '',
            );
            onFeedbackReceived(response.aiFeedback);

            ws.sendBoardSync({
                action: 'feedback',
                payload: JSON.stringify({
                    subject: response.subject ?? subject,
                    feedback: response.aiFeedback,
                }),
            });
        } catch (err) {
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : 'Error de conexión con el servidor.';
            console.error('[SmartBoard] handleAnalyze error:', err);
            onFeedbackReceived(` ${errorMessage}`);
        } finally {
            onLoadingStateChange(false);
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                const imageCount = elements.filter(el => el.type === 'image').length;
                if (imageCount >= 2) {
                    alert("⚠️ Auditoría de Sistema: Límite máximo de 2 imágenes alcanzado para evitar sobrecarga.");
                    return;
                }
                const blob = items[i].getAsFile();
                if (blob) {
                    if (blob.size > 10 * 1024 * 1024) {
                        alert("⚠️ Auditoría de Sistema: La imagen supera el tamaño máximo de 10 MB permitido por seguridad.");
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        if (event.target?.result) {
                            addImage(event.target.result as string, 50, 50);
                        }
                    };
                    reader.readAsDataURL(blob);
                }
            }
        }
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        if (elements.length >= 50) {
            alert("⚠️ Auditoría de Sistema: Límite máximo de 50 elementos en pantalla alcanzado. Limpia la pizarra.");
            return;
        }
        const rect = boardContainerRef.current?.getBoundingClientRect();
        if (rect) {
            startTyping(e.clientX - rect.left, e.clientY - rect.top);
        }
    };

    // ── Drag & resize handlers → update state + sync over WS ────────────────
    const handleElementMoved = React.useCallback((id: string, x: number, y: number) => {
        updateElement(id, { x, y });
        ws.sendBoardSync({
            action: 'update',
            element: {
                id,
                type: 'text', // type doesn't matter for update — server just forwards
                x, y,
                content: '',
                color: '',
                size: 0,
            },
        });
    }, [updateElement, ws]);

    const handleElementResized = React.useCallback((id: string, width: number, height: number) => {
        updateElement(id, { width, height });
        ws.sendBoardSync({
            action: 'update',
            element: {
                id,
                type: 'text',
                x: elements.find(el => el.id === id)?.x ?? 0,
                y: elements.find(el => el.id === id)?.y ?? 0,
                content: '',
                color: '',
                size: 0,
                // @ts-ignore — extra fields forwarded as-is
                width,
                height,
            },
        });
    }, [updateElement, ws, elements]);

    return (
        <div className="panel board-panel" onPaste={handlePaste}>
            {/* Panel Header */}
            <div className="panel-header">
                <div className="panel-title">
                    <span className="panel-title-icon"></span>
                    Pizarra Interactiva
                    {chalkMode && (
                        <span className="chalk-mode-badge"> Modo Pizarra</span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span style={{
                        fontSize: '0.75rem',
                        color: boardHasContent ? 'var(--accent-tertiary)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        transition: 'color 0.3s',
                    }}>
                        <span style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            background: boardHasContent ? 'var(--accent-tertiary)' : 'var(--text-muted)',
                            display: 'inline-block',
                        }} />
                        {boardHasContent ? 'Con contenido' : 'Vacío'}
                    </span>
                </div>
            </div>

            {/* Toolbar */}
            <BoardToolbar
                strokeColor={strokeColor}
                strokeWidth={strokeWidth}
                isEraser={isEraser}
                canUndo={canUndo}
                canRedo={canRedo}
                chalkMode={chalkMode}
                onColorChange={setDrawingColor}
                onWidthChange={setDrawingWidth}
                onToggleEraser={toggleEraser}
                onToggleChalkMode={toggleChalkMode}
                onUndo={handleUndo}
                onRedo={handleRedo}
            />

            {/* Canvas */}
            <div
                className={`canvas-wrapper${chalkMode ? ' chalk-mode' : ''}`}
                ref={boardContainerRef}
                onDoubleClick={handleDoubleClick}
                style={{ position: 'relative', background: canvasBackground }}
            >
                {!hasContent && elements.length === 0 && (
                    <div className="canvas-placeholder">
                        <div className="canvas-placeholder-icon"></div>
                        <div className={`canvas-placeholder-text${chalkMode ? ' chalk-placeholder' : ''}`}>
                            Escribe, dibuja o pega una imagen (Ctrl+V)
                        </div>
                    </div>
                )}

                {/* Overlay elements — now draggable & resizable */}
                {elements.map((el) => (
                    <DraggableElement
                        key={el.id}
                        element={el}
                        strokeColor={strokeColor}
                        onMoved={handleElementMoved}
                        onResized={handleElementResized}
                    />
                ))}

                {/* Inline text input */}
                {isTyping && (
                    <input
                        autoFocus
                        maxLength={200}
                        style={{
                            position: 'absolute',
                            left: tempTextPos.x,
                            top: tempTextPos.y - 10,
                            zIndex: 20,
                            fontSize: '1.2rem',
                            color: strokeColor,
                            fontFamily: 'var(--font-main)',
                            fontWeight: 600,
                            background: 'transparent',
                            border: '1px dashed var(--accent-primary)',
                            outline: 'none',
                            padding: '2px',
                        }}
                        onBlur={(e) => finishTyping(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') finishTyping(e.currentTarget.value);
                            else if (e.key === 'Escape') cancelTyping();
                        }}
                    />
                )}

                <ReactSketchCanvas
                    ref={canvasRef}
                    strokeWidth={effectiveStrokeWidth}
                    strokeColor={effectiveColor}
                    canvasColor="transparent"
                    style={{ border: 'none', width: '100%', height: '100%', background: 'transparent' }}
                    onStroke={handleStroke}
                />
            </div>

            {/* Subject Tags */}
            <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, padding: '0.5rem 1rem 0' }}>
                    Materia
                </div>
                <div className="subject-tags">
                    {SUBJECTS.map((s) => (
                        <button
                            key={s.value}
                            className={`subject-tag ${subject === s.value ? 'selected' : ''}`}
                            onClick={() => {
                                setSubject(s.value);
                                onSubjectChange(s.value);
                            }}
                            aria-pressed={subject === s.value}
                        >
                            {s.emoji} {s.value}
                        </button>
                    ))}
                </div>
            </div>

            {/* Controls */}
            <div className="board-controls">
                <button
                    id="btn-clear"
                    className="btn btn-danger"
                    onClick={clearCanvas}
                    disabled={!boardHasContent || isLoading}
                    aria-label="Limpiar pizarra"
                >
                    <span className="btn-icon"></span>
                    Limpiar
                </button>

                <button
                    id="btn-analyze"
                    className={`btn btn-primary ${isLoading ? 'loading' : ''}`}
                    onClick={handleAnalyze}
                    disabled={!boardHasContent || isLoading}
                    style={{ flex: 1 }}
                    aria-label="Evaluar con IA"
                >
                    {!isLoading && <span className="btn-icon"></span>}
                    {isLoading ? 'Analizando...' : `Evaluar con IA · ${subject}`}
                </button>
            </div>
        </div>
    );
};
