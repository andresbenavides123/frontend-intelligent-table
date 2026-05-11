import React from 'react';
import type { FeedbackPanelProps } from '../types/board.types';
import { THINKING_STEPS } from '../constants/board.constants';
import { useAIFeedback } from '../hooks/useAIFeedback';

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

    const renderFeedbackParagraphs = (text: string) => {
        return text
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line, idx) => {
                // Check for special patterns
                const isPositive = /|correcto|bien|excelente|perfecto|muy bien/i.test(line);
                const isCorrection = /✗|error|incorrecto|debería|debe|falta|recuerda/i.test(line);
                const isTip = /|tip:|nota:|consejo:/i.test(line);

                let lineColor = 'var(--text-secondary)';
                if (isPositive) lineColor = 'var(--accent-tertiary)';
                if (isCorrection) lineColor = '#f87171';
                if (isTip) lineColor = 'var(--accent-warning)';

                return (
                    <p
                        key={idx}
                        className="feedback-paragraph"
                        style={{
                            color: lineColor,
                            animationDelay: `${idx * 0.05}s`,
                        }}
                    >
                        {line}
                    </p>
                );
            });
    };

    return (
        <div className="panel feedback-panel">
            {/* Panel Header */}
            <div className="panel-header">
                <div className="panel-title">
                    <span className="panel-title-icon"></span>
                    Análisis IA
                </div>
                {analysisCount > 0 && (
                    <span style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                    }}>
                        #{analysisCount} análisis
                    </span>
                )}
            </div>

            {/* Stats Bar */}
            <div className="stats-bar">
                <div className="stat-item">
                    <span className="stat-value">{analysisCount}</span>
                    <span className="stat-label">Análisis</span>
                </div>
                <div className="stat-item">
                    <span className="stat-value">{analysisTime !== null ? `${analysisTime}s` : '—'}</span>
                    <span className="stat-label">Tiempo</span>
                </div>
                <div className="stat-item">
                    <span className="stat-value" style={{ fontSize: '0.85rem' }}>{subject || '—'}</span>
                    <span className="stat-label">Materia</span>
                </div>
            </div>

            {/* Content Area */}
            <div className="feedback-scroll" style={{ flex: 1 }}>
                {isLoading ? (
                    <div className="feedback-loading">
                        <div className="ai-spinner" />

                        <div>
                            <div style={{
                                fontSize: '1rem',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                marginBottom: '0.4rem',
                            }}>
                                Gemini está pensando...
                            </div>
                        </div>

                        <div className="thinking-steps">
                            {THINKING_STEPS.map((step, idx) => {
                                const status =
                                    idx < currentStep ? 'done' :
                                        idx === currentStep ? 'active' : '';
                                return (
                                    <div key={idx} className={`thinking-step ${status}`}>
                                        <span>{idx < currentStep ? '✓' : idx === currentStep ? '⟳' : '○'}</span>
                                        <span>{step.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : !feedback ? (
                    <div className="feedback-empty">
                        <div className="feedback-empty-icon">🎯</div>
                        <h3>Listo para analizar</h3>
                        <p>
                            Dibuja cualquier ejercicio, ecuación, o problema en la pizarra y el profesor virtual de IA lo revisará al instante.
                        </p>
                        <div className="feedback-hint-chips">
                            <span className="hint-chip">📐 Ecuaciones</span>
                            <span className="hint-chip">📊 Gráficas</span>
                            <span className="hint-chip">🧮 Cálculos</span>
                            <span className="hint-chip">🔢 Álgebra</span>
                        </div>
                    </div>
                ) : (
                    <div className="feedback-result">
                        {/* Metadata Badges */}
                        <div className="feedback-meta">
                            <span className="ai-badge gemini">✨ Gemini IA</span>
                            <span className="ai-badge subject">📚 {subject}</span>
                            <span className="feedback-timestamp">{formattedTime()}</span>
                        </div>

                        <div className="feedback-divider" />

                        {/* Feedback Text */}
                        <div className="feedback-text-block">
                            {renderFeedbackParagraphs(feedback)}
                        </div>

                        {/* Action Row */}
                        <div className="feedback-actions">
                            <button
                                id="btn-copy-feedback"
                                className="btn-copy"
                                onClick={handleCopy}
                                title="Copiar retroalimentación"
                            >
                                {copied ? ' Copiado' : ' Copiar'}
                            </button>
                            {analysisTime !== null && (
                                <span style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '0.72rem',
                                    color: 'var(--text-muted)',
                                    gap: '0.3rem',
                                    paddingRight: '0.5rem',
                                }}>
                                    {analysisTime}s
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
