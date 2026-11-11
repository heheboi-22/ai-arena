import * as THREE from 'three';
import { mulberry32, range } from '../util/math';
import { PAL } from './palette';
import { standard, wetness } from './materials';
import { onIsland as land } from './island';
import { inPond } from './pond';

export const HOUSE_AT = { x: -1.15, z: -1.25 };
export const WINDMILL_AT = { x: 3.05, z: -2.05 };

/** The sandy walk from the front rim to the cottage door. */
export const PATH_POINTS: [number, number][] = [
  [0.15, 3.45], [-0.18, 2.62], [-0.50, 1.78], [-0.90, 0.92], [HOUSE_AT.x, 0.20],
];

function distanceToPath(x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < PATH_POINTS.length - 1; i++) {
    const [ax, az] = PATH_POINTS[i];
    const [bx, bz] = PATH_POINTS[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
  }
  return best;
}

function placeable(x: number, z: number): boolean {
  if (!land(x, z, 0.10)) return false;
  if (Math.abs(x - HOUSE_AT.x) < 2.0 && Math.abs(z - HOUSE_AT.z) < 1.7) return false;
  if (Math.hypot(x - WINDMILL_AT.x, z - WINDMILL_AT.z) < 1.15) return false;
  if (inPond(x, z, 1.14)) return false;
  if (distanceToPath(x, z) < 0.31) return false;
  return true;
}

export interface Props {
  group: THREE.Group;
  update(dt: number, elapsed: number, reducedMotion: boolean): void;
}

