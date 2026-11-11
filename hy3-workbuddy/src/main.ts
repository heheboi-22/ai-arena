import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { createState, resetState } from './state';
import { isSmallDevice, reducedMotion } from './config';
import { clamp, damp } from './util/math';

import { createIsland } from './world/island';
import { createHouse } from './world/house';
import { createTrees } from './world/trees';
import { createWindmill } from './world/windmill';
import { createPonds } from './world/water';
import { createClouds } from './world/clouds';
import { createProps } from './world/props';

import { createEnvironment } from './environment/sky';
import { createRain } from './environment/rain';
import { createPicker } from './interaction/picker';
import { createPanel } from './ui/panel';

// ---------------------------------------------------------------------------
// WebGL capability guard
// ---------------------------------------------------------------------------
function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext('webgl2') || c.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

function showError(title: string, message: string): void {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'overlay-msg';
  wrap.innerHTML = `<div class="card"><h1>${title}</h1><p>${message}</p></div>`;
  app.appendChild(wrap);
}

if (!webglAvailable()) {
  showError(
    'WebGL is required',
    'Pocket World needs a browser with WebGL support, which appears to be unavailable or disabled. Try a different browser or enable hardware acceleration.'
  );
} else {
  boot();
}

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------
function boot(): void {
  const appEl = document.getElementById('app') as HTMLElement;
  const uiEl = document.getElementById('ui') as HTMLElement;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: !isSmallDevice,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    showError('Could not start the 3D view', String(err));
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmallDevice ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  appEl.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    600
  );

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 6.5;
  controls.maxDistance = 45;
  controls.minPolarAngle = Math.PI * 0.12;
  controls.maxPolarAngle = Math.PI * 0.56; // allow a slight look from below
  controls.enablePan = false; // never let the island drift off-screen
  controls.target.set(0, -0.4, 0);

  // Opening direction: a flattering three-quarter view from slightly above.
  const HOME_DIR = new THREE.Vector3(0.597, 0.318, 0.738).normalize();

  /**
   * Distance required to keep the whole island framed for the current
   * aspect ratio (portrait phones need to pull back a lot).
   */
  const framingDistance = (): number => {
    const halfV = Math.tan((camera.fov * Math.PI) / 360);
    const halfH = halfV * camera.aspect;
    const needV = 6.3 / halfV; // island + windmill height
    const needH = 5.7 / halfH; // island width
    return Math.max(needV, needH);
  };

  /** Re-frame after an aspect change without fighting the user's zoom. */
  const applyFraming = (snap: boolean): void => {
    const d = framingDistance();
    const offset = camera.position.clone().sub(controls.target);
    const len = offset.length() || 1;
    const wanted = snap ? d : Math.max(len, d * 0.92);
    offset.setLength(wanted);
    camera.position.copy(controls.target).add(offset);
  };

  camera.position.copy(controls.target).addScaledVector(HOME_DIR, 15);
  applyFraming(true);
  controls.update();
  controls.saveState(); // baseline for Reset

  // --- World ---
  const island = createIsland();
  scene.add(island.group);

  const house = createHouse();
  house.group.position.set(-1.15, 0, -0.95);
  house.group.rotation.y = 0.85; // face the opening camera
  scene.add(house.group);

  const trees = createTrees();
  scene.add(trees.group);

  const windmill = createWindmill();
  windmill.group.position.set(2.2, 0, -1.6);
  windmill.group.rotation.y = 0.35;
  scene.add(windmill.group);

  const ponds = createPonds();
  for (const p of ponds) scene.add(p.group);

  const clouds = createClouds();
  scene.add(clouds.group);

  const props = createProps();
  scene.add(props.group);

  // --- Environment & weather ---
  const env = createEnvironment(scene);
  const rain = createRain();
  scene.add(rain.mesh);

  // --- State & UI ---
  const state = createState();
  const motion = reducedMotion ? 0.2 : 1.0;

  // Whether the control panel is currently open. On narrow screens the panel
  // is a bottom sheet, so the framing shifts to keep the island clear of it.
  let panelExpanded = true;

  /**
   * Offset the camera frustum so the island is never hidden by the UI.
   * Wide screens push the scene right of the side panel; narrow screens
   * centre the island and lift it clear of the bottom sheet when it opens.
   */
  const applyViewOffset = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    if (w <= 700) {
      const lift = panelExpanded ? h * 0.16 : 0;
      camera.setViewOffset(w, h, 0, lift, w, h);
    } else {
      camera.setViewOffset(w, h, -w * 0.055, 0, w, h);
    }
    camera.updateProjectionMatrix();
  };

  // Smoothed view values (interruptible, time-based transitions).
  const view = {
    time: state.time,
    wind: state.wind,
    rain: state.weather === 'rain' ? 1 : 0,
    glow: state.houseLights ? 1 : 0,
  };

  const panel = createPanel({
    root: uiEl,
    state,
    onReset: () => {
      resetState(state);
      panel.sync();
      controls.reset();
    },
    onExpandChange: (expanded) => {
      panelExpanded = expanded;
      applyViewOffset();
    },
  });

  // --- House tap vs orbit drag ---
  createPicker({
    dom: renderer.domElement,
    camera,
    target: house.group,
    onToggle: () => {
      state.houseLights = !state.houseLights;
      panel.sync();
    },
  });

  // --- Resize ---
  const onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    applyViewOffset();
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmallDevice ? 1.5 : 2));
    applyFraming(false);
  };
  window.addEventListener('resize', onResize);
  onResize();
  controls.saveState(); // re-save the baseline after the first framing pass

  // --- Animation loop ---
  let last = performance.now();
  let elapsed = 0;

  const animate = (now: number): void => {
    requestAnimationFrame(animate);
    // Clamp big jumps (e.g. returning from a background tab) while still
    // advancing smoothly on slower devices.
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    elapsed += dt;

    // Smoothly approach the user's state so changes are interruptible.
    view.time = damp(view.time, state.time, 5, dt);
    view.wind = damp(view.wind, state.wind, 4, dt);
    view.rain = damp(view.rain, state.weather === 'rain' ? 1 : 0, 3, dt);
    view.glow = damp(view.glow, state.houseLights ? 1 : 0, 7, dt);

    env.update({ time: view.time, rain: view.rain, cloudMaterial: clouds.material });
    house.setLights(view.glow);

    // Windmill: stops at zero wind, scales with wind strength.
    windmill.blades.rotation.z -= view.wind * 3.6 * motion * dt;

    // Trees sway only as much as the wind allows.
    for (const s of trees.swayers) {
      const a = s.amp * view.wind * motion;
      s.pivot.rotation.z = Math.sin(elapsed * s.speed + s.phase) * a;
      s.pivot.rotation.x = Math.cos(elapsed * s.speed * 0.8 + s.phase) * a * 0.7;
    }

    clouds.update(dt, view.wind);
    for (const p of ponds) p.update(elapsed, dt, view.rain);
    rain.update(dt, view.rain, view.wind);

    controls.update();
    renderer.render(scene, camera);
  };

  // Prime the first frame, then run.
  env.update({ time: view.time, rain: view.rain, cloudMaterial: clouds.material });

  // Opt-in debug handle (?debug) for automated verification.
  if (new URLSearchParams(window.location.search).has('debug')) {
    (window as unknown as Record<string, unknown>).__pocketWorld = {
      state,
      camera,
      controls,
      house: house.group,
      renderer,
      env,
    };
  }

  requestAnimationFrame(animate);
}
