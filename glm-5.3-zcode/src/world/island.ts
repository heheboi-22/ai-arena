import * as THREE from 'three';
import { lerp, makeValueNoise, smoothstep } from '../lib/math';
import { LAYOUT } from './layout';

export interface Island {
  group: THREE.Group;
  /** Deterministic ground height at x/z - the exact formula the mesh was built from. */
  topY: (x: number, z: number) => number;
}

const R0 = LAYOUT.islandRadius;
const S = 64; // angular segments around the island

/**
 * A floating island: a meadow disc with an irregular silhouette on top of a
 * sculpted, craggy rock cone. One height field drives both the mesh and object
 * placement, so the pond bowl, house plateau and windmill mound carved into
 * the terrain are exactly where those props later stand.
 */
export function makeIsland(): Island {
  const noise = makeValueNoise(LAYOUT.islandSeed);
  const group = new THREE.Group();

  const topY = (x: number, z: number): number => {
    const d = Math.hypot(x, z) / R0;
    let y = 0.38 * (1 - d * d); // gentle central dome
    y += (noise(x * 0.45 + 11, z * 0.45 + 5) - 0.5) * 0.5 * (1 - d * 0.5); // meadow bumps
    y -= smoothstep((d - 0.94) / 0.06) * 0.07; // tuck the rim down toward the rock

    const dp = Math.hypot(x - LAYOUT.pond.x, z - LAYOUT.pond.z);
    y -= LAYOUT.pond.bowlDepth * smoothstep(1 - dp / LAYOUT.pond.bowlRadius);

    const dh = Math.hypot(x - LAYOUT.house.x, z - LAYOUT.house.z);
    y = lerp(y, 0.16, 0.85 * smoothstep(1 - dh / 2.5));

    const dm = Math.hypot(x - LAYOUT.windmill.x, z - LAYOUT.windmill.z);
    y += LAYOUT.windmill.moundHeight * smoothstep(1 - dm / LAYOUT.windmill.moundRadius);

    return y;
  };

  // Irregular silhouette radius per angular segment.
  const silhouette = (i: number): number => {
    const a = (i / S) * Math.PI * 2;
    return R0 * (0.87 + 0.16 * noise(Math.cos(a) * 1.3 + 3, Math.sin(a) * 1.3 + 7));
  };

  const grassLight = new THREE.Color(0xa9cd7f);
  const grassDeep = new THREE.Color(0x5c9a4e);
  const dirt = new THREE.Color(0xa58258);
  const rockTop = new THREE.Color(0x9b7d5c);
  const rockDeep = new THREE.Color(0x4e4034);
  const rockGray = new THREE.Color(0x76716a);
  const tmp = new THREE.Color();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.95,
    metalness: 0,
  });

  const makeMesh = (positions: number[], colors: number[], indices: number[]): THREE.Mesh => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  // --- meadow top ------------------------------------------------------------
  {
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];

    const push = (x: number, y: number, z: number): number => {
      pos.push(x, y, z);
      const tone = noise(x * 0.85 + 21, z * 0.85 + 13);
      tmp.copy(grassDeep).lerp(grassLight, tone);
      tmp.lerp(dirt, smoothstep((Math.hypot(x, z) / R0 - 0.85) / 0.15) * 0.85);
      col.push(tmp.r, tmp.g, tmp.b);
      return pos.length / 3 - 1;
    };

    const K = 8; // radial rings
    push(0, topY(0, 0), 0);
    for (let k = 1; k <= K; k++) {
      const t = k / K;
      for (let i = 0; i < S; i++) {
        const a = (i / S) * Math.PI * 2;
        const r = silhouette(i) * t;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        push(x, topY(x, z), z);
      }
    }
    const ring = (k: number) => 1 + (k - 1) * S;
    for (let i = 0; i < S; i++) idx.push(0, ring(1) + ((i + 1) % S), ring(1) + i);
    for (let k = 1; k < K; k++) {
      for (let i = 0; i < S; i++) {
        const j = (i + 1) % S;
        const a = ring(k) + i;
        const b = ring(k) + j;
        const c = ring(k + 1) + i;
        const d = ring(k + 1) + j;
        idx.push(a, d, c, a, b, d);
      }
    }

    group.add(makeMesh(pos, col, idx));
  }

  // --- craggy rock underside ---------------------------------------------------
  {
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const M = 9;
    const tipX = -0.85;
    const tipZ = -0.55;

    const depthAt = (i: number): number =>
      5.4 * (0.82 + 0.36 * noise(Math.cos((i / S) * Math.PI * 2) * 1.5 + 17, Math.sin((i / S) * Math.PI * 2) * 1.5 + 23));

    const push = (x: number, y: number, z: number, t: number, grayness: number): number => {
      pos.push(x, y, z);
      tmp.copy(rockTop).lerp(rockDeep, smoothstep(t));
      tmp.lerp(rockGray, grayness);
      col.push(tmp.r, tmp.g, tmp.b);
      return pos.length / 3 - 1;
    };

    for (let j = 0; j <= M; j++) {
      const t = j / M;
      for (let i = 0; i < S; i++) {
        const a = (i / S) * Math.PI * 2;
        const jag = 0.86 + 0.3 * noise(Math.cos(a) * 2.4 + t * 3.3, Math.sin(a) * 2.4 + 9 + t * 2.1);
        const shrink = j === 0 ? 1 : Math.pow(1 - t, 0.72) * jag;
        const r = silhouette(i) * shrink;
        const drift = t * t;
        const x = Math.cos(a) * r + tipX * drift;
        const z = Math.sin(a) * r + tipZ * drift;
        const y = j === 0 ? topY(x, z) : -depthAt(i) * Math.pow(t, 1.12);
        const grayness = noise(Math.cos(a) * 3.1 + 31 * t, Math.sin(a) * 3.1 + 5) * 0.45;
        push(x, y, z, t, grayness);
      }
    }
    const ring = (j: number) => j * S;
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < S; i++) {
        const k = (i + 1) % S;
        const a = ring(j) + i;
        const b = ring(j) + k;
        const c = ring(j + 1) + i;
        const d = ring(j + 1) + k;
        idx.push(a, b, d, a, d, c);
      }
    }
    const tipIndex = push(tipX * 1.25, -5.9, tipZ * 1.25, 1, 0.1);
    for (let i = 0; i < S; i++) idx.push(ring(M) + i, ring(M) + ((i + 1) % S), tipIndex);

    group.add(makeMesh(pos, col, idx));
  }

  return { group, topY };
}
