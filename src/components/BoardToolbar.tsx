import React from 'react';
import { STROKES } from '../constants/board.constants';
import { NORMAL_COLORS, CHALK_COLORS } from '../hooks/useSmartBoard';

interface BoardToolbarProps {
    strokeColor: string;
    strokeWidth: number;
    isEraser: boolean;
    canUndo: boolean;
    canRedo: boolean;
    chalkMode: boolean;
    onColorChange: (color: string) => void;
    onWidthChange: (width: number) => void;
    onToggleEraser: () => void;
    onToggleChalkMode: () => void;
    onUndo: () => void;
    onRedo: () => void;
}

export const BoardToolbar: React.FC<BoardToolbarProps> = ({
    strokeColor,
    strokeWidth,
    isEraser,
    canUndo,
    canRedo,
    chalkMode,
    onColorChange,
    onWidthChange,
    onToggleEraser,
    onToggleChalkMode,
    onUndo,
    onRedo,
}) => {
    // Show chalk palette in chalk mode, normal palette otherwise
    const colors = chalkMode ? CHALK_COLORS : NORMAL_COLORS;

    return (
        <div className={`toolbar ${chalkMode ? 'toolbar-chalk' : ''}`}>
            {/* Chalk Mode Toggle */}
            <button
                id="tool-chalk-mode"
                className={`tool-btn chalk-mode-btn ${chalkMode ? 'active' : ''}`}
                onClick={onToggleChalkMode}
                title={chalkMode ? 'Modo Normal (☀️)' : 'Modo Pizarra (🌙)'}
                aria-label={chalkMode ? 'Cambiar a modo normal' : 'Cambiar a modo pizarra oscura'}
                aria-pressed={chalkMode}
            >
                {chalkMode ? '☀️' : '🌙'}
            </button>

            <div className="toolbar-divider" />

            {/* Color Swatches — adapts based on chalk mode */}
            <div className="color-swatches">
                {colors.map((c) => (
                    <button
                        key={c.value}
                        className={`color-swatch ${!isEraser && strokeColor === c.value ? 'selected' : ''}`}
                        style={{
                            background: c.value,
                            // Chalk colors need a visible border on dark backgrounds
                            borderColor: chalkMode
                                ? (!isEraser && strokeColor === c.value ? '#fff' : 'rgba(255,255,255,0.25)')
                                : (!isEraser && strokeColor === c.value ? '#0f172a' : 'transparent'),
                        }}
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
                                background: chalkMode ? 'rgba(255,255,255,0.7)' : undefined,
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
