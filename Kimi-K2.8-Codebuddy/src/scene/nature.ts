import * as THREE from 'three';
import { POND } from '../config';
import { hash1, mulberry32 } from '../utils';

export interface TreeRef {
  group: THREE.Group;
  phase: number;
  maxSway: number;
}

export interface NatureRefs {
  group: THREE.Group;
  trees: TreeRef[];
  sway: (t: number, wind: number, motionScale: number) => void;
}

const TRUNK = '#7a5230';
const GREENS = ['#6fbf67', '#5da84f', '#82cc70', '#4e8f4a', '#67b35c'];
const PINE = '#4a8746';

const trunkGeo = new THREE.CylinderGeometry(0.09, 0.15, 1, 7);
const blobGeo = new THREE.IcosahedronGeometry(1, 1);
const pineGeo = new THREE.ConeGeometry(1, 1, 8);
const rockGeo = new THREE.IcosahedronGeometry(1, 0);
const stoneGeo = new THREE.CylinderGeometry(1, 1.08, 1, 9);
const postGeo = new THREE.BoxGeometry(0.07, 0.46, 0.07);
const railGeo = new THREE.BoxGeometry(1, 0.05, 0.045);
const stemGeo = new THREE.CylinderGeometry(0.014, 0.02, 0.17, 5);
const headGeo = new THREE.IcosahedronGeometry(0.055, 0);
const cherryGeo = new THREE.SphereGeometry(0.05, 8, 6);

