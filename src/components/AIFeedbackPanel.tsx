import React, { useState } from 'react';
import type { FeedbackPanelProps } from '../types/board.types';
import { THINKING_STEPS } from '../constants/board.constants';
import { useAIFeedback } from '../hooks/useAIFeedback';

// ─────────────────────────────────────────────────────────────
// Semantic line classifier — returns a card-type for each line
// ─────────────────────────────────────────────────────────────
type LineType = 'heading' | 'correct' | 'error' | 'tip' | 'formula' | 'step' | 'neutral';

interface ParsedLine {
    type: LineType;
    text: string;
    raw: string;
}

function classifyLine(line: string): ParsedLine {
    const clean = line.trim();

    // Headings: lines starting with #, or all-caps short phrases, or ending with ':'
    if (/^#{1,3}\s/.test(clean)) {
        return { type: 'heading', text: clean.replace(/^#{1,3}\s/, ''), raw: clean };
    }

    // Formula / math: contains =, ², ³, √, ∫, ∑, fractions, or code-like content
    if (/[=²³√∫∑∞±]|^\s*\d+[+\-×÷*/]|\d+\s*[+\-×÷*/=]\s*\d|\\frac|\\sqrt|\$/.test(clean)) {
        return { type: 'formula', text: clean, raw: clean };
    }

    // Numbered steps: "1.", "2)", "Paso 1", "Step 1"
    if (/^(\d+[.)]\s|paso\s*\d|step\s*\d)/i.test(clean)) {
        return { type: 'step', text: clean, raw: clean };
    }

    // Positive signals
    if (/✓|✅|correcto|bien|excelente|perfecto|muy bien|acertado|bravo|felicit|logr|éxito|correc/i.test(clean)) {
        return { type: 'correct', text: clean, raw: clean };
    }

    // Error / correction signals
    if (/✗|❌|error|incorrecto|debería|debe ser|falta|recuerda|incompleto|mal|equivoc|corrig|revisa|ojo[,!:\s]|cuidado|atención/i.test(clean)) {
        return { type: 'error', text: clean, raw: clean };
    }

    // Tip / advice signals
    if (/💡|tip[:\s]|nota[:\s]|consejo[:\s]|sugerencia|recuerda que|ten en cuenta|important[e:]|considera/i.test(clean)) {
        return { type: 'tip', text: clean, raw: clean };
    }

    return { type: 'neutral', text: clean, raw: clean };
}

function parseFeedback(text: string): ParsedLine[] {
    return text
        .split('\n')
        .filter(l => l.trim() !== '')
        .map(classifyLine);
}

// ─────────────────────────────────────────────────────────────
// Score extraction — look for a numeric score in the feedback
// ─────────────────────────────────────────────────────────────
function extractScore(text: string): number | null {
    const match = text.match(/(\d{1,3})\s*\/\s*100|(\d{1,2})\s*\/\s*10|puntaje[:\s]+(\d+)|nota[:\s]+(\d+)/i);
    if (!match) return null;
    const raw = match[1] ?? match[2] ?? match[3] ?? match[4];
    const val = parseInt(raw, 10);
    // Normalize to 0–100
    if (match[2]) return val * 10;
    return val > 100 ? null : val;
}

// ─────────────────────────────────────────────────────────────
// Score ring — SVG circular progress
// ─────────────────────────────────────────────────────────────
const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
    const r = 30;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';

    return (
        <div className="score-ring-wrapper" title={`Puntaje: ${score}/100`}>
            <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" />
                <circle
                    cx="40" cy="40" r={r} fill="none"
                    stroke={color} strokeWidth="7"
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform="rotate(-90 40 40)"
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
                <text x="40" y="45" textAnchor="middle" fontSize="14" fontWeight="700" fill={color}>
                    {score}
                </text>
            </svg>
            <span className="score-ring-label">/ 100</span>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
// Individual line cards
// ─────────────────────────────────────────────────────────────
const LineCard: React.FC<{ line: ParsedLine; index: number }> = ({ line, index }) => {
    const delay = `${index * 0.06}s`;

    if (line.type === 'heading') {
        return (
            <div className="fb-heading" style={{ animationDelay: delay }}>
                {line.text}
            </div>
        );
    }

    if (line.type === 'formula') {
        return (
            <div className="fb-card fb-formula" style={{ animationDelay: delay }}>
                <span className="fb-card-icon">📐</span>
                <code className="fb-formula-text">{line.text}</code>
            </div>
        );
    }

    if (line.type === 'step') {
        return (
            <div className="fb-card fb-step" style={{ animationDelay: delay }}>
                <span className="fb-step-bullet" />
                <span className="fb-step-text">{line.text}</span>
            </div>
        );
    }

    if (line.type === 'correct') {
        return (
            <div className="fb-card fb-correct" style={{ animationDelay: delay }}>
                <span className="fb-card-icon">✅</span>
                <span className="fb-card-text">{line.text.replace(/^[✓✅]\s*/, '')}</span>
            </div>
        );
    }

    if (line.type === 'error') {
        return (
            <div className="fb-card fb-error" style={{ animationDelay: delay }}>
                <span className="fb-card-icon">❌</span>
                <span className="fb-card-text">{line.text.replace(/^[✗❌]\s*/, '')}</span>
            </div>
        );
    }

    if (line.type === 'tip') {
        return (
            <div className="fb-card fb-tip" style={{ animationDelay: delay }}>
                <span className="fb-card-icon">💡</span>
                <span className="fb-card-text">{line.text}</span>
            </div>
        );
    }

    // neutral
    return (
        <p className="fb-neutral" style={{ animationDelay: delay }}>
            {line.text}
        </p>
    );
};

// ─────────────────────────────────────────────────────────────
// Summary chips — how many of each type?
// ─────────────────────────────────────────────────────────────
const SummaryChips: React.FC<{ lines: ParsedLine[] }> = ({ lines }) => {
    const correctCount = lines.filter(l => l.type === 'correct').length;
    const errorCount = lines.filter(l => l.type === 'error').length;
    const tipCount = lines.filter(l => l.type === 'tip').length;

    if (!correctCount && !errorCount && !tipCount) return null;

    return (
        <div className="fb-summary-chips">
            {correctCount > 0 && (
                <span className="fb-chip fb-chip-correct">
                    ✅ {correctCount} {correctCount === 1 ? 'logro' : 'logros'}
                </span>
            )}
            {errorCount > 0 && (
                <span className="fb-chip fb-chip-error">
                    ❌ {errorCount} {errorCount === 1 ? 'corrección' : 'correcciones'}
                </span>
            )}
            {tipCount > 0 && (
                <span className="fb-chip fb-chip-tip">
                    💡 {tipCount} {tipCount === 1 ? 'consejo' : 'consejos'}
                </span>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export const AIFeedbackPanel: React.FC<FeedbackPanelProps> = ({
    feedback,
    isLoading,
    analysisCount,
    subject,
}) => {
    const { currentStep, copied, analysisTime, handleCopy, formattedTime } = useAIFeedback(
        isLoading,
        feedback
    );

    const [expanded, setExpanded] = useState(true);

    const parsedLines = feedback ? parseFeedback(feedback) : [];
    const score = feedback ? extractScore(feedback) : null;

    return (
        <div className="panel feedback-panel">
            {/* ── Panel Header ── */}
            <div className="panel-header">
                <div className="panel-title">
                    <span className="panel-title-icon">🤖</span>
                    Tutor IA
                </div>
                <div className="fb-header-right">
                    {analysisCount > 0 && (
                        <span className="fb-analysis-badge">#{analysisCount}</span>
                    )}
                    {feedback && (
                        <button
                            className="fb-toggle-btn"
                            onClick={() => setExpanded(e => !e)}
                            title={expanded ? 'Colapsar' : 'Expandir'}
                        >
                            {expanded ? '▲' : '▼'}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Scrollable body ── */}
            <div className="feedback-scroll">
                {/* ── LOADING ── */}
                {isLoading && (
                    <div className="feedback-loading">
                        <div className="fb-spinner-ring">
                            <div className="fb-spinner" />
                        </div>
                        <div className="fb-loading-label">Gemini está analizando tu trabajo...</div>
                        <div className="thinking-steps">
                            {THINKING_STEPS.map((step, idx) => {
                                const status =
                                    idx < currentStep ? 'done' :
                                    idx === currentStep ? 'active' : '';
                                return (
                                    <div key={idx} className={`thinking-step ${status}`}>
                                        <span className="thinking-step-dot" />
                                        <span>{step.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── EMPTY ── */}
                {!isLoading && !feedback && (
                    <div className="feedback-empty">
                        <div className="feedback-empty-illustration">
                            <div className="feedback-empty-orbit" />
                            <span className="feedback-empty-icon">🎯</span>
                        </div>
                        <h3>Tu tutor está listo</h3>
                        <p>
                            Dibuja un ejercicio o escribe una ecuación en la pizarra y presiona
                            <strong> "Evaluar con IA"</strong> para obtener correcciones
                            detalladas al instante.
                        </p>
                        <div className="feedback-hint-chips">
                            <span className="hint-chip">📐 Ecuaciones</span>
                            <span className="hint-chip">📊 Gráficas</span>
                            <span className="hint-chip">🧮 Cálculos</span>
                            <span className="hint-chip">🔢 Álgebra</span>
                        </div>
                    </div>
                )}

                {/* ── RESULT ── */}
                {!isLoading && feedback && expanded && (
                    <div className="feedback-result">

                        {/* Meta row */}
                        <div className="fb-meta-row">
                            <span className="fb-badge fb-badge-gemini">✨ Gemini AI</span>
                            <span className="fb-badge fb-badge-subject">📚 {subject}</span>
                            <span className="fb-timestamp">{formattedTime()}</span>
                        </div>

                        {/* Score + summary chips */}
                        <div className="fb-score-area">
                            {score !== null && <ScoreRing score={score} />}
                            <div style={{ flex: 1 }}>
                                <SummaryChips lines={parsedLines} />
                                {analysisTime !== null && (
                                    <div className="fb-time-note">
                                        ⏱ Analizado en {analysisTime}s
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="fb-divider" />

                        {/* Parsed feedback cards */}
                        <div className="fb-content">
                            {parsedLines.map((line, idx) => (
                                <LineCard key={idx} line={line} index={idx} />
                            ))}
                        </div>

                        {/* Copy action */}
                        <div className="fb-actions">
                            <button
                                id="btn-copy-feedback"
                                className="fb-copy-btn"
                                onClick={handleCopy}
                                title="Copiar retroalimentación completa"
                            >
                                {copied ? '✅ Copiado' : '📋 Copiar todo'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Collapsed state */}
                {!isLoading && feedback && !expanded && (
                    <div className="fb-collapsed-hint" onClick={() => setExpanded(true)}>
                        <span>Toca para ver la retroalimentación completa ▼</span>
                    </div>
                )}
            </div>
        </div>
    );
};
