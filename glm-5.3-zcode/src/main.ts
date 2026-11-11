import './style.css';
import * as THREE from 'three';
import { AppState } from './app-state';
import { sampleEnv, nightFactor } from './palette';
import { createMaterials } from './world/materials';
import { createIsland } from './world/island';
import { createSky } from './world/sky';
import { createHouse } from './world/house';
import { createPond } from './world/pond';
import { createWaterfall } from './world/waterfall';
import { createVegetation } from './world/vegetation';
import { createWindmill } from './world/windmill';
import { createClouds } from './world/clouds';
import { createProps } from './world/props';
import { createSmoke } from './world/smoke';
import { createLighting } from './systems/lighting';
import { createRain } from './systems/rain';
import { createControls } from './systems/controls';
import { createPicker } from './systems/interaction';
import { createUI } from './systems/ui';
import { CAMERA_START } from './world/layout';

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function showFallback(): void {
  const el = document.getElementById('webgl-fallback');
  if (el) el.hidden = false;
  const panel = document.getElementById('panel');
  if (panel) panel.hidden = true;
}

function boot(): void {
  const sceneRoot = document.getElementById('scene');
  if (!sceneRoot || !webglAvailable()) {
    showFallback();
    return;
  }

  const smallish =
    Math.min(window.innerWidth, window.innerHeight) < 640 ||
    (navigator.hardwareConcurrency ?? 8) <= 4;

  // ---- renderer -----------------------------------------------------------
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch {
    showFallback();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, smallish ? 1.75 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  sceneRoot.appendChild(renderer.domElement);

  // ---- scene graph --------------------------------------------------------
  const scene = new THREE.Scene();
  const fog = new THREE.Fog(0xd6dbc9, 27, 80);
  scene.fog = fog;

  const camera = new THREE.PerspectiveCamera(
    CAMERA_START.fov,
    window.innerWidth / window.innerHeight,
    0.1,
    140,
  );
  camera.position.set(...CAMERA_START.pos);
  // portrait screens see a narrower slice — pull back so the island fits
  if (camera.aspect < 0.8) camera.position.multiplyScalar(1.24);

  const state = new AppState();
  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  state.reducedMotion = reducedQuery.matches;
  reducedQuery.addEventListener('change', (e) => {
    state.reducedMotion = e.matches;
  });

  const mats = createMaterials();
  const sky = createSky();
  const lighting = createLighting(smallish ? 1024 : 2048);
  const island = createIsland(mats);
  const pond = createPond();
  const waterfall = createWaterfall();
  const house = createHouse(mats, island.groundY);
  const vegetation = createVegetation(mats, island.groundY);
  const windmill = createWindmill(mats, island.groundY);
  const clouds = createClouds(mats);
  const props = createProps(mats, island.groundY);
  const smoke = createSmoke(house.chimneyTip);
  const rain = createRain(smallish ? 380 : 540, pond.waterY);
  const rig = createControls(camera, renderer.domElement);

  scene.add(
    sky.group,
    lighting.group,
    island.group,
    pond.group,
    waterfall.group,
    house.group,
    vegetation.group,
    windmill.group,
    clouds.group,
    props.group,
    smoke.group,
    rain.group,
  );

  // ---- interactions -------------------------------------------------------
  const toggleLights = () => {
    state.lights = !state.lights;
    ui.syncLights(state.lights);
    house.pulse();
  };
  createPicker(renderer.domElement, camera, [house.group], toggleLights);

  const ui = createUI({
    onTime: (h) => {
      state.hour = h;
    },
    onWeather: (w) => {
      state.weather = w;
    },
    onWind: (v) => {
      state.wind = v;
    },
    onLights: (on) => {
      state.lights = on;
    },
    onReset: () => {
      state.reset();
      ui.syncTime(state.hour);
      ui.syncWeather(state.weather);
      ui.syncWind(state.wind);
      ui.syncLights(state.lights);
      rig.flyHome(state.reducedMotion ? 250 : 950);
    },
  });

  // ---- resize -------------------------------------------------------------
  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  // ---- frame loop ---------------------------------------------------------
  const clock = new THREE.Clock();
  let elapsed = 0;

  const tick = () => {
    // clamp huge deltas (background tab) so nothing lurches on return
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    state.update(dt);
    const env = sampleEnv(state.sHour, state.sRain);

    sky.update(env, state.sHour, elapsed, state.sRain);
    lighting.update(env, state.sHour, state.sRain);
    fog.color.copy(env.fogColor);
    fog.near = env.fogNear;
    fog.far = env.fogFar;
    renderer.toneMappingExposure = env.exposure;

    const night = nightFactor(state.sHour);

    island.update(dt, elapsed, state.reducedMotion);
    pond.update(dt, elapsed, state.sRain, lighting.waterTint);
    waterfall.update(dt, elapsed, state.sWind, lighting.waterTint);
    house.update(dt, state.sLights, night, state.reducedMotion);
    vegetation.update(dt, elapsed, state.sWind, night, state.sRain, state.reducedMotion);
    windmill.update(dt, state.sWind);
    clouds.update(dt, elapsed, state.sWind, state.sRain, state.reducedMotion);
    props.update(dt, state.sLights, night);
    smoke.update(dt, state.sWind, state.reducedMotion);
    rain.update(dt, state.sRain, state.sWind);

    rig.update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

boot();
