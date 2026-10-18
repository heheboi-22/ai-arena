import * as THREE from 'three';
import { approach, damp, dampHours, smoothstep } from './core/math';
import { detectQuality } from './core/quality';
import { createFireflies } from './env/fireflies';
import { createLighting } from './env/lighting';
import { Rain } from './env/rain';
import { RingPool } from './env/ripples';
import { createSky } from './env/sky';
import { createSmoke } from './env/smoke';
import { applyRain, createSample, isSunHour, moonDirection, sampleTime, sunDirection } from './env/timeOfDay';
import { Wind } from './env/wind';
import { CameraRig } from './interaction/cameraRig';
import { HousePicker } from './interaction/picking';
import { DEFAULT_STATE, Store } from './state';
import { Panel } from './ui/panel';
import { buildWorld } from './world/world';

const MAX_DT = 1 / 20;

export function startApp(canvas: HTMLCanvasElement, onFatal: (message: string) => void): void {
  const quality = detectQuality();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    onFatal('The graphics driver reset and the island was lost. Reload the page to bring it back.');
  });

  const scene = new THREE.Scene();
  const fog = new THREE.Fog('#ffffff', 45, 120);
  scene.fog = fog;

  const store = new Store(DEFAULT_STATE);
  const world = buildWorld(quality);
  scene.add(world.root, world.clouds.group);

  const sky = createSky();
  scene.add(sky.mesh);
  const lighting = createLighting(scene, quality);
  const wind = new Wind(DEFAULT_STATE.wind);

  // Rain is simulated in world space; ripples and splashes ride along with the floating island.
  const ripples = new RingPool(80, 0.8, 0.85);
  const splashes = new RingPool(96, 0.55, 0.55);
  world.root.add(ripples.mesh, splashes.mesh);
  const rain = new Rain(quality.rainDrops, world.surface, ripples, splashes);
  scene.add(rain.mesh);

  const smoke = createSmoke(world.house.chimneyTop);
  const fireflies = createFireflies(pixelRatio);
  world.root.add(smoke.group, fireflies.points);

  const rig = new CameraRig(canvas);
  const camera = rig.camera;

  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let motion = reducedQuery.matches ? 0 : 1;
  reducedQuery.addEventListener('change', (e) => {
    motion = e.matches ? 0 : 1;
  });

  const reset = () => {
    store.set({ ...DEFAULT_STATE });
    rig.reset(motion > 0);
  };

  const panel = new Panel(store, {
    onReset: reset,
    onLayout: () => rig.setInsets(panel.insets()),
  });
  new ResizeObserver(() => rig.setInsets(panel.insets())).observe(panel.root);

  new HousePicker(
    canvas,
    camera,
    world.house.hitbox,
    [world.trees, world.windmill.group, world.island.top, world.island.underside],
    () => store.set({ lights: !store.get().lights }),
  );

  canvas.addEventListener('keydown', (e) => {
    const step = 0.1;
    const moves: Record<string, [number, number, number]> = {
      ArrowLeft: [-step, 0, 1],
      ArrowRight: [step, 0, 1],
      ArrowUp: [0, -step * 0.8, 1],
      ArrowDown: [0, step * 0.8, 1],
      '+': [0, 0, 0.9],
      '=': [0, 0, 0.9],
      '-': [0, 0, 1.1],
      _: [0, 0, 1.1],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    rig.nudge(m[0], m[1], m[2]);
  });

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    rig.resize(w, h, panel.insets(true), panel.insets());
  };
  window.addEventListener('resize', resize);
  resize();

  // Live values ease toward the store, so every change is a transition that a newer change
  // can interrupt without anything fighting.
  const live = { time: DEFAULT_STATE.time, rain: 0, lights: 0 };
  const env = createSample();
  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3();
  const look = { color: new THREE.Color(), emissive: new THREE.Color(), storm: new THREE.Color() };
  const tint = new THREE.Color();
  const rippleTint = new THREE.Color();
  const reflect = new THREE.Color();
  const white = new THREE.Color('#ffffff');
  const stormBase = new THREE.Color('#5d6676');

  let elapsed = 0;
  let last = performance.now();
  let slow = 0;

  const frame = (now: number) => {
    const raw = (now - last) / 1000;
    last = now;
    const dt = Math.min(Math.max(raw, 0), MAX_DT);
    elapsed += dt;

    // Gentle dynamic resolution: if frames stay slow for a few seconds, render fewer pixels.
    if (raw < 0.25) {
      slow = raw > 0.03 ? slow + raw : Math.max(0, slow - raw * 0.5);
      if (slow > 3 && pixelRatio > 1) {
        pixelRatio = Math.max(1, pixelRatio - 0.25);
        renderer.setPixelRatio(pixelRatio);
        resize();
        slow = 0;
      }
    }

    const s = store.get();
    live.time = dampHours(live.time, s.time, 5, dt);
    live.rain = approach(live.rain, s.weather === 'rain' ? 1 : 0, dt / 2.2);
    live.lights = damp(live.lights, s.lights ? 1 : 0, 9, dt);
    const rainK = smoothstep(0, 1, live.rain);
    wind.update(dt, s.wind, elapsed, motion);

    sampleTime(live.time, env);
    applyRain(env, rainK);
    sunDirection(live.time, sunDir);
    moonDirection(live.time, moonDir);
    lighting.apply(env, isSunHour(live.time) ? sunDir : moonDir, rainK);
    renderer.toneMappingExposure = env.exposure;

    const u = sky.uniforms;
    u.uTop.value.copy(env.skyTop);
    u.uHorizon.value.copy(env.skyHorizon);
    u.uBottom.value.copy(env.skyBottom);
    u.uSunDir.value.copy(sunDir);
    u.uSunColor.value.copy(env.key);
    u.uSunVis.value = smoothstep(-0.12, 0.04, sunDir.y) * (1 - 0.9 * rainK);
    u.uMoonDir.value.copy(moonDir);
    u.uMoonVis.value = env.night * (1 - rainK);
    u.uStars.value = env.night * env.night * (1 - rainK);
    u.uTime.value = elapsed;
    sky.mesh.position.copy(camera.position);

    // Fog is measured from the orbit distance, so a phone (camera further out) and a desktop
    // see the same amount of haze on the island.
    const orbit = camera.position.distanceTo(rig.controls.target);
    fog.color.copy(env.skyHorizon).lerp(env.skyBottom, 0.5);
    fog.near = orbit + THREE.MathUtils.lerp(25, -3, rainK);
    fog.far = orbit + THREE.MathUtils.lerp(95, 30, rainK);

    reflect.copy(env.skyHorizon).lerp(env.skyTop, 0.35);
    world.pond.setEnvironment(env.water, reflect, rainK);
    world.house.setLights(live.lights, env.night);

    look.color.copy(env.cloud);
    look.emissive.copy(env.skyHorizon).multiplyScalar(0.16 + 0.1 * env.night);
    look.storm.copy(stormBase).lerp(env.cloud, 0.35).multiplyScalar(1 - 0.5 * env.night);
    world.clouds.update(dt, elapsed, wind.gusting, rainK, camera, look, motion);

    world.windmill.update(dt, wind.gusting);
    world.island.update(dt, elapsed, motion);
    const bob = Math.sin(elapsed * 0.45) * 0.05 * motion;
    world.root.position.y = bob;

    tint.copy(env.hemiSky).lerp(white, 0.45 - 0.2 * env.night);
    rain.update(dt, rainK, wind, tint, 0.55 - 0.25 * env.night, bob);
    ripples.update(dt, rippleTint.copy(tint).lerp(white, 0.5));
    splashes.update(dt, tint);
    smoke.update(dt, wind, tint.copy(env.cloud).lerp(white, 0.25), motion > 0);
    fireflies.update(elapsed, env.night, rainK, motion, pixelRatio);

    panel.setNight(env.night);
    rig.update(dt);
    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop(frame);

  // A small handle for automated checks and console poking; it changes nothing by itself.
  (window as unknown as { __pocketWorld: unknown }).__pocketWorld = {
    store,
    stats: () => ({
      rainDrops: rain.active,
      ripples: ripples.count,
      splashes: splashes.count,
      liveRain: live.rain,
      liveTime: live.time,
      liveLights: live.lights,
      wind: wind.gusting,
      pixelRatio,
      camera: camera.position.toArray(),
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    }),
  };
}
