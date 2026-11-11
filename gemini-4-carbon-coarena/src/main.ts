import * as THREE from 'three';
import './style.css';
import { PocketWorldStore } from './state';
import { lerp } from './utils/math';
import { createCameraRig } from './systems/camera';
import { setupHouseInteraction } from './systems/interaction';
import { mountControlPanel } from './ui/panel';
import { createClouds } from './world/clouds';
import { createHouse } from './world/house';
import { createIsland } from './world/island';
import { createPond } from './world/pond';
import { createProps } from './world/props';
import { createSkyAndLights } from './world/skyAndLights';
import { createVegetation } from './world/vegetation';
import { createWeatherSystem } from './world/weather';
import { createWindmill } from './world/windmill';

function showWebGLFallback(customMessage?: string): void {
  const fallback = document.getElementById('webgl-fallback');
  const messageEl = document.getElementById('webgl-fallback-message');
  const canvas = document.getElementById('scene-canvas');
  if (canvas) {
    canvas.style.display = 'none';
  }
  if (messageEl && customMessage) {
    messageEl.textContent = customMessage;
  }
  if (fallback) {
    fallback.hidden = false;
  }
}

function isWebGLSupported(): boolean {
  try {
    const probe = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (probe.getContext('webgl2') || probe.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

function bootstrap(): void {
  const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement | null;
  const uiRoot = document.getElementById('ui-root');

  if (!canvas || !uiRoot) {
    showWebGLFallback('Application container elements were not found in the document.');
    return;
  }

  if (!isWebGLSupported()) {
    showWebGLFallback();
    return;
  }

  const isCompactDevice =
    window.innerWidth < 768 || (navigator.maxTouchPoints ?? 0) > 1;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
  } catch {
    showWebGLFallback();
    return;
  }

  const getClampedDpr = (): number =>
    Math.min(window.devicePixelRatio || 1, isCompactDevice ? 1.6 : 2.0);

  renderer.setPixelRatio(getClampedDpr());
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    showWebGLFallback(
      'The WebGL graphics context was lost. Please reload the page to restore Pocket World.'
    );
  });

  // Reduced motion preference detection & live listener
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const store = new PocketWorldStore(motionQuery.matches);
  motionQuery.addEventListener('change', (e) => {
    store.setReducedMotion(e.matches);
  });

  // Scene & Camera Setup
  const scene = new THREE.Scene();
  const cameraRig = createCameraRig(canvas);

  // Build World Modules
  const skyAndLights = createSkyAndLights(scene, isCompactDevice);

  const floatingWorld = new THREE.Group();
  floatingWorld.name = 'FloatingIslandAssembly';
  scene.add(floatingWorld);

  const island = createIsland();
  const pond = createPond();
  const house = createHouse();
  const windmill = createWindmill();
  const vegetation = createVegetation();
  const props = createProps();

  floatingWorld.add(
    island.group,
    pond.group,
    house.group,
    windmill.group,
    vegetation.group,
    props.group
  );

  const clouds = createClouds();
  const weather = createWeatherSystem(
    (x, z, strength) => pond.spawnRipple(x, z, strength),
    isCompactDevice
  );
  scene.add(clouds.group, weather.group);

  // Mount UI Control Panel & Synchronize Reset + House Click
  const panel = mountControlPanel(uiRoot, store);

  store.onReset(() => {
    cameraRig.reset(false);
  });

  let prevHouseLights = store.target.houseLights;
  store.subscribe((state) => {
    if (state.houseLights !== prevHouseLights) {
      prevHouseLights = state.houseLights;
      house.triggerPulse();
    }
  });

  const cleanupInteraction = setupHouseInteraction({
    canvas,
    camera: cameraRig.camera,
    hitTargets: house.hitTargets,
    onHouseClick: () => {
      store.toggleHouseLights();
    },
  });

  // Responsive Window Resize
  const onResize = (): void => {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(getClampedDpr());
    renderer.setSize(w, h);
    cameraRig.resize(w, h);
  };
  window.addEventListener('resize', onResize);

  // Time-based Animation Loop with Clamped Frame Deltas
  let lastTimeMs = performance.now();
  let elapsed = 0;

  function animate(nowMs: number): void {
    requestAnimationFrame(animate);

    const rawDt = (nowMs - lastTimeMs) / 1000;
    lastTimeMs = nowMs;
    // Clamp large deltas (e.g. returning from background tab) to prevent animation jumps
    const dt = Math.min(Math.max(rawDt, 0), 0.05);
    elapsed += dt;

    store.update(dt);

    const { smoothed, target } = store;
    const reduced = target.reducedMotion;

    const skySample = skyAndLights.update(
      smoothed.time,
      smoothed.rainAmount,
      elapsed,
      reduced
    );

    // Subtle exposure compensation keeps nighttime atmospheric yet clearly readable
    renderer.toneMappingExposure = lerp(1.03, 1.14, skySample.nightFactor);

    // Gentle floating island hover
    floatingWorld.position.y = reduced
      ? 0
      : Math.sin(elapsed * 0.72) * 0.036;

    island.update(
      elapsed,
      smoothed.wind,
      smoothed.rainAmount,
      skySample.dayFactor,
      reduced
    );
    house.update(
      dt,
      elapsed,
      smoothed.houseLightAmount,
      skySample.nightFactor,
      smoothed.wind,
      smoothed.rainAmount,
      reduced
    );
    pond.update(
      dt,
      elapsed,
      smoothed.wind,
      smoothed.rainAmount,
      skySample.dayFactor,
      reduced
    );
    windmill.update(dt, smoothed.wind, smoothed.rainAmount, reduced);
    vegetation.update(elapsed, smoothed.wind, smoothed.rainAmount, reduced);
    props.update(elapsed, smoothed.wind, smoothed.rainAmount, reduced);
    clouds.update(
      dt,
      elapsed,
      smoothed.wind,
      smoothed.rainAmount,
      smoothed.time,
      reduced
    );
    weather.update(
      dt,
      smoothed.rainAmount,
      smoothed.wind,
      skySample.dayFactor,
      reduced
    );

    cameraRig.update(dt);
    renderer.render(scene, cameraRig.camera);
  }

  requestAnimationFrame(animate);

  // Clean up on Vite HMR if applicable
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      window.removeEventListener('resize', onResize);
      cleanupInteraction();
      panel.dispose();
      cameraRig.dispose();
      renderer.dispose();
    });
  }
}

bootstrap();
