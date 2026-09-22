import { useState } from 'react';
import { downloadSession } from '../lib/session';
import type {
  AnalysisStatus,
  RecordedSession,
  SessionSummary
} from '../types/pose';

type Props = {
  session: RecordedSession;
  summary: SessionSummary;
  onNewAnalysis: () => void;
};

const STATUS_LABELS: Record<AnalysisStatus, string> = {
  good: 'Correcto',
  improvable: 'Mejorable',
  correct: 'Corregir'
};

const STATUS_ICONS: Record<AnalysisStatus, string> = {
  good: '●',
  improvable: '●',
  correct: '●'
};

function formatDuration(durationMs: number) {
  return `${(durationMs / 1000).toFixed(1)} s`;
}

function formatValue(value: number | null, suffix = '°') {
  if (value === null) {
    return '—';
  }

  return `${value}${suffix}`;
}

export function SessionSummaryPanel({
  session,
  summary,
  onNewAnalysis
}: Props) {
  const [showDetails, setShowDetails] = useState(false);

  const overallLabel =
    STATUS_LABELS[summary.dataQuality.overall];

  return (
    <section className="session-summary">
      <div className="summary-header">
        <span className="eyebrow">
          ANÁLISIS COMPLETADO
        </span>

        <h2>Resumen de la sesión</h2>

        <div
          className={`summary-overall status-${summary.dataQuality.overall}`}
        >
          <span>
            {STATUS_ICONS[summary.dataQuality.overall]}
          </span>

          <strong>{overallLabel}</strong>
        </div>
      </div>

      <div className="summary-main-stats">
        <div>
          <span>Duración</span>
          <strong>
            {formatDuration(summary.durationMs)}
          </strong>
        </div>

        <div>
          <span>Muestras</span>
          <strong>{summary.sampleCount}</strong>
        </div>

        <div>
          <span>Confianza media</span>
          <strong>
            {summary.confidence.average === null
              ? '—'
              : `${summary.confidence.average} %`}
          </strong>
        </div>
      </div>

      <div className="summary-assessments">
        {summary.dataQuality.assessments.map(
          (assessment) => (
            <article
              key={assessment.id}
              className={`assessment-card status-${assessment.status}`}
            >
              <div className="assessment-status">
                <span>
                  {STATUS_ICONS[assessment.status]}
                </span>

                <strong>
                  {STATUS_LABELS[assessment.status]}
                </strong>
              </div>

              <h3>{assessment.label}</h3>

              <p>{assessment.message}</p>
            </article>
          )
        )}
      </div>

      <button
        type="button"
        className="secondary summary-detail-button"
        onClick={() =>
          setShowDetails((current) => !current)
        }
      >
        {showDetails
          ? 'Ocultar análisis detallado'
          : 'Ver análisis detallado'}
      </button>

      {showDetails && (
        <div className="summary-details">
          <h3>Ángulos registrados</h3>

          <div className="detail-grid">
            <article>
              <span>Rodilla izquierda</span>
              <strong>
                {formatValue(
                  summary.metrics.leftKnee.average
                )}
              </strong>
              <small>
                {formatValue(
                  summary.metrics.leftKnee.min
                )}
                {' — '}
                {formatValue(
                  summary.metrics.leftKnee.max
                )}
              </small>
            </article>

            <article>
              <span>Rodilla derecha</span>
              <strong>
                {formatValue(
                  summary.metrics.rightKnee.average
                )}
              </strong>
              <small>
                {formatValue(
                  summary.metrics.rightKnee.min
                )}
                {' — '}
                {formatValue(
                  summary.metrics.rightKnee.max
                )}
              </small>
            </article>

            <article>
              <span>Cadera izquierda</span>
              <strong>
                {formatValue(
                  summary.metrics.leftHip.average
                )}
              </strong>
              <small>
                {formatValue(
                  summary.metrics.leftHip.min
                )}
                {' — '}
                {formatValue(
                  summary.metrics.leftHip.max
                )}
              </small>
            </article>

            <article>
              <span>Cadera derecha</span>
              <strong>
                {formatValue(
                  summary.metrics.rightHip.average
                )}
              </strong>
              <small>
                {formatValue(
                  summary.metrics.rightHip.min
                )}
                {' — '}
                {formatValue(
                  summary.metrics.rightHip.max
                )}
              </small>
            </article>

            <article>
              <span>Codo izquierdo</span>
              <strong>
                {formatValue(
                  summary.metrics.leftElbow.average
                )}
              </strong>
              <small>
                Disponibilidad:{' '}
                {
                  summary.metrics.leftElbow
                    .availabilityPercent
                }
                %
              </small>
            </article>

            <article>
              <span>Codo derecho</span>
              <strong>
                {formatValue(
                  summary.metrics.rightElbow.average
                )}
              </strong>
              <small>
                Disponibilidad:{' '}
                {
                  summary.metrics.rightElbow
                    .availabilityPercent
                }
                %
              </small>
            </article>

            <article>
              <span>Inclinación del tronco</span>
              <strong>
                {formatValue(
                  summary.metrics.trunkTilt.average
                )}
              </strong>
              <small>
                Máxima:{' '}
                {formatValue(
                  summary.metrics.trunkTilt.max
                )}
              </small>
            </article>
          </div>

          <p className="summary-disclaimer">
            Estas valoraciones corresponden a la calidad
            de captura y disponibilidad de datos. Todavía
            no representan una valoración técnica del
            movimiento deportivo.
          </p>
        </div>
      )}

      <div className="summary-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => downloadSession(session)}
        >
          Exportar JSON
        </button>

        <button
          type="button"
          className="primary"
          onClick={onNewAnalysis}
        >
          Nuevo análisis
        </button>
      </div>
    </section>
  );
}