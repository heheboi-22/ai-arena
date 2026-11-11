import * as THREE from 'three';
import { makeRng } from '../lib/math';
import { WORLD } from '../palette';
import { TREES, BUSHES, FLOWER_PATCHES } from './layout';
import type { SharedMaterials } from './materials';

export interface Vegetation {
  group: THREE.Group;
  update: (dt: number, time: number, wind: number, night: number, rain: number, reduced: boolean) => void;
}

interface Swayable {
  pivot: THREE.Group;
  phase: number;
  freq: number;
  amp: number;
}

export function createVegetation(
  mats: SharedMaterials,
  groundY: (x: number, z: number) => number,
): Vegetation {
  const group = new THREE.Group();
  const rng = makeRng(2026);
  const swayables: Swayable[] = [];

  // shared geometries — every tree reuses these
  const trunkGeo = new THREE.CylinderGeometry(0.05, 0.09, 1, 7);
  const puffGeo = new THREE.IcosahedronGeometry(1, 1);
  const coneGeo = new THREE.ConeGeometry(1, 1, 8);

  for (const spec of TREES) {
    const pivot = new THREE.Group();
    pivot.position.set(spec.x, groundY(spec.x, spec.z) - 0.03, spec.z);
    pivot.rotation.y = spec.rot;
    const s = spec.s;

    if (spec.kind === 'puff') {
      const trunk = new THREE.Mesh(trunkGeo, mats.trunk);
      trunk.scale.set(s * 0.9, s * 0.85, s * 0.9);
      trunk.position.y = s * 0.42;
      pivot.add(trunk);
      const puffs: [number, number, number, number][] = [
        [0, 1.05, 0, 0.52],
        [0.34, 0.82, 0.14, 0.36],
        [-0.3, 0.88, -0.1, 0.33],
        [0.05, 1.35, -0.06, 0.3],
      ];
      for (const [px, py, pz, pr] of puffs) {
        const puff = new THREE.Mesh(puffGeo, rng() > 0.5 ? mats.leaf : mats.leaf2);
        puff.position.set(px * s, py * s, pz * s);
        puff.scale.set(pr * s, pr * s * 0.86, pr * s);
        puff.rotation.y = rng() * Math.PI;
        pivot.add(puff);
      }
      swayables.push({ pivot, phase: rng() * Math.PI * 2, freq: 1.1 + rng() * 0.4, amp: 0.05 });
    } else {
      const trunk = new THREE.Mesh(trunkGeo, mats.trunk);
      trunk.scale.set(s * 0.7, s * 0.6, s * 0.7);
      trunk.position.y = s * 0.3;
      pivot.add(trunk);
      const tiers: [number, number, number][] = [
        [0.52, 0.72, 0.5],
        [0.4, 1.16, 0.62],
        [0.26, 1.62, 0.44],
      ];
      for (const [r, y, h] of tiers) {
        const cone = new THREE.Mesh(coneGeo, rng() > 0.4 ? mats.pine : mats.pine2);
        cone.scale.set(r * s, h * s, r * s);
        cone.position.y = y * s;
        cone.rotation.y = rng() * Math.PI;
        pivot.add(cone);
      }
      swayables.push({ pivot, phase: rng() * Math.PI * 2, freq: 0.9 + rng() * 0.3, amp: 0.035 });
    }
    pivot.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
      }
    });
    group.add(pivot);
  }

  // bushes: single low puffs
  const bushMat = mats.leaf2;
  for (const b of BUSHES) {
    const bush = new THREE.Mesh(puffGeo, bushMat);
    bush.position.set(b.x, groundY(b.x, b.z) + 0.16 * b.s, b.z);
    bush.scale.set(0.34 * b.s, 0.24 * b.s, 0.34 * b.s);
    bush.rotation.y = rng() * Math.PI;
    bush.castShadow = true;
    group.add(bush);
  }

  // flowers: three instanced meshes (one per color) + instanced stems
  const petalGeo = new THREE.SphereGeometry(0.045, 6, 5);
  const stemGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.16, 5);
  const flowerCount = FLOWER_PATCHES.reduce((n, p) => n + p.n, 0);
  const petalMesh = new THREE.InstancedMesh(
    petalGeo,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }),
    flowerCount,
  );
  const stemMesh = new THREE.InstancedMesh(stemGeo, mats.leaf, flowerCount);
  const petalColors = [WORLD.flowerPink, WORLD.flowerYellow, WORLD.flowerWhite];
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  let idx = 0;
  for (const patch of FLOWER_PATCHES) {
    for (let i = 0; i < patch.n; i++) {
      const ang = rng() * Math.PI * 2;
      const rad = rng() * patch.spread;
      const x = patch.x + Math.cos(ang) * rad;
      const z = patch.z + Math.sin(ang) * rad;
      const y = groundY(x, z);
      dummy.position.set(x, y + 0.19, z);
      dummy.rotation.set(0, rng() * Math.PI, 0);
      dummy.updateMatrix();
      petalMesh.setMatrixAt(idx, dummy.matrix);
      col.setHex(petalColors[Math.floor(rng() * petalColors.length)]);
      petalMesh.setColorAt(idx, col);
      dummy.position.set(x, y + 0.09, z);
      dummy.updateMatrix();
      stemMesh.setMatrixAt(idx, dummy.matrix);
      idx++;
    }
  }
  petalMesh.instanceMatrix.needsUpdate = true;
  if (petalMesh.instanceColor) petalMesh.instanceColor.needsUpdate = true;
  group.add(petalMesh, stemMesh);

  // fireflies come out around dusk and drift over the meadow
  const FIREFLIES = 16;
  const ffGeo = new THREE.BufferGeometry();
  const ffBase = new Float32Array(FIREFLIES * 3);
  const ffPos = new Float32Array(FIREFLIES * 3);
  for (let i = 0; i < FIREFLIES; i++) {
    const ang = rng() * Math.PI * 2;
    const rad = 1.2 + rng() * 3.6;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    ffBase[i * 3] = x;
    ffBase[i * 3 + 1] = groundY(x, z) + 0.5 + rng() * 0.9;
    ffBase[i * 3 + 2] = z;
  }
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  const ffMat = new THREE.PointsMaterial({
    color: 0xffd27a, size: 0.11, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const fireflies = new THREE.Points(ffGeo, ffMat);
  group.add(fireflies);

  return {
    group,
    update(dt, time, wind, night, rain, reduced) {
      const motion = reduced ? 0.3 : 1;
      const windDrive = 0.08 + wind * 0.92;
      for (const t of swayables) {
        t.pivot.rotation.z = Math.sin(time * t.freq * (0.6 + wind) + t.phase) * t.amp * windDrive * motion * 3;
        t.pivot.rotation.x = Math.sin(time * t.freq * 0.7 * (0.6 + wind) + t.phase * 1.7) * t.amp * 0.6 * windDrive * motion * 3;
      }
      // fireflies wander sinusoidally around their anchor points
      const glow = night * (1 - rain * 0.85) * (reduced ? 0.5 : 1);
      ffMat.opacity = glow * (0.65 + 0.35 * Math.sin(time * 2.2));
      if (glow > 0.02) {
        for (let i = 0; i < FIREFLIES; i++) {
          const bx = ffBase[i * 3], by = ffBase[i * 3 + 1], bz = ffBase[i * 3 + 2];
          ffPos[i * 3] = bx + Math.sin(time * 0.5 + i * 1.9) * 0.45 * motion;
          ffPos[i * 3 + 1] = by + Math.sin(time * 0.8 + i * 2.7) * 0.22 * motion;
          ffPos[i * 3 + 2] = bz + Math.cos(time * 0.45 + i * 1.3) * 0.45 * motion;
        }
        ffGeo.attributes.position.needsUpdate = true;
      }
    },
  };
}
