import * as THREE from 'three';
import { makeNoise2D, makeRng, smoothstep, lerp, clamp01 } from '../lib/math';
import { WORLD } from '../palette';
import { ISLAND_R, POND, HOUSE, WINDMILL, COMPANIONS } from './layout';
import type { SharedMaterials } from './materials';

const n1 = makeNoise2D(11);
const n2 = makeNoise2D(73);
const n3 = makeNoise2D(131);
const n4 = makeNoise2D(301);

/** Irregular silhouette radius at angle θ (radians around +Y). */
export function rimRadius(theta: number): number {
  const cx = Math.cos(theta), cz = Math.sin(theta);
  const wobble =
    0.1 * n1(cx * 2.1, cz * 2.1) +
    0.055 * n2(cx * 4.7 + 9, cz * 4.7 - 4) +
    0.03 * n4(cx * 9.3 - 7, cz * 9.3 + 2);
  return ISLAND_R * (0.9 + wobble);
}

// The spilling stream leaves the pond toward the rim, then falls off.
// (Vector2.y carries the world z coordinate.)
const STREAM_DIR = new THREE.Vector2(POND.x, POND.z).normalize();
const STREAM_A = new THREE.Vector2(POND.x, POND.z).addScaledVector(STREAM_DIR, POND.r * 0.82);
const STREAM_B = (() => {
  const p = STREAM_A.clone();
  for (let i = 0; i < 90; i++) {
    p.addScaledVector(STREAM_DIR, 0.05);
    if (p.length() >= rimRadius(Math.atan2(p.y, p.x)) * 0.96) break;
  }
  return p;
})();

function distToSegment(px: number, pz: number, a: THREE.Vector2, b: THREE.Vector2): number {
  const abx = b.x - a.x, abz = b.y - a.y;
  const t = clamp01(((px - a.x) * abx + (pz - a.y) * abz) / (abx * abx + abz * abz));
  const dx = px - (a.x + abx * t), dz = pz - (a.y + abz * t);
  return Math.sqrt(dx * dx + dz * dz);
}

export interface GroundSample {
  /** terrain height at (x, z) */
  y: number;
  /** 0..1 sand blend (pond shore + stream banks) */
  sand: number;
  /** 0..1 bare-dirt blend (pads under house / windmill / path) */
  dirt: number;
}

const sampleScratch: GroundSample = { y: 0, sand: 0, dirt: 0 };

/**
 * The single terrain formula: used to build the mesh and to place props.
 * Writes into a shared scratch object — copy out anything you need to keep.
 */
function sampleGroundInto(x: number, z: number, out: GroundSample): GroundSample {
  const r = Math.hypot(x, z);
  const theta = Math.atan2(z, x);
  const rim = rimRadius(theta);
  const t = r / rim;

  // domed top with soft bumps, then a rounded drooping lip at the edge
  let y = 0.34 * (1 - t * t)
    + n3(x * 0.55 + 3, z * 0.55 - 5) * 0.16 * (1 - t * 0.55)
    + n4(x * 1.4, z * 1.4) * 0.05;
  y -= smoothstep(0.74, 1.0, t) * 0.62;

  // pond bowl
  const pd = Math.hypot(x - POND.x, z - POND.z);
  const pondBowl = smoothstep(POND.r, POND.r * 0.42, pd);
  y = lerp(y, -0.52, pondBowl);

  // stream bed from pond edge out over the lip
  const sd = distToSegment(x, z, STREAM_A, STREAM_B);
  const streamBed = smoothstep(0.42, 0.1, sd);
  y = lerp(y, -0.42, streamBed);

  // flatten small pads so buildings sit true
  const hd = Math.hypot(x - HOUSE.x, z - HOUSE.z);
  y = lerp(y, 0.26, smoothstep(1.15, 0.45, hd));
  const wd = Math.hypot(x - WINDMILL.x, z - WINDMILL.z);
  y = lerp(y, 0.4, smoothstep(0.85, 0.3, wd));

  const sand = Math.max(
    smoothstep(POND.r * 1.4, POND.r * 0.78, pd) * (1 - pondBowl),
    smoothstep(0.74, 0.34, sd),
  );
  const dirt = Math.max(
    smoothstep(1.25, 0.7, hd),
    smoothstep(0.95, 0.55, wd),
  );
  out.y = y;
  out.sand = clamp01(sand);
  out.dirt = clamp01(dirt);
  return out;
}

/** Allocation-free query for placement code. */
function ground(x: number, z: number): GroundSample {
  return sampleGroundInto(x, z, sampleScratch);
}

export const streamSpill = {
  a: STREAM_A,
  b: STREAM_B,
  lipY: -0.45,
};

const cGrass = new THREE.Color(WORLD.grass);
const cGrassDeep = new THREE.Color(WORLD.grassDeep);
const cGrassLight = new THREE.Color(WORLD.grassLight);
const cShade = new THREE.Color(WORLD.grassShade);
const cSand = new THREE.Color(WORLD.sand);
const cDirt = new THREE.Color(WORLD.dirt);
const tmpC = new THREE.Color();

function grassColor(x: number, z: number, s: GroundSample, out: THREE.Color): void {
  const speck = n2(x * 1.1 + 40, z * 1.1 - 17) * 0.5 + 0.5;
  out.copy(cGrassDeep).lerp(cGrass, speck);
  const highlight = n4(x * 2.3 - 11, z * 2.3 + 6) * 0.5 + 0.5;
  out.lerp(cGrassLight, highlight * 0.28);
  out.lerp(cShade, s.dirt * 0.2);
  out.lerp(cSand, s.sand);
  out.lerp(cDirt, s.dirt);
}

