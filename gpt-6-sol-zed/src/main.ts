import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEnvironment } from './environment';
import { DEFAULT_STATE, type AppState } from './state';
import { createUI } from './ui';
import { createWorld } from './world';
import './style.css';

const app = document.querySelector<HTMLElement>('#app');
const viewport = document.querySelector<HTMLElement>('#viewport');
const uiHost = document.querySelector<HTMLElement>('#ui');
const fallback = document.querySelector<HTMLElement>('#fallback');

if (!app || !viewport || !uiHost || !fallback) throw new Error('Pocket World page elements are missing');

const appElement = app;
const viewportElement = viewport;
const fallbackElement = fallback;
let state: AppState = { ...DEFAULT_STATE };
let resetCamera = (): void => {};
let resetEffects = (): void => {};

function setState(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  ui.sync(state);
}

function reset(): void {
  state = { ...DEFAULT_STATE };
  ui.sync(state);
  resetEffects();
  resetCamera();
}

const ui = createUI(uiHost, state, setState, reset);

function showError(message: string): void {
  fallbackElement.textContent = message;
  fallbackElement.hidden = false;
}

try {
  const compact = window.matchMedia('(max-width: 700px)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !compact, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.setAttribute('aria-label', 'Pocket World. Drag to orbit, scroll or pinch to zoom; use the panel to toggle house lights.');
  viewportElement.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const world = createWorld();
  scene.add(world.root);
  const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 110);
  const target = new THREE.Vector3(0, 0.36, 0);
  const startingDirection = new THREE.Vector3(8.2, 6.2, 10.3).normalize();
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 7.5;
  controls.maxDistance = 34;
  controls.minPolarAngle = 0.38;
  controls.maxPolarAngle = Math.PI / 2 - 0.10;
  controls.target.copy(target);

  const environment = createEnvironment(scene, appElement, renderer, world, state, reducedMotion, compact);
  resetEffects = () => environment.reset(state);
  let fittedDistance = 14.7;
  let shiftedPixels = 0;
  const disclosure = uiHost.querySelector<HTMLDetailsElement>('.instrument');

  function applyViewOffset(width: number, height: number): void {
    const shiftUp = width <= 700 && disclosure?.open ? Math.min(115, height * 0.14) : 0;
    camera.setViewOffset(width, height, -shiftedPixels, shiftUp, width, height);
    camera.updateProjectionMatrix();
  }

  function resize(): void {
    const width = Math.max(1, viewportElement.clientWidth);
    const height = Math.max(1, viewportElement.clientHeight);
    const previousDistance = fittedDistance;
    shiftedPixels = width > 1120 ? Math.min(125, width * 0.083) : width > 700 ? 27 : 0;
    camera.aspect = width / height;
    const halfAngle = THREE.MathUtils.degToRad(camera.fov / 2);
    const usableAspect = Math.max(0.25, camera.aspect - 2 * shiftedPixels / height);
    fittedDistance = Math.max(14.7, 3.75 / (Math.tan(halfAngle) * usableAspect));
    const direction = camera.position.clone().sub(controls.target);
    const currentDistance = direction.length();
    if (currentDistance > 0.001) {
      camera.position.copy(controls.target).add(direction.multiplyScalar(
        THREE.MathUtils.clamp(fittedDistance / previousDistance, 0.5, 2.5),
      ));
    } else {
      camera.position.copy(controls.target).addScaledVector(startingDirection, fittedDistance);
    }
    applyViewOffset(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width <= 700 ? 1.5 : 1.85));
    renderer.setSize(width, height, false);
    controls.update();
  }

  resetCamera = () => {
    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(startingDirection, fittedDistance);
    controls.update();
  };
  resetCamera();
  resize();
  window.addEventListener('resize', resize);
  disclosure?.addEventListener('toggle', () => {
    applyViewOffset(Math.max(1, viewportElement.clientWidth), Math.max(1, viewportElement.clientHeight));
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let press: { id: number; x: number; y: number; moved: boolean } | null = null;
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) {
      press = null;
      return;
    }
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  });
  canvas.addEventListener('pointermove', (event) => {
    if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) press.moved = true;
  });
  canvas.addEventListener('pointercancel', () => { press = null; });
  canvas.addEventListener('pointerup', (event) => {
    const start = press;
    press = null;
    if (!start || start.id !== event.pointerId || start.moved || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
    const bounds = canvas.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const first = raycaster.intersectObjects(world.root.children, true)[0]?.object;
    for (let object: THREE.Object3D | null | undefined = first; object; object = object.parent) {
      if (object === world.house) {
        setState({ lights: !state.lights });
        break;
      }
    }
  });

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    showError('The graphics context was interrupted. Please wait for it to return or reload this page.');
  });
  canvas.addEventListener('webglcontextrestored', () => { fallbackElement.hidden = true; });

  let previousFrame = performance.now();
  let running = true;
  function animate(now: number): void {
    if (!running) return;
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, Math.max(0, (now - previousFrame) / 1000));
    previousFrame = now;
    try {
      environment.update(state, dt);
      controls.update();
      renderer.render(scene, camera);
    } catch (error) {
      running = false;
      console.error('Pocket World render failed:', error);
      showError('Pocket World could not render on this device. Try enabling WebGL and reloading the page.');
    }
  }
  requestAnimationFrame(animate);
} catch (error) {
  console.error('Pocket World could not start:', error);
  showError('Pocket World needs WebGL to display the island. Please enable hardware acceleration or try another browser.');
}
