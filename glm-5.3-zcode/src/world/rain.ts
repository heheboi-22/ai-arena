import * as THREE from 'three';
import { mulberry32 } from '../lib/math';
import { LAYOUT } from './layout';
import type { Frame } from '../lib/frame';

export interface Rain {
  lines: THREE.LineSegments;
  /** Set by main; called whenever a drop lands on the pond. */
  onPondDrop: ((x: number, z: number) => void) | null;
  update(f: Frame, topY: (x: number, z: number) => number): void;
}

const STREAK = 0.55;

/**
 * Rain as pooled line streaks in 3D space. Drops fall with the shared wind
 * slant, die at the terrain (or pond) surface instead of passing through, and
 * fade in/out with the smoothed rain amount.
 */
export function makeRain(count: number): Rain {
  const rand = mulberry32(555);
  const drops: Float32Array = new Float32Array(count * 4); // x, y, z, speed
  const positions = new Float32Array(count * 2 * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0xaec3d8,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  lines.visible = false;

  const respawn = (i: number, stagger: boolean): void => {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 9.6; // uniform over the island's disc
    drops[i * 4] = Math.cos(a) * r;
    drops[i * 4 + 1] = stagger ? 2 + rand() * 11 : 7 + rand() * 4.5;
    drops[i * 4 + 2] = Math.sin(a) * r;
    drops[i * 4 + 3] = 10.5 + rand() * 3.5;
  };
  for (let i = 0; i < count; i++) respawn(i, true);

  let wasVisible = false;
  const { x: pondX, z: pondZ, waterRadius } = LAYOUT.pond;
  let pondY = Number.NaN; // the Pond module derives its level the same way, lazily here

  return {
    lines,
    onPondDrop: null,
    update(f, topY) {
      const visible = f.rain > 0.015;
      if (visible && !wasVisible) {
        for (let i = 0; i < count; i++) respawn(i, true); // re-seed staggered
      }
      wasVisible = visible;
      lines.visible = visible;
      if (!visible) return;

      material.opacity = 0.36 * f.rain;
      const wx = f.windDir.x * f.wind * 5.5;
      const wz = f.windDir.z * f.wind * 5.5;

      for (let i = 0; i < count; i++) {
        const ix = i * 4;
        const speed = drops[ix + 3];
        drops[ix] += wx * f.dt;
        drops[ix + 1] -= speed * f.dt;
        drops[ix + 2] += wz * f.dt;
        const x = drops[ix];
        const y = drops[ix + 1];
        const z = drops[ix + 2];

        // Does the drop hit the pond, the island surface, or fall past the edge?
        const dPond = Math.hypot(x - pondX, z - pondZ);
        if (Number.isNaN(pondY)) pondY = topY(pondX, pondZ) + 0.3;
        if (dPond < waterRadius && y < pondY) {
          if (this.onPondDrop && rand() < 0.5) this.onPondDrop(x, z);
          respawn(i, false);
          continue;
        }
        const r = Math.hypot(x, z);
        if (r < LAYOUT.islandRadius + 0.35) {
          if (y < topY(x, z)) {
            respawn(i, false);
            continue;
          }
        } else if (y < -11) {
          respawn(i, false);
          continue;
        }

        // Write the streak: head at the drop, tail along its velocity.
        const mag = Math.hypot(wx, speed, wz);
        const k = STREAK / mag;
        const o = i * 6;
        positions[o] = x;
        positions[o + 1] = y;
        positions[o + 2] = z;
        positions[o + 3] = x + wx * k;
        positions[o + 4] = y + speed * k;
        positions[o + 5] = z + wz * k;
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}
