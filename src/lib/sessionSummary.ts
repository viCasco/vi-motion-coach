import type {
  AnalysisStatus,
  MetricStatistics,
  MovementMetrics,
  RecordedSession,
  SessionSummary,
  SummaryAssessment
} from '../types/pose';

type MetricKey = keyof Pick<
  MovementMetrics,
  | 'leftKnee'
  | 'rightKnee'
  | 'leftHip'
  | 'rightHip'
  | 'leftElbow'
  | 'rightElbow'
  | 'trunkTilt'
>;

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function calculateMetricStatistics(
  session: RecordedSession,
  metric: MetricKey
): MetricStatistics {
  const totalSamples = session.frames.length;

  const values = session.frames
    .map((frame) => frame.metrics[metric])
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return {
      average: null,
      min: null,
      max: null,
      validSamples: 0,
      totalSamples,
      availabilityPercent: 0
    };
  }

  const sum = values.reduce((acc, value) => acc + value, 0);

  return {
    average: round(sum / values.length),
    min: Math.min(...values),
    max: Math.max(...values),
    validSamples: values.length,
    totalSamples,
    availabilityPercent: round(
      (values.length / totalSamples) * 100
    )
  };
}

function calculateConfidence(session: RecordedSession) {
  const values = session.frames
    .map((frame) => frame.metrics.confidence)
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return {
      average: null,
      min: null,
      max: null
    };
  }

  const sum = values.reduce((acc, value) => acc + value, 0);

  return {
    average: round(sum / values.length),
    min: Math.min(...values),
    max: Math.max(...values)
  };
}

function statusFromConfidence(
  confidence: number | null
): AnalysisStatus {
  if (confidence === null) return 'correct';

  if (confidence >= 85) {
    return 'good';
  }

  if (confidence >= 70) {
    return 'improvable';
  }

  return 'correct';
}

function statusFromAvailability(
  availability: number
): AnalysisStatus {
  if (availability >= 90) {
    return 'good';
  }

  if (availability >= 70) {
    return 'improvable';
  }

  return 'correct';
}

function worstStatus(
  statuses: AnalysisStatus[]
): AnalysisStatus {
  if (statuses.includes('correct')) {
    return 'correct';
  }

  if (statuses.includes('improvable')) {
    return 'improvable';
  }

  return 'good';
}

function averageAvailability(
  metrics: MetricStatistics[]
) {
  if (!metrics.length) return 0;

  return round(
    metrics.reduce(
      (sum, metric) =>
        sum + metric.availabilityPercent,
      0
    ) / metrics.length
  );
}

function createAssessment(
  id: string,
  label: string,
  status: AnalysisStatus,
  message: string
): SummaryAssessment {
  return {
    id,
    label,
    status,
    message
  };
}

export function createSessionSummary(
  session: RecordedSession
): SessionSummary {
  const metrics = {
    leftKnee: calculateMetricStatistics(
      session,
      'leftKnee'
    ),
    rightKnee: calculateMetricStatistics(
      session,
      'rightKnee'
    ),
    leftHip: calculateMetricStatistics(
      session,
      'leftHip'
    ),
    rightHip: calculateMetricStatistics(
      session,
      'rightHip'
    ),
    leftElbow: calculateMetricStatistics(
      session,
      'leftElbow'
    ),
    rightElbow: calculateMetricStatistics(
      session,
      'rightElbow'
    ),
    trunkTilt: calculateMetricStatistics(
      session,
      'trunkTilt'
    )
  };

  const confidence = calculateConfidence(session);

  const lowerBodyAvailability =
    averageAvailability([
      metrics.leftKnee,
      metrics.rightKnee,
      metrics.leftHip,
      metrics.rightHip
    ]);

  const upperBodyAvailability =
    averageAvailability([
      metrics.leftElbow,
      metrics.rightElbow
    ]);

  const trunkAvailability =
    metrics.trunkTilt.availabilityPercent;

  const confidenceStatus =
    statusFromConfidence(confidence.average);

  const lowerBodyStatus =
    statusFromAvailability(lowerBodyAvailability);

  const upperBodyStatus =
    statusFromAvailability(upperBodyAvailability);

  const trunkStatus =
    statusFromAvailability(trunkAvailability);

  const assessments: SummaryAssessment[] = [
    createAssessment(
      'confidence',
      'Calidad de detección',
      confidenceStatus,
      confidence.average === null
        ? 'No hay suficientes datos para valorar la detección.'
        : `Confianza media del ${confidence.average} %.`
    ),

    createAssessment(
      'lower-body',
      'Seguimiento de piernas y cadera',
      lowerBodyStatus,
      `Datos disponibles en el ${lowerBodyAvailability} % de las muestras.`
    ),

    createAssessment(
      'upper-body',
      'Seguimiento de brazos',
      upperBodyStatus,
      `Datos disponibles en el ${upperBodyAvailability} % de las muestras.`
    ),

    createAssessment(
      'trunk',
      'Seguimiento del tronco',
      trunkStatus,
      `Datos disponibles en el ${trunkAvailability} % de las muestras.`
    )
  ];

  const firstFrame =
    session.frames[0]?.elapsedMs ?? 0;

  const lastFrame =
    session.frames.at(-1)?.elapsedMs ?? 0;

  return {
    durationMs: Math.max(
      0,
      lastFrame - firstFrame
    ),

    sampleCount: session.frames.length,

    confidence,

    metrics,

    dataQuality: {
      overall: worstStatus(
        assessments.map(
          (assessment) => assessment.status
        )
      ),
      assessments
    }
  };
}