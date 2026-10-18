import * as THREE from 'three';
import { M } from './materials';
import { LAYOUT } from './layout';
import { mulberry32 } from '../lib/math';
import type { Frame } from '../lib/frame';
import type { Island } from './island';

export interface Pond {
  group: THREE.Group;
  center: { x: number; z: number };
  radius: number;
  waterY: number;
  /** Rain drops landing on the water call this. */
  spawnRipple(x: number, z: number): void;
  update(f: Frame): void;
}

const RIPPLE_POOL = 18;

/** A quiet pond in a carved bowl, with a pooled ripple system for rain. */
export function makePond(island: Island): Pond {
  const group = new THREE.Group();
  const { x, z } = LAYOUT.pond;
  // Water sits above the bowl's deepest point but below the surrounding grade.
  const waterY = island.topY(x, z) + 0.3;
  group.position.set(x, waterY, z);

  const sand = new THREE.Mesh(new THREE.CircleGeometry(LAYOUT.pond.shoreRadius, 30), M.sand);
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = -0.025;
  sand.receiveShadow = true;
  group.add(sand);

  const water = new THREE.Mesh(new THREE.CircleGeometry(LAYOUT.pond.waterRadius, 30), M.water);
  water.rotation.x = -Math.PI / 2;
  water.receiveShadow = true;
  group.add(water);

  // Shore pebbles for a readable shoreline.
  const rand = mulberry32(99);
  const pebbleGeo = new THREE.IcosahedronGeometry(0.09, 0);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rand() * 0.5;
    const r = LAYOUT.pond.waterRadius + 0.22 + rand() * 0.25;
    const pebble = new THREE.Mesh(pebbleGeo, M.stoneDark);
    pebble.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r);
    pebble.scale.set(1 + rand(), 0.55, 1 + rand() * 0.6);
    pebble.rotation.y = rand() * Math.PI;
    pebble.castShadow = true;
    group.add(pebble);
  }

  // Pooled ripples: one shared geometry, one material per ripple (opacity varies).
  const rippleGeo = new THREE.RingGeometry(0.42, 0.5, 22);
  const ripples: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; life: number; maxScale: number }> = [];
  for (let i = 0; i < RIPPLE_POOL; i++) {
    const mat = M.ripple.clone();
    const mesh = new THREE.Mesh(rippleGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    group.add(mesh);
    ripples.push({ mesh, mat, life: 1, maxScale: 1 });
  }

  const free = () => ripples.find((r) => !r.mesh.visible);

  return {
    group,
    center: { x, z },
    radius: LAYOUT.pond.waterRadius,
    waterY,
    spawnRipple(px: number, pz: number) {
      const r = free();
      if (!r) return; // pool exhausted this frame - skip rather than allocate
      r.life = 0;
      r.maxScale = 2.1 + Math.random() * 0.7;
      r.mesh.position.set(px - x, 0.015, pz - z);
      r.mesh.visible = true;
    },
    update(f: Frame) {
      for (const r of ripples) {
        if (!r.mesh.visible) continue;
        r.life += f.dt / 0.85;
        if (r.life >= 1) {
          r.mesh.visible = false;
          continue;
        }
        const s = 0.25 + r.life * r.maxScale;
        r.mesh.scale.set(s, s, 1);
        r.mat.opacity = (1 - r.life) * 0.5 * Math.max(f.rain, 0.05);
      }
    },
  };
}
