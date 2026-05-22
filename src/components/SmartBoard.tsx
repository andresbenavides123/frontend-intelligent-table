import React from 'react';
import { ReactSketchCanvas } from 'react-sketch-canvas';
import type { CanvasPath } from 'react-sketch-canvas';
import { analyzeBoard } from '../services/apiService';
import type { SmartBoardProps, BoardElementDto } from '../types/board.types';
import { SUBJECTS } from '../constants/board.constants';
import { useSmartBoard } from '../hooks/useSmartBoard';
import { useBoardElements } from '../hooks/useBoardElements';
import { BoardToolbar } from './BoardToolbar';
import html2canvas from 'html2canvas';
import { useWebSocketContext } from '../context/WebSocketContext';

export const SmartBoard: React.FC<SmartBoardProps> = ({
    onFeedbackReceived,
    onLoadingStateChange,
    onNewAnalysis,
    onSubjectChange,
    isLoading,
    token,
}) => {
    const ws = useWebSocketContext();

    // ── Sync callbacks (passed to hooks so they broadcast WITHOUT triggering
    //    an extra WS send from clearCanvas — see Fix #2 below)
    const handleStrokeAdded = React.useCallback((path: CanvasPath) => {
        ws.sendBoardSync({
            action: 'add',
            element: {
                id: Date.now().toString(),
                type: 'path',
                x: 0,
                y: 0,
                content: JSON.stringify(path),
                color: path.strokeColor,
                size: path.strokeWidth,
            },
        });
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
        effectiveColor,
        effectiveStrokeWidth,
        handleStroke,
        handleUndo,
        handleRedo,
        handleClear,
        toggleEraser,
        setDrawingColor,
        setDrawingWidth,
    } = useSmartBoard(
        SUBJECTS[0].value,
        handleStrokeAdded,
        // ← No `onCleared` here. clearCanvas (below) sends the WS event once.
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
        startTyping,
        finishTyping,
        cancelTyping,
        clearElements,
    } = useBoardElements(
        handleElementAdded,
        // ← No `onCleared` here either.
    );

    const boardContainerRef = React.useRef<HTMLDivElement>(null);

    // ── Receive remote board events
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
    }, [ws, clearElements, addText, addImage, canvasRef, onSubjectChange, onFeedbackReceived]);

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

            // Separate paths from overlay elements
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
                    // isRemote=true to avoid broadcasting back to server
                    addText(el.content, el.x, el.y, true, el.id);
                } else if (el.type === 'image') {
                    addImage(el.content, el.x, el.y, true, el.id);
                }
            }

            // Load all paths at once for performance
            if (paths.length > 0) {
                await canvasRef.current?.loadPaths(paths);
            }

            console.log(`[SmartBoard] Board restored: ${paths.length} paths, ${elements.length - paths.length} overlay elements`);
        });
    }, [ws, addText, addImage, canvasRef]);

    /**
     * Clears the board locally AND notifies all peers.
     *
     * ⚠️  Previously this sent 3 WS messages because:
     *       handleClear()  → onCleared() → sendBoardSync  (1st)
     *       clearElements() → onCleared() → sendBoardSync (2nd)
     *       handleBoardCleared() explicitly            (3rd)
     *
     *     Fixed by NOT wiring onCleared to the hooks and sending once here.
     */
    const clearCanvas = () => {
        handleClear();         // resets canvas SVG + state (no WS call)
        clearElements();       // resets overlays state  (no WS call)
        ws.sendBoardSync({ action: 'clear' }); // ← single broadcast
        onFeedbackReceived('');
    };

    const boardHasContent = hasContent || elements.length > 0;

    const handleAnalyze = async () => {
        if (!boardContainerRef.current || !boardHasContent) return;

        onLoadingStateChange(true);
        onNewAnalysis();

        try {
            const canvas = await html2canvas(boardContainerRef.current, {
                backgroundColor: '#ffffff',
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
            onFeedbackReceived(`⚠️ ${errorMessage}`);
        } finally {
            onLoadingStateChange(false);
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                const blob = items[i].getAsFile();
                if (blob) {
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
        const rect = boardContainerRef.current?.getBoundingClientRect();
        if (rect) {
            startTyping(e.clientX - rect.left, e.clientY - rect.top);
        }
    };

    return (
        <div className="panel board-panel" onPaste={handlePaste}>
            {/* Panel Header */}
            <div className="panel-header">
                <div className="panel-title">
                    <span className="panel-title-icon">✏️</span>
                    Pizarra Interactiva
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
                onColorChange={setDrawingColor}
                onWidthChange={setDrawingWidth}
                onToggleEraser={toggleEraser}
                onUndo={handleUndo}
                onRedo={handleRedo}
            />

            {/* Canvas */}
            <div
                className="canvas-wrapper"
                ref={boardContainerRef}
                onDoubleClick={handleDoubleClick}
                style={{ position: 'relative' }}
            >
                {!hasContent && elements.length === 0 && (
                    <div className="canvas-placeholder">
                        <div className="canvas-placeholder-icon">✍️</div>
                        <div className="canvas-placeholder-text">
                            Escribe, dibuja o pega una imagen (Ctrl+V)
                        </div>
                    </div>
                )}

                {/* Overlay elements (text / images) */}
                {elements.map((el) => (
                    <div
                        key={el.id}
                        style={{
                            position: 'absolute',
                            left: el.x,
                            top: el.y,
                            zIndex: 10,
                            pointerEvents: 'none',
                        }}
                    >
                        {el.type === 'text' ? (
                            <span style={{ fontSize: '1.2rem', color: strokeColor, fontFamily: 'var(--font-main)', fontWeight: 600 }}>
                                {el.content}
                            </span>
                        ) : (
                            <img
                                src={el.content}
                                alt="Imagen pegada"
                                style={{ maxWidth: '300px', maxHeight: '300px', borderRadius: '4px', border: '2px solid var(--accent-primary)' }}
                            />
                        )}
                    </div>
                ))}

                {/* Inline text input */}
                {isTyping && (
                    <input
                        autoFocus
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
                    <span className="btn-icon">🗑️</span>
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
                    {!isLoading && <span className="btn-icon">✨</span>}
                    {isLoading ? 'Analizando...' : `Evaluar con IA · ${subject}`}
                </button>
            </div>
        </div>
    );
};
