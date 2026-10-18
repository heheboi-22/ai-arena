import * as THREE from 'three';
import { buildClouds } from './clouds';
import { buildHouse } from './house';
import { buildIsland } from './islandMesh';
import { buildPond } from './pond';
import { buildFence, buildGroundCover, buildPath, buildRocks } from './props';
import { buildRain } from './rain';
import { SkyRig } from './sky';
import type { WorldState } from './state';
import { buildVegetation } from './vegetation';
import { buildWindmill } from './windmill';

export interface Quality {
  shadowMap: number;
  rainDrops: number;
  groundCover: number;
  reduced: boolean;
}

export interface PocketScene {
  scene: THREE.Scene;
  sky: SkyRig;
  housePickables: THREE.Object3D[];
  fog: THREE.FogExp2;
  update: (state: WorldState, dt: number, elapsed: number, cameraAzimuth: number) => void;
}

interface Puff {
  sprite: THREE.Sprite;
  age: number;
  life: number;
  drift: THREE.Vector2;
}

/** Soft round puff: a sprite without a map would render as a hard-edged square. */
function puffTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grd = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.4, 'rgba(255,255,255,0.42)');
    grd.addColorStop(0.75, 'rgba(255,255,255,0.12)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A few soft puffs from the chimney; purely decorative, so wind scatters them faster. */
function createSmoke(parent: THREE.Object3D, origin: THREE.Vector3, count: number): { update: (dt: number, wind: number, tint: THREE.Color) => void } {
  const puff = puffTexture();
  const puffs: Puff[] = [];
  for (let i = 0; i < count; i += 1) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: puff,
        color: '#e9e6de',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      }),
    );
    sprite.scale.setScalar(0.16);
    parent.add(sprite);
    puffs.push({
      sprite,
      age: (i / count) * 2.6,
      life: 2.6,
      drift: new THREE.Vector2(Math.random() - 0.5, Math.random() - 0.5),
    });
  }
  let clock = 0;

  return {
    update(dt, wind, tint) {
      clock += dt;
      for (const puff of puffs) {
        puff.age += dt * (0.55 + wind * 0.7);
        if (puff.age > puff.life) {
          puff.age = 0;
          puff.drift.set(Math.random() - 0.5, Math.random() - 0.5);
        }
        const t = puff.age / puff.life;
        puff.sprite.position.set(
          origin.x + (0.14 + wind * 0.75) * t * puff.drift.x * 4 + t * (0.35 + wind * 2.6),
          origin.y + t * (1.05 + wind * 0.5),
          origin.z + (0.14 + wind * 0.6) * t * puff.drift.y * 3,
        );
        puff.sprite.scale.setScalar(0.14 + t * 0.62);
        const fade = Math.sin(Math.min(1, t) * Math.PI);
        (puff.sprite.material as THREE.SpriteMaterial).opacity = fade * 0.34;
        (puff.sprite.material as THREE.SpriteMaterial).color.copy(tint);
      }
    },
  };
}

export function createWorld(quality: Quality): PocketScene {
  const scene = new THREE.Scene();
  const fog = new THREE.FogExp2('#cfe4f0', 0.004);
  scene.fog = fog;

  const sky = new SkyRig();
  sky.sun.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
  scene.add(sky.group);

  const island = buildIsland();
  const pond = buildPond();
  const house = buildHouse();
  const windmill = buildWindmill();
  const vegetation = buildVegetation();
  const clouds = buildClouds();
  const rain = buildRain(quality.rainDrops, quality.reduced ? 14 : 26);

  scene.add(
    island,
    pond.group,
    house.group,
    windmill.group,
    vegetation.group,
    clouds.group,
    rain.group,
    buildPath(),
    buildFence(),
    buildRocks(),
    buildGroundCover(quality.groundCover),
  );

  const chimneyTop = new THREE.Vector3(-0.44, 2.42, -0.28);
  house.group.updateMatrixWorld(true);
  house.group.localToWorld(chimneyTop);
  const smoke = createSmoke(scene, chimneyTop, quality.reduced ? 5 : 9);

  const tint = new THREE.Color();
  const cloudTint = new THREE.Color();

  return {
    scene,
    sky,
    fog,
    housePickables: house.pickables,
    update(state: WorldState, dt: number, elapsed: number, cameraAzimuth: number) {
      const wind = state.current.wind;
      const rainAmount = state.rainIntensity;

      sky.update(state.current.timeHour, rainAmount);
      fog.color.copy(sky.fogColor);
      fog.density = sky.fogDensity;

      // Windows matter most after dark, and the switch is always decisive.
      const glow = state.current.lights * (0.5 + 0.5 * sky.night);
      house.setLights(glow);

      windmill.update(dt, elapsed, wind, quality.reduced);
      vegetation.update(elapsed, wind, quality.reduced);

      cloudTint.copy(sky.skyColor).lerp(new THREE.Color('#ffffff'), 0.55);
      clouds.update(dt, wind, rainAmount, cloudTint, sky.night);

      tint.copy(sky.skyColor).lerp(new THREE.Color('#e8f1fa'), 0.35);
      rain.update(dt, wind, rainAmount, cameraAzimuth, tint);

      smoke.update(dt, wind, cloudTint);
      pond.update(
        elapsed,
        wind,
        rainAmount,
        sky.sunDir,
        sky.sunColorOut,
        sky.skyColor,
        sky.waterColor,
      );
    },
  };
}
