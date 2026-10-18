import './style.css';
import * as THREE from 'three';
import { WIND } from './config';
import { createCameraRig } from './core/controls';
import { createHousePicking } from './core/picking';
import { RainSystem } from './fx/rain';
import { createSky } from './fx/sky';
import { createClouds } from './scene/clouds';
import { createHouse } from './scene/house';
import { createIsland } from './scene/island';
import { createLake } from './scene/lake';
import { createNature } from './scene/nature';
import { createWindmill } from './scene/windmill';
import { StateStore } from './state';
import { createUI } from './ui';

function webglAvailable(): boolean {
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'));
  } catch {
    return false;
  }
}

function boot(): void {
  const canvas = document.getElementById('scene') as HTMLCanvasElement | null;
  const fallback = document.getElementById('fallback') as HTMLDivElement | null;
  if (!canvas) return;

  let renderer: THREE.WebGLRenderer;
  try {
    if (!webglAvailable()) throw new Error('WebGL unavailable');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch {
    if (fallback) fallback.hidden = false;
    canvas.remove();
    return;
  }

  const small = Math.min(window.innerWidth, window.innerHeight) < 720;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.75 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcadee8, 32, 100);

  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.1,
    340,
  );
  const rig = createCameraRig(camera, canvas);

  const store = new StateStore();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionScale = reducedMotion ? 0.25 : 1;

  // --- world ---
  const island = createIsland();
  const house = createHouse();
  const nature = createNature();
  const windmill = createWindmill();
  const lake = createLake();
  const clouds = createClouds();
  scene.add(island, house.group, nature.group, windmill.group, lake.group, clouds.group);

  const sky = createSky(
    scene,
    renderer,
    { waterMaterial: lake.waterMaterial, cloudMaterial: clouds.material },
    !small,
  );

  const rain = new RainSystem(small ? 'low' : 'high');
  scene.add(rain.object);
  rain.onSplash = (x, z) => lake.splash(x, z, 0.9);

  // --- interaction & UI ---
  createHousePicking(canvas, camera, house.hitArea, () => store.toggleLights());
  createUI(store, { onResetCamera: () => rig.reset() });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- main loop (time-based, delta-clamped) ---
  const clock = new THREE.Clock();
  let bladeSpeed = 0;
  let glow = 0;
  let t = 0;

  const frame = (): void => {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    const s = store.state;

    rain.update(dt, s.wind, s.weather === 'rain' ? 1 : 0);
    const { nightFactor } = sky.update(s.hour, rain.amount, motionScale);

    clouds.update(dt, t, s.wind, motionScale);
    nature.sway(t, s.wind, motionScale);
    lake.update(dt, rain.amount);

    // windmill: eased spin so wind changes never snap
    const bladeTarget =
      Math.pow(s.wind, 1.15) * WIND.bladeMaxSpeed * (reducedMotion ? 0.7 : 1);
    bladeSpeed += (bladeTarget - bladeSpeed) * Math.min(1, dt * WIND.bladeSpinEase);
    windmill.blades.rotation.z -= bladeSpeed * dt;

    // house lights: emissive windows + warm halo, strongest at night
    const glowTarget = s.lightsOn ? 0.35 + 2.1 * nightFactor : 0.04;
    glow += (glowTarget - glow) * Math.min(1, dt * 6);
    house.windowMaterial.emissiveIntensity = glow;
    house.glowLight.intensity = s.lightsOn ? nightFactor * 1.4 : 0;
    house.glowSprite.material.opacity = s.lightsOn ? nightFactor * 0.5 : 0;

    rig.update();
    renderer.render(scene, camera);
  };
  frame();
}

boot();
