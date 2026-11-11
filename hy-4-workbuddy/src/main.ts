import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

import { DEFAULT_STATE, WorldState, formatTime, type AppState, type Weather } from './state';
import { sampleAtmosphere, type Atmosphere } from './world/palette';
import { wetness } from './world/materials';
import { createIsland } from './world/island';
import { createHouse } from './world/house';
import { createWindmill } from './world/windmill';
import { createPond } from './world/pond';
import { createVegetation } from './world/vegetation';
import { createProps, HOUSE_AT, WINDMILL_AT } from './world/props';
import { createClouds } from './world/clouds';
import { createSky } from './environment/sky';
import { createLighting } from './environment/lighting';
import { createRain } from './environment/rain';
import { attachHousePicker } from './interaction/picker';
import { createPanel } from './ui/panel';
import { clamp } from './util/math';

const app = document.getElementById('app')!;
const loading = document.getElementById('loading')!;
const fallback = document.getElementById('fallback')!;
const fallbackReason = document.getElementById('fallback-reason')!;

function fail(message: string): void {
  loading.classList.add('is-gone');
  fallback.hidden = false;
  fallbackReason.textContent = message;
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

if (!hasWebGL()) {
  fail('This browser could not create a WebGL context. Try a current version of Chrome, Firefox, Safari or Edge with hardware acceleration enabled.');
} else {
  try {
    boot();
  } catch (err) {
    fail(`The scene could not start: ${err instanceof Error ? err.message : String(err)}`);
    console.error(err);
  }
}

function boot(): void {
  const mobile = window.matchMedia('(max-width: 720px), (pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.35 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // The sun shadow only changes when the sun or the weather changes. Rendering
  // it every frame costs a second full pass over the whole island for nothing.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D island. Drag to orbit, scroll to zoom.');
  renderer.domElement.style.cursor = 'grab';
  app.appendChild(renderer.domElement);

  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    fail('The graphics context was lost. Reload the page to bring the island back.');
  });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 320);
  const baseTarget = new THREE.Vector3(-0.60, 0.85, 0);
  const baseOffset = new THREE.Vector3(9.80, 6.20, 13.20);
  const baseDirection = baseOffset.clone().normalize();
  const baseDistance = baseOffset.length();
  const homePosition = (): THREE.Vector3 =>
    baseTarget.clone().addScaledVector(baseDirection, baseDistance * frameScale);
  let frameScale = 1;
  let resetting = false;

  camera.position.copy(baseTarget).add(baseOffset);
  camera.lookAt(baseTarget);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(baseTarget);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = false;
  controls.minDistance = 8;
  controls.maxDistance = 32;
  controls.minPolarAngle = 0.32;
  controls.maxPolarAngle = 1.50;
  controls.rotateSpeed = 0.62;
  controls.zoomSpeed = 0.85;
  controls.update();
  let userMovedCamera = false;
  controls.addEventListener('start', () => { userMovedCamera = true; resetting = false; });

  // ---- world ----
  const state = new WorldState();
  const sky = createSky();
  scene.fog = sky.fog;
  const lighting = createLighting(false);
  const island = createIsland();
  const house = createHouse();
  house.group.position.set(HOUSE_AT.x, 0, HOUSE_AT.z);
  house.group.rotation.y = 0.10;
  const windmill = createWindmill();
  windmill.group.position.set(WINDMILL_AT.x, 0, WINDMILL_AT.z);
  windmill.group.rotation.y = -0.12;
  windmill.group.scale.setScalar(0.88);
  const pond = createPond();
  const vegetation = createVegetation();
  const props = createProps();
  const clouds = createClouds();
  const rainSystem = createRain(mobile ? 320 : 620);

  scene.add(sky.group, lighting.group, island, house.group, windmill.group,
    pond.group, vegetation.group, props.group, clouds.group, rainSystem.points);

  attachHousePicker(renderer.domElement, camera, house, () => state.toggleLights());
  function beginReset(): void {
    resetting = true;
    // OrbitControls keeps a damped rotation delta after a drag. Running one
    // update with damping off zeroes it, so the camera can settle exactly home
    // instead of being nudged away again during the return tween.
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
  }
  const panel = createPanel(state, beginReset);

  // ---- responsive framing ----
  function resize(): void {
    const w = app.clientWidth || window.innerWidth;
    const h = app.clientHeight || window.innerHeight;
    const aspect = w / h;
    // Portrait needs distance so the island's width fits; a short landscape
    // needs a little distance too so the underside clears the corner card.
    const nextScale = clamp(Math.max(1.08 / aspect, h < 520 ? 1.18 : 1, 1), 1, 3);
    if (Math.abs(nextScale - frameScale) > 0.001) {
      const ratio = nextScale / frameScale;
      if (userMovedCamera || resetting) {
        const offset = camera.position.clone().sub(controls.target).multiplyScalar(ratio);
        camera.position.copy(controls.target).add(offset);
      } else {
        camera.position.copy(baseTarget).addScaledVector(baseDirection, baseDistance * nextScale);
      }
      frameScale = nextScale;
    }
    controls.minDistance = 8 * frameScale;
    controls.maxDistance = 32 * frameScale;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    sky.setSize(renderer.domElement.width, renderer.domElement.height);
  }
  window.addEventListener('resize', resize);
  new ResizeObserver(resize).observe(app);
  resize();

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionQuery.matches;
  motionQuery.addEventListener('change', (e) => { reducedMotion = e.matches; });

  // ---- debug handle, also used by verify.mjs ----
  const tintDay = new THREE.Color('#e8f2f2');
  const tintNight = new THREE.Color('#a9bed2');
  const tint = new THREE.Color();
  const waterSky = new THREE.Color();
  const lastSunDir = new THREE.Vector3(0, 0, 0);
  let lastShadowRain = -1;
  let lastAtm: Atmosphere = sampleAtmosphere(state.smooth.time, 0);

  (window as unknown as { __pocketWorld: unknown }).__pocketWorld = {
    state: state.target,
    smooth: state.smooth,
    camera,
    scene,
    renderer,
    controls,
    house,
    windmill,
    pond,
    rain: rainSystem,
    panel,
    defaults: { ...DEFAULT_STATE },
    set(patch: Partial<AppState>): void { state.set(patch); },
    setTime(t: number): void { state.set({ time: t }); },
    setWeather(w: Weather): void { state.set({ weather: w }); },
    setWind(w: number): void { state.set({ wind: w }); },
    setLights(on: boolean): void { state.set({ houseLights: on }); },
    reset(): void { state.reset(); beginReset(); },
    settle(): void { state.settle(); },
    visual() {
      const a = lastAtm;
      return {
        time: state.smooth.time,
        timeLabel: formatTime(state.target.time),
        weather: state.target.weather,
        wind: state.smooth.wind,
        lights: state.smooth.lights,
        skyTop: `#${a.top.getHexString()}`,
        skyHorizon: `#${a.horizon.getHexString()}`,
        skyBottom: `#${a.bottom.getHexString()}`,
        sunPower: a.sunPower,
        sunDir: a.sunDir.toArray(),
        sunUp: a.sunUp,
        night: a.night,
        golden: a.golden,
        day: a.day,
        rainOpacity: (rainSystem.points.material as THREE.ShaderMaterial).uniforms.uOpacity.value,
        rainStreaks: rainSystem.visibleStreaks(),
        rainCount: rainSystem.count,
        rainVisible: rainSystem.points.visible,
        windmillAngle: windmill.angle,
        glow: state.smooth.lights,
        ripples: pond.activeRipples(),
        cloudColor: clouds.cloudColor(),
        cameraPosition: camera.position.toArray(),
        cameraDistance: camera.position.distanceTo(controls.target),
        target: controls.target.toArray(),
        panelCollapsed: panel.isCollapsed(),
        reducedMotion,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        webgl: true,
      };
    },
  };

  // ---- render loop ----
  let last = performance.now();
  let elapsed = 0;
  let firstFrame = true;
  function frame(now: number): void {
    // A 120 ms ceiling still prevents a tab-return jump, but lets a slow
    // device keep roughly real-time transitions instead of running at 1/6 speed.
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.12);
    last = now;
    elapsed += dt;
    state.update(dt);

    const s = state.smooth;
    const atm = sampleAtmosphere(s.time, s.rain);
    lastAtm = atm;
    if (!atm.sunDir.equals(lastSunDir) || Math.abs(s.rain - lastShadowRain) > 0.015) {
      renderer.shadowMap.needsUpdate = true;
      lastSunDir.copy(atm.sunDir);
      lastShadowRain = s.rain;
    }

    if (resetting) {
      const k = 1 - Math.exp(-6 * dt);
      const home = homePosition();
      camera.position.lerp(home, k);
      controls.target.lerp(baseTarget, k);
      if (camera.position.distanceTo(home) < 0.04 && controls.target.distanceTo(baseTarget) < 0.02) {
        resetting = false;
        userMovedCamera = false;
      }
    }

    sky.update(atm, elapsed, s.rain, reducedMotion);
    lighting.update(atm);
    wetness.apply(s.rain);
    clouds.update(dt, elapsed, s.wind, s.rain, atm.night, reducedMotion);
    house.update(dt, s.wind, s.rain, reducedMotion);
    house.setGlow(s.lights * (0.62 + 0.55 * atm.night));
    windmill.update(dt, s.wind, reducedMotion);
    vegetation.update(dt, elapsed, s.wind, reducedMotion);
    props.update(dt, elapsed, reducedMotion);
    // Water reflects the blue upper sky more than the warm horizon band.
    waterSky.copy(atm.horizon).lerp(atm.top, 0.62);
    pond.update(dt, elapsed, s.rain, atm.night, waterSky);
    tint.copy(tintDay).lerp(tintNight, atm.night * 0.75);
    rainSystem.setTint(tint);
    rainSystem.update(dt, s.rain, s.wind, pond);

    controls.update();
    renderer.render(scene, camera);

    if (firstFrame) {
      firstFrame = false;
      loading.classList.add('is-gone');
      window.setTimeout(() => loading.remove(), 600);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
