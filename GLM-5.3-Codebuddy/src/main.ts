import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './styles.css';
import { WorldState } from './state';
import { createSkyState, sampleSky } from './palette';
import { buildIsland, terrainHeight } from './world/island';
import { buildHouse } from './world/house';
import { buildWindmill } from './world/windmill';
import { buildPond } from './world/pond';
import { buildNature } from './world/nature';
import { buildSky, updateSky, celestialDir } from './world/sky';
import { Rain } from './world/rain';
import type { SwayTarget } from './world/nature';

/* ------------------------------------------------------------- constants */

const INITIAL_CAM_POS = new THREE.Vector3(11.2, 4.6, 12.4);
const INITIAL_TARGET = new THREE.Vector3(0, -0.1, 0);
const ISLAND_TOP = 5.8;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) < 700;

/* ------------------------------------------------------------------- dom */

const app = document.getElementById('app')!;
const panel = document.getElementById('panel')!;
const collapseBtn = document.getElementById('collapseBtn')!;
const timeRange = document.getElementById('timeRange') as HTMLInputElement;
const timeOut = document.getElementById('timeOut')!;
const windRange = document.getElementById('windRange') as HTMLInputElement;
const windOut = document.getElementById('windOut')!;
const btnClear = document.getElementById('btnClear') as HTMLButtonElement;
const btnRain = document.getElementById('btnRain') as HTMLButtonElement;
const lightsToggle = document.getElementById('lightsToggle') as HTMLButtonElement;
const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
const fallback = document.getElementById('fallback')!;

/* ----------------------------------------------------------------- state */

const state = new WorldState();
const skyState = createSkyState();

/* ------------------------------------------------------------------ core */

let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let controls: OrbitControls;

try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch {
  fallback.hidden = false;
  app.remove();
  throw new Error('WebGL unavailable');
}

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmallScreen ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xdfeec4, 34, 60);

camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 140);
camera.position.copy(INITIAL_CAM_POS);

controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(INITIAL_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 8.5;
controls.maxDistance = 24;
controls.minPolarAngle = 0.22;
controls.maxPolarAngle = Math.PI * 0.63; // allow peeking at the underside
controls.update();

/* --------------------------------------------------------------- world  */

const world = new THREE.Group();
scene.add(world);

world.add(buildIsland());

const house = buildHouse();
house.group.position.set(-1.35, terrainHeight(-1.35, -0.55) - 0.02, -0.55);
house.group.rotation.y = 0.62;
world.add(house.group);

const windmill = buildWindmill();
world.add(windmill.group);

const pond = buildPond();
world.add(pond.group);

const nature = buildNature(house.group);
world.add(nature.group);

const sky = buildSky();
scene.add(sky.group);

const rain = new Rain();
scene.add(rain.group);

const swayers: SwayTarget[] = [...nature.swayers, ...pond.swayers];

/* --------------------------------------------------------------- lights */

const hemi = new THREE.HemisphereLight(0xb8d0e8, 0x54463a, 0.68);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffe6b0, 1.3);
sun.castShadow = true;
sun.shadow.mapSize.set(isSmallScreen ? 1024 : 2048, isSmallScreen ? 1024 : 2048);
sun.shadow.camera.left = -ISLAND_TOP;
sun.shadow.camera.right = ISLAND_TOP;
sun.shadow.camera.top = ISLAND_TOP;
sun.shadow.camera.bottom = -ISLAND_TOP;
sun.shadow.camera.near = 4;
sun.shadow.camera.far = 60;
sun.shadow.bias = -0.0016;
sun.shadow.normalBias = 0.03;
scene.add(sun);
scene.add(sun.target);

const ambient = new THREE.AmbientLight(0x8ea2c8, 0.12);
scene.add(ambient);

const sunDir = new THREE.Vector3(0.5, 0.8, 0.3).normalize();

/* ------------------------------------------------------------ ui wiring */

