import './style.css';
import * as THREE from 'three';
import { createState, DEFAULTS, type AppState } from './state';
import { sampleTimeOfDay } from './palette';
import { World } from './world';
import { setupUI, syncUI } from './ui';
import { setupInteraction } from './interaction';
import { clamp, damp } from './noise';

const CAMERA_START = new THREE.Vector3(10.8, 7.2, 11.8);
const CAMERA_TARGET = new THREE.Vector3(0, -0.7, 0);

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch {
    return false;
  }
}

function showFallback(message: string): void {
  const fallback = document.getElementById('fallback')!;
  const msg = document.getElementById('fallback-msg')!;
  msg.textContent = message;
  fallback.classList.add('show');
  document.getElementById('panel')?.remove();
}

function init(): void {
  const container = document.getElementById('scene-container')!;
  if (!webglAvailable()) {
    showFallback('WebGL is not available in this browser or device. Pocket World needs WebGL to render its 3D island — try a recent desktop or mobile browser with hardware acceleration enabled.');
    return;
  }

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  } catch (err) {
    showFallback(`Failed to initialize WebGL: ${(err as Error).message}`);
    return;
  }

  const isSmallDevice = window.matchMedia('(max-width: 720px)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmallDevice ? 1.8 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.copy(CAMERA_START);

  const state: AppState = createState();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const world = new World(scene, { reducedMotion, isSmallDevice });
  const controls = setupInteraction(renderer, camera, {
    houseHitMeshes: world.houseHitMeshes,
    onToggleLights: () => {
      state.lightsOn = !state.lightsOn;
      syncUI(state);
    },
  });

  setupUI(state, {
    onReset: () => {
      state.time = DEFAULTS.time;
      state.weather = DEFAULTS.weather;
      state.wind = DEFAULTS.wind;
      state.lightsOn = DEFAULTS.lightsOn;
      camera.position.copy(CAMERA_START);
      controls.target.copy(CAMERA_TARGET);
      controls.update();
      syncUI(state);
    },
  });
  syncUI(state);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  const env = sampleTimeOfDay(state.time);

  renderer.setAnimationLoop(() => {
    // Clamp the delta so returning from a background tab causes no jump.
    const dt = clamp(clock.getDelta(), 0, 0.05);
    const elapsed = clock.elapsedTime;

    // Interruptible transitions: every animated value damps toward its
    // target, so rapid control changes always redirect cleanly.
    state.weatherBlend = damp(state.weatherBlend, state.weather === 'rain' ? 1 : 0, 1.6, dt);
    state.lightsBlend = damp(state.lightsBlend, state.lightsOn ? 1 : 0, 6, dt);

    sampleTimeOfDay(state.time, env);
    world.update(dt, elapsed, state, env);
    controls.update();
    renderer.render(scene, camera);

    document.body.classList.add('ready');
  });
}

try {
  init();
} catch (err) {
  showFallback(`Something went wrong while starting Pocket World: ${(err as Error).message}`);
}
