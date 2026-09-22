import { CameraStage } from './components/CameraStage';
import './styles.css';

export default function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <span className="brand-mark">viMC</span>
          <span className="brand-name">viMotionCoach</span>
          <span className="version">Prototype 0.1</span>
        </div>
        <div className="local-processing">Procesamiento local · cámara privada</div>
      </header>

      <section className="hero-copy">
        <div>
          <span className="eyebrow">ANÁLISIS DE MOVIMIENTO PARA ENTRENADORES</span>
          <h1>Ver el movimiento.<br />Corregir con datos.</h1>
        </div>
        <p>
          Seguimiento corporal en tiempo real con una sola cámara. Esta primera versión superpone el esqueleto,
          estima ángulos articulares y permite registrar una sesión para análisis posterior.
        </p>
      </section>

      <CameraStage />

      <footer>
        <span>MVP experimental · las mediciones son estimaciones visuales, no instrumentación clínica.</span>
      </footer>
    </main>
  );
}
