import { useCallback, useEffect, useRef, useState } from 'react';
import { calculateMetrics, landmarkIndex } from '../lib/biomechanics';
import { createSessionSummary } from '../lib/sessionSummary';
import { PoseWorkerClient } from '../services/PoseWorkerClient';
import type {
  LandmarkPoint,
  MovementMetrics,
  RecordedSession,
  SessionFrame,
  SessionSummary
} from '../types/pose';
import { MetricCard } from './MetricCard';
import { SessionSummaryPanel } from './SessionSummaryPanel';

const EMPTY_METRICS: MovementMetrics = {
  leftKnee: null,
  rightKnee: null,
  leftHip: null,
  rightHip: null,
  leftElbow: null,
  rightElbow: null,
  trunkTilt: null,
  confidence: null
};

const BODY_CONNECTIONS: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [15, 17],
  [15, 19],
  [15, 21],
  [17, 19],

  [12, 14],
  [14, 16],
  [16, 18],
  [16, 20],
  [16, 22],
  [18, 20],

  [11, 23],
  [12, 24],
  [23, 24],

  [23, 25],
  [25, 27],
  [27, 29],
  [29, 31],
  [27, 31],

  [24, 26],
  [26, 28],
  [28, 30],
  [30, 32],
  [28, 32]
];

const SAMPLE_INTERVAL_MS = 100;

function getPoint(
  point: LandmarkPoint,
  width: number,
  height: number,
  mirror: boolean
) {
  return {
    x: (mirror ? 1 - point.x : point.x) * width,
    y: point.y * height
  };
}

function drawOverlay(
  canvas: HTMLCanvasElement,
  landmarks: LandmarkPoint[],
  metrics: MovementMetrics,
  mirror: boolean
) {
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!landmarks.length) {
    return;
  }

  ctx.save();

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(105, 255, 181, 0.92)';
  ctx.lineWidth = Math.max(
    3,
    canvas.width * 0.004
  );

  for (const [startIndex, endIndex] of BODY_CONNECTIONS) {
    const a = landmarks[startIndex];
    const b = landmarks[endIndex];

    if (
      !a ||
      !b ||
      (a.visibility ?? 1) < 0.45 ||
      (b.visibility ?? 1) < 0.45
    ) {
      continue;
    }

    const p1 = getPoint(
      a,
      canvas.width,
      canvas.height,
      mirror
    );

    const p2 = getPoint(
      b,
      canvas.width,
      canvas.height,
      mirror
    );

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  ctx.fillStyle = '#ffffff';

  for (const point of landmarks) {
    if ((point.visibility ?? 1) < 0.45) {
      continue;
    }

    const p = getPoint(
      point,
      canvas.width,
      canvas.height,
      mirror
    );

    ctx.beginPath();

    ctx.arc(
      p.x,
      p.y,
      Math.max(
        3,
        canvas.width * 0.005
      ),
      0,
      Math.PI * 2
    );

    ctx.fill();
  }

  const labels: Array<
    [number, string, number | null]
  > = [
    [
      landmarkIndex.LEFT_KNEE,
      'L',
      metrics.leftKnee
    ],
    [
      landmarkIndex.RIGHT_KNEE,
      'R',
      metrics.rightKnee
    ],
    [
      landmarkIndex.LEFT_HIP,
      'L',
      metrics.leftHip
    ],
    [
      landmarkIndex.RIGHT_HIP,
      'R',
      metrics.rightHip
    ]
  ];

  ctx.font = `700 ${Math.max(
    14,
    canvas.width * 0.022
  )}px system-ui, sans-serif`;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const [index, side, value] of labels) {
    if (value === null) {
      continue;
    }

    const landmark = landmarks[index];

    if (
      !landmark ||
      (landmark.visibility ?? 1) < 0.45
    ) {
      continue;
    }

    const p = getPoint(
      landmark,
      canvas.width,
      canvas.height,
      mirror
    );

    const text = `${side} ${value}°`;

    const boxWidth =
      ctx.measureText(text).width + 18;

    const boxHeight = Math.max(
      24,
      canvas.width * 0.036
    );

    ctx.fillStyle =
      'rgba(5, 8, 12, 0.78)';

    ctx.fillRect(
      p.x - boxWidth / 2,
      p.y - boxHeight - 14,
      boxWidth,
      boxHeight
    );

    ctx.fillStyle = '#ffffff';

    ctx.fillText(
      text,
      p.x,
      p.y - boxHeight / 2 - 14
    );
  }

  ctx.restore();
}

