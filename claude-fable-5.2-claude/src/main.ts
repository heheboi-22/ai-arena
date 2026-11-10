import * as THREE from 'three';
import './style.css';
import { Environment } from './env/environment';
import { Wind } from './env/wind';
import { CameraRig, FOV, type Insets } from './interaction/cameraRig';
import { Picker } from './interaction/picker';
import { World } from './scene/world';
import { Store } from './state';
import { createPanel } from './ui/panel';

function showFallback(detail?: string): void {
  const box = document.getElementById('fallback');
  if (!box) return;
  if (detail) {
    const text = document.getElementById('fallback-text');
    if (text) text.textContent = detail;
  }
  box.hidden = false;
  document.getElementById('panel')?.setAttribute('hidden', '');
}

function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

function start(): void {
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const stage = document.getElementById('stage') as HTMLElement;

  // Lighter settings for phones and modest machines.
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 700;
  const lowTier = coarse || small || (navigator.hardwareConcurrency ?? 8) <= 4;
  const maxPixelRatio = lowTier ? 1.5 : 2;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const store = new Store();
  const wind = new Wind();
  wind.strength = store.state.wind;
  const env = new Environment(lowTier ? 1024 : 2048);
  env.snap(store.state);
  const world = new World(wind, { rainCount: lowTier ? 750 : 1500 });
  const rig = new CameraRig(canvas);

  const scene = new THREE.Scene();
  env.addTo(scene);
  scene.add(world.root);

  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let motion = reducedQuery.matches ? 0 : 1;
  reducedQuery.addEventListener('change', (e) => {
    motion = e.matches ? 0 : 1;
  });

  // --- layout ----------------------------------------------------------------
  const sheetQuery = matchMedia('(max-width: 720px)');
  let panelEl: HTMLElement | null = null;
  const layout = (): void => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (w === 0 || h === 0) return;
    const ratio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    env.sky.setPixelRatio(ratio);
    world.setViewport(h * ratio, FOV);

    // Frame the island in whatever the panel leaves free.
    const insets: Insets = { left: 0, right: 0, top: 0, bottom: 0 };
    if (panelEl && !panelEl.hidden) {
      const r = panelEl.getBoundingClientRect();
      if (sheetQuery.matches) insets.bottom = Math.min(h * 0.6, Math.max(0, h - r.top));
      else if (!panelEl.classList.contains('is-collapsed') && r.right < w * 0.45) insets.left = r.right;
    }
    rig.setViewport(w, h, insets);
  };

  const panel = createPanel(store, layout);
  panelEl = panel.element;
  const observer = new ResizeObserver(layout);
  observer.observe(stage);
  observer.observe(panelEl);
  layout();

  // --- interaction -----------------------------------------------------------
  const picker = new Picker({
    dom: canvas,
    camera: rig.camera,
    occluders: world.pickables,
    target: world.house.group,
    onPick: () => store.toggleLights(),
  });
  store.onReset(() => rig.reset(motion > 0.5));

  // --- loop ------------------------------------------------------------------
  let last = performance.now();
  let time = 0;
  let theme = '';
  const frame = (now: number): void => {
    // Clamp so a background tab coming back does not fast-forward the world.
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;

    const state = store.state;
    wind.update(dt, state.wind);
    env.update(dt, state, renderer);
    rig.update(dt);
    picker.update();
    world.update(dt, time, wind, env, motion);
    env.sky.update(rig.camera, time, env.starOpacity, motion);

    const nextTheme = env.frame.night > 0.5 ? 'night' : 'day';
    if (nextTheme !== theme) {
      theme = nextTheme;
      document.body.dataset.theme = theme;
    }
    renderer.render(scene, rig.camera);
  };
  renderer.setAnimationLoop(frame);

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    showFallback('The graphics context was lost. Reload the page to bring the island back.');
  });

  if (import.meta.env.DEV) {
    Object.assign(window, { pocket: { store, env, wind, world, rig, renderer } });
  }
}

if (!hasWebGL2()) {
  showFallback();
} else {
  try {
    start();
  } catch (err) {
    console.error(err);
    showFallback(
      'Something went wrong while building the island. Reloading usually helps; if not, try a different browser.',
    );
  }
}
