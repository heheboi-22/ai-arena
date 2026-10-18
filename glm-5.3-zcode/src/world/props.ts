import * as THREE from 'three';
import { M } from './materials';
import { LAYOUT } from './layout';
import { mulberry32 } from '../lib/math';
import type { Frame } from '../lib/frame';
import type { Island } from './island';

export interface Props {
  group: THREE.Group;
  update(f: Frame): void;
}

interface Bobber {
  mesh: THREE.Mesh;
  baseY: number;
  phase: number;
}

/** Restrained set dressing: path, fence, flowers, rocks, and drifting stones. */
export function makeProps(island: Island): Props {
  const group = new THREE.Group();
  const rand = mulberry32(3131);
  const bobbers: Bobber[] = [];
  const topY = island.topY;

  const solid = (mesh: THREE.Mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  // --- stepping stones from the porch toward the pond ---------------------------
  const stoneGeo = new THREE.CylinderGeometry(0.2, 0.24, 0.07, 7);
  const from = new THREE.Vector2(-1.35, -0.05);
  const to = new THREE.Vector2(1.8, 1.3);
  for (const t of [0.04, 0.26, 0.48, 0.7, 0.9]) {
    const px = from.x + (to.x - from.x) * t + (rand() - 0.5) * 0.3;
    const pz = from.y + (to.y - from.y) * t + (rand() - 0.5) * 0.3;
    const s = 0.85 + rand() * 0.4;
    const stone = solid(new THREE.Mesh(stoneGeo, M.stone));
    stone.position.set(px, topY(px, pz) + 0.01, pz);
    stone.scale.set(s, 1, s);
    stone.rotation.y = rand() * Math.PI;
  }

  // --- fence arc along the front rim ----------------------------------------------
  const postGeo = new THREE.BoxGeometry(0.1, 0.55, 0.1);
  const railGeo = new THREE.BoxGeometry(1, 0.05, 0.035); // scaled to length per span
  const R = 6.1;
  const angles = [0.3, 0.52, 0.74, 0.96, 1.18];
  const posts = angles.map((a) => new THREE.Vector3(Math.cos(a) * R, topY(Math.cos(a) * R, Math.sin(a) * R), Math.sin(a) * R));
  for (const p of posts) {
    const post = solid(new THREE.Mesh(postGeo, M.woodDark));
    post.position.set(p.x, p.y + 0.22, p.z);
  }
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i];
    const b = posts[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const yaw = -Math.atan2(dz, dx);
    for (const h of [0.34, 0.5]) {
      const rail = solid(new THREE.Mesh(railGeo, M.woodMid));
      rail.scale.x = len + 0.08;
      rail.position.set((a.x + b.x) / 2, (a.y + b.y) / 2 + h, (a.z + b.z) / 2);
      rail.rotation.y = yaw;
      rail.position.y += 0.22;
    }
  }

  // --- flowers ----------------------------------------------------------------------
  const stemGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.17, 5);
  const headGeo = new THREE.IcosahedronGeometry(0.05, 0);
  const anchors: Array<[number, number]> = [
    [-1.25, 0.75], [-0.6, 1.1], [0.6, 0.3], [3.9, 0.55],
    [1.5, 3.0], [-3.1, -1.5], [0.1, -3.4],
  ];
  let fi = 0;
  for (const [ax, az] of anchors) {
    for (let k = 0; k < 2; k++) {
      const px = ax + (rand() - 0.5) * 0.7;
      const pz = az + (rand() - 0.5) * 0.7;
      const stem = solid(new THREE.Mesh(stemGeo, M.flowerStem));
      stem.position.set(px, topY(px, pz) + 0.08, pz);
      const head = solid(new THREE.Mesh(headGeo, M.flowers[fi++ % M.flowers.length]));
      head.position.set(px, topY(px, pz) + 0.18, pz);
    }
  }

  // --- rocks and drifting stones -------------------------------------------------------
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  for (const r of LAYOUT.rocks) {
    const rock = solid(new THREE.Mesh(rockGeo, M.stone));
    rock.position.set(r.x, topY(r.x, r.z) + r.scale * 0.15, r.z);
    rock.scale.set(r.scale, r.scale * 0.72, r.scale * 0.85);
    rock.rotation.set(rand() * 0.4, rand() * Math.PI, rand() * 0.4);
  }
  for (const fl of LAYOUT.floaters) {
    const rock = solid(new THREE.Mesh(rockGeo, M.stoneDark));
    rock.position.set(fl.x, fl.y, fl.z);
    rock.scale.setScalar(fl.scale);
    rock.rotation.set(rand(), rand() * Math.PI, rand());
    bobbers.push({ mesh: rock, baseY: fl.y, phase: fl.phase });
  }

  return {
    group,
    update(f: Frame) {
      const motion = f.reducedMotion ? 0.3 : 1;
      for (const b of bobbers) {
        b.mesh.position.y = b.baseY + Math.sin(f.time * 0.5 * motion + b.phase) * 0.2 * motion;
        b.mesh.rotation.y += f.dt * 0.05 * motion;
      }
    },
  };
}
