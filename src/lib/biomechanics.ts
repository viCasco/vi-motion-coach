import type { LandmarkPoint, MovementMetrics } from '../types/pose';

const IDX = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28
} as const;

const degrees = (radians: number) => (radians * 180) / Math.PI;

function valid(point?: LandmarkPoint): point is LandmarkPoint {
  if (!point) return false;
  const visibility = point.visibility ?? 1;
  const presence = point.presence ?? 1;
  return Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z) && visibility >= 0.45 && presence >= 0.45;
}

export function angle3D(a?: LandmarkPoint, b?: LandmarkPoint, c?: LandmarkPoint): number | null {
  if (!valid(a) || !valid(b) || !valid(c)) return null;

  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.hypot(ba.x, ba.y, ba.z);
  const magBC = Math.hypot(bc.x, bc.y, bc.z);
  if (magBA === 0 || magBC === 0) return null;

  const cosine = Math.min(1, Math.max(-1, dot / (magBA * magBC)));
  return Math.round(degrees(Math.acos(cosine)));
}

function midpoint(a?: LandmarkPoint, b?: LandmarkPoint): LandmarkPoint | undefined {
  if (!valid(a) || !valid(b)) return undefined;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
    presence: Math.min(a.presence ?? 1, b.presence ?? 1)
  };
}

export function calculateMetrics(world: LandmarkPoint[], normalized: LandmarkPoint[]): MovementMetrics {
  const w = world.length ? world : normalized;

  const shoulderMid = midpoint(w[IDX.LEFT_SHOULDER], w[IDX.RIGHT_SHOULDER]);
  const hipMid = midpoint(w[IDX.LEFT_HIP], w[IDX.RIGHT_HIP]);
  let trunkTilt: number | null = null;

  if (shoulderMid && hipMid) {
    const dx = shoulderMid.x - hipMid.x;
    const dy = shoulderMid.y - hipMid.y;
    const dz = shoulderMid.z - hipMid.z;
    trunkTilt = Math.round(degrees(Math.atan2(Math.hypot(dx, dz), Math.abs(dy))));
  }

  const visiblePoints = normalized.filter((p) => (p.visibility ?? 1) >= 0.45);
  const confidence = normalized.length
    ? Math.round((visiblePoints.reduce((sum, p) => sum + (p.visibility ?? 1), 0) / normalized.length) * 100)
    : null;

  return {
    leftKnee: angle3D(w[IDX.LEFT_HIP], w[IDX.LEFT_KNEE], w[IDX.LEFT_ANKLE]),
    rightKnee: angle3D(w[IDX.RIGHT_HIP], w[IDX.RIGHT_KNEE], w[IDX.RIGHT_ANKLE]),
    leftHip: angle3D(w[IDX.LEFT_SHOULDER], w[IDX.LEFT_HIP], w[IDX.LEFT_KNEE]),
    rightHip: angle3D(w[IDX.RIGHT_SHOULDER], w[IDX.RIGHT_HIP], w[IDX.RIGHT_KNEE]),
    leftElbow: angle3D(w[IDX.LEFT_SHOULDER], w[IDX.LEFT_ELBOW], w[IDX.LEFT_WRIST]),
    rightElbow: angle3D(w[IDX.RIGHT_SHOULDER], w[IDX.RIGHT_ELBOW], w[IDX.RIGHT_WRIST]),
    trunkTilt,
    confidence
  };
}

export const landmarkIndex = IDX;
