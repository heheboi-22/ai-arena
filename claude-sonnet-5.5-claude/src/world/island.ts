import * as THREE from 'three';
import { GeoBuilder } from '../util/geo';
import { mulberry32, range, smoothstep, TAU } from '../util/math';
import { fbm2, fbm3, noise3 } from '../util/noise';
import { ISLAND_DEPTH, rimRadius, terrainHeight } from './layout';
import { GROUND_HALF } from './terrainPaint';
import type { Materials } from './materials';

/**
 * The floating island itself, built as four lofted meshes that share one
 * silhouette: the grassy top, the turf lip with its irregular drips, the
 * faceted rock body that tapers to a tail, and a few hanging stalactites.
 */

export interface Island {
  /** Everything that sits on the island hangs off this group; it bobs gently. */
  group: THREE.Group;
  /** Little rocks drifting around the underside, animated separately. */
  update(time: number, reducedMotion: boolean): void;
  dispose(): void;
}

const TOP_SEGMENTS = 192;
const TOP_RINGS = 48;
const SKIRT_SEGMENTS = 384;
const SKIRT_LEVELS = 8;
const BODY_SEGMENTS = 88;
const BODY_RINGS = 24;

const TIP_DRIFT = { x: 0.55, z: -0.3 };

const rimHeight = (theta: number): number => {
  const r = rimRadius(theta);
  return terrainHeight(Math.cos(theta) * r, Math.sin(theta) * r);
};

