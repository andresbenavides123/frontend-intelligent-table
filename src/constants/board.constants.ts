import type { ColorSwatch, StrokeSize, SubjectOption, ThinkingStep } from '../types/board.types';

export const COLORS: ColorSwatch[] = [
    { value: '#000000', label: 'Black' },
    { value: '#1e40af', label: 'Blue' },
    { value: '#15803d', label: 'Green' },
    { value: '#b91c1c', label: 'Red' },
    { value: '#7c3aed', label: 'Violet' },
    { value: '#d97706', label: 'Orange' },
    { value: '#be185d', label: 'Pink' },
];

export const STROKES: StrokeSize[] = [
    { size: 2, label: 'XS' },
    { size: 4, label: 'S' },
    { size: 8, label: 'M' },
    { size: 14, label: 'L' },
];

export const SUBJECTS: SubjectOption[] = [
    { value: 'Matemáticas', emoji: '📐' },
    { value: 'Física', emoji: '⚛️' },
    { value: 'Química', emoji: '🧪' },
    { value: 'Geometría', emoji: '📏' },
    { value: 'Álgebra', emoji: '🔢' },
    { value: 'Cálculo', emoji: '∫' },
];

export const THINKING_STEPS: ThinkingStep[] = [
    { label: 'Procesando imagen...', duration: 800 },
    { label: 'Identificando elementos...', duration: 1400 },
    { label: 'Analizando con Gemini IA...', duration: 2200 },
    { label: 'Generando retroalimentación...', duration: 3200 },
];