export function createProps(): Props {
  const group = new THREE.Group();
  group.name = 'ground-details';
  const rng = mulberry32(8811);

  const sand = wetness.track(standard(PAL.sand, { roughness: 1, side: THREE.DoubleSide, vertexColors: true }), 0.85);
  const wood = wetness.track(standard(PAL.wood, { roughness: 0.92 }), 0.8);
  const woodDark = wetness.track(standard(PAL.woodDark, { roughness: 0.92 }), 0.8);
  const stone = wetness.track(standard(PAL.stone, { flatShading: true, roughness: 1 }), 0.8);
  const stoneDark = wetness.track(standard(PAL.stoneDark, { flatShading: true, roughness: 1 }), 0.8);

  // ---------- path ----------
  const curve = new THREE.CatmullRomCurve3(PATH_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const N = 56;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t);
    const nx = tan.z;
    const nz = -tan.x;
    const w = 0.31 + 0.07 * Math.sin(t * 7.5) + 0.05 * (1 - t);
    for (const s of [-1, 1]) {
      pos.push(p.x + nx * w * s, 0.022 + 0.002 * Math.sin(t * 30), p.z + nz * w * s);
      const v = 0.88 + 0.16 * Math.sin(t * 23 + s);
      col.push(v, v * 0.98, v * 0.90);
    }
    if (i < N) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const pathGeo = new THREE.BufferGeometry();
  pathGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  pathGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  pathGeo.setIndex(idx);
  pathGeo.computeVertexNormals();
  const path = new THREE.Mesh(pathGeo, sand);
  path.receiveShadow = true;
  group.add(path);

  // stepping stones set into the path
  const pebbleGeo = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 8; i++) {
    const t = 0.08 + (i / 8) * 0.82;
    const p = curve.getPoint(t);
    const s = 0.15 + rng() * 0.07;
    const m = new THREE.Mesh(pebbleGeo, i % 2 ? stone : stoneDark);
    m.position.set(p.x + (rng() - 0.5) * 0.16, 0.035, p.z + (rng() - 0.5) * 0.16);
    m.scale.set(s, 0.045, s * (0.8 + rng() * 0.4));
    m.rotation.y = rng() * 3;
    m.receiveShadow = true;
    group.add(m);
  }

  // ---------- fences ----------
  function fence(points: [number, number][]): void {
    const c = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const count = Math.max(2, Math.floor(c.getLength() / 0.58));
    const posts: THREE.Vector3[] = [];
    for (let i = 0; i <= count; i++) posts.push(c.getPoint(i / count));
    for (const p of posts) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.60, 0.085), woodDark);
      post.position.set(p.x, 0.30, p.z);
      group.add(post);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.072, 0.10, 4), wood);
      cap.position.set(p.x, 0.65, p.z);
      group.add(cap);
    }
    const q = new THREE.Quaternion();
    const axis = new THREE.Vector3(1, 0, 0);
    for (let i = 0; i < count; i++) {
      const a = posts[i];
      const b = posts[i + 1];
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      q.setFromUnitVectors(axis, dir.clone().normalize());
      for (const y of [0.24, 0.45]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.055, 0.045), wood);
        rail.position.copy(a).addScaledVector(dir, 0.5);
        rail.position.y = y;
        rail.quaternion.copy(q);
        group.add(rail);
      }
    }
  }
  fence([[-4.15, -0.90], [-3.55, -1.85], [-2.55, -2.65], [-1.35, -3.05]]);
  fence([[3.15, 2.55], [3.85, 1.90], [4.15, 0.95]]);
  fence([[-3.75, 1.30], [-3.35, 2.05]]);

  // ---------- grass blades (one instanced draw call) ----------
  const bladeGeo = new THREE.ConeGeometry(0.026, 0.19, 3);
  bladeGeo.translate(0, 0.095, 0);
  const grassMat = wetness.track(standard('#ffffff', { roughness: 1, flatShading: true, side: THREE.DoubleSide }), 0.9);
  const TUFTS = 270;
  const grass = new THREE.InstancedMesh(bladeGeo, grassMat, TUFTS * 3);
  grass.name = 'grass';
  grass.castShadow = false;
  grass.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const grassColors = [PAL.grassLight, PAL.grass, PAL.leafLight, PAL.grass];
  let gi = 0;
  let attempts = 0;
  while (gi < TUFTS && attempts < 6000) {
    attempts++;
    const x = range(rng, -5.1, 5.1);
    const z = range(rng, -4.0, 4.0);
    if (!placeable(x, z)) continue;
    for (let k = 0; k < 3; k++) {
      dummy.position.set(x + (rng() - 0.5) * 0.16, 0, z + (rng() - 0.5) * 0.16);
      dummy.rotation.set((rng() - 0.5) * 0.45, rng() * 6.28, (rng() - 0.5) * 0.45);
      const s = 0.55 + rng() * 0.62;
      dummy.scale.set(s, s * (0.8 + rng() * 0.7), s);
      dummy.updateMatrix();
      grass.setMatrixAt(gi * 3 + k, dummy.matrix);
      grass.setColorAt(gi * 3 + k, grassColors[Math.floor(rng() * grassColors.length)]);
    }
    gi++;
  }
  grass.count = gi * 3;
  grass.instanceMatrix.needsUpdate = true;
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  group.add(grass);

  // ---------- flowers ----------
  const FLOWERS = 100;
  const stemGeo = new THREE.CylinderGeometry(0.011, 0.014, 0.22, 4);
  stemGeo.translate(0, 0.11, 0);
  const stemMat = wetness.track(standard(PAL.grassDark, { roughness: 1 }), 0.8);
  const stems = new THREE.InstancedMesh(stemGeo, stemMat, FLOWERS);
  const headGeo = new THREE.IcosahedronGeometry(0.052, 0);
  const headMat = wetness.track(standard('#ffffff', { flatShading: true, roughness: 0.9 }), 0.7);
  const heads = new THREE.InstancedMesh(headGeo, headMat, FLOWERS);
  heads.castShadow = false;
  const petalColors = [PAL.flowerYellow, PAL.flowerRed, PAL.flowerWhite, PAL.flowerViolet];
  let fi = 0;
  attempts = 0;
  while (fi < FLOWERS && attempts < 5000) {
    attempts++;
    const x = range(rng, -5.0, 5.0);
    const z = range(rng, -3.9, 3.9);
    if (!placeable(x, z)) continue;
    const h = 0.17 + rng() * 0.11;
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, rng() * 6.28, (rng() - 0.5) * 0.2);
    dummy.scale.set(1, h / 0.22, 1);
    dummy.updateMatrix();
    stems.setMatrixAt(fi, dummy.matrix);
    dummy.position.set(x, h, z);
    dummy.rotation.set(rng(), rng(), rng());
    dummy.scale.setScalar(0.85 + rng() * 0.6);
    dummy.updateMatrix();
    heads.setMatrixAt(fi, dummy.matrix);
    heads.setColorAt(fi, petalColors[Math.floor(rng() * petalColors.length)]);
    fi++;
  }
  stems.count = fi;
  heads.count = fi;
  stems.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
  group.add(stems, heads);

  // ---------- rocks + mushrooms ----------
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 26; i++) {
    const x = range(rng, -5.0, 5.0);
    const z = range(rng, -3.9, 3.9);
    if (!placeable(x, z)) continue;
    const s = 0.10 + rng() * 0.22;
    const m = new THREE.Mesh(rockGeo, rng() > 0.5 ? stone : stoneDark);
    m.position.set(x, s * 0.45, z);
    m.scale.set(s * 1.2, s * 0.8, s);
    m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    m.receiveShadow = true;
    group.add(m);
  }
  const capMat = wetness.track(standard(PAL.flowerRed, { flatShading: true, roughness: 0.9 }), 0.7);
  const stemMush = wetness.track(standard(PAL.flowerWhite, { roughness: 0.95 }), 0.7);
  for (let i = 0; i < 9; i++) {
    const x = range(rng, -4.6, 4.6);
    const z = range(rng, -3.5, 3.5);
    if (!placeable(x, z)) continue;
    const s = 0.7 + rng() * 0.6;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.16, 7), stemMush);
    stem.position.set(x, 0.08 * s, z);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
    cap.position.set(x, 0.16 * s, z);
    cap.scale.setScalar(s);
    group.add(stem, cap);
  }

  // ---------- small rocks suspended around the island ----------
  const debris: { mesh: THREE.Mesh; baseY: number; phase: number }[] = [];
  const debrisMat = wetness.track(standard(PAL.rockMid, { flatShading: true, roughness: 1 }), 0.5);
  for (let i = 0; i < 11; i++) {
    const a = rng() * Math.PI * 2;
    const r = 6.2 + rng() * 1.9;
    const y = -1.0 - rng() * 4.2;
    const s = 0.10 + rng() * 0.19;
    const m = new THREE.Mesh(rockGeo, debrisMat);
    m.position.set(Math.cos(a) * r, y, Math.sin(a) * r * 0.80);
    m.scale.set(s * 1.3, s * (0.6 + rng()), s);
    m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    group.add(m);
    debris.push({ mesh: m, baseY: y, phase: rng() * 6.28 });
  }

  return {
    group,
    update(_dt, elapsed, reducedMotion) {
      if (reducedMotion) return;
      for (const d of debris) {
        d.mesh.position.y = d.baseY + Math.sin(elapsed * 0.55 + d.phase) * 0.09;
        d.mesh.rotation.y += _dt * 0.10;
      }
    },
  };
}
