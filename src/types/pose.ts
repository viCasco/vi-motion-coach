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

export type RecordedSession = {
  schemaVersion: 1;
  appVersion: string;
  startedAt: string;
  endedAt: string;
  cameraFacingMode: 'user' | 'environment';
  samplingHz: number;
  device: {
    userAgent: string;
    viewport: { width: number; height: number };
    camera: { width?: number; height?: number; frameRate?: number };
  };
  frames: SessionFrame[];
};
