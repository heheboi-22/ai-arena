import './style.css';
import * as THREE from 'three';
import { StateStore } from './state';
import { createIsland } from './scene/island';
import { createStructures } from './scene/structures';
import { createFoliage } from './scene/foliage';
import { createEnvironment } from './scene/environment';
import { createInteractionController } from './interaction/controller';
import { createUIPanel } from './ui/panel';

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

function showWebGLFallback(): void {
  const fallback = document.getElementById('webgl-fallback');
  if (fallback) {
    fallback.hidden = false;
  }
}

function bootstrap(): void {
  const canvasContainer = document.getElementById('canvas-container');
  const uiRoot = document.getElementById('ui-root');

  if (!canvasContainer || !uiRoot) {
    return;
  }

  if (!isWebGLAvailable()) {
    showWebGLFallback();
    return;
  }

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
  } catch {
    showWebGLFallback();
    return;
  }

  const updatePixelRatio = () => {
    const isSmallScreen = window.innerWidth < 680;
    const maxDpr = isSmallScreen ? 1.5 : 2.0;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  };

  updatePixelRatio();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvasContainer.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / Math.max(1, window.innerHeight),
    0.5,
    140
  );

  const store = new StateStore();

  // Group holding the floating island and everything resting on it
  const worldFloatGroup = new THREE.Group();
  worldFloatGroup.name = 'WorldFloatGroup';
  scene.add(worldFloatGroup);

  // 1. Build Island Base, Pond, Shoreline, and Satellite Islets
  const island = createIsland();
  worldFloatGroup.add(island.root);

  // 2. Build House, Windmill, Fences, Bench, and Lanterns
  const structures = createStructures();
  worldFloatGroup.add(structures.root);

  // 3. Build Trees, Bushes, Reeds, and Wildflowers
  const foliage = createFoliage();
  worldFloatGroup.add(foliage.root);

  // 4. Build Sky, Lighting, Clouds, 3D Rain, Ripples, and Chimney Smoke
  const environment = createEnvironment(
    scene,
    island.waterMaterial,
    structures.chimneyWorldPos
  );
  scene.add(environment.root);

  // 5. Initialize OrbitControls & House Click Interaction
  const interaction = createInteractionController(
    camera,
    renderer.domElement,
    structures.houseGroup,
    store
  );

  // 6. Initialize UI Panel
  createUIPanel(uiRoot, store);

  // Responsive Resize Handler
  const onResize = () => {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    const aspect = w / h;
    camera.aspect = aspect;
    // Dynamically widen vertical FOV on narrow portrait screens so the full island width and underside remain framed
    const baseFov = 40;
    if (w <= 680) {
      const widthScale = Math.min(1, w / 720);
      camera.fov = Math.min(72, baseFov / Math.pow(widthScale, 0.78));
      // Positive Y offset places the optical center in the upper half above the mobile bottom panel
      camera.setViewOffset(w, h, 0, Math.round(h * 0.21), w, h);
    } else {
      camera.fov =
        aspect < 1.0
          ? Math.min(64, baseFov / Math.pow(aspect, 0.55))
          : baseFov;
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
    updatePixelRatio();
    renderer.setSize(w, h);
  };

  window.addEventListener('resize', onResize);
  onResize();

  // Main Animation Loop with clamped delta time
  let lastTime = performance.now();
  let floatElapsed = 0;

  const animate = (now: number) => {
    requestAnimationFrame(animate);

    // Clamp unusually large frame deltas (e.g., returning from a background tab)
    const rawDt = (now - lastTime) / 1000;
    lastTime = now;
    const dt = Math.min(Math.max(rawDt, 0.0001), 0.1);

    store.updateSmoothed(dt);
    const {
      timeOfDay,
      rainFactor,
      windFactor,
      houseLightsFactor,
      reducedMotion,
    } = store.smoothed;

    // Gentle floating motion of the main island and satellite islets
    if (!reducedMotion) {
      floatElapsed += dt;
      worldFloatGroup.position.y = Math.sin(floatElapsed * 1.05) * 0.065;
      for (const islet of island.floatingIslets) {
        islet.mesh.position.y =
          islet.baseY + Math.sin(floatElapsed * islet.speed + islet.phase) * 0.14;
      }
    } else {
      worldFloatGroup.position.y = 0;
      for (const islet of island.floatingIslets) {
        islet.mesh.position.y = islet.baseY;
      }
    }

    environment.update(dt, timeOfDay, rainFactor, windFactor, reducedMotion);
    const nightFactor = environment.getNightFactor();

    structures.update(
      dt,
      windFactor,
      houseLightsFactor,
      nightFactor,
      reducedMotion
    );
    foliage.update(dt, windFactor, reducedMotion);
    interaction.update(dt);

    renderer.render(scene, camera);
  };

  requestAnimationFrame(animate);
}

bootstrap();
