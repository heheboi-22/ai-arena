import * as THREE from 'three';
import { M } from './materials';
import { mulberry32 } from '../lib/math';
import type { Frame } from '../lib/frame';

export interface Clouds {
  group: THREE.Group;
  update(f: Frame): void;
}

interface Drifter {
  group: THREE.Group;
  radius: number;
  angle: number;
  height: number;
  speed: number;
  bobPhase: number;
}

const PUFF_GEO = new THREE.IcosahedronGeometry(1, 0);
const RAIN_GRAY = new THREE.Color(0x6f7887);
const WHITE = new THREE.Color(0xffffff);
const tmpColor = new THREE.Color();

/** Puffy low-poly clouds orbiting the island; drift speed follows the wind. */
export function makeClouds(): Clouds {
  const group = new THREE.Group();
  const rand = mulberry32(4242);
  const drifters: Drifter[] = [];

  const SPECS = [
    { radius: 9.6, height: 3.4, puffs: 4 },
    { radius: 11.4, height: 5.0, puffs: 5 },
    { radius: 13.0, height: 2.9, puffs: 3 },
    { radius: 10.2, height: 4.6, puffs: 4 },
    { radius: 12.2, height: 3.8, puffs: 5 },
    { radius: 14.2, height: 5.6, puffs: 3 },
  ];

  for (const spec of SPECS) {
    const cloud = new THREE.Group();
    for (let i = 0; i < spec.puffs; i++) {
      const puff = new THREE.Mesh(PUFF_GEO, M.cloud);
      puff.position.set(
        (i - (spec.puffs - 1) / 2) * (0.9 + rand() * 0.4) + (rand() - 0.5) * 0.4,
        (rand() - 0.5) * 0.35,
        (rand() - 0.5) * 0.9,
      );
      const s = 0.72 + rand() * 0.55;
      puff.scale.set(s * 1.55, s * 0.62, s);
      cloud.add(puff);
    }
    group.add(cloud);
    drifters.push({
      group: cloud,
      radius: spec.radius,
      angle: rand() * Math.PI * 2,
      height: spec.height,
      speed: 0.75 + rand() * 0.5,
      bobPhase: rand() * Math.PI * 2,
    });
  }

  return {
    group,
    update(f: Frame) {
      // One shared material write retints every puff.
      tmpColor.copy(WHITE).lerp(RAIN_GRAY, f.rain);
      const brightness = 0.35 + 0.65 * Math.max(f.dayFactor, 0.25);
      M.cloud.color.copy(tmpColor).multiplyScalar(brightness);

      const motion = f.reducedMotion ? 0.45 : 1;
      for (const d of drifters) {
        d.angle += f.dt * (0.025 + f.wind * 0.16) * d.speed * motion;
        d.group.position.set(
          Math.cos(d.angle) * d.radius,
          d.height - f.rain * 0.7 + Math.sin(f.time * 0.4 * motion + d.bobPhase) * 0.12,
          Math.sin(d.angle) * d.radius,
        );
      }
    },
  };
}