function buildTop(segments: number, rings: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= rings; i++) {
    const rr = i / rings;
    for (let s = 0; s <= segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      const rim = rimRadius(theta);
      const x = Math.cos(theta) * rim * rr;
      const z = Math.sin(theta) * rim * rr;
      const sample = ground(x, z);
      positions.push(x, sample.y, z);
      grassColor(x, z, sample, tmpC);
      colors.push(tmpC.r, tmpC.g, tmpC.b);
    }
  }
  const cols = segments + 1;
  for (let i = 0; i < rings; i++) {
    for (let s = 0; s < segments; s++) {
      const a = i * cols + s;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// terrain height at the spill lip (needs sampleScratch, defined above)
streamSpill.lipY = sampleGroundInto(STREAM_B.x, STREAM_B.y, sampleScratch).y;

const cRock = new THREE.Color(WORLD.rock);
const cRockDeep = new THREE.Color(WORLD.rockDeep);
const cRockDark = new THREE.Color(WORLD.rockDark);
const cMoss = new THREE.Color(WORLD.grassShade);

function buildUnderside(): THREE.BufferGeometry {
  // silhouette profile of the hanging rock cone
  const profile: THREE.Vector2[] = [];
  const pts: [number, number][] = [
    [5.02, -0.28], [4.78, -0.9], [4.35, -1.7], [3.6, -2.7],
    [2.55, -3.7], [1.45, -4.7], [0.6, -5.6], [0.0, -6.4],
  ];
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)));
  for (let i = 0; i <= 14; i++) {
    const p = curve.getPoint(i / 14);
    profile.push(new THREE.Vector2(Math.max(p.x, 0.001), p.y));
  }
  const geo = new THREE.LatheGeometry(profile, 30);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const theta = Math.atan2(v.z, v.x);
    const rim = rimRadius(theta);
    // keep the cone tucked slightly inside the grass silhouette, and give
    // each layer a rocky wobble independent of the top
    const wobble =
      0.09 * n1(Math.cos(theta) * 3.1 + 20, Math.sin(theta) * 3.1) +
      0.05 * n2(Math.cos(theta) * 6.4 - 13, v.y * 1.5 + Math.sin(theta) * 6.4);
    const squash = (rim / ISLAND_R) * (1 + wobble * smoothstep(-1.2, -4.8, v.y));
    pos.setXYZ(i, v.x * squash, v.y, v.z * squash);

    // strata bands that darken toward the tip, moss touching the grass
    const band = Math.sin(v.y * 2.6 + n2(Math.cos(theta) * 5, Math.sin(theta) * 5) * 2.2) * 0.5 + 0.5;
    tmpC.copy(cRock).lerp(cRockDeep, smoothstep(-0.6, -4.6, v.y));
    tmpC.lerp(cRockDark, band * 0.28);
    tmpC.lerp(cMoss, smoothstep(-1.0, -0.2, v.y) * (n4(Math.cos(theta) * 4, Math.sin(theta) * 4) * 0.5 + 0.5) * 0.55);
    colors[i * 3] = tmpC.r;
    colors[i * 3 + 1] = tmpC.g;
    colors[i * 3 + 2] = tmpC.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

export interface Island {
  group: THREE.Group;
  /** terrain height at (x,z), for placing props */
  groundY: (x: number, z: number) => number;
  update: (dt: number, time: number, reduced: boolean) => void;
}

export function createIsland(mats: SharedMaterials): Island {
  const group = new THREE.Group();

  const top = new THREE.Mesh(buildTop(72, 20), mats.grass);
  top.receiveShadow = true;
  top.castShadow = true;
  group.add(top);

  const under = new THREE.Mesh(
    buildUnderside(),
    new THREE.MeshStandardMaterial({
      color: 0xffffff, vertexColors: true, roughness: 0.98, metalness: 0, flatShading: true,
    }),
  );
  under.receiveShadow = true;
  group.add(under);

  // a couple of rooted boulders sticking out of the cone
  const rng = makeRng(4242);
  for (let i = 0; i < 3; i++) {
    const theta = rng() * Math.PI * 2;
    const rad = 2.2 + rng() * 1.6;
    const s = 0.28 + rng() * 0.22;
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mats.rockDeep);
    boulder.position.set(Math.cos(theta) * rad, -2.2 - rng() * 1.6, Math.sin(theta) * rad);
    boulder.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    boulder.castShadow = false;
    group.add(boulder);
  }

  // companion mini-rocks drifting alongside
  const companions: { g: THREE.Group; baseY: number; phase: number; spin: number }[] = [];
  const capGeo = new THREE.CylinderGeometry(1, 0.92, 0.3, 9);
  for (const c of COMPANIONS) {
    const g = new THREE.Group();
    const rockGeo = new THREE.DodecahedronGeometry(c.s, 0);
    const rock = new THREE.Mesh(rockGeo, mats.rock);
    rock.scale.y = 0.85;
    rock.position.y = -c.s * 0.5;
    g.add(rock);
    const cap = new THREE.Mesh(capGeo, mats.grass);
    cap.scale.set(c.s, 1, c.s);
    cap.position.y = -c.s * 0.12;
    cap.material = mats.grass;
    g.add(cap);
    g.position.set(c.x, c.y, c.z);
    group.add(g);
    companions.push({ g, baseY: c.y, phase: c.phase, spin: 0.04 + rng() * 0.05 });
  }

  return {
    group,
    groundY: (x, z) => ground(x, z).y,
    update(dt, time, reduced) {
      const amp = reduced ? 0.05 : 0.16;
      const spin = reduced ? 0 : 1;
      for (const c of companions) {
        c.g.position.y = c.baseY + Math.sin(time * 0.45 + c.phase) * amp;
        c.g.rotation.y += c.spin * spin * dt;
      }
    },
  };
}
