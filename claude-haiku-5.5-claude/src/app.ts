import { NeutralToneMapping, PCFShadowMap, Timer, WebGLRenderer } from 'three';
import { createStore, DEFAULT_STATE } from './state';
import { detectQuality } from './quality';
import { createWorld } from './world';
import { createCameraRig } from './interaction/camera';
import { attachHousePicking } from './interaction/picking';
import { bindPanel } from './ui/panel';
import { hideNotice, showNotice } from './ui/notice';

const WEBGL_MESSAGE =
  'Pocket World needs WebGL, and this browser did not provide it. Try a current version of Chrome, Edge, Firefox or Safari, and make sure hardware acceleration is turned on.';

function webglAvailable(): boolean {
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'));
  } catch {
    return false;
  }
}

export function startApp(): void {
  const canvas = document.getElementById('scene');
  const panel = document.getElementById('panel');
  if (!(canvas instanceof HTMLCanvasElement) || !panel) {
    throw new Error('index.html is missing the #scene canvas or the #panel section');
  }

  if (!webglAvailable()) {
    showNotice(WEBGL_MESSAGE);
    return;
  }

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (error) {
    console.error(error);
    showNotice(WEBGL_MESSAGE);
    return;
  }

  const quality = detectQuality();
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1;

  const world = createWorld(quality);
  const rig = createCameraRig(canvas);
  const store = createStore({ ...DEFAULT_STATE });

  // Tells the camera how much of the screen the panel covers, so the island is
  // centred in the rest. Side panel on desktop, bottom sheet on a phone.
  const syncInsets = (): void => {
    const open = panel.dataset.open === 'true';
    const compact = window.matchMedia('(max-width: 640px)').matches;
    if (!open) {
      rig.setInsets(0, 0);
      return;
    }
    const rect = panel.getBoundingClientRect();
    rig.setInsets(compact ? 0 : rect.right + 12, compact ? rect.height : 0);
  };

  bindPanel({
    store,
    onReset: () => {
      store.reset();
      rig.resetView();
    },
    onLayout: syncInsets,
  });

  attachHousePicking({
    canvas,
    camera: rig.camera,
    pickRoot: world.solids,
    target: world.house.group,
    onTap: () => store.set({ houseLights: !store.get().houseLights }),
  });

  const resize = (): void => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    rig.resize(width, height);
    syncInsets();
  };
  window.addEventListener('resize', resize);
  resize();

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const timer = new Timer();

  renderer.setAnimationLoop((time) => {
    timer.update(time);
    // Clamp the step so returning from a background tab doesn't jump the scene forward.
    const dt = Math.min(timer.getDelta(), 0.1);
    rig.update(dt);
    world.update({ state: store.get(), dt, elapsed: timer.getElapsed(), reducedMotion: reduced.matches });
    renderer.render(world.scene, rig.camera);
  });

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    showNotice('The graphics context was lost. Reload the page to bring the island back.');
  });
  canvas.addEventListener('webglcontextrestored', () => hideNotice());
}
