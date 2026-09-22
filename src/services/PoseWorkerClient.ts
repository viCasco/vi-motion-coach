import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { PoseFrameResult } from '../types/pose';

type ResultHandler = (result: PoseFrameResult, inferenceMs: number) => void;
type ReadyHandler = (delegate: 'GPU' | 'CPU') => void;
type ErrorHandler = (message: string) => void;

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

function isIOSDevice() {
  const userAgent = navigator.userAgent;

  const classicIOS =
    /iPad|iPhone|iPod/.test(userAgent);

  const modernIPad =
    navigator.platform === 'MacIntel' &&
    navigator.maxTouchPoints > 1;

  return classicIOS || modernIPad;
}

export class PoseWorkerClient {
  private worker: Worker | null = null;
  private landmarker: PoseLandmarker | null = null;

  private busy = false;
  private ready = false;
  private destroyed = false;

  private readonly useMainThread: boolean;

  constructor(
    private readonly onResult: ResultHandler,
    private readonly onReady: ReadyHandler,
    private readonly onError: ErrorHandler
  ) {
    this.useMainThread = isIOSDevice();

    if (!this.useMainThread) {
      this.createWorker();
    }
  }

  private createWorker() {
    this.worker = new Worker(
      new URL('../workers/pose.worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (event) => {
      const message = event.data;

      if (message.type === 'READY') {
        this.ready = true;
        this.onReady(message.delegate);
        return;
      }

      if (message.type === 'RESULT') {
        this.busy = false;
        this.onResult(
          message.result as PoseFrameResult,
          message.inferenceMs
        );
        return;
      }

      if (
        message.type === 'DETECT_ERROR' ||
        message.type === 'ERROR'
      ) {
        this.busy = false;
        this.onError(message.error);
      }
    };

    this.worker.onerror = (event) => {
      this.busy = false;

      this.onError(
        event.message ||
          'Error en el Web Worker de análisis.'
      );
    };
  }

  private async createLandmarker(
    preferredDelegate: 'GPU' | 'CPU'
  ) {
    const vision =
      await FilesetResolver.forVisionTasks(WASM_URL);

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

  private async initMainThread() {
    if (this.landmarker || this.destroyed) {
      return;
    }

    try {
      this.landmarker =
        await this.createLandmarker('GPU');

      if (this.destroyed) {
        this.landmarker.close();
        this.landmarker = null;
        return;
      }

      this.ready = true;
      this.onReady('GPU');
    } catch (gpuError) {
      console.warn(
        'GPU delegate unavailable on iOS; falling back to CPU.',
        gpuError
      );

      try {
        this.landmarker =
          await this.createLandmarker('CPU');

        if (this.destroyed) {
          this.landmarker.close();
          this.landmarker = null;
          return;
        }

        this.ready = true;
        this.onReady('CPU');
      } catch (cpuError) {
        this.onError(
          cpuError instanceof Error
            ? cpuError.message
            : 'No se pudo inicializar MediaPipe.'
        );
      }
    }
  }

  init() {
    if (this.useMainThread) {
      void this.initMainThread();
      return;
    }

    this.worker?.postMessage({ type: 'INIT' });
  }

  canDetect() {
    return this.ready && !this.busy;
  }

  detect(bitmap: ImageBitmap, timestampMs: number) {
    if (!this.canDetect()) {
      bitmap.close();
      return false;
    }

    this.busy = true;

    if (this.useMainThread) {
      try {
        if (!this.landmarker) {
          throw new Error(
            'Pose Landmarker no inicializado.'
          );
        }

        const startedAt = performance.now();

        const result =
          this.landmarker.detectForVideo(
            bitmap,
            timestampMs
          );

        const inferenceMs =
          performance.now() - startedAt;

        bitmap.close();
        this.busy = false;

        this.onResult(
          result as PoseFrameResult,
          inferenceMs
        );

        return true;
      } catch (error) {
        bitmap.close();
        this.busy = false;

        this.onError(
          error instanceof Error
            ? error.message
            : 'Error analizando el fotograma.'
        );

        return false;
      }
    }

    this.worker?.postMessage(
      {
        type: 'DETECT',
        bitmap,
        timestampMs
      },
      [bitmap]
    );

    return true;
  }

  destroy() {
    this.destroyed = true;

    this.worker?.terminate();
    this.worker = null;

    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }

    this.ready = false;
    this.busy = false;
  }
}