import type { PoseFrameResult } from '../types/pose';

type ResultHandler = (result: PoseFrameResult, inferenceMs: number) => void;
type ReadyHandler = (delegate: 'GPU' | 'CPU') => void;
type ErrorHandler = (message: string) => void;

export class PoseWorkerClient {
  private worker: Worker;
  private busy = false;
  private ready = false;

  constructor(
    onResult: ResultHandler,
    onReady: ReadyHandler,
    onError: ErrorHandler
  ) {
    this.worker = new Worker(new URL('../workers/pose.worker.ts', import.meta.url), { type: 'module' });

    this.worker.onmessage = (event) => {
      const message = event.data;
      if (message.type === 'READY') {
        this.ready = true;
        onReady(message.delegate);
      } else if (message.type === 'RESULT') {
        this.busy = false;
        onResult(message.result as PoseFrameResult, message.inferenceMs);
      } else if (message.type === 'DETECT_ERROR') {
        this.busy = false;
        onError(message.error);
      } else if (message.type === 'ERROR') {
        this.busy = false;
        onError(message.error);
      }
    };

    this.worker.onerror = (event) => {
      this.busy = false;
      onError(event.message || 'Error en el Web Worker de análisis.');
    };
  }

  init() {
    this.worker.postMessage({ type: 'INIT' });
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
    this.worker.postMessage({ type: 'DETECT', bitmap, timestampMs }, [bitmap]);
    return true;
  }

  destroy() {
    this.worker.terminate();
    this.ready = false;
    this.busy = false;
  }
}
