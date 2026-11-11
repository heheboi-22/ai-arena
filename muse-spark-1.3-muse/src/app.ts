import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { store } from './state';
import { clamp, damp, easeInOutCubic } from './util';
import { buildWorld, terrainHeight } from './world';
import { Environment } from './env';
import { bindUI } from './ui';

const INITIAL_TARGET = new THREE.Vector3(0, 0.2, 0);
const INITIAL_POS = new THREE.Vector3(16.5, 7.4, 19.5);

interface Flight {
  t: number;
  dur: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
}

export function start(canvas: HTMLCanvasElement): void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 700 || 'ontouchstart' in window;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1.8 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.copy(INITIAL_POS);

  // Portrait screens get a wider lens so the whole island stays in frame.
  const fitFov = () => {
    const a = window.innerWidth / window.innerHeight;
    camera.fov = a < 0.75 ? 56 : a < 1.1 ? 47 : 40;
    camera.updateProjectionMatrix();
  };
  fitFov();

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(INITIAL_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 10.5;
  controls.maxDistance = 38;
  controls.minPolarAngle = 0.16;
  controls.maxPolarAngle = 1.48;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.85;
  controls.update();

  const world = buildWorld();
  scene.add(world.group);
  const env = new Environment(scene);

  // --- camera reset flight -------------------------------------------------
  let flight: Flight | null = null;
  const flyHome = () => {
    flight = {
      t: 0,
      dur: 0.95,
      fromPos: camera.position.clone(),
      toPos: INITIAL_POS.clone(),
      fromTarget: controls.target.clone(),
      toTarget: INITIAL_TARGET.clone(),
    };
  };
  canvas.addEventListener('pointerdown', () => {
    flight = null;
  });

  bindUI({ onResetView: flyHome });

  // --- house picking: a click toggles, a drag orbits -----------------------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downX = 0;
  let downY = 0;
  let downT = 0;
  canvas.addEventListener('pointerdown', (e) => {
    downX = e.clientX;
    downY = e.clientY;
    downT = performance.now();
  });
  canvas.addEventListener('pointerup', (e) => {
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (moved > 7 || performance.now() - downT > 600) return;
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.intersectObject(world.house, true).length > 0) {
      store.set({ lights: !store.state.lights });
    }
  });

  // --- keyboard orbit (canvas is focusable) --------------------------------
  canvas.addEventListener('keydown', (e) => {
    const offset = camera.position.clone().sub(controls.target);
    const sph = new THREE.Spherical().setFromVector3(offset);
    let used = true;
    switch (e.key) {
      case 'ArrowLeft':
        sph.theta -= 0.18;
        break;
      case 'ArrowRight':
        sph.theta += 0.18;
        break;
      case 'ArrowUp':
        sph.phi = clamp(sph.phi - 0.12, controls.minPolarAngle, controls.maxPolarAngle);
        break;
      case 'ArrowDown':
        sph.phi = clamp(sph.phi + 0.12, controls.minPolarAngle, controls.maxPolarAngle);
        break;
      case '+':
      case '=':
        sph.radius = clamp(sph.radius * 0.88, controls.minDistance, controls.maxDistance);
        break;
      case '-':
      case '_':
        sph.radius = clamp(sph.radius * 1.14, controls.minDistance, controls.maxDistance);
        break;
      default:
        used = false;
    }
    if (used) {
      e.preventDefault();
      flight = null;
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));
    }
  });

  // --- resize ---------------------------------------------------------------
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    fitFov();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1.8 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- main loop --------------------------------------------------------------
  const clock = new THREE.Clock();
  let elapsed = 0;
  let rainAmount = 0;
  let lightsAmount = 0;

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    const s = store.state;

    rainAmount = damp(rainAmount, s.weather === 'rain' ? 1 : 0, 2.0, dt);
    if (Math.abs(rainAmount - (s.weather === 'rain' ? 1 : 0)) < 0.001) {
      rainAmount = s.weather === 'rain' ? 1 : 0;
    }
    lightsAmount = damp(lightsAmount, s.lights ? 1 : 0, 7, dt);

    if (flight) {
      flight.t += dt;
      const k = easeInOutCubic(clamp(flight.t / flight.dur, 0, 1));
      camera.position.lerpVectors(flight.fromPos, flight.toPos, k);
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, k);
      if (flight.t >= flight.dur) flight = null;
    }

    const frame = env.update(dt, elapsed, s.hour, rainAmount, s.wind, terrainHeight);
    renderer.toneMappingExposure = 1.05 - frame.night * 0.1 + frame.dusk * 0.03;

    world.update(dt, elapsed, {
      wind: s.wind,
      rainAmount,
      lightsAmount,
      night: frame.night,
      calm,
      waterColor: frame.waterColor,
      cloudColor: frame.cloudColor,
    });

    controls.update();
    renderer.render(scene, camera);
  });
}
