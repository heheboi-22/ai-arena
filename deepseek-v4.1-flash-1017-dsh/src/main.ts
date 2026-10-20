import './style.css';
import {
  ACESFilmicToneMapping,
  PCFShadowMap,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { Environment } from './environment/environment';
import { RainLayer } from './environment/rain';
import { RippleLayer } from './environment/ripples';
import { CameraRig } from './interaction/cameraRig';
import { HousePicker } from './interaction/housePicker';
import { createMaterials } from './scene/palette';
import { createTextures } from './lib/textures';
import { World } from './scene/world';
import { DEFAULT_STATE, WorldStore } from './state';
import { ControlPanel } from './ui/panel';

function id<T extends HTMLElement>(elementId: string): T {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Missing page element: ${elementId}`);
  return element as T;
}

function showFailure(message: string): void {
  const failure = document.getElementById('failure');
  const messageElement = document.getElementById('failure-message');
  const boot = document.getElementById('boot');
  const panel = document.getElementById('panel');
  const canvas = document.getElementById('scene');
  const vignette = document.querySelector<HTMLElement>('.vignette');

  if (messageElement) messageElement.textContent = message;
  if (panel) panel.hidden = true;
  if (canvas) canvas.hidden = true;
  if (vignette) vignette.hidden = true;
  if (boot) {
    boot.classList.add('is-done');
    boot.hidden = true;
  }
  if (failure) failure.hidden = false;
  document.getElementById('failure-reload')?.focus();
}

async function boot(): Promise<void> {
  const canvas = id<HTMLCanvasElement>('scene');
  const bootOverlay = id<HTMLElement>('boot');

  document.getElementById('failure-reload')?.addEventListener('click', () => {
    window.location.reload();
  });
  const store = new WorldStore();
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = reduceMotionQuery.matches;
  reduceMotionQuery.addEventListener('change', (event) => {
    reducedMotion = event.matches;
  });

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
  } catch (error) {
    console.error('WebGL renderer could not be created.', error);
    showFailure(
      'This browser or device could not create a WebGL canvas. Try a recent browser with hardware acceleration enabled, then reload the page.',
    );
    return;
  }

  const isSmallScreen = window.matchMedia('(max-width: 820px), (max-height: 560px)').matches;
  const limitedDevice =
    isSmallScreen ||
    (navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 4);
  const quality: 'high' | 'low' = limitedDevice ? 'low' : 'high';

  const scene = new Scene();
  const textures = createTextures();
  const materials = createMaterials(textures);
  const world = new World(materials, textures, quality);
  scene.add(world.group);

  const cameraRig = new CameraRig(canvas);
  const environment = new Environment(scene, textures.softDot, textures.moon, quality);
  const ripples = new RippleLayer(world.pond);
  scene.add(ripples.group);

  const rain = new RainLayer({
    count: quality === 'high' ? 1100 : 520,
    isOnIsland: (x, z) => world.isOnIsland(x, z),
    terrainHeight: (x, z) => world.terrainHeight(x, z),
    pondContains: (x, z) => world.pond.contains(x, z),
    pondY: world.pond.waterY,
    onPondDrop: (x, z) => ripples.splash(x, z, environment.frame.rain),
  });
  scene.add(rain.group);

  new HousePicker(canvas, cameraRig.camera, world.house.hitTarget, () => {
    store.toggleHouseLights();
  });

  new ControlPanel({
    store,
    onResetView: () => {
      cameraRig.reset();
      environment.snapTo(DEFAULT_STATE);
      rain.clear();
      ripples.clear();
      world.resetDecorative();
    },
  });

  const resize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const cap = quality === 'high' && window.innerWidth > 820 && window.innerHeight > 560 ? 2 : 1.6;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, cap);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height);
    cameraRig.resize(width, height);
  };

  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  resize();

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => window.setTimeout(resize, 120));

  let lastTime = performance.now();
  let elapsed = 0;
  let running = true;

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    running = false;
    showFailure('The 3D view stopped responding. Reload the page to wake the island again.');
  });

  window.addEventListener('visibilitychange', () => {
    if (!document.hidden) lastTime = performance.now();
  });

  let firstFrame = true;
  const animate = (now: number): void => {
    if (!running) return;
    const rawDelta = (now - lastTime) / 1000;
    lastTime = now;
    const dt = Math.min(0.05, Math.max(0.0001, rawDelta));
    elapsed += dt;

    const state = store.get();
    const frame = environment.update(dt, state);
    world.update(dt, elapsed, frame, reducedMotion);
    rain.update(dt, frame);
    ripples.update(dt, frame);
    cameraRig.update();
    renderer.toneMappingExposure = frame.exposure;
    renderer.render(scene, cameraRig.camera);

    if (firstFrame) {
      firstFrame = false;
      window.setTimeout(() => bootOverlay.classList.add('is-done'), 80);
    }

    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
}

boot().catch((error: unknown) => {
  console.error('Pocket World failed to start.', error);
  showFailure(
    'The island could not be built in this browser. Reload the page, or try a recent browser with WebGL enabled.',
  );
});
