import * as THREE from 'three';
import './styles/main.css';
import { CameraController } from './interaction/cameraController';
import { HousePicker } from './interaction/housePicker';
import { PocketWorldScene, type SceneMetricsSnapshot } from './scene/pocketWorldScene';
import { EnvironmentTransitionController, clampDelta } from './state/transitions';
import { WorldStateStore, type WorldState } from './state/worldState';
import { createControlPanel } from './ui/controlPanel';

interface PocketWorldDebugHandle {
  getState: () => Readonly<WorldState>;
  getMetrics: () => SceneMetricsSnapshot;
  getCamera: () => { pos: [number, number, number]; target: [number, number, number] };
  getHouseScreenPoint: () => { x: number; y: number };
}

declare global {
  interface Window {
    __POCKET_WORLD__?: PocketWorldDebugHandle;
  }
}

function showWebGLFallback(root: HTMLElement, reason: string): void {
  root.innerHTML = '';
  const wrapper = document.createElement('main');
  wrapper.className = 'pw-fallback';
  wrapper.innerHTML = `
    <section class="pw-fallback-card" role="alert">
      <h1>Pocket World</h1>
      <p>
        This interactive 3D diorama requires WebGL, which is unavailable or could not be
        initialized in this browser environment.
      </p>
      <p>
        Please enable hardware acceleration or try a modern browser with WebGL support.
      </p>
      <p class="pw-fallback-detail"></p>
    </section>
  `;
  const detail = wrapper.querySelector<HTMLElement>('.pw-fallback-detail');
  if (detail) {
    detail.textContent = reason;
  }
  root.appendChild(wrapper);
}

function isWebGLAvailable(): boolean {
  try {
    const testCanvas = document.createElement('canvas');
    const gl =
      testCanvas.getContext('webgl2') ||
      testCanvas.getContext('webgl') ||
      testCanvas.getContext('experimental-webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}

function bootstrap(): void {
  const appRoot = document.getElementById('app');
  const stage = document.getElementById('canvas-stage');
  const uiRoot = document.getElementById('ui-root');
  if (!appRoot || !stage || !uiRoot) return;

  if (!isWebGLAvailable()) {
    showWebGLFallback(appRoot, 'WebGL rendering context is not supported.');
    return;
  }

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isCompactDevice =
    window.innerWidth <= 768 || (navigator.hardwareConcurrency ?? 8) <= 4;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create WebGLRenderer.';
    showWebGLFallback(appRoot, message);
    return;
  }

  const getPixelRatioCap = () => (window.innerWidth <= 768 ? 1.5 : 2.0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, getPixelRatioCap()));
  renderer.setSize(stage.clientWidth || window.innerWidth, stage.clientHeight || window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);

  const store = new WorldStateStore({
    reducedMotion: reducedMotionQuery.matches,
  });
  const transitions = new EnvironmentTransitionController(store.getState());
  const worldScene = new PocketWorldScene(isCompactDevice);

  const initialWidth = stage.clientWidth || window.innerWidth;
  const initialHeight = stage.clientHeight || window.innerHeight;
  const cameraController = new CameraController(renderer.domElement, initialWidth, initialHeight);

  const housePicker = new HousePicker(
    renderer.domElement,
    cameraController.camera,
    worldScene.houseHitRoot,
    () => store.toggleHouseLights(),
  );

  const panel = createControlPanel(uiRoot, store);

  const unsubscribeReset = store.onReset(() => {
    const w = stage.clientWidth || window.innerWidth;
    const h = stage.clientHeight || window.innerHeight;
    cameraController.reset(w, h, store.getState().reducedMotion);
  });

  const handleReducedMotionChange = (event: MediaQueryListEvent) => {
    store.setReducedMotion(event.matches);
  };
  reducedMotionQuery.addEventListener('change', handleReducedMotionChange);

  const handleResize = () => {
    const w = Math.max(1, stage.clientWidth || window.innerWidth);
    const h = Math.max(1, stage.clientHeight || window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, getPixelRatioCap()));
    renderer.setSize(w, h);
    cameraController.applyResponsiveFraming(w, h, false);
  };
  window.addEventListener('resize', handleResize);

  const handleContextLost = (event: Event) => {
    event.preventDefault();
    cancelAnimationFrame(rafId);
    showWebGLFallback(appRoot, 'WebGL graphics context was lost.');
  };
  renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

  // Project cottage world center to screen coordinates for clean inspection/testing
  const houseWorldCenter = new THREE.Vector3();
  const houseBox = new THREE.Box3();
  window.__POCKET_WORLD__ = {
    getState: () => store.getState(),
    getMetrics: () => worldScene.getMetricsSnapshot(),
    getCamera: () => cameraController.getCameraState(),
    getHouseScreenPoint: () => {
      houseBox.setFromObject(worldScene.houseHitRoot);
      houseBox.getCenter(houseWorldCenter);
      houseWorldCenter.project(cameraController.camera);
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: rect.left + (houseWorldCenter.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (-houseWorldCenter.y * 0.5 + 0.5) * rect.height,
      };
    },
  };

  let rafId = 0;
  let lastTimestamp = performance.now();

  const renderFrame = (now: number) => {
    rafId = requestAnimationFrame(renderFrame);

    const rawDt = (now - lastTimestamp) / 1000;
    lastTimestamp = now;
    const dt = clampDelta(rawDt);

    const targetState = store.getState();
    const env = transitions.update(targetState, dt);
    const atmosphere = worldScene.update(dt, env, targetState.reducedMotion);

    panel.setThemeMode(atmosphere.nightFactor > 0.48);
    cameraController.update(dt);
    renderer.render(worldScene.scene, cameraController.camera);
  };

  // Run an immediate initial update so the very first painted frame is composed & accurate
  const initialAtmosphere = worldScene.update(
    0,
    transitions.values,
    store.getState().reducedMotion,
  );
  panel.setThemeMode(initialAtmosphere.nightFactor > 0.48);
  renderer.render(worldScene.scene, cameraController.camera);
  rafId = requestAnimationFrame(renderFrame);

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(rafId);
    unsubscribeReset();
    reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
    window.removeEventListener('resize', handleResize);
    renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
    panel.dispose();
    housePicker.dispose();
    cameraController.dispose();
    worldScene.dispose();
    renderer.dispose();
  });
}

bootstrap();
