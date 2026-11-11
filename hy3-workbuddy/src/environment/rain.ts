import * as THREE from 'three';
import { GROUND_Y, ISLAND_TOP_RADIUS, isSmallDevice } from '../config';

export interface Rain {
  mesh: THREE.LineSegments;
  update: (dt: number, rainAmount: number, wind: number) => void;
}

const TOP_Y = 9.0;
const GROUND = GROUND_Y;
const RADIUS = ISLAND_TOP_RADIUS + 1.0;
const STREAK = 0.3;
const FALL = 13.0;

/**
 * Rain belongs to the 3D scene (not a screen overlay). Each drop falls within
 * a column above the island and is recycled to the top once it reaches the
 * ground, so it never streams through the floating underside.
 */
export function createRain(): Rain {
  const maxDrops = isSmallDevice ? 900 : 1800;
  const positions = new Float32Array(maxDrops * 2 * 3);
  const geo = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(positions, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', attr);
  geo.setDrawRange(0, 0);

  const mat = new THREE.LineBasicMaterial({
    color: '#9fbdd6',
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const mesh = new THREE.LineSegments(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;

  // Per-drop state
  const hx = new Float32Array(maxDrops);
  const hy = new Float32Array(maxDrops);
  const hz = new Float32Array(maxDrops);
  const jx = new Float32Array(maxDrops);
  const jz = new Float32Array(maxDrops);

  const spawn = (i: number): void => {
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random()) * RADIUS;
    hx[i] = Math.cos(ang) * rad;
    hz[i] = Math.sin(ang) * rad;
    hy[i] = TOP_Y + Math.random() * 2.5;
    jx[i] = (Math.random() - 0.5) * 1.2;
    jz[i] = (Math.random() - 0.5) * 0.8;
  };

  for (let i = 0; i < maxDrops; i++) spawn(i);

  const head = new THREE.Vector3();
  const tail = new THREE.Vector3();

  const update = (dt: number, rainAmount: number, wind: number): void => {
    const rain = Math.max(0, Math.min(1, rainAmount));
    mat.opacity = rain * 0.6;
    const active = Math.floor(maxDrops * rain);
    geo.setDrawRange(0, active * 2);

    const vx = wind * 7.0;
    const vz = wind * 2.2;

    for (let i = 0; i < active; i++) {
      hy[i] -= FALL * dt;
      hx[i] += (vx + jx[i]) * dt;
      hz[i] += (vz + jz[i]) * dt;
      if (hy[i] < GROUND) spawn(i);

      head.set(hx[i], hy[i], hz[i]);
      // streak trails opposite to motion (mostly upward)
      const len = Math.hypot(FALL, vx + jx[i], vz + jz[i]) || 1;
      tail.set(
        hx[i] - ((vx + jx[i]) / len) * STREAK,
        hy[i] + (FALL / len) * STREAK,
        hz[i] - ((vz + jz[i]) / len) * STREAK
      );

      const o = i * 6;
      positions[o] = head.x;
      positions[o + 1] = head.y;
      positions[o + 2] = head.z;
      positions[o + 3] = tail.x;
      positions[o + 4] = tail.y;
      positions[o + 5] = tail.z;
    }
    attr.needsUpdate = true;
  };

  return { mesh, update };
}
