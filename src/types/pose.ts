export type LandmarkPoint = {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  presence?: number;
};

export type PoseFrameResult = {
  landmarks: LandmarkPoint[][];
  worldLandmarks: LandmarkPoint[][];
};

export type MovementMetrics = {
  leftKnee: number | null;
  rightKnee: number | null;
  leftHip: number | null;
  rightHip: number | null;
  leftElbow: number | null;
  rightElbow: number | null;
  trunkTilt: number | null;
  confidence: number | null;
};

export type SessionFrame = {
  elapsedMs: number;
  metrics: MovementMetrics;
  worldLandmarks: LandmarkPoint[];
};

export type AnalysisStatus =
  | 'good'
  | 'improvable'
  | 'correct';

export type MetricStatistics = {
  average: number | null;
  min: number | null;
  max: number | null;
  validSamples: number;
  totalSamples: number;
  availabilityPercent: number;
};

export type SummaryAssessment = {
  id: string;
  label: string;
  status: AnalysisStatus;
  message: string;
};

export type SessionSummary = {
  durationMs: number;
  sampleCount: number;

  confidence: {
    average: number | null;
    min: number | null;
    max: number | null;
  };

  metrics: {
    leftKnee: MetricStatistics;
    rightKnee: MetricStatistics;
    leftHip: MetricStatistics;
    rightHip: MetricStatistics;
    leftElbow: MetricStatistics;
    rightElbow: MetricStatistics;
    trunkTilt: MetricStatistics;
  };

  dataQuality: {
    overall: AnalysisStatus;
    assessments: SummaryAssessment[];
  };
};

export type RecordedSession = {
  schemaVersion: 1;
  appVersion: string;
  startedAt: string;
  endedAt: string;
  cameraFacingMode: 'user' | 'environment';
  samplingHz: number;

  device: {
    userAgent: string;
    viewport: {
      width: number;
      height: number;
    };
    camera: {
      width?: number;
      height?: number;
      frameRate?: number;
    };
  };

  frames: SessionFrame[];
};