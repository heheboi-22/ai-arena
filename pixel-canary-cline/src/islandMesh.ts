import * as THREE from 'three';
import { groundAt, silhouette, WATER_LEVEL } from './island';
import { clamp, fbm2, makeRandom } from './noise';

/** Vertex colours let a single material carry grass, soil, root zone and rock. */
const GRASS_HIGH = new THREE.Color('#a5c471');
const GRASS_LOW = new THREE.Color('#58824a');
const SOIL = new THREE.Color('#7b5636');
const ROOT = new THREE.Color('#4c3524');
const ROCK = new THREE.Color('#8c8271');
const ROCK_DEEP = new THREE.Color('#463f38');

const RING = 128;

function polarIndex(ring: number, seg: number): number {
  return ring * RING + (((seg % RING) + RING) % RING);
}

function colorAttribute(count: number): THREE.BufferAttribute {
  return new THREE.BufferAttribute(new Float32Array(count * 3), 3);
}

function quadRing(indices: number[], rings: number, mirrored: boolean): void {
  for (let ring = 0; ring < rings; ring += 1) {
    for (let seg = 0; seg < RING; seg += 1) {
      const a = polarIndex(ring, seg);
      const b = polarIndex(ring, seg + 1);
      const d = polarIndex(ring + 1, seg + 1);
      const e = polarIndex(ring + 1, seg);
      if (mirrored) indices.push(a, d, b, a, e, d);
      else indices.push(a, b, d, a, d, e);
    }
  }
}

function buildCap(): THREE.BufferGeometry {
  const rings = 34;
  const count = (rings + 1) * RING;
  const positions = new Float32Array(count * 3);
  const colors = colorAttribute(count);
  const c = new THREE.Color();

  for (let ring = 0; ring <= rings; ring += 1) {
    const u = ring / rings;
    for (let seg = 0; seg < RING; seg += 1) {
      const theta = (seg / RING) * Math.PI * 2;
      const radius = u * silhouette(theta) * 0.985;
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      const y = groundAt(x, z);
      const i = polarIndex(ring, seg) * 3;
      positions[i] = x;
      positions[i + 1] = y;
      positions[i + 2] = z;

      const rise = groundAt(x + 0.12, z) - y + (groundAt(x, z + 0.12) - y);
      c.copy(GRASS_LOW).lerp(GRASS_HIGH, clamp(1 - rise / 1.2, 0, 1) * 0.72 + 0.2);
      c.offsetHSL(0, 0, 0.05 * fbm2(x * 2.4 + 5, z * 2.4 - 3, 2));
      c.lerp(SOIL, clamp((u - 0.9) / 0.1, 0, 1) * 0.85);
      if (y < WATER_LEVEL + 0.16) c.lerp(SOIL, 0.7);
      colors.setXYZ(i / 3, c.r, c.g, c.b);
    }
  }

  const indices: number[] = [];
  quadRing(indices, rings, false);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', colors);
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}


/** One ring of the sculpted, tapering underside. */
function undersideRing(t: number): { y: number; scale: number; lumps: number; freq: number } {
  if (t < 0.18) {
    return { y: 0.18 - t * 1.35, scale: 1.02 - t * 0.04, lumps: 0.05, freq: 2.2 };
  }
  const s = clamp((t - 0.18) / 0.82, 0, 1);
  return {
    y: -0.06 - 3.62 * Math.pow(s, 1.18),
    scale: 0.98 * Math.pow(1 - s, 0.72) * (1 + 0.16 * Math.sin(s * 7.4)),
    lumps: 0.05 + 0.34 * Math.sin(s * 5.1 + 0.6),
    freq: 2.2 + 2.6 * s,
  };
}

function buildUnderside(): THREE.BufferGeometry {
  const rings = 26;
  const count = (rings + 1) * RING;
  const positions = new Float32Array(count * 3);
  const colors = colorAttribute(count);
  const tmp = new THREE.Color();

  for (let ring = 0; ring <= rings; ring += 1) {
    const t = ring / rings;
    const prof = undersideRing(t);
    for (let seg = 0; seg < RING; seg += 1) {
      const theta = (seg / RING) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const lump =
        prof.lumps * fbm2(cos * prof.freq + t * 1.7, sin * prof.freq - t * 2.3, 3) +
        0.06 * fbm2(cos * 6.1, sin * 6.1 + t * 4, 2);
      const radius =
        silhouette(theta) *
        0.965 *
        // Top rings hug the inside of the grass cap so no rock peeks through the rim;
        // lower ones are free to bulge past the silhouette.
        Math.min(t < 0.12 ? 0.97 : 1.06, Math.max(0.002, prof.scale + lump));
      const i = polarIndex(ring, seg);
      positions[i * 3] = cos * radius;
      positions[i * 3 + 1] = prof.y;
      positions[i * 3 + 2] = sin * radius;

      tmp.copy(SOIL).lerp(ROOT, clamp(t / 0.3, 0, 1));
      tmp.lerp(ROCK, clamp((t - 0.14) / 0.34, 0, 1));
      tmp.lerp(ROCK_DEEP, clamp((t - 0.55) / 0.5, 0, 1) * 0.75);
      tmp.offsetHSL(0, 0, 0.05 * fbm2(cos * 5 + 2, sin * 5 - 4, 2));
      colors.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
  }

  const indices: number[] = [];
  // Mirrored winding: the bowl has to face outward and downward.
  quadRing(indices, rings, true);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', colors);
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Stones hanging beneath the island sell the "clipped cliff" read. */
function danglingRocks(): THREE.InstancedMesh {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ color: '#6f6659', roughness: 0.98, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, 11);
  const rand = makeRandom(9127);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();

  for (let i = 0; i < 11; i += 1) {
    const theta = rand() * Math.PI * 2;
    const t = 0.26 + rand() * 0.46;
    const prof = undersideRing(t);
    const radius = silhouette(theta) * 0.9 * Math.max(0.02, prof.scale) * (0.55 + rand() * 0.35);
    const s = 0.12 + rand() * 0.28;
    pos.set(Math.cos(theta) * radius, prof.y - s * 0.6, Math.sin(theta) * radius);
    scale.set(s * (0.8 + rand() * 0.6), s * (0.7 + rand() * 0.8), s * (0.8 + rand() * 0.6));
    e.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    mesh.setMatrixAt(i, m.compose(pos, q.setFromEuler(e), scale));
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  return mesh;
}

export function buildIsland(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'island';

  const cap = new THREE.Mesh(
    buildCap(),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, flatShading: true }),
  );
  cap.receiveShadow = true;
  cap.castShadow = true;
  group.add(cap);

  const underside = new THREE.Mesh(
    buildUnderside(),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.99, metalness: 0, flatShading: true }),
  );
  underside.castShadow = true;
  underside.receiveShadow = true;
  group.add(underside);

  group.add(danglingRocks());
  return group;
}
