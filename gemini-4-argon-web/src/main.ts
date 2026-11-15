import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import './styles.css';
import { WorldStateStore, clamp } from './state';
import { createProceduralTextures } from './world/textures';
import { createIsland } from './world/island';
import { createHouse } from './world/house';
import { createPond } from './world/pond';
import { createWindmill } from './world/windmill';
import { createTrees } from './world/trees';
import { createDetails } from './world/details';
import { createSkyEnvironment } from './environment/sky';
import { createClouds } from './environment/clouds';
import { createRain } from './environment/rain';
import { createInteractionController } from './interaction/controls';
import { createControlPanel } from './ui/panel';

function detectSoftwareGl(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function showWebGLFallback(): void {
  const fallback = document.getElementById('webgl-fallback');
  if (fallback) {
    fallback.hidden = false;
  }
}

function bootstrap(): void {
  const canvasMount = document.getElementById('canvas-mount');
  const hudRoot = document.getElementById('hud-root');

  if (!canvasMount || !hudRoot) {
    return;
  }

  const isSoftwareGl = detectSoftwareGl();

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
  } catch {
    showWebGLFallback();
    return;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  canvasMount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#9bd1f5', 0.0065);

  // Studio environment reflections for water, glass, and brass accents
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;
  pmremGenerator.dispose();

  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / Math.max(1, window.innerHeight),
    0.5,
    160,
  );

  const store = new WorldStateStore();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const textures = createProceduralTextures(maxAniso);

  // Assemble the floating island world
  const skyEnv = createSkyEnvironment(textures, !isSoftwareGl);
  scene.add(skyEnv.group);

  const worldRoot = new THREE.Group();
  worldRoot.name = 'PocketWorldRoot';
  scene.add(worldRoot);

  const island = createIsland(textures);
  worldRoot.add(island.group);

  const pond = createPond(textures);
  island.group.add(pond.group);

  const house = createHouse(textures);
  island.group.add(house.group);

  const windmill = createWindmill(textures);
  island.group.add(windmill.group);

  const trees = createTrees(textures);
  island.group.add(trees.group);

  const details = createDetails(textures);
  island.group.add(details.group);

  const clouds = createClouds();
  scene.add(clouds.group);

  const rain = createRain();
  scene.add(rain.group);

  // Camera & pointer interaction
  const interaction = createInteractionController(
    camera,
    renderer.domElement,
    house.hitMeshes,
    () => {
      store.toggleHouseLights();
      house.triggerPulse();
    },
    (hovered) => {
      house.setHovered(hovered);
    },
    isSoftwareGl,
  );

  // UI Overlay Panel
  const uiPanel = createControlPanel(hudRoot, store, () => {
    interaction.resetCamera(false);
  });

  // Responsive resize handling
  const onResize = () => {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    interaction.syncViewportAspect(w, h);
    renderer.setSize(w, h);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  };
  onResize();
  window.addEventListener('resize', onResize);

  // Handle WebGL context loss gracefully
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    showWebGLFallback();
  });

  // Animation loop with clamped frame delta and software-WebGL fence pacing
  let lastTime = performance.now();
  let elapsed = 0;
  let frameId = 0;

  function afterDraw(cb: () => void): void {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    } else {
      frameId = window.setTimeout(cb, 80);
    }
  }

  function tick(): void {
    const now = performance.now();
    const rawDt = (now - lastTime) / 1000;
    lastTime = now;
    // Clamp frame delta so returning from a background tab never jumps
    const dt = clamp(rawDt, 0.001, 0.1);
    elapsed += dt;

    store.updateSmoothed(dt);
    const { timeHours, rainFactor, windFactor, houseLightsFactor, reducedMotion } = store.smoothed;

    const celestial = skyEnv.update(elapsed, timeHours, rainFactor, scene);
    const { daylight, twilight, nightness } = celestial;

    island.update(elapsed, dt, reducedMotion, nightness);
    pond.update(elapsed, dt, rainFactor, windFactor, daylight, twilight, nightness, reducedMotion);
    house.update(elapsed, dt, houseLightsFactor, nightness, rainFactor, windFactor, reducedMotion);
    windmill.update(dt, windFactor, houseLightsFactor, nightness);
    trees.update(elapsed, windFactor, rainFactor, reducedMotion);
    details.update(elapsed, windFactor, nightness, rainFactor, reducedMotion);
    clouds.update(elapsed, dt, windFactor, rainFactor, daylight, twilight, nightness, reducedMotion);
    rain.update(dt, rainFactor, windFactor, nightness, reducedMotion);
    interaction.update(dt);

    renderer.render(scene, camera);

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = window.requestAnimationFrame(tick);
    }
  }

  tick();

  // Cleanup hook on page unload
  window.addEventListener('beforeunload', () => {
    window.cancelAnimationFrame(frameId);
    window.clearTimeout(frameId);
    window.removeEventListener('resize', onResize);
    uiPanel.destroy();
    interaction.dispose();
    textures.dispose();
    envTarget.dispose();
    renderer.dispose();
  });
}

bootstrap();
