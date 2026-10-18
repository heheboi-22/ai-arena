import * as THREE from 'three';
import { fbm2, noise3 } from '../core/noise';
import { lerp, smoothstep } from '../core/math';
import { jitter, paintGradient } from '../core/parts';
import { Random } from '../core/random';
import { PALETTE, type Materials } from './materials';
import { pathDistance } from './layout';
import { groundHeight, pondQ, rimHeight, rimRadius } from './terrain';

const RINGS = 46;
const SEGMENTS = 160;

const col = (hex: string) => new THREE.Color(hex);
const C = {
  grass: col(PALETTE.grass),
  grassLight: col(PALETTE.grassLight),
  grassDark: col(PALETTE.grassDark),
  edge: col(PALETTE.grassEdge),
  path: col(PALETTE.path),
  sand: col(PALETTE.sand),
  bed: col(PALETTE.pondBed),
  soil: col(PALETTE.soil),
  soilDark: col(PALETTE.soilDark),
  rock: col(PALETTE.rock),
  rockLight: col(PALETTE.rockLight),
  rockDark: col(PALETTE.rockDark),
  moss: col(PALETTE.moss),
};

function grassColor(x: number, z: number, edge: number, out: THREE.Color): THREE.Color {
  const n = fbm2(x * 0.75 + 11, z * 0.75 - 4, 3);
  out.copy(C.grassDark).lerp(C.grassLight, smoothstep(-0.45, 0.5, n));
  out.lerp(C.grass, 0.35);
  out.lerp(C.edge, smoothstep(0.86, 1.0, edge) * 0.55);

  const pd = pathDistance(x, z);
  const worn = 1 - smoothstep(0.13, 0.3 + 0.06 * fbm2(x * 3, z * 3, 2), pd);
  out.lerp(C.path, worn * 0.92);

  const q = pondQ(x, z);
  if (q < 1.14) {
    out.lerp(C.sand, 1 - smoothstep(1.02, 1.14, q));
    if (q < 0.97) out.copy(C.sand).lerp(C.bed, smoothstep(0.95, 0.55, q));
  }
  return out;
}

