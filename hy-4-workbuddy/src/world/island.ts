import * as THREE from 'three';
import { mulberry32 } from '../util/math';
import { PAL } from './palette';
import { standard, wetness } from './materials';
import { grassTexture } from './textures';

export const ISLAND_RX = 5.35;
export const ISLAND_RZ = 4.25;

/** Deterministic coastline. Shared with rain (landing test) and plant scattering. */
export function coastRadius(a: number): number {
  return 1
    + 0.072 * Math.sin(3 * a + 0.7)
    + 0.050 * Math.sin(5 * a - 1.1)
    + 0.028 * Math.sin(8 * a + 2.3)
    + 0.016 * Math.sin(13 * a - 0.4);
}

export function coastPoint(a: number, scale = 1, y = 0): THREE.Vector3 {
  const r = coastRadius(a) * scale;
  return new THREE.Vector3(Math.cos(a) * ISLAND_RX * r, y, Math.sin(a) * ISLAND_RZ * r);
}

/** Is this XZ point on the grass? Margin shrinks the outline. */
export function onIsland(x: number, z: number, margin = 0): boolean {
  const nx = x / ISLAND_RX;
  const nz = z / ISLAND_RZ;
  const a = Math.atan2(nz, nx);
  return Math.hypot(nx, nz) < coastRadius(a) * (1 - margin);
}

const N = 96;

function buildTop(): THREE.Mesh {
  const rings = [0, 0.38, 0.72, 1];
  const pos: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const push = (x: number, y: number, z: number): number => {
    const i = pos.length / 3;
    pos.push(x, y, z);
    uv.push(x / (ISLAND_RX * 2.2) + 0.5, z / (ISLAND_RZ * 2.2) + 0.5);
    const n = 0.5 + 0.5 * Math.sin(x * 1.9 + Math.cos(z * 1.4)) * Math.cos(z * 1.7);
    const shade = 0.88 + 0.16 * n;
    col.push(shade * 0.99, shade, shade * 0.92);
    return i;
  };
  push(0, 0, 0);
  for (const s of rings.slice(1)) {
    for (let j = 0; j < N; j++) {
      const p = coastPoint((j / N) * Math.PI * 2, s, 0);
      push(p.x, p.y, p.z);
    }
  }
  for (let j = 0; j < N; j++) idx.push(0, 1 + ((j + 1) % N), 1 + j);
  for (let r = 0; r < rings.length - 2; r++) {
    const a0 = 1 + r * N;
    const b0 = a0 + N;
    for (let j = 0; j < N; j++) {
      const j1 = (j + 1) % N;
      idx.push(a0 + j, b0 + j1, b0 + j, a0 + j, a0 + j1, b0 + j1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();

  const mat = standard('#ffffff', {
    map: grassTexture(),
    vertexColors: true,
    roughness: 0.96,
  });
  wetness.track(mat, 0.85);
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.name = 'island-top';
  return mesh;
}

interface Layer { y: number; s: number; c: THREE.Color }

const LAYERS: Layer[] = [
  { y: -0.02, s: 1.020, c: PAL.grassEdge },
  { y: -0.22, s: 1.005, c: PAL.grassDark },
  { y: -0.38, s: 0.980, c: PAL.soil },
  { y: -0.68, s: 0.950, c: PAL.soilDark },
  { y: -1.16, s: 0.885, c: PAL.rockHigh },
  { y: -1.78, s: 0.745, c: PAL.rockMid },
  { y: -2.42, s: 0.560, c: PAL.rockMid.clone().multiplyScalar(0.84) },
  { y: -3.04, s: 0.360, c: PAL.rockLow },
  { y: -3.58, s: 0.165, c: PAL.rockDeep },
];

function buildCliff(): THREE.Mesh {
  const pos: number[] = [];
  const idx: number[] = [];
  const faceLayers: number[] = [];
  for (let i = 0; i < LAYERS.length; i++) {
    const L = LAYERS[i];
    for (let j = 0; j < N; j++) {
      const a = (j / N) * Math.PI * 2;
      const wobble = 1 + (i === 0 || i === 1 ? 0.012 : 0.055) * Math.sin(5 * a + i * 0.9)
        + 0.022 * Math.sin(11 * a - i * 1.3);
      const p = coastPoint(a, L.s * wobble, 0);
      const yJitter = i < 2 ? 0 : 0.075 * Math.sin(4 * a + i * 1.2);
      pos.push(p.x, L.y + yJitter, p.z);
    }
  }
  const tip = pos.length / 3;
  pos.push(0.18, -4.08, -0.12);

  for (let i = 0; i < LAYERS.length - 1; i++) {
    const a0 = i * N;
    const b0 = a0 + N;
    for (let j = 0; j < N; j++) {
      const j1 = (j + 1) % N;
      // Winding is outward for a downward-tapering surface.
      idx.push(a0 + j, b0 + j, a0 + j1, a0 + j1, b0 + j, b0 + j1);
      faceLayers.push(i, i);
    }
  }
  const last = (LAYERS.length - 1) * N;
  for (let j = 0; j < N; j++) {
    idx.push(last + j, tip, last + ((j + 1) % N));
    faceLayers.push(LAYERS.length - 1);
  }

  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  indexed.setIndex(idx);
  const g = indexed.toNonIndexed();

  // One colour per facet keeps the rock reading as carved, not smooth-shaded.
  const colors = new Float32Array(g.getAttribute('position').count * 3);
  const rng = mulberry32(77);
  for (let f = 0; f < faceLayers.length; f++) {
    const li = faceLayers[f];
    const a = LAYERS[li].c;
    const b = LAYERS[Math.min(li + 1, LAYERS.length - 1)].c;
    const v = 0.82 + rng() * 0.34;
    for (let k = 0; k < 3; k++) {
      const o = (f * 3 + k) * 3;
      colors[o] = (a.r + b.r) * 0.5 * v;
      colors[o + 1] = (a.g + b.g) * 0.5 * v;
      colors[o + 2] = (a.b + b.b) * 0.5 * v;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();

  const mat = standard('#ffffff', { vertexColors: true, flatShading: true, roughness: 0.98 });
  wetness.track(mat, 0.7);
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'island-cliff';
  return mesh;
}

function buildRockChunks(): THREE.Group {
  const group = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const rng = mulberry32(909);
  for (let i = 0; i < 20; i++) {
    const a = rng() * Math.PI * 2;
    const li = 2 + Math.floor(rng() * (LAYERS.length - 3));
    const L = LAYERS[li];
    const p = coastPoint(a, L.s * (0.93 + rng() * 0.08), L.y + (rng() - 0.5) * 0.35);
    const s = 0.16 + rng() * 0.36;
    const m = standard(rng() > 0.5 ? PAL.rockMid : PAL.rockLow, { flatShading: true, roughness: 1 });
    wetness.track(m, 0.6);
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.copy(p);
    mesh.scale.set(s * (1 + rng()), s * (0.6 + rng() * 0.7), s * (1 + rng()));
    mesh.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

export function createIsland(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'island';
  group.add(buildCliff(), buildTop(), buildRockChunks());
  return group;
}
