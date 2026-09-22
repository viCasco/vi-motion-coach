# viMotionCoach · Prototype 0.1

MVP web móvil para que un entrenador observe el movimiento de un atleta con una sola cámara.

## Qué incluye

- Cámara frontal o trasera del móvil.
- MediaPipe Pose Landmarker ejecutado en un **Web Worker**.
- Superposición del esqueleto corporal.
- Estimación en tiempo real de ángulos de rodilla, cadera, codo e inclinación del tronco.
- Registro temporal de landmarks 3D estimados y métricas a 10 Hz.
- Exportación de cada registro a JSON para análisis posterior.
- Arquitectura React + TypeScript + Vite preparada para Vercel.

> Las mediciones son estimaciones monoculares. No deben presentarse como sustituto de instrumentación biomecánica clínica o sistemas de motion capture validados.

## Requisitos

- Node.js >= 20.19
- Navegador moderno con cámara.
- En móvil, usar HTTPS. Vercel ya sirve el proyecto mediante HTTPS.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre la URL que muestre Vite. `localhost` puede solicitar permisos de cámara.

## Build

```bash
npm run build
npm run preview
```

## Desplegar en Vercel

### Opción recomendada: GitHub + Vercel

1. Crea un repositorio Git y sube este proyecto.
2. En Vercel selecciona **Add New → Project**.
3. Importa el repositorio.
4. Vercel debería detectar **Vite** automáticamente.
5. Build command: `npm run build`.
6. Output directory: `dist`.
7. Deploy.

Cada push posterior a la rama de producción puede generar un despliegue nuevo.

### CLI

```bash
npm i -g vercel
vercel
vercel --prod
```

`vercel.json` incluye el rewrite necesario para que las rutas de una SPA vuelvan a `index.html`.

## Arquitectura

```text
src/
├── components/
│   ├── CameraStage.tsx       # cámara, overlay y controles
│   └── MetricCard.tsx
├── lib/
│   ├── biomechanics.ts       # cálculo de métricas
│   └── session.ts            # exportación de sesiones
├── services/
│   └── PoseWorkerClient.ts   # contrato UI ↔ worker
├── types/
│   └── pose.ts               # tipos de dominio
└── workers/
    └── pose.worker.ts        # MediaPipe fuera del hilo principal
```

Esta separación permite sustituir el motor de pose o añadir nuevos analizadores sin mezclar la lógica de UI y biomecánica.

## Dependencias remotas actuales

El worker fija estas URLs:

- WASM de `@mediapipe/tasks-vision@1.0.1` vía jsDelivr.
- `pose_landmarker_lite.task` oficial de Google Storage.

Para una versión de producción estrictamente reproducible conviene copiar WASM + modelo al propio proyecto/CDN y versionarlos como activos de la aplicación.

## Próximos pasos recomendados

1. Definir el primer gesto deportivo a analizar.
2. Crear una máquina de estados del movimiento: preparación → carga → ejecución → recuperación.
3. Detectar repeticiones automáticamente.
4. Guardar valores mínimo/máximo y eventos clave de cada repetición.
5. Añadir reproducción lenta y comparación lado a lado.
6. Añadir atleta, entrenador, sesiones e historial mediante backend.
7. Validar las métricas frente a vídeo etiquetado y, si la aplicación lo requiere, frente a instrumentación de referencia.

## Privacidad

El vídeo se analiza en el navegador y este prototipo no lo sube a un backend. La documentación del paquete de MediaPipe indica que los datos de entrada se procesan en el dispositivo, aunque MediaPipe puede enviar métricas de utilización/rendimiento a Google. Antes de un uso real con atletas debe revisarse el flujo de consentimiento, política de privacidad y tratamiento de datos aplicable.
