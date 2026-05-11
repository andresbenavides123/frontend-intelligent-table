import React from 'react';
import { COLORS, STROKES } from '../constants/board.constants';

interface BoardToolbarProps {
    strokeColor: string;
    strokeWidth: number;
    isEraser: boolean;
    canUndo: boolean;
    canRedo: boolean;
    onColorChange: (color: string) => void;
    onWidthChange: (width: number) => void;
    onToggleEraser: () => void;
    onUndo: () => void;
    onRedo: () => void;
}

export const BoardToolbar: React.FC<BoardToolbarProps> = ({
    strokeColor,
    strokeWidth,
    isEraser,
    canUndo,
    canRedo,
    onColorChange,
    onWidthChange,
    onToggleEraser,
    onUndo,
    onRedo,
}) => {
    return (
        <div className="toolbar">
            {/* Color Swatches */}
            <div className="color-swatches">
                {COLORS.map((c) => (
                    <button
                        key={c.value}
                        className={`color-swatch ${!isEraser && strokeColor === c.value ? 'selected' : ''}`}
                        style={{ background: c.value }}
                        title={c.label}
                        onClick={() => onColorChange(c.value)}
                        aria-label={`Color ${c.label}`}
                    />
                ))}
            </div>

            <div className="toolbar-divider" />

            {/* Stroke Sizes */}
            <div className="stroke-sizes">
                {STROKES.map((s) => (
                    <button
                        key={s.size}
                        className={`stroke-btn ${!isEraser && strokeWidth === s.size ? 'active' : ''}`}
                        title={`Trazo ${s.label}`}
                        onClick={() => onWidthChange(s.size)}
                        aria-label={`Tamaño ${s.label}`}
                    >
                        <span
                            className="stroke-dot"
                            style={{
                                width: `${Math.min(s.size * 1.5, 16)}px`,
                                height: `${Math.min(s.size * 1.5, 16)}px`,
                            }}
                        />
                    </button>
                ))}
            </div>

            <div className="toolbar-divider" />

            {/* Tools */}
            <button
                id="tool-eraser"
                className={`tool-btn ${isEraser ? 'active' : ''}`}
                onClick={onToggleEraser}
                title="Borrador"
                aria-label="Borrador"
            >
                🧹
            </button>

            <button
                id="tool-undo"
                className="tool-btn"
                onClick={onUndo}
                disabled={!canUndo}
                title="Deshacer"
                aria-label="Deshacer"
            >
                ↩️
            </button>

            <button
                id="tool-redo"
                className="tool-btn"
                onClick={onRedo}
                disabled={!canRedo}
                title="Rehacer"
                aria-label="Rehacer"
            >
                ↪️
            </button>
        </div>
    );
};
