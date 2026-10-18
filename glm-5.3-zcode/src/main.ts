import './style.css';
import * as THREE from 'three';
import { AppState } from './app-state';
import { samplePalette } from './palette';
import type { Frame } from './lib/frame';
import { makeIsland } from './world/island';
import { makeHouse } from './world/house';
import { makeWindmill } from './world/windmill';
import { makeVegetation } from './world/vegetation';
import { makePond } from './world/pond';
import { makeClouds } from './world/clouds';
import { makeSky } from './world/sky';
import { makeRain } from './world/rain';
import { makeProps } from './world/props';
import { makeLighting } from './systems/lighting';
import { makeControls } from './systems/controls';
import { makeClickPicker } from './systems/interaction';
import { makeUI } from './systems/ui';

function showWebglError(message?: string): void {
  const el = document.getElementById('webgl-error');
  if (!el) return;
  if (message) el.textContent = `Pocket World hit a problem while starting: ${message}`;
  el.hidden = false;
}

let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  showWebglError();
  throw err;
}
renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  showWebglError();
});

const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 700;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, smallScreen ? 1.75 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app')?.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 200);
camera.position.set(10.4, 6.2, 12.6);

// Any failure while building the world must surface as a readable message,
// never a silent blank page.
let island!: ReturnType<typeof makeIsland>;
let house!: ReturnType<typeof makeHouse>;
let windmill!: ReturnType<typeof makeWindmill>;
let vegetation!: ReturnType<typeof makeVegetation>;
let pond!: ReturnType<typeof makePond>;
let props!: ReturnType<typeof makeProps>;
let sky!: ReturnType<typeof makeSky>;
let clouds!: ReturnType<typeof makeClouds>;
let rain!: ReturnType<typeof makeRain>;
let lighting!: ReturnType<typeof makeLighting>;
let controls!: ReturnType<typeof makeControls>;

const state = new AppState();

try {
  island = makeIsland();
  scene.add(island.group);
  house = makeHouse(island);
  scene.add(house.group);
  windmill = makeWindmill(island);
  scene.add(windmill.group);
  vegetation = makeVegetation(island);
  scene.add(vegetation.group);
  pond = makePond(island);
  scene.add(pond.group);
  props = makeProps(island);
  scene.add(props.group);
  sky = makeSky();
  scene.add(sky.group);
  clouds = makeClouds();
  scene.add(clouds.group);
  rain = makeRain(smallScreen ? 200 : 340);
  scene.add(rain.lines);
  rain.onPondDrop = (x, z) => pond.spawnRipple(x, z);

  // --- systems -----------------------------------------------------------------
  lighting = makeLighting(scene, smallScreen ? 1024 : 2048);
  controls = makeControls(camera, renderer.domElement, new THREE.Vector3(0, -0.7, 0));
  makeUI(state, () => controls.resetView());
  makeClickPicker(renderer.domElement, camera, house.group, new THREE.Raycaster(), () => state.toggleLights());
} catch (err) {
  const detail = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err);
  console.error(detail);
  showWebglError(detail.slice(0, 600));
  throw err;
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- render loop ----------------------------------------------------------------
const clock = new THREE.Clock();
let elapsed = 0;
const frame: Frame = {
  dt: 0,
  time: 0,
  hour: state.hour,
  wind: state.wind,
  windDir: state.windDir,
  rain: state.rainAmount,
  glow: state.lightGlow,
  dayFactor: 0,
  reducedMotion: state.reducedMotion,
};

let running = true;
const animate = (): void => {
  if (!running) return;
  requestAnimationFrame(animate);
  try {
    const dt = Math.min(clock.getDelta(), 0.1); // clamp background-tab jumps
    elapsed += dt;

    state.update(dt);
    const palette = samplePalette(state.hour);

    frame.dt = dt;
    frame.time = elapsed;
    frame.hour = state.hour;
    frame.wind = state.wind;
    frame.rain = state.rainAmount;
    frame.glow = state.lightGlow;
    frame.dayFactor = palette.dayFactor;
    frame.reducedMotion = state.reducedMotion;

    lighting.update(palette, frame);
    sky.update(state.hour, palette, state.rainAmount, dt);
    clouds.update(frame);
    house.update(frame);
    windmill.update(frame);
    vegetation.update(frame);
    pond.update(frame);
    props.update(frame);
    rain.update(frame, island.topY);
    controls.update(dt);

    renderer.render(scene, camera);
  } catch (err) {
    running = false;
    showWebglError(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    throw err;
  }
};
animate();
