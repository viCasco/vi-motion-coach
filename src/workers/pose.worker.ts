/// <reference lib="webworker" />

import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

let landmarker: PoseLandmarker | null = null;
let delegate: 'GPU' | 'CPU' = 'CPU';

async function createLandmarker(preferredDelegate: 'GPU' | 'CPU') {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: preferredDelegate
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.55,
    minPosePresenceConfidence: 0.55,
    minTrackingConfidence: 0.55,
    outputSegmentationMasks: false
  });
}

async function init() {
  if (landmarker) return;

  try {
    landmarker = await createLandmarker('GPU');
    delegate = 'GPU';
  } catch (gpuError) {
    console.warn('GPU delegate unavailable; falling back to CPU.', gpuError);
    landmarker = await createLandmarker('CPU');
    delegate = 'CPU';
  }

  self.postMessage({ type: 'READY', delegate });
}

self.onmessage = async (event: MessageEvent) => {
  const message = event.data;

  if (message.type === 'INIT') {
    try {
      await init();
    } catch (error) {
      self.postMessage({
        type: 'ERROR',
        error: error instanceof Error ? error.message : 'No se pudo inicializar MediaPipe.'
      });
    }
    return;
  }

  if (message.type === 'DETECT') {
    const bitmap = message.bitmap as ImageBitmap;
    try {
      if (!landmarker) await init();
      if (!landmarker) throw new Error('Pose Landmarker no inicializado.');

      const startedAt = performance.now();
      const result = landmarker.detectForVideo(bitmap, message.timestampMs);
      const inferenceMs = performance.now() - startedAt;
      bitmap.close();
      self.postMessage({ type: 'RESULT', result, inferenceMs });
    } catch (error) {
      bitmap.close();
      self.postMessage({
        type: 'DETECT_ERROR',
        error: error instanceof Error ? error.message : 'Error analizando el fotograma.'
      });
    }
  }
};

export {};
