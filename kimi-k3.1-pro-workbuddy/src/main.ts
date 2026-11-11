import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createWorld } from './world';
import { createEnvironment } from './environment';
import { createUI } from './ui';
import { DEFAULT_STATE, damp, dampTime } from './state';
import type { WorldState } from './state';

const targetState: WorldState = { ...DEFAULT_STATE };
let renderedTime = DEFAULT_STATE.time;
let renderedRain = 0;
let renderedWind = DEFAULT_STATE.wind;
let renderedLights = 0;
let resetCamera = false;
const HOME_TARGET = new THREE.Vector3(0, -0.45, 0);

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = reducedMotionQuery.matches;
reducedMotionQuery.addEventListener('change', (event) => { reducedMotion = event.matches; });

const ui = createUI(targetState, (patch) => {
  Object.assign(targetState, patch);
  ui.sync(targetState);
}, () => {
  Object.assign(targetState, DEFAULT_STATE);
  ui.sync(targetState);
  resetCamera = true;
  ui.toast('Back to a clear afternoon');
});

function showError(message?: string): void {
  const error = document.getElementById('error')!;
  if (message) error.querySelector('p')!.textContent = message;
  error.hidden = false;
  document.getElementById('loading')!.classList.add('done');
}

function start(): void {
  const container = document.getElementById('world')!;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(window.innerWidth / window.innerHeight < 0.75 ? 44 : 38, window.innerWidth / window.innerHeight, 0.1, 120);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 700 ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.domElement.setAttribute('aria-label', 'Pocket World 3D scene. Drag to orbit, scroll to zoom, or click the house to toggle its lights.');
  container.appendChild(renderer.domElement);

  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    showError('The graphics context was interrupted. Reload the page to return to your little world.');
  });

  const world = createWorld(scene);
  const environment = createEnvironment(scene, renderer);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = false;
  controls.rotateSpeed = 0.62;
  controls.zoomSpeed = 0.72;
  controls.minDistance = 10;
  controls.maxDistance = 48;
  controls.minPolarAngle = 0.32;
  controls.maxPolarAngle = Math.PI * 0.475;
  controls.target.copy(HOME_TARGET);

  const homeDirection = new THREE.Vector3(11, 8.5, 13).normalize();
  const getHomeDistance = (aspect: number): number => aspect < 0.75 ? 37.5 : aspect < 1.1 ? 28 : 20.5;
  const getHomePosition = (): THREE.Vector3 => {
    const distance = getHomeDistance(window.innerWidth / window.innerHeight);
    return homeDirection.clone().multiplyScalar(distance).add(controls.target);
  };
  camera.position.copy(getHomePosition());
  camera.lookAt(controls.target);
  controls.update();

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerStart: { x: number; y: number; time: number; id: number } | null = null;

  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    pointerStart = { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId };
    resetCamera = false;
  });
  renderer.domElement.addEventListener('pointercancel', () => { pointerStart = null; });
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
    const duration = performance.now() - pointerStart.time;
    pointerStart = null;
    if (distance > 6 || duration > 500) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.intersectObjects(world.houseTargets, false).length > 0) {
      targetState.lights = !targetState.lights;
      ui.sync(targetState);
      ui.toast(targetState.lights ? 'A warm light comes on' : 'The house settles into quiet');
    }
  });

  let previousAspect = camera.aspect;
  window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const nextAspect = width / height;
    const framingScale = getHomeDistance(nextAspect) / getHomeDistance(previousAspect);
    camera.position.sub(controls.target).multiplyScalar(framingScale).add(controls.target);
    previousAspect = nextAspect;
    camera.aspect = nextAspect;
    camera.fov = camera.aspect < 0.75 ? 44 : 38;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, width < 700 ? 1.5 : 2));
  });

  const clock = new THREE.Clock();
  let elapsed = 0;
  let firstFrame = true;
  const animate = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    renderedTime = dampTime(renderedTime, targetState.time, reducedMotion ? 8 : 2.7, dt);
    renderedRain = damp(renderedRain, targetState.weather === 'rain' ? 1 : 0, reducedMotion ? 9 : 2.1, dt);
    renderedWind = damp(renderedWind, targetState.wind, 4.5, dt);
    renderedLights = damp(renderedLights, targetState.lights ? 1 : 0, 6, dt);

    const night = environment.update(dt, renderedTime, renderedRain, renderedWind, world);
    world.update(dt, elapsed, renderedWind, renderedLights, night, reducedMotion);

    if (resetCamera) {
      const home = getHomePosition();
      camera.position.lerp(home, 1 - Math.exp(-5 * dt));
      controls.target.lerp(HOME_TARGET, 1 - Math.exp(-5 * dt));
      if (camera.position.distanceTo(home) < 0.015) resetCamera = false;
    }
    controls.update();
    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      requestAnimationFrame(() => document.getElementById('loading')!.classList.add('done'));
    }
  };
  renderer.setAnimationLoop(animate);
}

try {
  start();
} catch (error) {
  console.error('Pocket World could not start:', error);
  showError();
}
