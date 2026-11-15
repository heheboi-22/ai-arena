import './style.css';
import { InputController } from './interaction/inputController';
import { PocketWorldScene } from './scene/pocketWorldScene';
import {
  DEFAULT_WORLD_STATE,
  WorldState,
  clampFrameDelta,
  createInitialSmoothedState,
  stepSmoothedState,
} from './state/worldState';
import { ControlPanel } from './ui/controlPanel';

function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
    );
  } catch {
    return false;
  }
}

function showWebGLFallback(container: HTMLElement, detail?: string): void {
  container.innerHTML = `
    <div class="pw-fallback" role="alert">
      <div class="pw-fallback-card">
        <h1>Pocket World</h1>
        <p>
          WebGL is required to render the 3D floating island diorama, but it is unavailable or disabled in this browser.
          ${detail ? `<br /><br />Details: ${detail}` : ''}
        </p>
      </div>
    </div>
  `;
}

function boot(): void {
  const appRoot = document.getElementById('app');
  const canvasContainer = document.getElementById('canvas-container');
  const uiRoot = document.getElementById('ui-root');

  if (!appRoot || !canvasContainer || !uiRoot) {
    return;
  }

  if (!isWebGLSupported()) {
    showWebGLFallback(appRoot);
    return;
  }

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state: WorldState = {
    ...DEFAULT_WORLD_STATE,
    reducedMotion: reducedMotionQuery.matches,
  };

  let scene: PocketWorldScene;
  try {
    scene = new PocketWorldScene(canvasContainer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to initialize WebGL context.';
    showWebGLFallback(appRoot, msg);
    return;
  }

  let smoothed = createInitialSmoothedState(state);

  const toggleHouseLights = () => {
    state.houseLightsOn = !state.houseLightsOn;
    panel.sync(state);
  };

  const inputController = new InputController({
    camera: scene.camera,
    domElement: scene.renderer.domElement,
    houseHitTargets: scene.getHouseHitTargets(),
    onToggleHouseLights: toggleHouseLights,
  });

  const panel = new ControlPanel(uiRoot, state, {
    onTimeChange: (timeOfDay) => {
      state.timeOfDay = timeOfDay;
      panel.sync(state);
    },
    onWeatherChange: (weather) => {
      state.weather = weather;
      panel.sync(state);
    },
    onWindChange: (windStrength) => {
      state.windStrength = windStrength;
      panel.sync(state);
    },
    onToggleLights: () => {
      toggleHouseLights();
    },
    onReset: () => {
      state.timeOfDay = DEFAULT_WORLD_STATE.timeOfDay;
      state.weather = DEFAULT_WORLD_STATE.weather;
      state.windStrength = DEFAULT_WORLD_STATE.windStrength;
      state.houseLightsOn = DEFAULT_WORLD_STATE.houseLightsOn;
      inputController.resetCamera();
      panel.sync(state);
    },
  });

  const handleResize = () => {
    scene.resize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', handleResize);

  const handleReducedMotionChange = (event: MediaQueryListEvent) => {
    state.reducedMotion = event.matches;
  };
  reducedMotionQuery.addEventListener('change', handleReducedMotionChange);

  let lastTimestamp = performance.now();
  let rafId = 0;

  const animate = (now: number) => {
    rafId = window.requestAnimationFrame(animate);
    const dt = clampFrameDelta((now - lastTimestamp) / 1000);
    lastTimestamp = now;

    smoothed = stepSmoothedState(smoothed, state, dt);
    inputController.update(dt);
    scene.update(smoothed, dt, state.reducedMotion);
  };

  rafId = window.requestAnimationFrame(animate);

  window.addEventListener('beforeunload', () => {
    window.cancelAnimationFrame(rafId);
    window.removeEventListener('resize', handleResize);
    reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
    panel.dispose();
    inputController.dispose();
    scene.dispose();
  });
}

boot();
