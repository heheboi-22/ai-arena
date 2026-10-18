import * as THREE from 'three';
import { Rng, jitterFacets, paintGeometry, mergePainted, TAU } from '../util';
import { terrainHeight, rimRadius, ISLAND } from './island';
import * as M from './materials';

export interface SwayTarget {
  obj: THREE.Object3D;
  phase: number;
  speed: number;
}

export interface Companion {
  group: THREE.Group;
  baseY: number;
  phase: number;
}

export interface NatureBuild {
  group: THREE.Group;
  swayers: SwayTarget[];
  companions: Companion[];
}

const leafMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.9,
  flatShading: true,
});
const stemMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
const tuftMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
const petalMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });

/* ------------------------------------------------------------------ trees */

function puffball(rng: Rng, s: number): { trunk: THREE.Mesh; foliage: THREE.Mesh } {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.13 * s, 0.64 * s, 7), M.wood);
  trunk.position.y = 0.32 * s;
  trunk.castShadow = true;

  const blobs: Array<[number, number, number, number, number]> = [
    // [radius, dx, dy, dz, color]
    [0.58, 0, 0.42, 0, 0x5da35b],
    [0.42, 0.36, 0.26, 0.16, 0x74b568],
    [0.38, -0.32, 0.3, -0.2, 0x519a52],
    [0.3, 0.05, 0.72, -0.12, 0x67ab61],
  ];
  const parts: THREE.BufferGeometry[] = [];
  for (const [r, dx, dy, dz, color] of blobs) {
    const g = new THREE.IcosahedronGeometry(r * s, 1).toNonIndexed();
    jitterFacets(g, 0.05 * s, rng);
    g.translate(dx * s, dy * s, dz * s);
    paintGeometry(g, color, 0.13);
    parts.push(g);
  }
  const foliage = new THREE.Mesh(mergePainted(parts), leafMat);
  foliage.position.y = 0.52 * s;
  foliage.castShadow = true;
  return { trunk, foliage };
}

function pine(rng: Rng, s: number): { trunk: THREE.Mesh; foliage: THREE.Mesh } {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.1 * s, 0.34 * s, 7), M.wood);
  trunk.position.y = 0.17 * s;
  trunk.castShadow = true;

  const tiers: Array<[number, number, number]> = [
    [0.55, 0.02, 0x3f7a52],
    [0.43, 0.42, 0x46845a],
    [0.3, 0.78, 0x3a7150],
  ];
  const parts: THREE.BufferGeometry[] = [];
  for (const [r, dy, color] of tiers) {
    const g = new THREE.ConeGeometry(r * s, 0.62 * s, 8).toNonIndexed();
    jitterFacets(g, 0.045 * s, rng);
    g.translate(0, dy * s, 0);
    paintGeometry(g, color, 0.12);
    parts.push(g);
  }
  const foliage = new THREE.Mesh(mergePainted(parts), leafMat);
  foliage.position.y = 0.26 * s;
  foliage.castShadow = true;
  return { trunk, foliage };
}

function cypress(rng: Rng, s: number): { trunk: THREE.Mesh; foliage: THREE.Mesh } {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.08 * s, 0.3 * s, 7), M.wood);
  trunk.position.y = 0.15 * s;
  trunk.castShadow = true;

  const parts: THREE.BufferGeometry[] = [];
  const body = new THREE.IcosahedronGeometry(0.42 * s, 1).toNonIndexed();
  body.scale(0.62, 1.9, 0.62);
  jitterFacets(body, 0.04 * s, rng);
  body.translate(0, 0.95 * s, 0);
  paintGeometry(body, 0x46695c, 0.12);
  parts.push(body);
  const tip = new THREE.IcosahedronGeometry(0.2 * s, 1).toNonIndexed();
  jitterFacets(tip, 0.03 * s, rng);
  tip.translate(0, 1.75 * s, 0);
  paintGeometry(tip, 0x51776a, 0.12);
  parts.push(tip);

  const foliage = new THREE.Mesh(mergePainted(parts), leafMat);
  foliage.position.y = 0.2 * s;
  foliage.castShadow = true;
  return { trunk, foliage };
}

/* ------------------------------------------------------------- companion islets */