function fmtTime(hour: number): string {
  const h = Math.floor(((hour % 24) + 24) % 24);
  const m = Math.floor((hour - Math.floor(hour)) * 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(Math.round(m / 15) * 15 % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function periodName(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h < 5) return 'Night';
  if (h < 6.8) return 'Dawn';
  if (h < 11) return 'Morning';
  if (h < 14) return 'Midday';
  if (h < 17.3) return 'Afternoon';
  if (h < 19.4) return 'Sunset';
  if (h < 21.8) return 'Evening';
  return 'Night';
}

function syncUI(): void {
  timeRange.value = String(state.time);
  windRange.value = String(Math.round(state.wind * 100));
  timeOut.textContent = `${fmtTime(state.time)} · ${periodName(state.time)}`;
  windOut.textContent = `${Math.round(state.wind * 100)}%`;
  btnClear.classList.toggle('is-active', state.weather === 'clear');
  btnRain.classList.toggle('is-active', state.weather === 'rain');
  btnClear.setAttribute('aria-pressed', String(state.weather === 'clear'));
  btnRain.setAttribute('aria-pressed', String(state.weather === 'rain'));
  lightsToggle.setAttribute('aria-checked', String(state.lightsOn));
}

timeRange.addEventListener('input', () => {
  state.time = parseFloat(timeRange.value);
  state.timeS.target = state.time;
  timeOut.textContent = `${fmtTime(state.time)} · ${periodName(state.time)}`;
});

windRange.addEventListener('input', () => {
  state.wind = parseInt(windRange.value, 10) / 100;
  state.windS.target = state.wind;
  windOut.textContent = `${Math.round(state.wind * 100)}%`;
});

btnClear.addEventListener('click', () => {
  state.weather = 'clear';
  state.wet.target = 0;
  syncUI();
});

btnRain.addEventListener('click', () => {
  state.weather = 'rain';
  state.wet.target = 1;
  syncUI();
});

function setLights(on: boolean): void {
  state.lightsOn = on;
  state.glow.target = on ? 1 : 0;
  syncUI();
}

lightsToggle.addEventListener('click', () => setLights(!state.lightsOn));

resetBtn.addEventListener('click', () => {
  state.reset();
  camera.position.copy(INITIAL_CAM_POS);
  controls.target.copy(INITIAL_TARGET);
  controls.update();
  syncUI();
});

collapseBtn.addEventListener('click', () => {
  const collapsed = panel.classList.toggle('collapsed');
  collapseBtn.setAttribute('aria-expanded', String(!collapsed));
});

/* --------------------------------------------------- click/tap the house */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downX = 0;
let downY = 0;
let downTime = 0;
let downOnCanvas = false;

renderer.domElement.addEventListener('pointerdown', (e) => {
  downX = e.clientX;
  downY = e.clientY;
  downTime = performance.now();
  downOnCanvas = true;
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downOnCanvas) return;
  downOnCanvas = false;
  const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
  const elapsed = performance.now() - downTime;
  if (moved > 7 || elapsed > 550) return; // it was an orbit gesture

  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(house.hitMeshes, false);
  if (hits.length > 0) setLights(!state.lightsOn);
});

// pointer affordance: cursor changes over the clickable house
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const over = raycaster.intersectObjects(house.hitMeshes, false).length > 0;
  renderer.domElement.style.cursor = over ? 'pointer' : 'grab';
});

/* ----------------------------------------------------------------- resize */

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmallScreen ? 1.5 : 2));
});

/* ------------------------------------------------------------- main loop */

const clock = new THREE.Clock();
let elapsed = 0;

function animate(): void {
  requestAnimationFrame(animate);

  // clamp big deltas so returning from a background tab doesn't jump
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  state.update(dt);

  const hour = state.timeS.value;
  const night = state.nightFactor();
  const wet = state.wet.value;
  const wind = state.windS.value;

  sampleSky(hour, skyState);

  // --- lights -----------------------------------------------------------
  celestialDir(hour, sunDir);
  sun.position.copy(sunDir).multiplyScalar(24);
  sun.target.position.set(0, 0, 0);
  sun.color.copy(skyState.dirColor);
  sun.intensity = skyState.dirI * (1 - wet * 0.55) * (1 - night * 0.15);
  hemi.color.copy(skyState.hemiSky);
  hemi.groundColor.copy(skyState.hemiGround);
  hemi.intensity = skyState.hemiI * (1 - wet * 0.3);
  ambient.intensity = 0.1 + night * 0.14;
  (scene.fog as THREE.Fog).color.copy(skyState.fog);

  // --- sky, clouds, stars, celestial disc ---------------------------------
  updateSky(sky, state, skyState, night, elapsed, dt, reducedMotion);

  // --- water ---------------------------------------------------------------
  const u = pond.waterMat.uniforms;
  (u.uSunDir.value as THREE.Vector3).copy(sunDir);
  (u.uSunColor.value as THREE.Color).copy(skyState.dirColor).multiplyScalar(skyState.dirI);
  (u.uSkyColor.value as THREE.Color).copy(skyState.skyHorizon);
  (u.uDeep.value as THREE.Color).copy(skyState.waterDeep);
  (u.uShallow.value as THREE.Color).copy(skyState.waterShallow);
  u.uTime.value = elapsed;
  u.uRain.value = wet;
  pond.ripples.update(dt, wet > 0.35, wet, night, reducedMotion);

  // --- wind-driven motion ---------------------------------------------------
  const gust = 0.85 + Math.sin(elapsed * 1.7) * 0.15;
  windmill.rotor.rotation.z += dt * (0.12 + wind * wind * 3.4) * gust;

  const swayAmp = 0.028 + wind * 0.085;
  for (const s of swayers) {
    const t = elapsed * s.speed + s.phase;
    s.obj.rotation.z = Math.sin(t) * swayAmp;
    s.obj.rotation.x = Math.sin(t * 0.83 + 1.2) * swayAmp * 0.6;
  }

  for (const comp of nature.companions) {
    comp.group.position.y =
      comp.baseY + (reducedMotion ? 0 : Math.sin(elapsed * 0.5 + comp.phase) * 0.28);
  }

  // --- house lights ---------------------------------------------------------
  const glow = state.glow.value;
  house.glassMat.emissiveIntensity = glow * (0.75 + night * 2.1);
  house.light.intensity = glow * (0.55 + night * 1.35) * (1 - wet * 0.2);

  // --- rain -----------------------------------------------------------------
  rain.update(dt, wet, wind);

  controls.update();
  renderer.render(scene, camera);
}

syncUI();
animate();
