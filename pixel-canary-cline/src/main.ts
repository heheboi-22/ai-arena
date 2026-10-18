import * as THREE from 'three';
import { createCameraRig, type CameraRig } from './cameraRig';
import { setupControls } from './controls';
import { createWorld, type Quality } from './scene';
import { DEFAULTS, formatHour, WorldState, type WeatherKind } from './state';

const canvas = document.getElementById('scene') as HTMLCanvasElement | null;
const stage = document.getElementById('stage') as HTMLElement | null;
const fallback = document.getElementById('fallback') as HTMLElement | null;
const fallbackMsg = document.getElementById('fallback-msg') as HTMLElement | null;

function fail(message: string): void {
  if (fallback) fallback.hidden = false;
  if (fallbackMsg) fallbackMsg.textContent = message;
  if (stage) stage.style.visibility = 'hidden';
}

if (!canvas || !stage) {
  fail('The page did not finish loading. Reload to try again.');
} else {
  start(canvas, stage);
}

function start(canvas: HTMLCanvasElement, stageEl: HTMLElement): void {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    fail('This browser could not open a WebGL context, so the diorama cannot render.');
    return;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = reduceMotion.matches;

  const quality: Quality = {
    shadowMap: window.devicePixelRatio > 1.5 ? 1024 : 2048,
    rainDrops: window.innerWidth < 720 ? 260 : 460,
    groundCover: window.innerWidth < 720 ? 190 : 320,
    reduced,
  };

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Neutral (Khronos PBR) keeps the stylised palette saturated where ACES would wash it out.
  renderer.toneMapping = THREE.NeutralToneMapping;

  const state = new WorldState();
  const world = createWorld(quality);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 260);

  let rig: CameraRig | null = null;
  let lastInteract = performance.now();

  const controls = setupControls(
    canvas,
    camera,
    11,
    world.housePickables,
    () => {
      syncLights(state.lightsOn);
      lastInteract = performance.now();
    },
    () => {
      lastInteract = performance.now();
      rig?.cancelTween();
    },
  );
  controls.orbit.autoRotateSpeed = 0.3;

  rig = createCameraRig(camera, controls.orbit);

  /* ---------------------------------------------------------------- sizing */
  function resize(): void {
    const width = stageEl.clientWidth || window.innerWidth;
    const height = stageEl.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, reduced ? 1.5 : 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    rig?.reframe(width, height);
    camera.updateProjectionMatrix();
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  reduceMotion.addEventListener('change', (event) => {
    reduced = event.matches;
    quality.reduced = reduced;
    resize();
  });

  /* -------------------------------------------------------------- controls */
  const timeInput = document.getElementById('time') as HTMLInputElement | null;
  const timeOut = document.getElementById('time-out');
  const windInput = document.getElementById('wind') as HTMLInputElement | null;
  const windOut = document.getElementById('wind-out');
  const lightsBtn = document.getElementById('lights') as HTMLButtonElement | null;
  const lightsState = document.getElementById('lights-state');
  const resetBtn = document.getElementById('reset') as HTMLButtonElement | null;
  const panel = document.getElementById('panel');
  const panelToggle = document.getElementById('panel-toggle') as HTMLButtonElement | null;
  const panelLabel = panelToggle?.querySelector('.panel-toggle__label');
  const weatherButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('.seg[data-weather]'),
  );

  function paintRange(input: HTMLInputElement | null): void {
    if (!input) return;
    const min = Number(input.min);
    const max = Number(input.max);
    const fill = ((Number(input.value) - min) / Math.max(1e-6, max - min)) * 100;
    input.style.setProperty('--fill', `${fill}%`);
  }

  function syncClock(): void {
    if (timeOut) timeOut.textContent = formatHour(state.target.timeHour);
  }

  function syncWeatherUi(): void {
    for (const button of weatherButtons) {
      const on = button.dataset.weather === state.target.weather;
      button.classList.toggle('is-on', on);
      button.setAttribute('aria-pressed', String(on));
    }
  }

  function syncLights(on: boolean): void {
    lightsBtn?.setAttribute('aria-checked', String(on));
    if (lightsState) lightsState.textContent = on ? 'On' : 'Off';
  }

  function syncAll(): void {
    if (timeInput) timeInput.value = String(Math.round(state.target.timeHour * 60));
    if (windInput) windInput.value = String(Math.round(state.target.wind * 100));
    paintRange(timeInput);
    paintRange(windInput);
    if (windOut) windOut.textContent = `${Math.round(state.target.wind * 100)}%`;
    syncClock();
    syncWeatherUi();
    syncLights(state.lightsOn);
  }

  timeInput?.addEventListener('input', () => {
    state.setTimeHour(Number(timeInput.value) / 60);
    paintRange(timeInput);
    syncClock();
    lastInteract = performance.now();
  });

  windInput?.addEventListener('input', () => {
    state.setWind(Number(windInput.value) / 100);
    paintRange(windInput);
    if (windOut) windOut.textContent = `${Math.round(state.target.wind * 100)}%`;
    lastInteract = performance.now();
  });

  for (const button of weatherButtons) {
    button.addEventListener('click', () => {
      state.setWeather((button.dataset.weather ?? DEFAULTS.weather) as WeatherKind);
      syncWeatherUi();
      lastInteract = performance.now();
    });
  }

  lightsBtn?.addEventListener('click', () => syncLights(state.toggleLights()));

  resetBtn?.addEventListener('click', () => {
    state.reset();
    // Snap the smoothed values too, so reset restores the scene, not just the target.
    state.current.wind = DEFAULTS.wind;
    state.current.rainAmount = 0;
    state.current.lights = 0;
    syncAll();
    rig?.reset();
  });

  panelToggle?.addEventListener('click', () => {
    const collapsed = panel?.dataset.collapsed === 'true';
    panel?.setAttribute('data-collapsed', String(!collapsed));
    panelToggle.setAttribute('aria-expanded', String(collapsed));
    if (panelLabel) panelLabel.textContent = collapsed ? 'Hide' : 'Show';
    // Layout changed under the canvas, so the view needs re-deriving.
    resize();
  });

  // Panel is open at load on desktop, collapsed by CSS on short screens.
  if (panel?.dataset.collapsed === 'true') {
    panelToggle?.setAttribute('aria-expanded', 'false');
    if (panelLabel) panelLabel.textContent = 'Show';
  }

  syncAll();

  /* ------------------------------------------------------------------ loop */
  const clock = new THREE.Clock();
  let firstFrame = true;

  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());
    const elapsed = clock.elapsedTime;

    // Orbit only drifts on its own once the viewer has stopped reaching for it.
    controls.orbit.autoRotate = !reduced && performance.now() - lastInteract > 4200;
    controls.orbit.update();
    rig?.update(dt);

    state.update(dt);
    world.update(state, dt, elapsed, controls.orbit.getAzimuthalAngle());
    renderer.toneMappingExposure = world.sky.exposure;
    renderer.render(world.scene, camera);

    if (firstFrame) {
      firstFrame = false;
      document.body.classList.add('is-ready');
    }
  });

  document.addEventListener('visibilitychange', () => {
    // Resume without dumping several seconds of animation into one frame.
    if (!document.hidden) clock.getDelta();
  });

  window.addEventListener('pagehide', () => {
    renderer.setAnimationLoop(null);
    controls.dispose();
    renderer.dispose();
  });
}
