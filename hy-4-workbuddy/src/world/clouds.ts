import * as THREE from 'three';
import { mulberry32, range } from '../util/math';
import { PAL } from './palette';
import { standard } from './materials';

export interface Clouds {
  group: THREE.Group;
  cloudColor(): string;
  update(dt: number, elapsed: number, wind: number, rain: number, night: number, reducedMotion: boolean): void;
}

interface Cloud {
  group: THREE.Group;
  baseY: number;
  phase: number;
  scale: number;
}

export function createClouds(): Clouds {
  const group = new THREE.Group();
  group.name = 'clouds';
  const rng = mulberry32(6402);
  const mat = standard(PAL.cloud, { roughness: 1, flatShading: true });
  const shadeMat = standard(PAL.cloudShadow, { roughness: 1, flatShading: true });
  const clear = PAL.cloud.clone();
  const shadeClear = PAL.cloudShadow.clone();
  const rainCol = PAL.cloudRain.clone();
  const nightCol = new THREE.Color('#4a5b76');
  const puffGeo = new THREE.IcosahedronGeometry(1, 1);
  const clouds: Cloud[] = [];

  // The camera looks down at the island, so clouds sit low and far behind it:
  // that is where they land near the top of the frame instead of off-screen.
  const spots: [number, number, number, number][] = [
    [-7.0, 2.7, -11.0, 0.80], [1.5, 3.2, -13.5, 0.70], [-13.0, 2.3, -8.0, 0.64],
    [8.0, 2.6, -10.0, 0.58], [-2.5, 3.6, -9.0, 0.55],
  ];
  for (const [x, y, z, s] of spots) {
    const c = new THREE.Group();
    c.position.set(x, y, z);
    const n = 5 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const puff = new THREE.Mesh(puffGeo, i % 3 === 0 ? shadeMat : mat);
      puff.position.set(
        (i - n / 2) * 0.62 * s + (rng() - 0.5) * 0.3,
        (rng() - 0.5) * 0.36 * s,
        (rng() - 0.5) * 0.65 * s,
      );
      const r = range(rng, 0.50, 0.86) * s;
      puff.scale.set(r * 1.25, r * 0.78, r);
      c.add(puff);
    }
    group.add(c);
    clouds.push({ group: c, baseY: y, phase: rng() * 6.28, scale: s });
  }

  return {
    group,
    cloudColor() {
      return `#${mat.color.getHexString()}`;
    },
    update(dt, elapsed, wind, rain, night, reducedMotion) {
      mat.color.copy(clear).lerp(rainCol, rain * 0.85).lerp(nightCol, night * 0.72);
      shadeMat.color.copy(shadeClear).lerp(rainCol, rain * 0.9).lerp(nightCol, night * 0.78);
      for (const c of clouds) {
        // Wind is the single shared driver of cloud drift: no idle motion at 0.
        c.group.position.x += dt * wind * 2.8;
        if (c.group.position.x > 16) c.group.position.x = -16;
        c.group.position.y = c.baseY + (reducedMotion ? 0 : Math.sin(elapsed * 0.35 + c.phase) * 0.10);
        const s = 1 + rain * 0.16;
        c.group.scale.setScalar(s);
      }
    },
  };
}
