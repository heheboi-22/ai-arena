import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildIsland, groundY } from './scene/island';
import { House } from './scene/house';
import { Windmill } from './scene/windmill';
import { placeTrees, Swaying } from './scene/vegetation';
import { buildPond, buildPath, buildFence, buildFlowers, buildRocks } from './scene/props';
import { Clouds, Rain, Ripples } from './scene/effects';
import { Environment } from './scene/environment';
import { AppState, DEFAULTS, stateFromQuery } from './state/AppState';
import { buildUI, syncUI } from './ui/Controls';
import './styles/main.css';

const container = document.getElementById('scene-container')!;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const motionScale = reduceMotion ? 0.3 : 1;

let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch {
  container.innerHTML = '<div class="webgl-error">This experience needs WebGL, which your browser or device could not provide.</div>';
  throw new Error('WebGL unavailable');
}

const isSmall = window.innerWidth < 768;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 200);
const BASE_POS = new THREE.Vector3(10.5, 6.8, 13.2);
const HOME_POS = new THREE.Vector3().copy(BASE_POS);
const HOME_TGT = new THREE.Vector3(0, 0.6, 0);
camera.position.copy(HOME_POS);

function fitForViewport() {
  const a = window.innerWidth / window.innerHeight;
  camera.fov = a < 0.8 ? 55 : 42;
  camera.aspect = a;
  camera.updateProjectionMatrix();
  HOME_POS.copy(BASE_POS).multiplyScalar(a < 0.8 ? 1.5 : 1);
}
fitForViewport();
camera.position.copy(HOME_POS);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME_TGT);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 7.5;
controls.maxDistance = 32;
controls.minPolarAngle = 0.32;
controls.maxPolarAngle = 1.62;
controls.update();

// ---- world ----
const world = new THREE.Group();
scene.add(world);
world.add(buildIsland());

const house = new House();
house.group.position.set(-1.9, groundY(-1.9, -0.9) - 0.03, -0.9);
house.group.rotation.y = 0.32;
world.add(house.group);

const windmill = new Windmill();
windmill.group.position.set(3.2, groundY(3.2, -2.5) - 0.04, -2.5);
windmill.group.rotation.y = -0.5;
world.add(windmill.group);

const swayers: Swaying[] = placeTrees(world);
const pond = buildPond();
world.add(pond.mesh, pond.rim);
world.add(buildPath(), buildFence(), buildFlowers(), buildRocks());

const clouds = new Clouds(4);
scene.add(clouds.group);
const rain = new Rain();
scene.add(rain.object);
const ripples = new Ripples();
scene.add(ripples.object);
const env = new Environment(scene);

// ---- state ----
const state: AppState = stateFromQuery();
// Optional camera override for verification: ?cam=x,y,z,tx,ty,tz
try {
  const cam = new URLSearchParams(window.location.search).get('cam');
  if (cam) {
    const p = cam.split(',').map(Number);
    if (p.length === 6 && p.every((n) => !Number.isNaN(n))) {
      camera.position.set(p[0], p[1], p[2]);
      controls.target.set(p[3], p[4], p[5]);
      controls.update();
    }
  }
} catch {
  /* ignore */
}
let rainAmount = state.weather === 'rain' ? 1 : 0;
let windSmooth = state.wind;
// When set from query for previews, start with the smooth values matching state

// ---- click vs drag for house toggle ----
let downX = 0;
let downY = 0;
let downT = 0;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

renderer.domElement.addEventListener('pointerdown', (e) => {
  downX = e.clientX;
  downY = e.clientY;
  downT = performance.now();
});
renderer.domElement.addEventListener('pointerup', (e) => {
  const dx = e.clientX - downX;
  const dy = e.clientY - downY;
  if (Math.hypot(dx, dy) > 6 || performance.now() - downT > 500) return;
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObject(house.group, true);
  if (hits.length > 0) {
    setLights(!state.lights);
  }
});

// ---- UI ----
const ui = buildUI(state, setLights, setWeather, reset);
syncUI(ui, state);

function setLights(v: boolean) {
  state.lights = v;
  syncUI(ui, state);
}
function setWeather(w: AppState['weather']) {
  state.weather = w;
  syncUI(ui, state);
}

let camTween: { p0: THREE.Vector3; t0: THREE.Vector3; p: THREE.Vector3; t: THREE.Vector3; from: number } | null = null;
function reset() {
  Object.assign(state, { ...DEFAULTS });
  rainAmount = state.weather === 'rain' ? 1 : 0;
  windSmooth = state.wind;
  syncUI(ui, state);
  camTween = { p0: camera.position.clone(), t0: controls.target.clone(), p: HOME_POS.clone(), t: HOME_TGT.clone(), from: performance.now() };
}

// ---- loop ----
const clock = new THREE.Clock();
let elapsed = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  // smooth derived values — interruptible transitions
  rainAmount = THREE.MathUtils.damp(rainAmount, state.weather === 'rain' ? 1 : 0, 2.2, dt);
  windSmooth = THREE.MathUtils.damp(windSmooth, state.wind, 4, dt);

  // gentle island float
  world.position.y = Math.sin(elapsed * 0.45) * 0.09 * motionScale;
  world.rotation.z = Math.sin(elapsed * 0.3) * 0.006 * motionScale;

  windmill.update(windSmooth, dt);
  for (const s of swayers) s.update(elapsed, windSmooth * motionScale);
  clouds.update(elapsed, windSmooth, rainAmount, env.nightness, dt, motionScale);
  rain.update(dt, windSmooth, rainAmount);
  ripples.update(dt, rainAmount, motionScale);
  env.update(state.time, rainAmount);
  house.update(state.lights, env.nightness, dt, elapsed);

  if (camTween) {
    const k = Math.min((performance.now() - camTween.from) / 900, 1);
    const e = 1 - Math.pow(1 - k, 3);
    camera.position.lerpVectors(camTween.p0, camTween.p, e);
    controls.target.lerpVectors(camTween.t0, camTween.t, e);
    if (k >= 1) camTween = null;
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  fitForViewport();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
