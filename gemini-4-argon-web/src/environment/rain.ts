import * as THREE from 'three';
import { getIslandSurfaceHeight } from '../state';

interface RainDropData {
  x: number;
  y: number;
  z: number;
  speed: number;
  len: number;
  minY: number;
}

export interface RainSystem {
  group: THREE.Group;
  update: (
    dt: number,
    rainFactor: number,
    windFactor: number,
    nightness: number,
    reducedMotion: boolean,
  ) => void;
}

function seededRand(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRain(): RainSystem {
  const group = new THREE.Group();
  group.name = 'RainSystem';

  const count = 650;
  const rand = seededRand(88123);

  const drops: RainDropData[] = [];
  const positions = new Float32Array(count * 6); // 2 vertices (x,y,z) per line segment

  const sampleDropXZ = (): [number, number, number] => {
    const angle = rand() * Math.PI * 2;
    const radius = Math.sqrt(rand()) * 7.8;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const surfaceY = getIslandSurfaceHeight(x, z);
    // Stop at the island surface or at rim level (0.15) if just outside the edge
    const minY = surfaceY !== null ? Math.max(0.0, surfaceY + 0.06) : 0.25;
    return [x, z, minY];
  };

  for (let i = 0; i < count; i++) {
    const [x, z, minY] = sampleDropXZ();
    const y = minY + rand() * (7.2 - minY);
    const speed = 10.5 + rand() * 3.5;
    const len = 0.42 + rand() * 0.22;
    drops.push({ x, y, z, speed, len, minY });
  }

  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);

  const mat = new THREE.LineBasicMaterial({
    color: '#d4ecff',
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  const lines = new THREE.LineSegments(geo, mat);
  lines.visible = false;
  lines.frustumCulled = false;
  group.add(lines);

  const dayRainCol = new THREE.Color('#d8eeff');
  const nightRainCol = new THREE.Color('#8ab4e6');

  return {
    group,
    update: (
      dt: number,
      rainFactor: number,
      windFactor: number,
      nightness: number,
      reducedMotion: boolean,
    ) => {
      if (rainFactor <= 0.005) {
        lines.visible = false;
        mat.opacity = 0;
        return;
      }

      lines.visible = true;
      mat.color.copy(dayRainCol).lerp(nightRainCol, nightness * 0.7);
      mat.opacity = rainFactor * 0.54;

      const timeStep = reducedMotion ? dt * 0.55 : dt;
      // Wind pushes rain horizontally along -X / +Z; at 0% wind, horizontal velocity is 0
      const windVx = windFactor > 0.002 ? -windFactor * 5.6 : 0;
      const windVz = windFactor > 0.002 ? windFactor * 1.4 : 0;

      for (let i = 0; i < count; i++) {
        const d = drops[i];
        d.x += windVx * timeStep;
        d.y -= d.speed * timeStep;
        d.z += windVz * timeStep;

        // Recycle drop as soon as it reaches the island surface / pond level (never passes beneath island)
        if (d.y <= d.minY) {
          const [nx, nz, nMinY] = sampleDropXZ();
          // Offset spawn X slightly upwind so slanted rain still covers the whole island
          d.x = nx - windVx * 0.35;
          d.z = nz - windVz * 0.35;
          d.minY = nMinY;
          d.y = 6.2 + (i % 7) * 0.25;
        } else {
          const curSurf = getIslandSurfaceHeight(d.x, d.z);
          d.minY = curSurf !== null ? Math.max(0.0, curSurf + 0.06) : 0.25;
        }

        const streakRatio = d.len / d.speed;
        const tailX = d.x - windVx * streakRatio;
        const tailY = d.y + d.len;
        const tailZ = d.z - windVz * streakRatio;

        const idx = i * 6;
        positions[idx] = d.x;
        positions[idx + 1] = d.y;
        positions[idx + 2] = d.z;
        positions[idx + 3] = tailX;
        positions[idx + 4] = tailY;
        positions[idx + 5] = tailZ;
      }

      posAttr.needsUpdate = true;
    },
  };
}
