import * as THREE from 'three';
import { makeRng } from '../lib/math';
import { WORLD } from '../palette';
import type { SharedMaterials } from './materials';

export interface Clouds {
  group: THREE.Group;
  update: (dt: number, time: number, wind: number, rain: number, reduced: boolean) => void;
}

interface CloudUnit {
  g: THREE.Group;
  speed: number;
  bobPhase: number;
}

/** Low-poly puff clouds drifting through; one shared material grays in rain. */
export function createClouds(mats: SharedMaterials): Clouds {
  const group = new THREE.Group();
  const rng = makeRng(555);
  const units: CloudUnit[] = [];
  const puffGeo = new THREE.SphereGeometry(1, 7, 5);

  for (let c = 0; c < 6; c++) {
    const g = new THREE.Group();
    const puffs = 4 + Math.floor(rng() * 3);
    const scale = 0.55 + rng() * 0.5;
    for (let i = 0; i < puffs; i++) {
      const puff = new THREE.Mesh(puffGeo, mats.cloud);
      puff.position.set(
        (i - puffs / 2) * 0.75 * scale + rng() * 0.2,
        rng() * 0.22 * scale,
        (rng() - 0.5) * 0.5 * scale,
      );
      const r = (0.42 + rng() * 0.3) * scale;
      puff.scale.set(r, r * 0.72, r * 0.85);
      puff.castShadow = true;
      g.add(puff);
    }
    g.position.set(
      -14 + rng() * 28,
      4.6 + rng() * 1.8,
      -9 + rng() * 18,
    );
    group.add(g);
    units.push({ g, speed: 0.55 + rng() * 0.6, bobPhase: rng() * Math.PI * 2 });
  }

  const clear = new THREE.Color(WORLD.cloud);
  const gray = new THREE.Color(WORLD.cloudRain);

  return {
    group,
    update(dt, time, wind, rain, reduced) {
      // drift speed follows the shared wind state
      const drift = 0.1 + wind * 1.5;
      const bobAmp = reduced ? 0.03 : 0.1;
      for (const u of units) {
        u.g.position.x += drift * u.speed * dt;
        if (u.g.position.x > 16) u.g.position.x = -16;
        u.g.position.y += Math.sin(time * 0.32 + u.bobPhase) * bobAmp * dt;
      }
      mats.cloud.color.lerpColors(clear, gray, rain);
      // fluff slightly flattens under rain
      const squash = 1 - rain * 0.12;
      for (const u of units) u.g.scale.y = squash;
    },
  };
}
