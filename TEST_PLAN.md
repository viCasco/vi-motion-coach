# Plan de prueba · viMotionCoach 0.1

## 1. Instalación

```bash
npm install
npm run dev
```

Comprueba que la pantalla carga sin errores y que el estado pasa de `Cargando modelo…` a `Modelo listo · GPU` o `Modelo listo · CPU`.

## 2. Cámara

- Pulsa **Activar cámara** y concede permisos.
- Comprueba que la cámara trasera aparece por defecto en móvil.
- Cambia a cámara frontal y verifica que la imagen se muestra en espejo pero el esqueleto permanece alineado.
- Vuelve a cámara trasera.

## 3. Seguimiento corporal

- Sitúa a una persona de cuerpo entero, con pies y manos visibles.
- Comprueba que el esqueleto sigue hombros, brazos, cadera y piernas.
- Flexiona una rodilla lentamente y verifica que el valor disminuye al flexionar y vuelve a acercarse a 180° al extender.
- Flexiona un codo y repite la misma comprobación.
- Inclina el tronco hacia delante/lateralmente y observa el cambio en `Inclinación tronco`.

## 4. Estabilidad

- Mantén la cámara activa durante 3–5 minutos.
- Comprueba que la interfaz sigue respondiendo y que la inferencia continúa actualizándose.
- Saca parcialmente al atleta del encuadre y comprueba que algunas métricas pasan a `—` cuando la visibilidad es insuficiente.

## 5. Registro de sesión

- Pulsa **Registrar análisis**.
- Realiza un movimiento durante 10–20 segundos.
- Comprueba que aumenta el contador de muestras.
- Pulsa **Detener y exportar JSON**.
- Abre el JSON y verifica que contiene `frames`, `metrics`, `worldLandmarks`, datos de cámara y timestamps.

## 6. Vercel

- Sube el proyecto a GitHub e impórtalo en Vercel.
- Comprueba que el build termina correctamente y que Vercel publica `dist`.
- Abre la URL HTTPS de Preview desde un iPhone/Android real.
- Repite las pruebas de cámara y registro.
- Prueba una URL interna/refresco directo para confirmar que `vercel.json` evita 404 de SPA.

## 7. Dispositivos mínimos a validar

- iPhone con Safari.
- Android con Chrome.
- Ordenador con Chrome o Edge.

## Criterio para pasar a la V2

No avanzar a reglas automáticas de corrección hasta que el esqueleto sea estable en el gesto deportivo elegido y los ángulos sean coherentes visualmente en varias repeticiones y al menos dos dispositivos distintos.
