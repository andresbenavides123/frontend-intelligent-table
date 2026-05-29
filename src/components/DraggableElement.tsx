import React, { useRef, useCallback, useState } from 'react';
import type { BoardElement } from '../hooks/useBoardElements';

interface DraggableElementProps {
    element: BoardElement;
    strokeColor: string;
    onMoved: (id: string, x: number, y: number) => void;
    onResized: (id: string, width: number, height: number) => void;
}

/**
 * DraggableElement
 *
 * Wraps a board overlay element (text or image) and makes it:
 *   1. Draggable via pointerdown → pointermove → pointerup on the wrapper.
 *   2. Resizable via a small handle on the bottom-right corner.
 *
 * Uses pointer capture so drag/resize continues even if the cursor
 * leaves the element boundary quickly.
 */
export const DraggableElement: React.FC<DraggableElementProps> = ({
    element,
    strokeColor,
    onMoved,
    onResized,
}) => {
    // Local position / size state — mirrors parent but allows smooth local updates
    const [pos, setPos] = useState({ x: element.x, y: element.y });
    const [size, setSize] = useState({
        w: element.width ?? (element.type === 'image' ? 300 : undefined),
        h: element.height ?? (element.type === 'image' ? 200 : undefined),
    });

    // ── Drag logic ────────────────────────────────────────────
    const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const onDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        // Don't start drag if the user clicked on the resize handle
        if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origX: pos.x,
            origY: pos.y,
        };
        e.currentTarget.style.cursor = 'grabbing';
    }, [pos]);

    const onDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        setPos({
            x: Math.max(0, dragRef.current.origX + dx),
            y: Math.max(0, dragRef.current.origY + dy),
        });
    }, []);

    const onDragEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        e.currentTarget.style.cursor = '';
        const newX = Math.max(0, dragRef.current.origX + (e.clientX - dragRef.current.startX));
        const newY = Math.max(0, dragRef.current.origY + (e.clientY - dragRef.current.startY));
        dragRef.current = null;
        onMoved(element.id, newX, newY);
    }, [element.id, onMoved]);

    // ── Resize logic ──────────────────────────────────────────
    const resizeRef = useRef<{
        startX: number; startY: number;
        origW: number; origH: number;
    } | null>(null);
    const resizeHandleRef = useRef<HTMLDivElement>(null);

    const onResizeStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        e.stopPropagation(); // prevent parent drag
        e.currentTarget.setPointerCapture(e.pointerId);
        const currentW = size.w ?? (wrapperRef.current?.offsetWidth ?? 100);
        const currentH = size.h ?? (wrapperRef.current?.offsetHeight ?? 40);
        resizeRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origW: currentW,
            origH: currentH,
        };
    }, [size]);

    const onResizeMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!resizeRef.current) return;
        const dx = e.clientX - resizeRef.current.startX;
        const dy = e.clientY - resizeRef.current.startY;
        setSize({
            w: Math.max(60, resizeRef.current.origW + dx),
            h: Math.max(30, resizeRef.current.origH + dy),
        });
    }, []);

    const onResizeEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!resizeRef.current) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        const newW = Math.max(60, resizeRef.current.origW + (e.clientX - resizeRef.current.startX));
        const newH = Math.max(30, resizeRef.current.origH + (e.clientY - resizeRef.current.startY));
        resizeRef.current = null;
        onResized(element.id, newW, newH);
    }, [element.id, onResized]);

    return (
        <div
            ref={wrapperRef}
            className="draggable-element"
            style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                width: size.w,
                height: element.type === 'text' ? undefined : size.h,
                zIndex: 10,
                userSelect: 'none',
                touchAction: 'none',
            }}
            onPointerDown={onDragStart}
            onPointerMove={dragRef.current ? onDragMove : undefined}
            onPointerUp={onDragEnd}
        >
            {/* Content */}
            {element.type === 'text' ? (
                <span
                    className="draggable-text-content"
                    style={{
                        fontSize: '1.2rem',
                        color: strokeColor,
                        fontFamily: 'var(--font-main)',
                        fontWeight: 600,
                        display: 'block',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        width: size.w ? '100%' : undefined,
                    }}
                >
                    {element.content}
                </span>
            ) : (
                <img
                    src={element.content}
                    alt="Imagen en pizarra"
                    draggable={false}
                    style={{
                        width: size.w ? '100%' : undefined,
                        height: size.h ? '100%' : undefined,
                        maxWidth: size.w ? undefined : '300px',
                        maxHeight: size.h ? undefined : '300px',
                        display: 'block',
                        borderRadius: '4px',
                        border: '2px solid var(--accent-primary)',
                        objectFit: 'contain',
                        pointerEvents: 'none',
                    }}
                />
            )}

            {/* Resize handle — bottom-right corner */}
            <div
                ref={resizeHandleRef}
                className="resize-handle"
                onPointerDown={onResizeStart}
                onPointerMove={resizeRef.current ? onResizeMove : undefined}
                onPointerUp={onResizeEnd}
            />
        </div>
    );
};