/** Grassy top: a polar grid out to the irregular rim, finished with a rounded lip. */
function buildTop(material: THREE.Material): THREE.Mesh {
  const lip = [
    { r: 1.012, dy: -0.06, tone: 0.55 },
    { r: 1.018, dy: -0.15, tone: 0.75 },
    { r: 1.006, dy: -0.25, tone: 0.95 },
  ];
  const ringCount = RINGS + lip.length;
  const positions: number[] = [0, groundHeight(0, 0), 0];
  const colors: number[] = [];
  const c = new THREE.Color();
  grassColor(0, 0, 0, c);
  colors.push(c.r, c.g, c.b);

  for (let i = 1; i <= ringCount; i++) {
    for (let j = 0; j < SEGMENTS; j++) {
      const theta = (j / SEGMENTS) * Math.PI * 2;
      const rim = rimRadius(theta);
      if (i <= RINGS) {
        const f = i / RINGS;
        const x = Math.cos(theta) * rim * f;
        const z = Math.sin(theta) * rim * f;
        positions.push(x, groundHeight(x, z), z);
        grassColor(x, z, f, c);
      } else {
        const l = lip[i - RINGS - 1];
        const x = Math.cos(theta) * rim * l.r;
        const z = Math.sin(theta) * rim * l.r;
        positions.push(x, rimHeight(theta) + l.dy, z);
        c.copy(C.edge).lerp(C.soilDark, l.tone * 0.55);
      }
      colors.push(c.r, c.g, c.b);
    }
  }

  const index: number[] = [];
  for (let j = 0; j < SEGMENTS; j++) {
    const a = 1 + j;
    const b = 1 + ((j + 1) % SEGMENTS);
    index.push(0, b, a);
  }
  for (let i = 1; i < ringCount; i++) {
    const r0 = 1 + (i - 1) * SEGMENTS;
    const r1 = 1 + i * SEGMENTS;
    for (let j = 0; j < SEGMENTS; j++) {
      const jn = (j + 1) % SEGMENTS;
      index.push(r0 + j, r0 + jn, r1 + j, r0 + jn, r1 + jn, r1 + j);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(index);
  g.computeVertexNormals();

  const mesh = new THREE.Mesh(g, material);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'island-top';
  return mesh;
}

/** Sculpted underside: a soil band, then chunky faceted strata tapering to a blunt point. */
function buildUnderside(material: THREE.Material): THREE.Mesh {
  const SEG = 30;
  const LEVELS = 10;
  const rnd = new Random(7);
  const ringInset = Array.from({ length: LEVELS + 1 }, (_, k) => (k % 2 ? rnd.range(0.9, 0.96) : rnd.range(0.98, 1.03)));
  const tip = new THREE.Vector3(0.35, -5.0, -0.25);
  const positions: number[] = [];

  for (let k = 0; k <= LEVELS; k++) {
    // Alternate rings are rotated half a step, so facets zig-zag instead of forming stripes.
    const twist = (k % 2) * (Math.PI / SEG);
    for (let j = 0; j < SEG; j++) {
      const theta = (j / SEG) * Math.PI * 2 + twist;
      const rim = rimRadius(theta);
      const top = rimHeight(theta);
      if (k === LEVELS) {
        positions.push(tip.x, tip.y, tip.z);
        continue;
      }
      if (k <= 1) {
        const r = k === 0 ? rim * 0.99 : rim * (0.975 + 0.012 * noise3(Math.cos(theta) * 3, 1, Math.sin(theta) * 3));
        positions.push(Math.cos(theta) * r, top - (k === 0 ? 0.18 : 0.55), Math.sin(theta) * r);
        continue;
      }
      const t = (k - 1) / (LEVELS - 1);
      const profile = Math.pow(1 - t, 0.62) * 0.96;
      const n = noise3(Math.cos(theta) * 1.8, k * 0.9, Math.sin(theta) * 1.8);
      const r = Math.min(rim * profile * ringInset[k] * (1 + n * 0.14), rim * 0.96);
      const y = lerp(-0.8, -4.4, Math.pow(t, 1.1)) + noise3(Math.cos(theta) * 3, k + 5, Math.sin(theta) * 3) * 0.16 * (1 - t);
      const pull = smoothstep(0.35, 1, t) * 0.6;
      positions.push(lerp(Math.cos(theta) * r, tip.x, pull), y, lerp(Math.sin(theta) * r, tip.z, pull));
    }
  }

  const index: number[] = [];
  for (let k = 0; k < LEVELS; k++) {
    const r0 = k * SEG;
    const r1 = (k + 1) * SEG;
    for (let j = 0; j < SEG; j++) {
      const jn = (j + 1) % SEG;
      index.push(r0 + j, r1 + j, r0 + jn, r0 + jn, r1 + j, r1 + jn);
    }
  }

  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  indexed.setIndex(index);
  const g = indexed.toNonIndexed();
  indexed.dispose();

  // One colour per facet, chosen from the facet's centre height: soil, strata, darker tip.
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let f = 0; f < pos.count; f += 3) {
    const cx = (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3;
    const cy = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
    const cz = (pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)) / 3;
    const n = noise3(cx * 1.3, cy * 2.0, cz * 1.3);
    if (cy > -0.62) {
      c.copy(C.soil).lerp(C.soilDark, 0.3 + 0.3 * n);
    } else {
      const band = Math.sin(cy * 2.6 + n * 1.2);
      c.copy(band > 0.2 ? C.rockLight : C.rock);
      if (band < -0.6) c.lerp(C.rockDark, 0.35);
      c.lerp(C.rockDark, smoothstep(-1.5, -4.4, cy) * 0.5);
      if (cy > -1.6 && n > 0.2) c.lerp(C.moss, 0.5);
      if (cy > -1.0) c.lerp(C.soil, 0.4);
    }
    for (let v = 0; v < 3; v++) {
      colors[(f + v) * 3] = c.r;
      colors[(f + v) * 3 + 1] = c.g;
      colors[(f + v) * 3 + 2] = c.b;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();

  // The grass top is an open surface, which Three's back-face shadow pass does not render,
  // so letting the underside receive shadows would show the fence and stones through it.
  const mesh = new THREE.Mesh(g, material);
  mesh.receiveShadow = false;
  mesh.name = 'island-underside';
  return mesh;
}

function buildRoots(material: THREE.Material): THREE.Mesh {
  const rnd = new Random(31);
  const parts: THREE.BufferGeometry[] = [];
  const angles = [0.4, 1.5, 2.3, 3.4, 4.3, 5.4];
  for (const base of angles) {
    const theta = base + rnd.range(-0.2, 0.2);
    const rim = rimRadius(theta) * 0.965;
    const top = rimHeight(theta) - 0.32;
    const dir = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
    const len = rnd.range(0.55, 1.15);
    const pts = [0, 0.33, 0.66, 1].map((t, i) =>
      dir
        .clone()
        .multiplyScalar(rim + Math.sin(t * Math.PI) * 0.12 - t * 0.12)
        .add(new THREE.Vector3(i ? rnd.range(-0.06, 0.06) : 0, top - t * len, i ? rnd.range(-0.06, 0.06) : 0)),
    );
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, 10, 0.022, 5, false);
    // Taper toward the tip.
    const p = tube.getAttribute('position');
    const center = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      const ring = Math.floor(i / 6);
      const t = ring / 10;
      curve.getPointAt(t, center);
      const k = 1 - t * 0.8;
      p.setXYZ(
        i,
        center.x + (p.getX(i) - center.x) * k,
        center.y + (p.getY(i) - center.y) * k,
        center.z + (p.getZ(i) - center.z) * k,
      );
    }
    tube.computeVertexNormals();
    parts.push(tube);
  }
  const merged = new THREE.Mesh(mergeSimple(parts), material);
  merged.name = 'roots';
  return merged;
}

function mergeSimple(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const nonIndexed = list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(n.attributes)) if (name !== 'position' && name !== 'normal') n.deleteAttribute(name);
    return n;
  });
  let count = 0;
  for (const g of nonIndexed) count += g.getAttribute('position').count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  let o = 0;
  for (const g of nonIndexed) {
    pos.set(g.getAttribute('position').array as Float32Array, o);
    nor.set(g.getAttribute('normal').array as Float32Array, o);
    o += g.getAttribute('position').count * 3;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

interface FloatingRock {
  mesh: THREE.Mesh;
  baseY: number;
  phase: number;
  spin: number;
}

function buildFloatingRocks(material: THREE.Material): FloatingRock[] {
  const spots = [
    { theta: 0.35, r: 4.7, y: -1.9, size: 0.3, cap: true },
    { theta: 2.6, r: 3.9, y: -2.8, size: 0.26, cap: false },
    { theta: 4.75, r: 4.6, y: -1.6, size: 0.34, cap: true },
    { theta: 1.75, r: 3.3, y: -3.3, size: 0.18, cap: false },
  ];
  const grass = new THREE.Color(PALETTE.grass);
  return spots.map((s, i) => {
    const g = jitter(new THREE.DodecahedronGeometry(1, 0), 0.18, 101 + i);
    g.scale(s.size, s.size * 0.8, s.size);
    paintGradient(g, PALETTE.rockDark, PALETTE.rockLight, -s.size * 0.6, s.size * 0.75);
    if (s.cap) {
      // Only the upward-facing facets get turf, like a clod that broke off the rim.
      const pos = g.getAttribute('position');
      const col = g.getAttribute('color');
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const c = new THREE.Vector3();
      for (let f = 0; f < pos.count; f += 3) {
        a.fromBufferAttribute(pos, f);
        b.fromBufferAttribute(pos, f + 1);
        c.fromBufferAttribute(pos, f + 2);
        const ny = b.clone().sub(a).cross(c.clone().sub(a)).normalize().y;
        if (ny > 0.6) for (let v = 0; v < 3; v++) col.setXYZ(f + v, grass.r, grass.g, grass.b);
      }
    }
    const mesh = new THREE.Mesh(g, material);
    mesh.position.set(Math.cos(s.theta) * s.r, s.y, Math.sin(s.theta) * s.r);
    mesh.rotation.y = i * 1.3;
    mesh.castShadow = true;
    return { mesh, baseY: s.y, phase: i * 1.7, spin: (i % 2 ? 1 : -1) * 0.08 };
  });
}

export function buildIsland(mats: Materials) {
  const group = new THREE.Group();
  const grassMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  const top = buildTop(grassMat);
  const underside = buildUnderside(mats.vertexRock);
  const roots = buildRoots(mats.bark);
  const rocks = buildFloatingRocks(mats.vertexRock);
  group.add(top, underside, roots, ...rocks.map((r) => r.mesh));

  return {
    group,
    top,
    underside,
    update(dt: number, elapsed: number, motion: number) {
      for (const r of rocks) {
        r.mesh.position.y = r.baseY + Math.sin(elapsed * 0.55 + r.phase) * 0.09 * motion;
        r.mesh.rotation.y += r.spin * motion * dt;
      }
    },
  };
}