function miniIslet(rng: Rng, s: number, withTree: boolean): THREE.Group {
  const g = new THREE.Group();

  const rock = new THREE.IcosahedronGeometry(0.72 * s, 1).toNonIndexed();
  jitterFacets(rock, 0.2 * s, rng);
  paintGeometry(rock, 0x767068, 0.14);
  const rockMesh = new THREE.Mesh(rock, M.stone);
  g.add(rockMesh);

  const cap = new THREE.SphereGeometry(0.78 * s, 8, 5);
  cap.scale(1, 0.3, 1);
  paintGeometry(cap, 0x74b058, 0.14);
  const capMesh = new THREE.Mesh(cap, tuftMat);
  capMesh.position.y = 0.16 * s;
  g.add(capMesh);

  if (withTree) {
    const t = pine(rng, 0.5 * s);
    t.trunk.position.y += 0.3 * s;
    t.foliage.position.y += 0.3 * s;
    g.add(t.trunk, t.foliage);
  }
  return g;
}

/* ------------------------------------------------------------------- build */

export function buildNature(houseGroup: THREE.Group): NatureBuild {
  const rng = new Rng(2026);
  const group = new THREE.Group();
  const swayers: SwayTarget[] = [];
  const companions: Companion[] = [];

  // ---- trees ---------------------------------------------------------
  const treeSpecs: Array<{ x: number; z: number; s: number; kind: 'puff' | 'pine' | 'cypress' }> = [
    { x: -3.2, z: -1.9, s: 1.3, kind: 'puff' },
    { x: -2.95, z: 1.65, s: 0.85, kind: 'puff' },
    { x: 3.15, z: -3.25, s: 1.15, kind: 'pine' },
    { x: 4.35, z: -2.85, s: 0.9, kind: 'pine' },
    { x: -1.5, z: -3.35, s: 1.25, kind: 'cypress' },
  ];
  for (const spec of treeSpecs) {
    const built =
      spec.kind === 'puff' ? puffball(rng, spec.s) : spec.kind === 'pine' ? pine(rng, spec.s) : cypress(rng, spec.s);
    const treeGroup = new THREE.Group();
    treeGroup.position.set(spec.x, terrainHeight(spec.x, spec.z) - 0.02, spec.z);
    treeGroup.rotation.y = rng.range(0, TAU);
    treeGroup.add(built.trunk, built.foliage);
    group.add(treeGroup);
    swayers.push({ obj: built.foliage, phase: rng.range(0, TAU), speed: rng.range(1.1, 1.6) });
  }

  // ---- path (stepping stones from the door to the gate) ---------------
  const doorWorld = houseGroup.localToWorld(new THREE.Vector3(-0.45, 0, 1.3));
  const pathParts: THREE.BufferGeometry[] = [];
  const gate = new THREE.Vector2(0.35, 4.5);
  const ctrl = new THREE.Vector2(-0.55, 2.75);
  const start = new THREE.Vector2(doorWorld.x, doorWorld.z);
  const stoneCount = 10;
  for (let i = 0; i < stoneCount; i++) {
    const t = (i + 0.6) / stoneCount;
    const mt = 1 - t;
    const x = mt * mt * start.x + 2 * mt * t * ctrl.x + t * t * gate.x;
    const z = mt * mt * start.y + 2 * mt * t * ctrl.y + t * t * gate.y;
    const r = rng.range(0.16, 0.22);
    const g = new THREE.CylinderGeometry(r, r * 1.12, 0.07, 7);
    g.rotateY(rng.range(0, TAU));
    g.translate(x, terrainHeight(x, z) - 0.012, z);
    paintGeometry(g, 0x9a9288, 0.1);
    pathParts.push(g);
  }
  const pathMesh = new THREE.Mesh(mergePainted(pathParts), M.stone);
  pathMesh.receiveShadow = true;
  group.add(pathMesh);

  // ---- fence with a gate gap facing the path ---------------------------
  const fenceParts: THREE.BufferGeometry[] = [];
  const postBase: Array<{ x: number; z: number }> = [];
  const gapCenter = Math.atan2(gate.x, gate.y); // angle of the gate in atan2(x, z) space
  const gapHalf = 0.13;
  const a0 = -0.98;
  const a1 = 0.68;
  const step = 0.135;
  for (let a = a0; a <= a1; a += step) {
    // skip posts that fall inside the gate opening
    const inGap = Math.abs(a - gapCenter) < gapHalf;
    if (inGap) continue;
    const rad = rimRadius(a) * 0.855;
    const x = Math.sin(a) * rad;
    const z = Math.cos(a) * rad;
    postBase.push({ x, z });
    const h = terrainHeight(x, z);
    const post = new THREE.BoxGeometry(0.1, 0.56, 0.1);
    post.translate(x, h + 0.25, z);
    paintGeometry(post, 0x9c7b52, 0.12);
    fenceParts.push(post);
  }
  // rails connecting consecutive posts (two heights)
  for (let i = 0; i < postBase.length - 1; i++) {
    const p = postBase[i];
    const q = postBase[i + 1];
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    const len = Math.hypot(dx, dz);
    const angle = -Math.atan2(dz, dx);
    for (const hOff of [0.17, 0.36]) {
      const rail = new THREE.BoxGeometry(len + 0.06, 0.055, 0.05);
      rail.rotateY(angle);
      const mx = (p.x + q.x) / 2;
      const mz = (p.z + q.z) / 2;
      rail.translate(mx, (terrainHeight(p.x, p.z) + terrainHeight(q.x, q.z)) / 2 + hOff, mz);
      paintGeometry(rail, 0x9c7b52, 0.1);
      fenceParts.push(rail);
    }
  }
  const fenceMesh = new THREE.Mesh(mergePainted(fenceParts), M.wood);
  fenceMesh.castShadow = true;
  fenceMesh.receiveShadow = true;
  group.add(fenceMesh);

  // ---- rocks & pond pebbles -------------------------------------------
  const rockParts: THREE.BufferGeometry[] = [];
  const rockSpecs: Array<[number, number, number]> = [
    [1.02, 2.98, 0.3],
    [-4.18, 0.78, 0.42],
    [3.92, 0.55, 0.24],
    [-0.92, -3.62, 0.32],
  ];
  for (const [x, z, s] of rockSpecs) {
    const g = new THREE.IcosahedronGeometry(s, 1).toNonIndexed();
    jitterFacets(g, 0.08 * s, rng);
    g.scale(1, 0.72, 1);
    g.rotateY(rng.range(0, TAU));
    g.translate(x, terrainHeight(x, z) + s * 0.18, z);
    paintGeometry(g, 0x8a867e, 0.14);
    rockParts.push(g);
  }
  for (const a of [2.1, 2.6, 3.1, 3.55]) {
    const rr = ISLAND.pond.r + 0.32 + rng.range(0, 0.2);
    const x = ISLAND.pond.x + Math.sin(a) * rr;
    const z = ISLAND.pond.z + Math.cos(a) * rr;
    const s = rng.range(0.06, 0.11);
    const g = new THREE.IcosahedronGeometry(s, 0);
    g.translate(x, terrainHeight(x, z) + s * 0.4, z);
    paintGeometry(g, 0xa39a86, 0.12);
    rockParts.push(g);
  }
  const rocksMesh = new THREE.Mesh(mergePainted(rockParts), M.stone);
  rocksMesh.castShadow = true;
  rocksMesh.receiveShadow = true;
  group.add(rocksMesh);

  // a little barrel resting by the windmill
  {
    const bx = 1.66;
    const bz = -1.08;
    const by = terrainHeight(bx, bz);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.34, 10), M.woodDark);
    barrel.position.set(bx, by + 0.17, bz);
    barrel.castShadow = true;
    group.add(barrel);
    for (const dy of [-0.09, 0.09]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.178, 0.178, 0.035, 10), M.trim);
      band.position.set(bx, by + 0.17 + dy, bz);
      group.add(band);
    }
  }

  // ---- flowers ---------------------------------------------------------
  const flowerSpots: Array<[number, number]> = [
    [-2.35, 0.55], [-2.62, 0.22], [-2.12, 0.95], [-2.88, 0.78],
    [0.55, 2.72], [0.92, 3.38], [0.72, 2.05],
    [3.02, 1.12], [3.32, 0.66], [2.68, 0.32],
    [-2.58, 3.12], [-1.72, 3.88],
    [1.66, -1.28],
  ];
  const petalColors = [0xff8f6b, 0xffd97a, 0xf5f2ea, 0xc9a6e8, 0xf4a6c0];
  const stems: THREE.BufferGeometry[] = [];
  const heads: THREE.BufferGeometry[] = [];
  for (const [x, z] of flowerSpots) {
    const h = terrainHeight(x, z);
    const stem = new THREE.CylinderGeometry(0.016, 0.02, 0.17, 5);
    stem.translate(x, h + 0.085, z);
    paintGeometry(stem, 0x5a8f4c, 0.1);
    stems.push(stem);

    const color = petalColors[Math.floor(rng.next() * petalColors.length)];
    const head = new THREE.SphereGeometry(0.052, 8, 6);
    head.translate(x, h + 0.19, z);
    paintGeometry(head, color, 0.08);
    heads.push(head);

    const core = new THREE.SphereGeometry(0.02, 6, 5);
    core.translate(x, h + 0.215, z);
    paintGeometry(core, 0xf7e9b0, 0.06);
    heads.push(core);
  }
  group.add(new THREE.Mesh(mergePainted(stems), stemMat));
  group.add(new THREE.Mesh(mergePainted(heads), petalMat));

  // ---- grass tufts ------------------------------------------------------
  const tufts: THREE.BufferGeometry[] = [];
  const forbidden: Array<[number, number, number]> = [
    [-1.35, -0.55, 1.9], // house
    [2.5, -2.0, 1.1], // windmill
    ...treeSpecs.map((t) => [t.x, t.z, 0.55 * t.s + 0.35] as [number, number, number]),
  ];
  let placed = 0;
  let guard = 0;
  while (placed < 26 && guard < 400) {
    guard++;
    const a = rng.range(0, TAU);
    const rad = Math.sqrt(rng.next()) * 4.75;
    const x = Math.sin(a) * rad;
    const z = Math.cos(a) * rad;
    const pr = Math.hypot(x - ISLAND.pond.x, z - ISLAND.pond.z);
    if (pr < ISLAND.pond.r + ISLAND.pond.shore + 0.3) continue;
    if (forbidden.some(([fx, fz, fr]) => Math.hypot(x - fx, z - fz) < fr)) continue;
    // keep off the stepping stones
    const pxDist = bezierDist(start, ctrl, gate, x, z);
    if (pxDist < 0.42) continue;
    const h = terrainHeight(x, z);
    const g = new THREE.ConeGeometry(rng.range(0.05, 0.1), rng.range(0.2, 0.34), 5);
    g.rotateX(rng.range(-0.25, 0.25));
    g.rotateZ(rng.range(-0.25, 0.25));
    g.translate(x, h + 0.1, z);
    paintGeometry(g, 0x6fae53, 0.22);
    tufts.push(g);
    placed++;
  }
  group.add(new THREE.Mesh(mergePainted(tufts), tuftMat));

  // ---- floating companion islets ---------------------------------------
  const isletA = miniIslet(rng, 1, true);
  isletA.position.set(9.4, -3.4, -6.2);
  group.add(isletA);
  companions.push({ group: isletA, baseY: -3.4, phase: 0 });

  const isletB = miniIslet(rng, 0.62, false);
  isletB.position.set(-7.9, -4.6, 3.6);
  group.add(isletB);
  companions.push({ group: isletB, baseY: -4.6, phase: 2.4 });

  return { group, swayers, companions };
}

/** Rough distance from a point to a quadratic bezier curve (sampled). */
function bezierDist(
  start: THREE.Vector2,
  ctrl: THREE.Vector2,
  end: THREE.Vector2,
  x: number,
  z: number,
): number {
  let best = Infinity;
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const mt = 1 - t;
    const bx = mt * mt * start.x + 2 * mt * t * ctrl.x + t * t * end.x;
    const bz = mt * mt * start.y + 2 * mt * t * ctrl.y + t * t * end.y;
    const d = Math.hypot(bx - x, bz - z);
    if (d < best) best = d;
  }
  return best;
}
