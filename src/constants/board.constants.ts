import type { ColorSwatch, StrokeSize, SubjectOption, ThinkingStep } from '../types/board.types';

export const COLORS: ColorSwatch[] = [
    { value: '#000000', label: 'Negro' },
    { value: '#1e40af', label: 'Azul' },
    { value: '#15803d', label: 'Verde' },
    { value: '#b91c1c', label: 'Rojo' },
    { value: '#7c3aed', label: 'Violeta' },
    { value: '#d97706', label: 'Naranja' },
    { value: '#be185d', label: 'Rosa' },
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