export function CameraStage() {
  const videoRef =
    useRef<HTMLVideoElement>(null);

  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  const workerRef =
    useRef<PoseWorkerClient | null>(null);

  const animationRef =
    useRef<number | null>(null);

  const lastVideoTimeRef =
    useRef(-1);

  const capturePendingRef =
    useRef(false);

  const recordingRef =
    useRef(false);

  const sessionFramesRef =
    useRef<SessionFrame[]>([]);

  const sessionStartedIsoRef =
    useRef('');

  const sessionStartedPerfRef =
    useRef(0);

  const lastSampleRef =
    useRef(0);

  const facingModeRef =
    useRef<
      'user' | 'environment'
    >('environment');

  const [cameraActive, setCameraActive] =
    useState(false);

  const [modelReady, setModelReady] =
    useState(false);

  const [delegate, setDelegate] =
    useState<
      'GPU' | 'CPU' | null
    >(null);

  const [facingMode, setFacingMode] =
    useState<
      'user' | 'environment'
    >('environment');

  const [metrics, setMetrics] =
    useState<MovementMetrics>(
      EMPTY_METRICS
    );

  const [inferenceMs, setInferenceMs] =
    useState<number | null>(null);

  const [recording, setRecording] =
    useState(false);

  const [samples, setSamples] =
    useState(0);

  const [error, setError] =
    useState<string | null>(null);

  const [
    completedSession,
    setCompletedSession
  ] =
    useState<RecordedSession | null>(
      null
    );

  const [
    sessionSummary,
    setSessionSummary
  ] =
    useState<SessionSummary | null>(
      null
    );

  useEffect(() => {
    facingModeRef.current =
      facingMode;
  }, [facingMode]);

  const handlePoseResult =
    useCallback(
      (
        result: {
          landmarks: LandmarkPoint[][];
          worldLandmarks: LandmarkPoint[][];
        },
        ms: number
      ) => {
        capturePendingRef.current =
          false;

        setInferenceMs(
          Math.round(ms)
        );

        const normalized =
          result.landmarks?.[0] ??
          [];

        const world =
          result.worldLandmarks?.[0] ??
          [];

        const nextMetrics =
          normalized.length
            ? calculateMetrics(
                world,
                normalized
              )
            : EMPTY_METRICS;

        setMetrics(nextMetrics);

        const canvas =
          canvasRef.current;

        const video =
          videoRef.current;

        if (
          canvas &&
          video &&
          video.videoWidth &&
          video.videoHeight
        ) {
          if (
            canvas.width !==
            video.videoWidth
          ) {
            canvas.width =
              video.videoWidth;
          }

          if (
            canvas.height !==
            video.videoHeight
          ) {
            canvas.height =
              video.videoHeight;
          }

          drawOverlay(
            canvas,
            normalized,
            nextMetrics,
            facingModeRef.current ===
              'user'
          );
        }

        if (
          recordingRef.current &&
          world.length
        ) {
          const now =
            performance.now();

          if (
            now -
              lastSampleRef.current >=
            SAMPLE_INTERVAL_MS
          ) {
            lastSampleRef.current =
              now;

            sessionFramesRef.current.push(
              {
                elapsedMs:
                  Math.round(
                    now -
                      sessionStartedPerfRef.current
                  ),

                metrics:
                  nextMetrics,

                worldLandmarks:
                  world.map(
                    (point) => ({
                      x: point.x,
                      y: point.y,
                      z: point.z,
                      visibility:
                        point.visibility,
                      presence:
                        point.presence
                    })
                  )
              }
            );

            setSamples(
              sessionFramesRef.current
                .length
            );
          }
        }
      },
      []
    );

  useEffect(() => {
    const client =
      new PoseWorkerClient(
        handlePoseResult,

        (usedDelegate) => {
          setDelegate(
            usedDelegate
          );

          setModelReady(true);
          setError(null);
        },

        (message) => {
          capturePendingRef.current =
            false;

          setError(message);
        }
      );

    workerRef.current = client;

    client.init();

    return () => {
      client.destroy();

      streamRef.current
        ?.getTracks()
        .forEach((track) =>
          track.stop()
        );

      if (
        animationRef.current !==
        null
      ) {
        cancelAnimationFrame(
          animationRef.current
        );
      }
    };
  }, [handlePoseResult]);

  const stopCamera =
    useCallback(() => {
      streamRef.current
        ?.getTracks()
        .forEach((track) =>
          track.stop()
        );

      streamRef.current = null;

      if (videoRef.current) {
        videoRef.current.srcObject =
          null;
      }

      if (
        animationRef.current !==
        null
      ) {
        cancelAnimationFrame(
          animationRef.current
        );
      }

      animationRef.current = null;

      setCameraActive(false);
      setMetrics(EMPTY_METRICS);

      const canvas =
        canvasRef.current;

      canvas
        ?.getContext('2d')
        ?.clearRect(
          0,
          0,
          canvas.width,
          canvas.height
        );
    }, []);

  const analyzeLoop =
    useCallback(
      async function loop() {
        const video =
          videoRef.current;

        const client =
          workerRef.current;

        if (
          video &&
          client &&
          video.readyState >=
            HTMLMediaElement.HAVE_CURRENT_DATA
        ) {
          const currentTime =
            video.currentTime;

          if (
            currentTime !==
              lastVideoTimeRef.current &&
            client.canDetect() &&
            !capturePendingRef.current
          ) {
            capturePendingRef.current =
              true;

            lastVideoTimeRef.current =
              currentTime;

            try {
              const bitmap =
                await createImageBitmap(
                  video
                );

              client.detect(
                bitmap,
                performance.now()
              );
            } catch (
              captureError
            ) {
              capturePendingRef.current =
                false;

              setError(
                captureError instanceof
                  Error
                  ? captureError.message
                  : 'No se pudo capturar el fotograma.'
              );
            }
          }
        }

        animationRef.current =
          requestAnimationFrame(
            loop
          );
      },
      []
    );

  const startCamera =
    useCallback(
      async (
        mode = facingMode
      ) => {
        setError(null);

        stopCamera();

        if (
          !navigator.mediaDevices
            ?.getUserMedia
        ) {
          setError(
            'Este navegador no ofrece acceso compatible a la cámara.'
          );

          return;
        }

        try {
          const stream =
            await navigator.mediaDevices.getUserMedia(
              {
                audio: false,

                video: {
                  facingMode: {
                    ideal: mode
                  },

                  width: {
                    ideal: 1280
                  },

                  height: {
                    ideal: 720
                  },

                  frameRate: {
                    ideal: 30,
                    max: 30
                  }
                }
              }
            );

          streamRef.current =
            stream;

          const video =
            videoRef.current;

          if (!video) {
            return;
          }

          video.srcObject =
            stream;

          await video.play();

          lastVideoTimeRef.current =
            -1;

          setCameraActive(true);

          animationRef.current =
            requestAnimationFrame(
              analyzeLoop
            );
        } catch (
          cameraError
        ) {
          const message =
            cameraError instanceof
            Error
              ? cameraError.message
              : 'No se pudo acceder a la cámara.';

          setError(
            `Cámara: ${message}`
          );
        }
      },
      [
        analyzeLoop,
        facingMode,
        stopCamera
      ]
    );

  const switchCamera =
    async () => {
      const next =
        facingMode ===
        'environment'
          ? 'user'
          : 'environment';

      setFacingMode(next);

      facingModeRef.current =
        next;

      if (cameraActive) {
        await startCamera(next);
      }
    };

  const startRecording =
    () => {
      sessionFramesRef.current =
        [];

      sessionStartedIsoRef.current =
        new Date().toISOString();

      sessionStartedPerfRef.current =
        performance.now();

      lastSampleRef.current = 0;

      recordingRef.current =
        true;

      setRecording(true);
      setSamples(0);
    };

  const stopAnalysis = () => {
    recordingRef.current = false;

    setRecording(false);

    const cameraSettings =
      streamRef.current
        ?.getVideoTracks()[0]
        ?.getSettings() ?? {};

    const session: RecordedSession =
      {
        schemaVersion: 1,

        appVersion: '0.1.0',

        startedAt:
          sessionStartedIsoRef.current ||
          new Date().toISOString(),

        endedAt:
          new Date().toISOString(),

        cameraFacingMode:
          facingModeRef.current,

        samplingHz:
          1000 /
          SAMPLE_INTERVAL_MS,

        device: {
          userAgent:
            navigator.userAgent,

          viewport: {
            width:
              window.innerWidth,

            height:
              window.innerHeight
          },

          camera: {
            width:
              cameraSettings.width,

            height:
              cameraSettings.height,

            frameRate:
              cameraSettings.frameRate
          }
        },

        frames:
          sessionFramesRef.current
      };

    const summary =
      createSessionSummary(
        session
      );

    setCompletedSession(
      session
    );

    setSessionSummary(
      summary
    );

    stopCamera();
  };

  const startNewAnalysis =
    () => {
      setCompletedSession(null);
      setSessionSummary(null);

      sessionFramesRef.current =
        [];

      sessionStartedIsoRef.current =
        '';

      sessionStartedPerfRef.current =
        0;

      lastSampleRef.current = 0;

      recordingRef.current =
        false;

      setRecording(false);
      setSamples(0);
      setMetrics(EMPTY_METRICS);
      setInferenceMs(null);
      setError(null);
    };

  if (
    completedSession &&
    sessionSummary
  ) {
    return (
      <SessionSummaryPanel
        session={
          completedSession
        }
        summary={
          sessionSummary
        }
        onNewAnalysis={
          startNewAnalysis
        }
      />
    );
  }

  return (
    <section className="workspace">
      <div className="camera-panel">
        <div className="camera-toolbar">
          <div className="status-row">
            <span
              className={`status-dot ${
                modelReady
                  ? 'ok'
                  : ''
              }`}
            />

            <span>
              {modelReady
                ? `Modelo listo · ${delegate}`
                : 'Cargando modelo…'}
            </span>
          </div>

          <div className="status-row subtle">
            {inferenceMs !== null
              ? `${inferenceMs} ms/inferencia`
              : 'Esperando movimiento'}
          </div>
        </div>

        <div className="camera-frame">
          <video
            ref={videoRef}
            className={
              facingMode === 'user'
                ? 'mirrored'
                : ''
            }
            autoPlay
            muted
            playsInline
          />

          <canvas
            ref={canvasRef}
          />

          {!cameraActive && (
            <div className="camera-empty">
              <div className="camera-icon">
                ◎
              </div>

              <strong>
                Encuadra el cuerpo
                completo
              </strong>

              <span>
                Deja visibles cabeza,
                manos y pies para
                mejorar el seguimiento.
              </span>
            </div>
          )}

          {recording && (
            <div className="recording-pill">
              <span />

              {' '}
              Registrando ·{' '}
              {samples}{' '}
              muestras
            </div>
          )}
        </div>

        {error && (
          <div className="error-box">
            {error}
          </div>
        )}

        <div className="camera-actions">
          {!cameraActive ? (
            <button
              className="primary"
              onClick={() =>
                startCamera()
              }
            >
              Activar cámara
            </button>
          ) : (
            <button
              className="secondary"
              disabled={recording}
              onClick={
                stopCamera
              }
            >
              Detener cámara
            </button>
          )}

          <button
            className="secondary"
            disabled={recording}
            onClick={
              switchCamera
            }
          >
            {facingMode ===
            'environment'
              ? 'Cámara frontal'
              : 'Cámara trasera'}
          </button>

          {!recording ? (
            <button
              className="secondary accent"
              disabled={
                !cameraActive ||
                !modelReady
              }
              onClick={
                startRecording
              }
            >
              Registrar análisis
            </button>
          ) : (
            <button
              className="danger"
              onClick={
                stopAnalysis
              }
            >
              Detener análisis
            </button>
          )}
        </div>
      </div>

      <aside className="analysis-panel">
        <div className="analysis-heading">
          <div>
            <span className="eyebrow">
              BIOMECÁNICA · TIEMPO
              REAL
            </span>

            <h2>
              Ángulos articulares
            </h2>
          </div>

          <div className="confidence">
            <span>
              Visibilidad
            </span>

            <strong>
              {metrics.confidence ===
              null
                ? '—'
                : `${metrics.confidence}%`}
            </strong>
          </div>
        </div>

        <div className="metrics-grid">
          <MetricCard
            label="Rodilla izq."
            value={
              metrics.leftKnee
            }
            detail="cadera · rodilla · tobillo"
          />

          <MetricCard
            label="Rodilla der."
            value={
              metrics.rightKnee
            }
            detail="cadera · rodilla · tobillo"
          />

          <MetricCard
            label="Cadera izq."
            value={
              metrics.leftHip
            }
            detail="hombro · cadera · rodilla"
          />

          <MetricCard
            label="Cadera der."
            value={
              metrics.rightHip
            }
            detail="hombro · cadera · rodilla"
          />

          <MetricCard
            label="Codo izq."
            value={
              metrics.leftElbow
            }
          />

          <MetricCard
            label="Codo der."
            value={
              metrics.rightElbow
            }
          />

          <MetricCard
            label="Inclinación tronco"
            value={
              metrics.trunkTilt
            }
            detail="eje vertical 3D estimado"
          />
        </div>

        <div className="coach-card">
          <span className="eyebrow">
            PARA EL ENTRENADOR
          </span>

          <h3>
            V1: observar antes de
            automatizar
          </h3>

          <p>
            El entrenador ve el
            esqueleto y los ángulos
            en directo. El registro
            conserva una serie
            temporal para comparar
            repeticiones y construir
            después reglas
            específicas para
            carrera, sentadilla,
            salto o técnica
            deportiva.
          </p>
        </div>
      </aside>
    </section>
  );
}