function blobGeometry(seed: number, radius: number): THREE.BufferGeometry {
  const geo = blobGeo.clone();
  const pos = geo.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = hash1(seed + i * 0.37);
    v.multiplyScalar(radius * (0.82 + 0.28 * n));
    pos.setXYZ(i, v.x, v.y * 0.92, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function makeBlobTree(seed: number, scale: number, cherry: boolean): THREE.Group {
  const rand = mulberry32(seed);
  const tree = new THREE.Group();
  const trunkH = 0.85 * scale;
  const trunk = new THREE.Mesh(trunkGeo, new THREE.MeshStandardMaterial({ color: TRUNK, roughness: 0.9, flatShading: true }));
  trunk.scale.set(scale, trunkH, scale);
  trunk.position.y = trunkH / 2;
  tree.add(trunk);

  const foliage = new THREE.Group();
  const blobs = 2 + Math.floor(rand() * 2);
  for (let b = 0; b < blobs; b++) {
    const r = (0.5 + rand() * 0.28) * scale;
    const geo = blobGeometry(seed * 13 + b * 7, r);
    const mat = new THREE.MeshStandardMaterial({
      color: GREENS[Math.floor(rand() * GREENS.length)],
      roughness: 0.9,
      flatShading: true,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(
      (rand() - 0.5) * 0.5 * scale,
      trunkH + r * 0.75 + (rand() - 0.5) * 0.25 * scale + b * 0.16 * scale,
      (rand() - 0.5) * 0.5 * scale,
    );
    foliage.add(m);

    if (cherry && b === 0) {
      const cherryMat = new THREE.MeshStandardMaterial({ color: '#d94f45', roughness: 0.5 });
      for (let c = 0; c < 6; c++) {
        const ch = new THREE.Mesh(cherryGeo, cherryMat);
        const ca = rand() * Math.PI * 2;
        const cr = r * (0.75 + rand() * 0.25);
        ch.position.set(
          m.position.x + Math.cos(ca) * cr,
          m.position.y + (rand() - 0.3) * r * 0.7,
          m.position.z + Math.sin(ca) * cr,
        );
        foliage.add(ch);
      }
    }
  }
  tree.add(foliage);
  return tree;
}

function makePineTree(seed: number, scale: number): THREE.Group {
  const rand = mulberry32(seed);
  const tree = new THREE.Group();
  const trunkH = 0.5 * scale;
  const trunk = new THREE.Mesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#6e4527', roughness: 0.9, flatShading: true }));
  trunk.scale.set(scale * 0.85, trunkH, scale * 0.85);
  trunk.position.y = trunkH / 2;
  tree.add(trunk);

  const mat = new THREE.MeshStandardMaterial({
    color: rand() > 0.5 ? PINE : '#3f7a44',
    roughness: 0.92,
    flatShading: true,
  });
  const layers = 3;
  for (let i = 0; i < layers; i++) {
    const f = i / layers;
    const r = (0.62 - f * 0.34) * scale;
    const h = 0.62 * scale;
    const cone = new THREE.Mesh(pineGeo, mat);
    cone.scale.set(r, h, r);
    cone.position.y = trunkH + h * 0.5 + i * 0.4 * scale;
    tree.add(cone);
  }
  return tree;
}

function makeRock(seed: number, scale: number): THREE.Mesh {
  const geo = rockGeo.clone();
  const pos = geo.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = hash1(seed + i * 0.53);
    v.multiplyScalar(scale * (0.75 + 0.4 * n));
    pos.setXYZ(i, v.x, v.y * 0.72, v.z);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: '#8b8578', roughness: 0.95, flatShading: true }),
  );
  mesh.rotation.y = hash1(seed) * Math.PI * 2;
  return mesh;
}

/** Hand-composed layout — checked against island radius, house and pond. */
const TREES: Array<{ kind: 'blob' | 'pine' | 'cherry'; x: number; z: number; s: number }> = [
  { kind: 'pine', x: -4.35, z: -0.5, s: 1.25 },
  { kind: 'blob', x: -1.35, z: 3.35, s: 1.05 },
  { kind: 'cherry', x: 5.0, z: 0.8, s: 0.95 },
  { kind: 'pine', x: -1.6, z: -4.05, s: 0.85 },
  { kind: 'blob', x: 0.95, z: 4.05, s: 0.8 },
  { kind: 'pine', x: 4.45, z: -2.15, s: 0.7 },
];

const ROCKS: Array<{ x: number; z: number; s: number }> = [
  { x: -3.35, z: 0.95, s: 0.34 },
  { x: -0.65, z: 2.75, s: 0.22 },
  { x: -3.1, z: -3.75, s: 0.5 },
  { x: 3.4, z: 0.2, s: 0.26 },
  { x: 0.35, z: -4.35, s: 0.3 },
];

/** Stepping-stone path from the door to the pond shore. */
const PATH_POINTS = [
  new THREE.Vector3(0.95, 0, -0.65),
  new THREE.Vector3(0.35, 0, 0.0),
  new THREE.Vector3(-0.35, 0, 0.55),
  new THREE.Vector3(-0.95, 0, 0.95),
  new THREE.Vector3(-1.25, 0, 1.2),
];

const FLOWER_COLORS = ['#f2a7c3', '#f7e08a', '#ffffff', '#c9a7f2', '#f29b7d', '#f6f0e0'];

export function createNature(): NatureRefs {
  const group = new THREE.Group();
  group.name = 'nature';
  const trees: TreeRef[] = [];

  // trees
  TREES.forEach((t, i) => {
    const tree =
      t.kind === 'pine'
        ? makePineTree(100 + i * 17, t.s)
        : makeBlobTree(100 + i * 17, t.s, t.kind === 'cherry');
    tree.position.set(t.x, 0, t.z);
    tree.rotation.y = hash1(i * 3.3) * Math.PI * 2;
    tree.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    group.add(tree);
    trees.push({ group: tree, phase: hash1(i * 7.7) * Math.PI * 2, maxSway: 1 });
  });

  // rocks
  ROCKS.forEach((r, i) => {
    const rock = makeRock(300 + i * 11, r.s);
    rock.position.set(r.x, r.s * 0.28, r.z);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  });

  // stepping stones along a small catmull-rom curve
  const curve = new THREE.CatmullRomCurve3(PATH_POINTS);
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#b8ad9a', roughness: 0.95, flatShading: true });
  const N_STONES = 12;
  const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, N_STONES);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eul = new THREE.Euler();
  const rand = mulberry32(42);
  for (let i = 0; i < N_STONES; i++) {
    const p = curve.getPoint(i / (N_STONES - 1));
    const s = 0.14 + rand() * 0.05;
    eul.set(0, rand() * Math.PI, 0);
    q.setFromEuler(eul);
    m4.compose(
      new THREE.Vector3(p.x, 0.028, p.z),
      q,
      new THREE.Vector3(s, 0.055, s * (0.85 + rand() * 0.3)),
    );
    stones.setMatrixAt(i, m4);
  }
  stones.receiveShadow = true;
  group.add(stones);

  // fence flanking the path near the house
  const fence = new THREE.Group();
  const fenceMat = new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.9 });
  const posts = [
    new THREE.Vector3(0.62, 0, 0.28),
    new THREE.Vector3(0.4, 0, 0.78),
    new THREE.Vector3(0.16, 0, 1.28),
  ];
  posts.forEach((p) => {
    const post = new THREE.Mesh(postGeo, fenceMat);
    post.position.set(p.x, 0.23, p.z);
    post.castShadow = true;
    fence.add(post);
  });
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i];
    const b = posts[i + 1];
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const len = a.distanceTo(b) - 0.05;
    const rail = new THREE.Mesh(railGeo, fenceMat);
    rail.scale.x = len;
    rail.position.set(mid.x, 0.34, mid.z);
    rail.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
    rail.castShadow = true;
    fence.add(rail);
    const rail2 = rail.clone();
    rail2.position.y = 0.18;
    fence.add(rail2);
  }
  group.add(fence);

  // flowers — instanced stems + heads
  const randF = mulberry32(7);
  const N_FLOWERS = 54;
  const stems = new THREE.InstancedMesh(
    stemGeo,
    new THREE.MeshStandardMaterial({ color: '#4c7a3f', roughness: 0.9 }),
    N_FLOWERS,
  );
  const heads = new THREE.InstancedMesh(
    headGeo,
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }),
    N_FLOWERS,
  );
  const color = new THREE.Color();
  let placed = 0;
  let guard = 0;
  while (placed < N_FLOWERS && guard++ < 800) {
    const a = randF() * Math.PI * 2;
    const r = 0.8 + Math.sqrt(randF()) * 4.4;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const dHouse = Math.hypot(x - 1.9, z + 1.4);
    const dPond = Math.hypot(x - POND.x, z - POND.z);
    if (dHouse < 2.1 || dPond < 1.75) continue;
    const s = 0.8 + randF() * 0.5;
    eul.set(0, randF() * Math.PI, 0);
    q.setFromEuler(eul);
    m4.compose(new THREE.Vector3(x, 0.085 * s, z), q, new THREE.Vector3(s, s, s));
    stems.setMatrixAt(placed, m4);
    m4.compose(new THREE.Vector3(x, 0.19 * s, z), q, new THREE.Vector3(s, s, s));
    heads.setMatrixAt(placed, m4);
    color.set(FLOWER_COLORS[Math.floor(randF() * FLOWER_COLORS.length)]);
    heads.setColorAt(placed, color);
    placed++;
  }
  stems.count = placed;
  heads.count = placed;
  stems.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
  group.add(stems, heads);

  // per-tree sway: whole-tree lean plus a touch of foliage shuffle
  const sway = (t: number, wind: number, motionScale: number): void => {
    const amp = 0.045 * Math.pow(wind, 1.2) * motionScale;
    for (const tree of trees) {
      const g = tree.group;
      g.rotation.z = Math.sin(t * 1.35 + tree.phase) * amp;
      g.rotation.x = Math.cos(t * 1.05 + tree.phase * 1.31) * amp * 0.7;
    }
  };

  return { group, trees, sway };
}