function buildTop(): THREE.BufferGeometry {
  const M = TOP_SEGMENTS;
  const K = TOP_RINGS;
  const pos = new Float32Array((1 + M * K) * 3);
  const uv = new Float32Array((1 + M * K) * 2);
  const put = (i: number, x: number, z: number): void => {
    pos[i * 3] = x;
    pos[i * 3 + 1] = terrainHeight(x, z);
    pos[i * 3 + 2] = z;
    uv[i * 2] = (x + GROUND_HALF) / (2 * GROUND_HALF);
    uv[i * 2 + 1] = 1 - (z + GROUND_HALF) / (2 * GROUND_HALF);
  };
  put(0, 0, 0);
  const rim: number[] = [];
  for (let j = 0; j < M; j++) rim.push(rimRadius((j / M) * TAU));
  for (let k = 1; k <= K; k++) {
    const rho = 1 - Math.pow(1 - k / K, 1.4);
    for (let j = 0; j < M; j++) {
      const th = (j / M) * TAU;
      put(1 + (k - 1) * M + j, Math.cos(th) * rim[j] * rho, Math.sin(th) * rim[j] * rho);
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < M; j++) idx.push(0, 1 + ((j + 1) % M), 1 + j);
  for (let k = 1; k < K; k++) {
    for (let j = 0; j < M; j++) {
      const j2 = (j + 1) % M;
      const a = 1 + (k - 1) * M + j;
      const b = 1 + (k - 1) * M + j2;
      const c = 1 + k * M + j;
      const d = 1 + k * M + j2;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** How far the turf hangs below the rim at angle `theta`: a row of soft tongues. */
function dripDepth(theta: number): number {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const broad = fbm2(c * 2.6 + 11, s * 2.6 + 4, 3, 21);
  const tongue = Math.pow(Math.max(0, Math.sin(theta * 31 + broad * 14)), 2);
  const tongueLong = Math.pow(Math.max(0, Math.sin(theta * 17 + 1.3 + broad * 9)), 3);
  const longMask = smoothstep(0.5, 0.82, broad);
  return 0.17 + 0.13 * broad + 0.2 * tongue + 0.32 * tongueLong * longMask;
}

function buildSkirt(): THREE.BufferGeometry {
  const M = SKIRT_SEGMENTS;
  const L = SKIRT_LEVELS;
  const pos = new Float32Array(M * L * 3);
  const col = new Float32Array(M * L * 3);
  const top = new THREE.Color('#78b062');
  const bottom = new THREE.Color('#4a7d46');
  const tmp = new THREE.Color();
  for (let j = 0; j < M; j++) {
    const th = (j / M) * TAU;
    const R = rimRadius(th);
    const yTop = rimHeight(th);
    const depth = dripDepth(th);
    const shade = 0.94 + 0.12 * fbm2(Math.cos(th) * 5, Math.sin(th) * 5, 2, 3);
    for (let k = 0; k < L; k++) {
      const f = k / (L - 1);
      const s = 1 + 0.05 * Math.sin(Math.min(f * 1.15, 1) * Math.PI) - 0.03 * f * f;
      const i = j * L + k;
      pos[i * 3] = Math.cos(th) * R * s;
      pos[i * 3 + 1] = yTop - depth * f;
      pos[i * 3 + 2] = Math.sin(th) * R * s;
      tmp.copy(top).lerp(bottom, Math.pow(f, 0.8)).multiplyScalar(shade);
      col[i * 3] = tmp.r;
      col[i * 3 + 1] = tmp.g;
      col[i * 3 + 2] = tmp.b;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < M; j++) {
    const j2 = (j + 1) % M;
    for (let k = 0; k < L - 1; k++) {
      const a = j * L + k;
      const b = j2 * L + k;
      const c = j * L + k + 1;
      const d = j2 * L + k + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** A point on the rock body: `v` runs from 0 at the rim to 1 at the tip. */
function bodyPoint(theta: number, v: number, out = new THREE.Vector3()): THREE.Vector3 {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const R = rimRadius(theta);
  const profile = Math.pow(1 - v, 0.86) * (1 + 0.08 * Math.sin(Math.min(1, v * 3) * Math.PI));
  const n1 = fbm3(c * 1.25 + 4.2, v * 2.3 + 1.1, s * 1.25 + 8.8, 3, 41) - 0.5;
  const n2 = fbm3(c * 3.3 + 1.7, v * 5.5 + 6.2, s * 3.3 + 2.9, 3, 77) - 0.5;
  const ridge = Math.sin(v * 38 + n1 * 8) * 0.035 * (0.25 + v);
  // Column-like striations running down the rock.
  const columns = Math.sin(theta * 9 + n1 * 7) * 0.05 * smoothstep(0.1, 0.5, v) * (1 - v);
  const scale = Math.max(0.012, profile * (1 + n1 * 0.78 * Math.pow(v, 0.55) + n2 * 0.34 * v + columns) + ridge);
  const radius = R * scale;
  const drift = Math.pow(v, 1.7);
  const y = rimHeight(theta) - 0.06 - ISLAND_DEPTH * Math.pow(v, 0.92) + n2 * 1.1 * v * (1 - v);
  return out.set(TIP_DRIFT.x * drift + c * radius, y, TIP_DRIFT.z * drift + s * radius);
}

const SOIL = new THREE.Color('#8b6346');
const ROCK_LIGHT = new THREE.Color('#a39a8d');
const ROCK_DARK = new THREE.Color('#7b7367');
const ROCK_COOL = new THREE.Color('#68687a');
const MOSS = new THREE.Color('#7f9560');

function rockColor(theta: number, v: number, out: THREE.Color): THREE.Color {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const n1 = fbm3(c * 1.25 + 4.2, v * 2.3 + 1.1, s * 1.25 + 8.8, 3, 41) - 0.5;
  const band = 0.5 + 0.5 * Math.sin(v * 34 + n1 * 9);
  out.copy(ROCK_LIGHT).lerp(ROCK_DARK, band * 0.85);
  out.lerp(ROCK_COOL, smoothstep(0.25, 1, v) * 0.75);
  const moss = smoothstep(0.1, 0.45, n1 + 0.2) * (1 - smoothstep(0.1, 0.4, v));
  out.lerp(MOSS, moss * 0.45);
  out.lerp(SOIL, 1 - smoothstep(0.03, 0.17, v));
  const grain = 0.94 + 0.12 * fbm3(c * 9, v * 14, s * 9, 2, 5);
  return out.multiplyScalar(grain * (1 - 0.28 * v));
}

function buildBody(): THREE.BufferGeometry {
  const M = BODY_SEGMENTS;
  const K = BODY_RINGS;
  const ringVerts = M * K;
  const pos = new Float32Array((ringVerts + 1) * 3);
  const col = new Float32Array((ringVerts + 1) * 3);
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  for (let k = 0; k < K; k++) {
    const v = Math.pow(k / K, 1.12);
    for (let j = 0; j < M; j++) {
      const th = (j / M) * TAU;
      bodyPoint(th, v, p);
      if (k === 0) {
        // Tuck the first ring under the turf lip.
        p.x *= 0.985;
        p.z *= 0.985;
        p.y -= 0.03;
      }
      const i = k * M + j;
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;
      rockColor(th, v, c);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
  }
  const tip = ringVerts;
  pos[tip * 3] = TIP_DRIFT.x;
  pos[tip * 3 + 1] = -ISLAND_DEPTH - 0.2;
  pos[tip * 3 + 2] = TIP_DRIFT.z;
  rockColor(0, 1, c);
  col[tip * 3] = c.r;
  col[tip * 3 + 1] = c.g;
  col[tip * 3 + 2] = c.b;

  const idx: number[] = [];
  for (let k = 0; k < K - 1; k++) {
    for (let j = 0; j < M; j++) {
      const j2 = (j + 1) % M;
      const a = k * M + j;
      const b = k * M + j2;
      const cc = (k + 1) * M + j;
      const d = (k + 1) * M + j2;
      idx.push(a, b, cc, b, d, cc);
    }
  }
  for (let j = 0; j < M; j++) {
    const j2 = (j + 1) % M;
    idx.push((K - 1) * M + j, (K - 1) * M + j2, tip);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Hanging rock spikes that break up the silhouette of the underside. */
function buildStalactites(): THREE.BufferGeometry {
  const b = new GeoBuilder();
  const rng = mulberry32(88);
  const picks: Array<[number, number, number, number]> = [
    // theta, v, base radius, length
    [0.9, 0.4, 0.42, 1.55],
    [2.1, 0.5, 0.34, 1.35],
    [3.4, 0.38, 0.46, 1.7],
    [4.5, 0.46, 0.32, 1.25],
    [5.5, 0.34, 0.4, 1.3],
    [1.5, 0.66, 0.26, 1.1],
    [3.9, 0.7, 0.24, 1.0],
    [0.1, 0.58, 0.28, 1.15],
  ];
  const p = new THREE.Vector3();
  const color = new THREE.Color();
  for (const [theta, v, r, len] of picks) {
    bodyPoint(theta, v, p);
    rockColor(theta, v + 0.08, color);
    color.multiplyScalar(0.92);
    const geo = new THREE.ConeGeometry(r, len, 7, 2);
    // Roughen the spike so it reads as chipped stone rather than a perfect cone.
    const pa = geo.getAttribute('position');
    for (let i = 0; i < pa.count; i++) {
      const y = pa.getY(i);
      const w = 1 - (y + len / 2) / len;
      pa.setX(i, pa.getX(i) * (1 + (rng() - 0.5) * 0.28 * (1 - w)));
      pa.setZ(i, pa.getZ(i) * (1 + (rng() - 0.5) * 0.28 * (1 - w)));
    }
    b.add(geo, {
      at: [p.x - Math.cos(theta) * 0.05, p.y - len * 0.5 + 0.2, p.z - Math.sin(theta) * 0.05],
      rot: [Math.PI + (rng() - 0.5) * 0.3, rng() * TAU, (rng() - 0.5) * 0.3],
      color,
      noise: 0.1,
    });
    geo.dispose();
  }
  return b.build();
}

/** Roots and a few vines that hang from the longest tongues of turf, so the lip reads as soil. */
function buildRoots(): THREE.BufferGeometry {
  const b = new GeoBuilder();
  const rng = mulberry32(404);
  const bark = new THREE.Color('#7a5538');
  const leaf = new THREE.Color('#6fae5d');
  for (let i = 0; i < 22; i++) {
    // Favour the angles where the turf hangs lowest.
    let theta = rng() * TAU;
    for (let t = 0; t < 6; t++) {
      const cand = rng() * TAU;
      if (dripDepth(cand) > dripDepth(theta)) theta = cand;
    }
    const R = rimRadius(theta) * 1.0;
    const depth = dripDepth(theta);
    const out = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
    const start = new THREE.Vector3(out.x * R, rimHeight(theta) - depth * range(rng, 0.55, 0.9), out.z * R);
    const length = range(rng, 0.35, 0.95);
    const sway = new THREE.Vector3(-out.z, 0, out.x).multiplyScalar(range(rng, -0.12, 0.12));
    const curve = new THREE.CatmullRomCurve3([
      start,
      start.clone().addScaledVector(out, 0.03).add(new THREE.Vector3(0, -length * 0.35, 0)),
      start.clone().addScaledVector(out, -0.02).add(sway).add(new THREE.Vector3(0, -length * 0.7, 0)),
      start.clone().addScaledVector(out, 0.02).add(sway.clone().multiplyScalar(1.6)).add(new THREE.Vector3(0, -length, 0)),
    ]);
    const radius = range(rng, 0.016, 0.034);
    const tube = new THREE.TubeGeometry(curve, 8, radius, 5, false);
    // Taper toward the tip.
    const pos = tube.getAttribute('position');
    const ring = 6;
    for (let k = 0; k < pos.count; k++) {
      const seg = Math.floor(k / ring);
      const centre = curve.getPointAt(seg / 8);
      const taper = 1 - 0.8 * (seg / 8);
      pos.setXYZ(
        k,
        centre.x + (pos.getX(k) - centre.x) * taper,
        centre.y + (pos.getY(k) - centre.y) * taper,
        centre.z + (pos.getZ(k) - centre.z) * taper,
      );
    }
    tube.computeVertexNormals();
    b.add(tube, { color: bark, noise: 0.14 });
    tube.dispose();
    // A pair of small leaves part-way down some of them.
    if (rng() < 0.6) {
      const at = curve.getPointAt(range(rng, 0.35, 0.7));
      for (const side of [-1, 1]) {
        b.sphere(0.045, 5, 4, {
          at: [at.x + out.x * 0.03 + -out.z * 0.04 * side, at.y, at.z + out.z * 0.03 + out.x * 0.04 * side],
          scale: [1, 0.35, 0.6],
          rot: [0, Math.atan2(out.x, out.z) + side * 0.8, 0.3 * side],
          color: leaf,
          noise: 0.15,
        });
      }
    }
  }
  return b.build();
}

interface Debris {
  mesh: THREE.Mesh;
  base: THREE.Vector3;
  phase: number;
  speed: number;
  spin: number;
  amp: number;
}

function buildDebris(material: THREE.Material): { group: THREE.Group; items: Debris[] } {
  const group = new THREE.Group();
  const items: Debris[] = [];
  const rng = mulberry32(31);
  const specs: Array<[number, number, number, number, boolean]> = [
    [-3.2, -3.1, 1.2, 0.3, true],
    [3.6, -4.4, -0.8, 0.22, false],
    [1.7, -6.3, 2.9, 0.17, false],
    [-1.4, -5.5, -3.0, 0.2, false],
    [4.7, -2.1, 2.4, 0.15, true],
    [-4.3, -5.6, -1.2, 0.13, false],
  ];
  for (const [x, y, z, size, grassy] of specs) {
    const b = new GeoBuilder();
    const geo = new THREE.IcosahedronGeometry(size, 1);
    const pa = geo.getAttribute('position');
    const seed = Math.floor(rng() * 1000);
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i);
      const y = pa.getY(i);
      const z = pa.getZ(i);
      // A function of position alone, so the duplicated vertices of neighbouring faces move together.
      const k = 0.78 + 0.44 * noise3(x * 9 + 3, y * 9 + 5, z * 9 + 7, seed);
      // Islets that carry grass get a flat top for the turf to sit on.
      pa.setXYZ(i, x * k, grassy ? Math.min(y * k * 0.9, size * 0.6) : y * k * 0.9, z * k);
    }
    const c = new THREE.Color();
    rockColor(rng() * TAU, 0.45 + rng() * 0.3, c);
    b.add(geo, { color: c, noise: 0.12 });
    geo.dispose();
    if (grassy) {
      b.add(new THREE.CylinderGeometry(size * 0.95, size * 0.82, size * 0.3, 9), {
        at: [0, size * 0.72, 0],
        color: '#7db663',
        noise: 0.1,
      });
    }
    const mesh = new THREE.Mesh(b.build(), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(x, y, z);
    group.add(mesh);
    items.push({
      mesh,
      base: mesh.position.clone(),
      phase: rng() * TAU,
      speed: 0.35 + rng() * 0.3,
      spin: (rng() - 0.5) * 0.4,
      amp: 0.08 + rng() * 0.08,
    });
  }
  return { group, items };
}

export function buildIsland(materials: Materials): Island {
  const group = new THREE.Group();
  group.name = 'island';

  const top = new THREE.Mesh(buildTop(), materials.ground);
  top.name = 'island-top';
  top.receiveShadow = true;
  top.castShadow = true;

  const skirt = new THREE.Mesh(buildSkirt(), materials.turf);
  skirt.name = 'island-turf';
  skirt.receiveShadow = true;
  skirt.castShadow = true;

  const body = new THREE.Mesh(buildBody(), materials.rock);
  body.name = 'island-body';
  body.receiveShadow = true;
  body.castShadow = true;

  const spikes = new THREE.Mesh(buildStalactites(), materials.rock);
  spikes.name = 'island-spikes';
  spikes.receiveShadow = true;
  spikes.castShadow = true;

  const roots = new THREE.Mesh(buildRoots(), materials.clay);
  roots.name = 'island-roots';
  roots.castShadow = true;
  roots.receiveShadow = true;

  group.add(top, skirt, body, spikes, roots);

  const debris = buildDebris(materials.rock);
  group.add(debris.group);

  return {
    group,
    update(time: number, reducedMotion: boolean): void {
      group.position.y = reducedMotion ? 0 : Math.sin(time * 0.75) * 0.05;
      for (const d of debris.items) {
        if (reducedMotion) {
          d.mesh.position.copy(d.base);
          continue;
        }
        d.mesh.position.y = d.base.y + Math.sin(time * d.speed + d.phase) * d.amp;
        d.mesh.rotation.y = time * d.spin + d.phase;
        d.mesh.rotation.x = Math.sin(time * d.speed * 0.7 + d.phase) * 0.18;
      }
    },
    dispose(): void {
      for (const m of [top, skirt, body, spikes, roots, ...debris.items.map((d) => d.mesh)]) m.geometry.dispose();
    },
  };
}
