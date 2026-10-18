import {
  AdditiveBlending,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  PointLight,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { createEnvironment, sampleEnvironment } from './environment';
import type { WorldState } from './state';
import type { Quality } from './quality';
import { createMaterials, glowTexture, PALETTE } from './scene/materials';
import { createIslandRock, createIslandTop } from './scene/island';
import { createPond } from './scene/pond';
import { createHouse, type House } from './scene/house';
import { createWindmill } from './scene/windmill';
import { createTrees, type Tree } from './scene/trees';
import { createProps } from './scene/props';
import { CLOUD_TRACK, createClouds, updateClouds, type Cloud } from './scene/clouds';
import { createSky, type SkyUniforms } from './scene/sky';
import { createRain, type Rain } from './effects/rain';
import { createRipples, type Ripples } from './effects/ripples';
import { createFireflies, type Fireflies } from './effects/fireflies';
import { damp, hourDelta, wrapHour } from './util/math';

export interface WorldFrame {
  state: Readonly<WorldState>;
  /** Seconds since the last frame, already clamped by the caller. */
  dt: number;
  /** Seconds since start. Used for periodic motion, never for accumulated state. */
  elapsed: number;
  reducedMotion: boolean;
}

export interface World {
  scene: Scene;
  /** Solid geometry only. The picker raycasts this so rain, sky and glow never block a click. */
  solids: Group;
  house: House;
  update(frame: WorldFrame): void;
}

// Full-wind rotation rate of the windmill, in radians per second.
const WINDMILL_SPEED = 3.2;
// Ease rates, roughly 1/seconds. Higher settles faster.
const HOUR_RATE = 3.2;
const RAIN_RATE = 1.2;
const RAIN_RATE_REDUCED = 1.6;
const WIND_RATE = 2.5;
const LIGHT_RATE = 4.5;

const RAIN_SKY = new Color(0x6f7d8c);
const RAIN_CLOUD = new Color(0x5d6876);
const RAIN_LIGHT = new Color(0xc3ced8);
const GLASS_OFF = new Color(PALETTE.glassOff);
const GLASS_ON = new Color(PALETTE.glassOn);

export function createWorld(quality: Quality): World {
  const scene = new Scene();
  const fog = new Fog(0xcde7f4, 42, 120);
  scene.fog = fog;

  const mats = createMaterials();
  const env = createEnvironment();
  const sky = createSky();
  const skyUniforms: SkyUniforms = sky.uniforms;
  scene.add(sky.mesh);

  // Lights: hemisphere for ambient sky and ground bounce, a shadow-casting sun,
  // a soft moon for night, and a warm point light from the house.
  const hemi = new HemisphereLight(0xffffff, 0x444444, 1);
  scene.add(hemi);

  const sun = new DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  const shadowCam = sun.shadow.camera;
  shadowCam.left = -9.5;
  shadowCam.right = 9.5;
  shadowCam.top = 9.5;
  shadowCam.bottom = -9.5;
  shadowCam.near = 1;
  shadowCam.far = 70;
  shadowCam.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  const moon = new DirectionalLight(0xaec4ff, 0);
  scene.add(moon, moon.target);

  const houseLight = new PointLight(0xffb865, 0, 9, 2);
  scene.add(houseLight);

  // Solid world: everything a click can land on.
  const solids = new Group();
  solids.name = 'solids';
  const top = createIslandTop(mats.grass);
  const rock = createIslandRock(mats.rock);
  const pond = createPond(mats);
  const house = createHouse(mats);
  const windmill = createWindmill(mats);
  const { group: treeGroup, trees } = createTrees(mats);
  const props = createProps(mats);
  solids.add(top, rock, pond.group, house.group, windmill.group, treeGroup, props);
  scene.add(solids);

  const { group: cloudGroup, clouds } = createClouds(mats);
  scene.add(cloudGroup);

  const rain: Rain = createRain(quality.rainDrops);
  scene.add(rain.mesh);
  const ripples: Ripples = createRipples(quality.ripples);
  scene.add(ripples.group);
  const fireflies: Fireflies = createFireflies();
  scene.add(fireflies.mesh);

  // Soft amber halo around the house, shown only while its lights are on.
  const glowMaterial = new SpriteMaterial({
    map: glowTexture(),
    color: GLASS_ON,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const glow = new Sprite(glowMaterial);
  glow.name = 'house-glow';
  scene.add(glow);

  house.group.updateMatrixWorld(true);
  const anchor = house.glowAnchor.getWorldPosition(new Vector3());
  glow.position.copy(anchor);
  houseLight.position.copy(anchor).add(new Vector3(0, 0.4, 0));

  // Eased copies of the controls. The scene reads these, never the raw state.
  let hourNow = wrapHour(0);
  let rainNow = 0;
  let windNow = 0;
  let lightsNow = 0;
  let initialised = false;
  let travel = 0;

  const windmillRotor = windmill.rotor;
  const treeList: Tree[] = trees;
  const cloudList: Cloud[] = clouds;

  const update = (frame: WorldFrame): void => {
    const { state, dt, elapsed, reducedMotion } = frame;
    // Decorative motion (sway, drift, fireflies) is scaled down under reduced motion.
    // Functional motion (windmill, rain) stays, so controls keep an obvious effect.
    const decor = reducedMotion ? 0.35 : 1;

    if (!initialised) {
      // First frame snaps to the saved state so the page doesn't open with a fade.
      hourNow = state.hour;
      rainNow = state.weather === 'rain' ? 1 : 0;
      windNow = state.wind;
      lightsNow = state.houseLights ? 1 : 0;
      initialised = true;
    }

    hourNow = wrapHour(hourNow + hourDelta(hourNow, state.hour) * (1 - Math.exp(-HOUR_RATE * dt)));
    rainNow = damp(rainNow, state.weather === 'rain' ? 1 : 0, reducedMotion ? RAIN_RATE_REDUCED : RAIN_RATE, dt);
    windNow = damp(windNow, state.wind, WIND_RATE, dt);
    lightsNow = damp(lightsNow, state.houseLights ? 1 : 0, LIGHT_RATE, dt);

    sampleEnvironment(hourNow, env);
    const rainAmt = rainNow;
    const night = env.night;
    const day = env.day;

    // Sky and fog. Rain greys the sky and sets the sun's disc back.
    skyUniforms.uZenith.value.copy(env.zenith).lerp(RAIN_SKY, rainAmt * 0.6);
    skyUniforms.uHorizon.value.copy(env.horizon).lerp(RAIN_SKY, rainAmt * 0.5);
    skyUniforms.uSunDir.value.copy(env.sunDir);
    skyUniforms.uSunColor.value.copy(env.sunColor);
    skyUniforms.uSunGlow.value = day * (1 - 0.7 * rainAmt);
    skyUniforms.uMoonDir.value.copy(env.moonDir);
    skyUniforms.uStars.value = night * (1 - 0.8 * rainAmt);
    skyUniforms.uTime.value = elapsed;
    fog.color.copy(skyUniforms.uHorizon.value);

    // Light. Rain softens the sun and tints it cool; the moon takes over after dark.
    sun.position.copy(env.sunDir).multiplyScalar(30);
    sun.color.copy(env.sunColor).lerp(RAIN_LIGHT, rainAmt * 0.5);
    sun.intensity = env.sunIntensity * (1 - 0.5 * rainAmt);
    moon.position.copy(env.moonDir).multiplyScalar(30);
    moon.color.copy(env.moonColor);
    moon.intensity = env.moonIntensity * (1 - 0.25 * rainAmt);
    hemi.color.copy(env.hemiSky).lerp(RAIN_SKY, rainAmt * 0.4);
    hemi.groundColor.copy(env.hemiGround);
    hemi.intensity = env.hemiIntensity * (1 - 0.12 * rainAmt);

    // Materials that follow the environment.
    mats.cloud.color.copy(env.cloud).lerp(RAIN_CLOUD, rainAmt * 0.85);
    mats.grass.color.copy(env.tint);

    // House lights: glass colour, emissive glow, point light and halo, all from one amount.
    const lit = lightsNow;
    mats.glass.color.copy(GLASS_OFF).lerp(GLASS_ON, lit * 0.9);
    mats.glass.emissiveIntensity = lit * (0.9 + 1.7 * night);
    houseLight.intensity = lit * (1.4 + 5.0 * night);
    glowMaterial.opacity = lit * (0.22 + 0.45 * night);
    glow.scale.setScalar(3.2 + 0.1 * Math.sin(elapsed * 1.1) * decor);

    // Wind drives the windmill, the trees and the clouds from one shared value.
    windmillRotor.rotation.z = (windmillRotor.rotation.z + windNow * WINDMILL_SPEED * decor * dt) % (Math.PI * 2);

    const sway = (0.012 + windNow * 0.075) * decor;
    for (const tree of treeList) {
      tree.crown.rotation.z = Math.sin(elapsed * 1.1 + tree.phase) * sway * tree.amplitude;
      tree.crown.rotation.x = Math.sin(elapsed * 0.8 + tree.phase * 1.7) * sway * 0.6 * tree.amplitude;
    }

    travel = (travel + (0.02 + windNow * 1.8) * decor * dt) % CLOUD_TRACK;
    updateClouds(cloudList, travel);

    rain.update(dt, rainAmt, windNow);
    ripples.update(dt, rainAmt);
    fireflies.update(elapsed, night, reducedMotion);
  };

  return { scene, solids, house, update };
}
