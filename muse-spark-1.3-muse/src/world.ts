// Pocket World — the island itself: terrain, house, windmill, pond, planting,
// clouds, chimney smoke and fireflies. Everything is procedural (geometry and
// CanvasTextures only, no external assets) and all placement derives from the
// single deterministic terrainHeight() below, so the ground mesh and every
// object planted on it always agree.

import * as THREE from 'three';
import { clamp, lerp, smoothstep, createRng, noise2, fbm2 } from './util';

// --- Layout -----------------------------------------------------------------

export const POND = { x: 3.6, z: 3.4, r: 2.7 };

const ISLAND_R = 10;
const HOUSE_POS = { x: -1.8, z: -0.6 };
const HOUSE_ROT = 0.55; // front (+z local) tips toward +x, facing the camera start
const PLATEAU_H = 1.02;
const MILL_POS = { x: -4.6, z: -3.4 };

/** Stepping-stone route: house door -> pond edge -> around -> windmill base. */
const PATH_PTS: ReadonlyArray<readonly [number, number]> = [
  [-0.95, 0.85],
  [-0.05, 1.4],
  [0.8, 1.65],
  [1.5, 1.9],
  [0.55, 1.15],
  [-0.75, 0.05],
  [-2.05, -1.15],
  [-3.15, -2.05],
  [-3.95, -2.7],
];

/**
 * The one heightfield for the whole island: a gentle dome, a hill under the
 * windmill, a smooth bowl for the pond, a flattened house plateau, light fbm
 * undulation, and a falloff that lands exactly on the rim height at r = 10.
 */
export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const d = clamp(r / ISLAND_R, 0, 1);
  let h = 0.98 * (1 - d * d);
  const dm = Math.hypot(x - MILL_POS.x, z - MILL_POS.z);
  h += 1.12 * Math.exp(-(dm * dm) / (2 * 2.3 * 2.3));
  h += 0.2 * fbm2(x * 0.32 + 7.3, z * 0.32 - 2.1, 3) * (1 - d * 0.55);
  h += 0.05 * noise2(x * 0.95, z * 0.95);
  const dp = Math.hypot(x - POND.x, z - POND.z);
  h -= 0.98 * (1 - smoothstep(2.0, 3.4, dp));
  const dh = Math.hypot(x - HOUSE_POS.x, z - HOUSE_POS.z);
  h = lerp(h, PLATEAU_H, (1 - smoothstep(1.7, 3.3, dh)) * 0.94);
  h = lerp(h, -0.15, smoothstep(8.1, 10, r));
  return h;
}

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const abx = bx - ax;
  const abz = bz - az;
  const len2 = abx * abx + abz * abz;
  const t = len2 > 0 ? clamp(((px - ax) * abx + (pz - az) * abz) / len2, 0, 1) : 0;
  return Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
}

function distToPath(x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < PATH_PTS.length - 1; i++) {
    const a = PATH_PTS[i];
    const b = PATH_PTS[i + 1];
    best = Math.min(best, distToSegment(x, z, a[0], a[1], b[0], b[1]));
  }
  return best;
}

/** True where flowers / grass tufts / rocks may be scattered. */
function isOpenGround(x: number, z: number): boolean {
  const r = Math.hypot(x, z);
  if (r > 9.25) return false;
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.45) return false;
  if (Math.hypot(x - HOUSE_POS.x, z - HOUSE_POS.z) < 2.65) return false;
  if (Math.hypot(x - MILL_POS.x, z - MILL_POS.z) < 1.75) return false;
  if (distToPath(x, z) < 0.55) return false;
  return true;
}

// --- Small builders -----------------------------------------------------------

function canvasTexture(
  size: number,
  draw: (g: CanvasRenderingContext2D, s: number) => void,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (g) draw(g, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Soft radial disc used for smoke puffs, the house glow and firefly points. */
function softCircleTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(128, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  });
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function put(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  cast = true,
  receive = false,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}

function box(
  parent: THREE.Object3D,
  mat: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  cast = true,
  receive = false,
): THREE.Mesh {
  return put(parent, new THREE.BoxGeometry(w, h, d), mat, x, y, z, cast, receive);
}

/** Icosahedron blob with position-noise displacement (seam-free: the noise is
 *  a pure function of position, so duplicated vertices move together). */
function blobGeometry(radius: number, seed: number, squash = 0.84, detail = 1): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = 1 + noise2(v.x * 1.35 + seed, v.y * 1.2 + v.z * 1.1 - seed) * 0.24;
    v.multiplyScalar(k);
    v.y *= squash;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Concatenate non-indexed geometries that share position/normal/uv layouts. */
function mergeGeoms(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let total = 0;
  for (const g of geoms) total += (g.attributes.position as THREE.BufferAttribute).count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let vo = 0;
  let uo = 0;
  for (const g of geoms) {
    const p = g.attributes.position as THREE.BufferAttribute;
    const n = g.attributes.normal as THREE.BufferAttribute;
    const u = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      pos[vo] = p.getX(i);
      pos[vo + 1] = p.getY(i);
      pos[vo + 2] = p.getZ(i);
      nor[vo] = n.getX(i);
      nor[vo + 1] = n.getY(i);
      nor[vo + 2] = n.getZ(i);
      vo += 3;
      uv[uo] = u.getX(i);
      uv[uo + 1] = u.getY(i);
      uo += 2;
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

// --- Public contract ------------------------------------------------------------

export interface WorldCtx {
  wind: number;
  rainAmount: number;
  lightsAmount: number;
  night: number;
  calm: boolean;
  waterColor: THREE.Color;
  cloudColor: THREE.Color;
}

export interface World {
  group: THREE.Group;
  house: THREE.Group;
  update(dt: number, t: number, ctx: WorldCtx): void;
}

const PANE_DAY = new THREE.Color(0x33505f);
const PANE_LIT = new THREE.Color(0xffc06a);

export function buildWorld(): World {
  const rng = createRng(20261105);
  const group = new THREE.Group();

  // --- Procedural textures ---------------------------------------------------
  const grassTex = canvasTexture(
    256,
    (g, s) => {
      const trng = createRng(41);
      g.fillStyle = '#eef2e2';
      g.fillRect(0, 0, s, s);
      for (let i = 0; i < 5200; i++) {
        const v = 205 + Math.floor(trng() * 50);
        g.fillStyle = `rgb(${v - 28},${v},${v - 52})`;
        g.fillRect(trng() * s, trng() * s, 1.6, 2.6);
      }
      for (let i = 0; i < 260; i++) {
        const v = 178 + Math.floor(trng() * 40);
        g.fillStyle = `rgba(${v},${v + 12},${v - 60},0.5)`;
        g.fillRect(trng() * s, trng() * s, 3.2, 1.4);
      }
    },
    16,
    16,
  );
  const rockTex = canvasTexture(
    256,
    (g, s) => {
      const trng = createRng(97);
      g.fillStyle = '#e8e2d8';
      g.fillRect(0, 0, s, s);
      for (let i = 0; i < 2400; i++) {
        const v = 178 + Math.floor(trng() * 70);
        g.fillStyle = `rgb(${v},${v - 6},${v - 18})`;
        g.fillRect(trng() * s, trng() * s, 2.4, 2.4);
      }
      g.strokeStyle = 'rgba(90,78,66,0.35)';
      for (let i = 0; i < 22; i++) {
        g.beginPath();
        const y = trng() * s;
        g.moveTo(0, y);
        g.bezierCurveTo(s * 0.3, y + trng() * 14 - 7, s * 0.7, y + trng() * 14 - 7, s, y);
        g.stroke();
      }
    },
    5,
    2,
  );
  const woodTex = canvasTexture(
    256,
    (g, s) => {
      const trng = createRng(7);
      g.fillStyle = '#a67c52';
      g.fillRect(0, 0, s, s);
      const rows = 4;
      for (let rI = 0; rI < rows; rI++) {
        const y = (rI * s) / rows;
        g.fillStyle = rI % 2 ? '#9c744b' : '#ad8358';
        g.fillRect(0, y, s, s / rows);
        g.fillStyle = 'rgba(70,48,28,0.8)';
        g.fillRect(0, y, s, 2.5);
        g.strokeStyle = 'rgba(84,58,34,0.4)';
        for (let i = 0; i < 9; i++) {
          g.beginPath();
          const gy = y + 6 + trng() * (s / rows - 12);
          g.moveTo(0, gy);
          g.bezierCurveTo(s * 0.3, gy + 3, s * 0.7, gy - 3, s, gy);
          g.stroke();
        }
      }
    },
    1,
    1,
  );
  const shingleTex = canvasTexture(
    256,
    (g, s) => {
      const trng = createRng(23);
      g.fillStyle = '#c06a4e';
      g.fillRect(0, 0, s, s);
      const rowH = s / 6;
      const colW = s / 5;
      for (let rI = 0; rI < 6; rI++) {
        const off = rI % 2 ? colW / 2 : 0;
        for (let cI = -1; cI < 6; cI++) {
          const v = trng() * 22 - 11;
          g.fillStyle = `rgb(${186 + v},${96 + v * 0.6},${70 + v * 0.4})`;
          g.beginPath();
          g.arc(cI * colW + off + colW / 2, rI * rowH + rowH * 0.4, colW * 0.52, 0, Math.PI, false);
          g.fill();
          g.fillRect(cI * colW + off, rI * rowH, colW, rowH * 0.42);
        }
        g.fillStyle = 'rgba(96,44,30,0.55)';
        g.fillRect(0, rI * rowH + rowH - 2, s, 2);
      }
    },
    3,
    2,
  );
  const stoneTex = canvasTexture(
    256,
    (g, s) => {
      const trng = createRng(53);
      g.fillStyle = '#8f897e';
      g.fillRect(0, 0, s, s);
      const rowH = s / 4;
      const colW = s / 3;
      for (let rI = 0; rI < 4; rI++) {
        const off = rI % 2 ? colW / 2 : 0;
        for (let cI = -1; cI < 4; cI++) {
          const v = trng() * 26 - 13;
          g.fillStyle = `rgb(${158 + v},${152 + v},${140 + v})`;
          g.fillRect(cI * colW + off + 3, rI * rowH + 3, colW - 6, rowH - 6);
        }
      }
    },
    2,
    2,
  );
  const softTex = softCircleTexture();

  // --- Shared materials --------------------------------------------------------
  const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, vertexColors: true, roughness: 1 });
  const rockMat = new THREE.MeshStandardMaterial({
    map: rockTex,
    vertexColors: true,
    roughness: 1,
    flatShading: true,
  });
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x7d5f43, roughness: 1 });
  const creamMat = new THREE.MeshStandardMaterial({ color: 0xf3e7cd, roughness: 0.9 });
  const gableMat = new THREE.MeshStandardMaterial({ color: 0xefe0c2, roughness: 0.9, side: THREE.DoubleSide });
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, color: 0xb99b78, roughness: 0.95 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x5f4630, roughness: 0.95 });
  const roofMat = new THREE.MeshStandardMaterial({ map: shingleTex, roughness: 0.95 });
  const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 1 });
  const stonePlainMat = new THREE.MeshStandardMaterial({ color: 0x97907f, roughness: 1, flatShading: true });
  const pathStoneMat = new THREE.MeshStandardMaterial({ color: 0xb3a48c, roughness: 1, flatShading: true });
  const trunkMat = new THREE.MeshStandardMaterial({ map: woodTex, color: 0x8a6a4c, roughness: 1 });
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xf6efdd, roughness: 0.9, side: THREE.DoubleSide });
  const paneMat = new THREE.MeshStandardMaterial({
    color: PANE_DAY.clone(),
    roughness: 0.25,
    metalness: 0.1,
    emissive: 0xffa64d,
    emissiveIntensity: 0,
  });
  const leafMats = [0x5da24e, 0x4c9041, 0x6cab57, 0x3f7f38].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }),
  );
  const pineMat = new THREE.MeshStandardMaterial({ color: 0x38663a, roughness: 1, flatShading: true });
  const blossomMats = [0xe9a7bd, 0xf3c6d3, 0xde8cab].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }),
  );
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x477f3c, roughness: 1, flatShading: true });


  // --- Ground ------------------------------------------------------------------
  {
    const geo = new THREE.PlaneGeometry(20, 20, 120, 120);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const cGrassA = new THREE.Color(0x69a84f);
    const cGrassB = new THREE.Color(0x8fbc62);
    const cDry = new THREE.Color(0xa9b567);
    const cSand = new THREE.Color(0xdcc08a);
    const cDirt = new THREE.Color(0x9a7d55);
    const cRim = new THREE.Color(0x8a6a48);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let z = pos.getZ(i);
      const r = Math.hypot(x, z);
      if (r > ISLAND_R) {
        const k = ISLAND_R / r;
        x *= k;
        z *= k;
        pos.setX(i, x);
        pos.setZ(i, z);
      }
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      // Base grass: two greens by fbm, with dry patches.
      const n = fbm2(x * 0.45 + 3, z * 0.45 - 5, 3) * 0.5 + 0.5;
      tmp.lerpColors(cGrassA, cGrassB, n);
      const dry = smoothstep(0.32, 0.75, fbm2(x * 0.22 - 11, z * 0.22 + 8, 2) * 0.5 + 0.5);
      tmp.lerp(cDry, dry * 0.35);
      tmp.offsetHSL(0, 0, (h - 0.6) * 0.012);
      // Sandy shore ring around the pond.
      const dp = Math.hypot(x - POND.x, z - POND.z);
      const shore = (1 - smoothstep(0.55, 1.05, Math.abs(dp - (POND.r + 0.18)))) * 0.85;
      tmp.lerp(cSand, shore);
      // Dirt worn along the path.
      const pd = distToPath(x, z);
      tmp.lerp(cDirt, (1 - smoothstep(0.25, 0.62, pd)) * 0.65);
      // Dirt at the rim where grass gives way to the rock underside.
      tmp.lerp(cRim, smoothstep(9.15, 9.95, Math.hypot(x, z)) * 0.8);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, grassMat);
    ground.receiveShadow = true;
    group.add(ground);
  }

  // --- Rocky underside -----------------------------------------------------------
  {
    const profile: THREE.Vector2[] = [
      new THREE.Vector2(10, -0.1),
      new THREE.Vector2(9.35, -0.95),
      new THREE.Vector2(8.15, -2.05),
      new THREE.Vector2(6.6, -3.35),
      new THREE.Vector2(4.95, -4.7),
      new THREE.Vector2(3.35, -5.9),
      new THREE.Vector2(1.85, -6.8),
      new THREE.Vector2(0.7, -7.35),
      new THREE.Vector2(0.001, -7.6),
    ];
    const geo = new THREE.LatheGeometry(profile, 96);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const cRockA = new THREE.Color(0x8d7b67);
    const cRockB = new THREE.Color(0x6e6053);
    const cDeep = new THREE.Color(0x584c41);
    const cDirtTop = new THREE.Color(0x7d5f43);
    const tmp = new THREE.Color();
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const radial = Math.hypot(v.x, v.z);
      const ang = Math.atan2(v.z, v.x);
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      if (radial > 0.05) {
        // Periodic in angle (cos/sin only) so the lathe seam stays closed.
        const n = fbm2(cosA * 2.3 + 10, sinA * 2.3 + v.y * 0.5, 3);
        const k = 1 + n * 0.13 + noise2(cosA * 3.1 + v.y * 1.4, sinA * 3.1) * 0.03;
        v.x *= k;
        v.z *= k;
        pos.setX(i, v.x);
        pos.setZ(i, v.z);
      }
      const band = fbm2(v.y * 0.85 + 4, cosA * 1.5, 2) * 0.5 + 0.5;
      tmp.lerpColors(cRockA, cRockB, band);
      tmp.lerp(cDeep, clamp(-v.y / 7.6, 0, 1) * 0.55);
      tmp.lerp(cDirtTop, (1 - smoothstep(0.4, 1.3, -v.y)) * 0.65);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const rock = new THREE.Mesh(geo, rockMat);
    rock.castShadow = true;
    group.add(rock);

    // Dirt band tucked just under the rim, between grass edge and rock.
    put(group, new THREE.CylinderGeometry(10.04, 9.5, 0.55, 96, 1, true), dirtMat, 0, -0.34, 0, false, false);
  }

  // --- Path stepping stones -------------------------------------------------------
  {
    const stoneGeo = new THREE.CylinderGeometry(0.3, 0.36, 0.08, 7);
    let travelled = 0;
    let nextAt = 0.35;
    for (let i = 0; i < PATH_PTS.length - 1; i++) {
      const [ax, az] = PATH_PTS[i];
      const [bx, bz] = PATH_PTS[i + 1];
      const segLen = Math.hypot(bx - ax, bz - az);
      for (let s = 0; s <= segLen; s += 0.18) {
        if (travelled + s < nextAt) continue;
        nextAt = travelled + s + 0.68 + rng() * 0.22;
        const tSeg = s / segLen;
        const px = lerp(ax, bx, tSeg) + (rng() - 0.5) * 0.22;
        const pz = lerp(az, bz, tSeg) + (rng() - 0.5) * 0.22;
        const stone = put(group, stoneGeo, pathStoneMat, px, terrainHeight(px, pz) + 0.045, pz, false, true);
        stone.rotation.y = rng() * Math.PI;
        const sc = 0.8 + rng() * 0.55;
        stone.scale.set(sc, 1, sc * (0.78 + rng() * 0.3));
      }
      travelled += segLen;
    }
  }


  // --- House ------------------------------------------------------------------------
  const house = new THREE.Group();
  house.position.set(HOUSE_POS.x, terrainHeight(HOUSE_POS.x, HOUSE_POS.z) - 0.1, HOUSE_POS.z);
  house.rotation.y = HOUSE_ROT;
  group.add(house);

  const HW = 3.6; // width  (x)
  const HD = 3.1; // depth  (z)
  const FOUND_H = 0.55;
  const WALL_H = 2.45;
  const WALL_TOP = FOUND_H + WALL_H; // 3.0
  const ROOF_H = 1.35;
  let chimneyTopLocal = new THREE.Vector3();

  {
    // Foundation + walls.
    box(house, stoneMat, HW + 0.34, FOUND_H, HD + 0.34, 0, FOUND_H / 2, 0, true, true);
    box(house, creamMat, HW, WALL_H, HD, 0, FOUND_H + WALL_H / 2, 0, true, true);

    // Timber corner beams, mid posts and top plate.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        box(house, darkWoodMat, 0.2, WALL_H, 0.2, sx * (HW / 2 - 0.02), FOUND_H + WALL_H / 2, sz * (HD / 2 - 0.02));
      }
    }
    box(house, darkWoodMat, HW + 0.16, 0.18, 0.14, 0, WALL_TOP - 0.05, HD / 2 + 0.02);
    box(house, darkWoodMat, HW + 0.16, 0.18, 0.14, 0, WALL_TOP - 0.05, -HD / 2 - 0.02);
    box(house, darkWoodMat, 0.14, 0.18, HD + 0.16, HW / 2 + 0.02, WALL_TOP - 0.05, 0);
    box(house, darkWoodMat, 0.14, 0.18, HD + 0.16, -HW / 2 - 0.02, WALL_TOP - 0.05, 0);
    box(house, darkWoodMat, HW + 0.1, 0.14, 0.12, 0, FOUND_H + 0.1, HD / 2 + 0.02);

    // Gables (triangles at both x ends, under the roof slopes).
    const gableShape = new THREE.BufferGeometry();
    const gv = new Float32Array([
      -HD / 2, WALL_TOP, 0, HD / 2, WALL_TOP, 0, 0, WALL_TOP + ROOF_H, 0,
    ]);
    gableShape.setAttribute('position', new THREE.BufferAttribute(gv, 3));
    gableShape.computeVertexNormals();
    for (const sx of [-1, 1]) {
      const gable = new THREE.Mesh(gableShape, gableMat);
      gable.rotation.y = Math.PI / 2;
      gable.position.x = sx * (HW / 2 - 0.01);
      gable.castShadow = true;
      house.add(gable);
    }

    // Roof: two shingled slopes with overhang + ridge beam.
    const overhang = 0.42;
    const run = HD / 2 + overhang;
    const slopeLen = Math.hypot(run, ROOF_H) + 0.12;
    const slopeAng = Math.atan2(ROOF_H, run);
    const roofLen = HW + overhang * 2;
    for (const sz of [-1, 1]) {
      const slope = box(house, roofMat, roofLen, 0.13, slopeLen, 0, WALL_TOP + ROOF_H / 2 + 0.04, sz * (run / 2 - 0.06));
      slope.rotation.x = sz * slopeAng;
    }
    box(house, darkWoodMat, roofLen + 0.1, 0.15, 0.2, 0, WALL_TOP + ROOF_H + 0.05, 0);

    // Chimney with cap; remember the top for the smoke pool.
    const chimX = 1.05;
    const chimZ = -0.35;
    box(house, stoneMat, 0.56, 1.7, 0.56, chimX, WALL_TOP + ROOF_H - 0.25, chimZ);
    box(house, stonePlainMat, 0.78, 0.16, 0.78, chimX, WALL_TOP + ROOF_H + 0.66, chimZ);
    chimneyTopLocal = new THREE.Vector3(chimX, WALL_TOP + ROOF_H + 0.78, chimZ);

    // Arched front door + knob + stone step.
    const doorShape = new THREE.Shape();
    doorShape.moveTo(-0.43, 0);
    doorShape.lineTo(0.43, 0);
    doorShape.lineTo(0.43, 0.98);
    doorShape.absarc(0, 0.98, 0.43, 0, Math.PI, false);
    doorShape.lineTo(-0.43, 0);
    const door = put(
      house,
      new THREE.ExtrudeGeometry(doorShape, { depth: 0.09, bevelEnabled: false }),
      woodMat,
      -0.45,
      FOUND_H,
      HD / 2,
    );
    door.castShadow = true;
    const knob = put(house, new THREE.SphereGeometry(0.055, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc9a24b, roughness: 0.35, metalness: 0.7 }), -0.12, FOUND_H + 0.82, HD / 2 + 0.14, false);
    knob.castShadow = false;
    box(house, stonePlainMat, 1.25, 0.16, 0.6, -0.45, FOUND_H - 0.06, HD / 2 + 0.34, false, true);
    box(house, darkWoodMat, 1.0, 0.1, 0.08, -0.45, FOUND_H + 1.62, HD / 2 + 0.05);

    // Windows: frame + pane (shared glow material) + cross muntins + sill.
    const makeWindow = (parent: THREE.Object3D, x: number, y: number, z: number, rotY: number, flowerBox: boolean) => {
      const w = new THREE.Group();
      w.position.set(x, y, z);
      w.rotation.y = rotY;
      parent.add(w);
      box(w, darkWoodMat, 0.82, 0.98, 0.09, 0, 0, 0);
      const pane = put(w, new THREE.PlaneGeometry(0.64, 0.8), paneMat, 0, 0, 0.055, false);
      pane.castShadow = false;
      box(w, darkWoodMat, 0.06, 0.8, 0.05, 0, 0, 0.07, false);
      box(w, darkWoodMat, 0.64, 0.06, 0.05, 0, 0, 0.07, false);
      box(w, creamMat, 0.96, 0.09, 0.18, 0, -0.53, 0.03);
      if (flowerBox) {
        box(w, woodMat, 0.88, 0.2, 0.24, 0, -0.68, 0.12);
        const cols = [0xe86a8a, 0xf2b64b, 0xe86a8a, 0xffffff, 0xb678d8];
        for (let i = 0; i < 5; i++) {
          put(w, blobGeometry(0.11, i * 3.7 + 1, 0.8, 0), bushMat, -0.32 + i * 0.16, -0.56, 0.13, false);
          put(
            w,
            new THREE.IcosahedronGeometry(0.055, 0),
            new THREE.MeshStandardMaterial({ color: cols[i], roughness: 0.8, flatShading: true }),
            -0.32 + i * 0.16,
            -0.47,
            0.15,
            false,
          );
        }
      }
      return w;
    };
    makeWindow(house, 0.95, FOUND_H + 1.45, HD / 2 + 0.03, 0, true);
    makeWindow(house, -1.38, FOUND_H + 1.45, HD / 2 + 0.03, 0, true);
    makeWindow(house, HW / 2 + 0.03, FOUND_H + 1.45, 0.25, Math.PI / 2, false);
    makeWindow(house, -0.6, FOUND_H + 1.45, -HD / 2 - 0.03, Math.PI, false);

    // Round attic window on the +x gable.
    const attic = new THREE.Group();
    attic.position.set(HW / 2 + 0.02, WALL_TOP + 0.55, 0);
    attic.rotation.y = Math.PI / 2;
    house.add(attic);
    put(attic, new THREE.TorusGeometry(0.27, 0.055, 8, 20), darkWoodMat, 0, 0, 0, false);
    const atticPane = put(attic, new THREE.CircleGeometry(0.26, 20), paneMat, 0, 0, 0.01, false);
    atticPane.castShadow = false;
    box(attic, darkWoodMat, 0.05, 0.5, 0.04, 0, 0, 0.03, false);
    box(attic, darkWoodMat, 0.5, 0.05, 0.04, 0, 0, 0.03, false);
  }

  // Porch lantern beside the door + warm point light + fake glow sprite.
  const lanternPos = new THREE.Vector3(0.28, FOUND_H + 1.75, HD / 2 + 0.16);
  box(house, darkWoodMat, 0.07, 0.07, 0.3, 0.28, FOUND_H + 2.02, HD / 2 + 0.08, false);
  box(house, darkWoodMat, 0.2, 0.26, 0.2, lanternPos.x, lanternPos.y, lanternPos.z, false);
  put(house, new THREE.BoxGeometry(0.11, 0.16, 0.11), paneMat, lanternPos.x, lanternPos.y, lanternPos.z, false);
  const porchLight = new THREE.PointLight(0xffb066, 0, 9, 2);
  porchLight.position.set(0.28, FOUND_H + 1.75, HD / 2 + 0.65);
  house.add(porchLight);
  const glowMat = new THREE.SpriteMaterial({
    map: softTex,
    color: 0xffbe78,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(4.6);
  glow.position.set(-0.1, FOUND_H + 1.5, HD / 2 + 0.75);
  house.add(glow);

  // Chimney top in world-group space (house is a direct child of `group`).
  const chimneyTop = chimneyTopLocal
    .clone()
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), HOUSE_ROT)
    .add(house.position);


  // --- Windmill -----------------------------------------------------------------------
  const mill = new THREE.Group();
  mill.position.set(MILL_POS.x, terrainHeight(MILL_POS.x, MILL_POS.z) - 0.12, MILL_POS.z);
  mill.rotation.y = 0.6;
  group.add(mill);
  let rotor = new THREE.Group();
  {
    put(mill, new THREE.CylinderGeometry(1.3, 1.5, 0.5, 12), stoneMat, 0, 0.22, 0, true, true);
    put(mill, new THREE.CylinderGeometry(0.82, 1.28, 4.3, 12), stoneMat, 0, 2.35, 0, true, true);
    // Timber door + a small glowing window on the tower.
    box(mill, woodMat, 0.62, 1.05, 0.08, 0, 0.95, 1.24);
    box(mill, darkWoodMat, 0.5, 0.62, 0.07, 0, 3.1, 0.98, false);
    put(mill, new THREE.PlaneGeometry(0.34, 0.44), paneMat, 0, 3.1, 1.02, false);
    // Cap roof.
    put(mill, new THREE.ConeGeometry(1.18, 1.05, 12), roofMat, 0, 5.0, 0);
    put(mill, new THREE.SphereGeometry(0.11, 8, 8), darkWoodMat, 0, 5.6, 0, false);
    // Rotor: hub + axle at the tower top, blades in the rotor's xy-plane.
    rotor = new THREE.Group();
    rotor.position.set(0, 4.35, 1.05);
    mill.add(rotor);
    const axle = put(rotor, new THREE.CylinderGeometry(0.09, 0.09, 0.55, 8), darkWoodMat, 0, 0, 0.1, false);
    axle.rotation.x = Math.PI / 2;
    put(rotor, new THREE.SphereGeometry(0.17, 10, 8), darkWoodMat, 0, 0, 0.3, false);
    const sparGeo = new THREE.BoxGeometry(0.09, 2.35, 0.05);
    const railGeo = new THREE.BoxGeometry(0.05, 2.0, 0.04);
    const rungGeo = new THREE.BoxGeometry(0.52, 0.05, 0.04);
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Group();
      blade.rotation.z = (i * Math.PI) / 2;
      rotor.add(blade);
      put(blade, sparGeo, darkWoodMat, 0, 1.32, 0.3);
      put(blade, railGeo, darkWoodMat, 0.26, 1.45, 0.3, false);
      for (let rI = 0; rI < 4; rI++) {
        put(blade, rungGeo, darkWoodMat, 0.13, 0.62 + rI * 0.5, 0.3, false);
      }
      // Cream sail panel covering the outer part of the lattice.
      const sail = box(blade, sailMat, 0.46, 1.05, 0.025, 0.14, 1.85, 0.33, false);
      sail.castShadow = false;
    }
  }
  let rotorSpeed = 0;

  // --- Trees & bushes ------------------------------------------------------------------
  interface Swaying {
    node: THREE.Object3D;
    phase: number;
  }
  const swayers: Swaying[] = [];

  const makeOak = (scale: number, seed: number): THREE.Group => {
    const tree = new THREE.Group();
    const trunk = put(tree, new THREE.CylinderGeometry(0.14, 0.24, 1.5, 7), trunkMat, 0, 0.75, 0);
    trunk.rotation.z = (rng() - 0.5) * 0.08;
    const canopy = new THREE.Group();
    canopy.position.y = 1.35;
    tree.add(canopy);
    const blobs: Array<[number, number, number, number]> = [
      [0, 1.35, 0, 1.3],
      [0.78, 0.95, 0.18, 0.92],
      [-0.72, 1.05, -0.12, 0.98],
      [0.12, 1.95, -0.28, 0.88],
      [-0.18, 0.8, 0.6, 0.78],
    ];
    blobs.forEach(([bx, by, bz, br], i) => {
      put(canopy, blobGeometry(br, seed + i * 5.1, 0.82), leafMats[(seed + i) % leafMats.length], bx, by, bz);
    });
    tree.scale.setScalar(scale);
    swayers.push({ node: canopy, phase: rng() * Math.PI * 2 });
    return tree;
  };
  const makePine = (scale: number): THREE.Group => {
    const tree = new THREE.Group();
    put(tree, new THREE.CylinderGeometry(0.11, 0.19, 1.3, 7), trunkMat, 0, 0.65, 0);
    const canopy = new THREE.Group();
    canopy.position.y = 1.0;
    tree.add(canopy);
    put(canopy, new THREE.ConeGeometry(1.12, 1.5, 9), pineMat, 0, 0.85, 0);
    put(canopy, new THREE.ConeGeometry(0.88, 1.35, 9), pineMat, 0, 1.75, 0);
    put(canopy, new THREE.ConeGeometry(0.6, 1.2, 9), pineMat, 0, 2.6, 0);
    tree.scale.setScalar(scale);
    swayers.push({ node: canopy, phase: rng() * Math.PI * 2 });
    return tree;
  };
  const makeBlossom = (scale: number, seed: number): THREE.Group => {
    const tree = new THREE.Group();
    const trunk = put(tree, new THREE.CylinderGeometry(0.12, 0.2, 1.35, 7), trunkMat, 0, 0.67, 0);
    trunk.rotation.z = 0.06;
    const canopy = new THREE.Group();
    canopy.position.y = 1.2;
    tree.add(canopy);
    const blobs: Array<[number, number, number, number]> = [
      [0, 1.2, 0, 1.15],
      [0.68, 0.85, 0.15, 0.82],
      [-0.62, 0.95, -0.1, 0.86],
      [0.05, 1.7, 0.25, 0.72],
    ];
    blobs.forEach(([bx, by, bz, br], i) => {
      put(canopy, blobGeometry(br, seed + i * 4.3, 0.8), blossomMats[i % blossomMats.length], bx, by, bz);
    });
    tree.scale.setScalar(scale);
    swayers.push({ node: canopy, phase: rng() * Math.PI * 2 });
    return tree;
  };

  const treeSpecs: Array<{ kind: 'oak' | 'pine' | 'blossom'; x: number; z: number; s: number }> = [
    { kind: 'oak', x: 6.9, z: -2.3, s: 1.25 },
    { kind: 'pine', x: -6.9, z: 1.9, s: 1.15 },
    { kind: 'oak', x: 2.3, z: -6.1, s: 1.05 },
    { kind: 'blossom', x: -3.2, z: 4.9, s: 1.0 },
    { kind: 'pine', x: 7.3, z: 2.4, s: 0.95 },
    { kind: 'oak', x: -7.5, z: -1.6, s: 1.3 },
    { kind: 'pine', x: 0.6, z: -7.9, s: 1.2 },
    { kind: 'blossom', x: 5.6, z: -5.4, s: 0.8 },
    { kind: 'oak', x: -5.6, z: 6.1, s: 0.9 },
  ];
  treeSpecs.forEach((spec, i) => {
    const tree =
      spec.kind === 'oak' ? makeOak(spec.s, i * 7 + 2) : spec.kind === 'pine' ? makePine(spec.s) : makeBlossom(spec.s, i * 9 + 4);
    tree.position.set(spec.x, terrainHeight(spec.x, spec.z) - 0.07, spec.z);
    tree.rotation.y = rng() * Math.PI * 2;
    group.add(tree);
  });

  // Bushes tucked by the house, mill and fence line.
  const bushSpots: Array<[number, number, number]> = [
    [-3.6, 0.9, 0.5],
    [0.15, -2.15, 0.62],
    [-0.35, 1.95, 0.42],
    [-3.35, -2.2, 0.48],
    [-5.85, -4.35, 0.55],
    [1.35, -1.6, 0.4],
  ];
  bushSpots.forEach(([bx, bz, br], i) => {
    put(group, blobGeometry(br, i * 6.3 + 11, 0.75), bushMat, bx, terrainHeight(bx, bz) + br * 0.45, bz);
  });


  // --- Pond -----------------------------------------------------------------------------
  const waterY = terrainHeight(POND.x, POND.z) + 0.32;
  const waterUniforms: { [uniform: string]: THREE.IUniform } = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x6fa8bf) },
    uRain: { value: 0 },
  };
  {
    const waterMat = new THREE.ShaderMaterial({
      uniforms: waterUniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying vec3 vNormalW;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vNormalW = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uRain;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying vec3 vNormalW;
        void main() {
          vec2 c = vUv - 0.5;
          float dist = length(c) * 2.0;
          float cross = sin((vUv.x * 13.0 + uTime * 0.5) + sin(vUv.y * 11.0 - uTime * 0.4) * 1.6) * 0.5 + 0.5;
          vec3 col = uColor;
          col += cross * 0.012 * (1.0 + uRain * 0.8);
          col = mix(col, col * 0.88, smoothstep(0.55, 1.0, dist) * 0.5);
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float fres = pow(1.0 - max(dot(viewDir, normalize(vNormalW)), 0.0), 2.0);
          col += fres * 0.16;
          gl_FragColor = vec4(col, 0.94);
        }
      `,
    });
    const water = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 48), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(POND.x, waterY, POND.z);
    water.renderOrder = 1;
    group.add(water);

    // Lily pads + one small flower.
    const lilyMat = new THREE.MeshStandardMaterial({ color: 0x3e7d3a, roughness: 0.9, flatShading: true });
    const lilySpots: Array<[number, number, number]> = [
      [POND.x - 1.15, POND.z - 0.7, 0.3],
      [POND.x + 0.55, POND.z + 1.05, 0.24],
      [POND.x + 1.25, POND.z - 1.25, 0.2],
    ];
    lilySpots.forEach(([lx, lz, lr], i) => {
      const pad = put(group, new THREE.CylinderGeometry(lr, lr * 1.05, 0.035, 10), lilyMat, lx, waterY + 0.025, lz, false);
      pad.rotation.y = i * 1.7;
      if (i === 0) {
        put(group, new THREE.IcosahedronGeometry(0.075, 0), blossomMats[0], lx + 0.08, waterY + 0.1, lz, false);
      }
    });

    // Reeds at the shore: thin stems with brown tips, in three clusters.
    const reedMat = new THREE.MeshStandardMaterial({ color: 0x5c8a4a, roughness: 1 });
    const tipMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 });
    for (const ang of [0.5, 2.4, 4.4]) {
      for (let i = 0; i < 4; i++) {
        const rr = POND.r - 0.28 + rng() * 0.2;
        const rx = POND.x + Math.cos(ang + rng() * 0.24) * rr;
        const rz = POND.z + Math.sin(ang + rng() * 0.24) * rr;
        const baseY = Math.max(terrainHeight(rx, rz), waterY - 0.05);
        const stem = put(group, new THREE.CylinderGeometry(0.016, 0.024, 0.72, 5), reedMat, rx, baseY + 0.36, rz, false);
        stem.rotation.z = (rng() - 0.5) * 0.16;
        if (i % 2 === 0) put(group, new THREE.CylinderGeometry(0.035, 0.035, 0.17, 6), tipMat, rx, baseY + 0.78, rz, false);
      }
    }
  }

  // Ripple pool: rings are created once and recycled forever.
  interface Ripple {
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    life: number;
    active: boolean;
  }
  const ripples: Ripple[] = [];
  {
    const ringGeo = new THREE.RingGeometry(0.84, 0.95, 30);
    for (let i = 0; i < 36; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
      const m = new THREE.Mesh(ringGeo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = waterY + 0.03;
      m.visible = false;
      m.renderOrder = 2;
      group.add(m);
      ripples.push({ mesh: m, mat, life: 0, active: false });
    }
  }
  let rippleAcc = 0;
  const spawnRipple = (): void => {
    const slot = ripples.find((r) => !r.active) ?? ripples[0];
    const ang = rng() * Math.PI * 2;
    const rr = Math.sqrt(rng()) * (POND.r - 0.55);
    slot.mesh.position.x = POND.x + Math.cos(ang) * rr;
    slot.mesh.position.z = POND.z + Math.sin(ang) * rr;
    slot.life = 0;
    slot.active = true;
    slot.mesh.visible = true;
  };

  // --- Props ------------------------------------------------------------------------------
  {
    // Fence along the north shore of the pond: posts + two rails per span.
    const fencePts: Array<[number, number]> = [
      [1.7, 5.1],
      [3.0, 5.8],
      [4.5, 6.05],
      [6.0, 5.7],
    ];
    const postGeo = new THREE.BoxGeometry(0.1, 0.78, 0.1);
    const postTops: THREE.Vector3[] = [];
    fencePts.forEach(([fx, fz]) => {
      const fy = terrainHeight(fx, fz);
      put(group, postGeo, woodMat, fx, fy + 0.36, fz);
      postTops.push(new THREE.Vector3(fx, fy, fz));
    });
    for (let i = 0; i < postTops.length - 1; i++) {
      const a = postTops[i];
      const b = postTops[i + 1];
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      for (const hOff of [0.3, 0.58]) {
        const rail = box(group, woodMat, len + 0.12, 0.055, 0.045, mid.x, mid.y + hOff, mid.z, false);
        rail.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
      }
    }

    // Scattered rocks.
    let placedRocks = 0;
    let guard = 0;
    while (placedRocks < 7 && guard++ < 120) {
      const ang = rng() * Math.PI * 2;
      const rr = 3.6 + rng() * 5.4;
      const rx = Math.cos(ang) * rr;
      const rz = Math.sin(ang) * rr;
      if (!isOpenGround(rx, rz)) continue;
      const rock = put(
        group,
        blobGeometry(0.32 + rng() * 0.34, placedRocks * 8.9 + 3, 0.72),
        stonePlainMat,
        rx,
        terrainHeight(rx, rz) + 0.1,
        rz,
      );
      rock.rotation.y = rng() * Math.PI;
      placedRocks++;
    }

    // Mushroom cluster by the big oak.
    const mushMat = new THREE.MeshStandardMaterial({ color: 0xc2503c, roughness: 0.85, flatShading: true });
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xf0e6d2, roughness: 0.95 });
    for (let i = 0; i < 3; i++) {
      const mx = 6.15 + rng() * 0.5;
      const mz = -1.35 + rng() * 0.5;
      const my = terrainHeight(mx, mz);
      put(group, new THREE.CylinderGeometry(0.045, 0.065, 0.2, 7), stemMat, mx, my + 0.1, mz, false);
      put(group, new THREE.SphereGeometry(0.13 + rng() * 0.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mushMat, mx, my + 0.19, mz, false);
    }

    // Barrel + crate beside the house.
    const barrel = new THREE.Group();
    barrel.position.set(0.35, terrainHeight(0.35, -2.3) + 0.34, -2.3);
    group.add(barrel);
    put(barrel, new THREE.CylinderGeometry(0.3, 0.3, 0.68, 12), woodMat, 0, 0, 0);
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x4c4c52, roughness: 0.5, metalness: 0.6 });
    for (const by of [-0.2, 0.2]) {
      const band = put(barrel, new THREE.TorusGeometry(0.305, 0.022, 6, 18), bandMat, 0, by, 0, false);
      band.rotation.x = Math.PI / 2;
    }
    const crate = box(group, woodMat, 0.56, 0.56, 0.56, -3.85, terrainHeight(-3.85, 0.75) + 0.26, 0.75);
    crate.rotation.y = 0.5;
  }

  // --- Meadow: instanced flowers + grass tufts ------------------------------------------------
  const tuftUniforms = {
    uTime: { value: 0 },
    uWind: { value: 0.3 },
  };
  {
    // Flowers: instanced heads on instanced stems.
    const FLOWERS = 130;
    const headGeo = new THREE.IcosahedronGeometry(0.075, 0);
    const stemGeo = new THREE.CylinderGeometry(0.014, 0.02, 0.34, 5);
    const headMat = new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true });
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x4e7d3a, roughness: 1 });
    const heads = new THREE.InstancedMesh(headGeo, headMat, FLOWERS);
    const stems = new THREE.InstancedMesh(stemGeo, stemMat, FLOWERS);
    heads.castShadow = false;
    stems.castShadow = false;
    const flowerCols = [0xe86a8a, 0xf2b64b, 0xffffff, 0xb678d8, 0xef8354].map((c) => new THREE.Color(c));
    const dummy = new THREE.Object3D();
    const colTmp = new THREE.Color();
    let fi = 0;
    let guard = 0;
    while (fi < FLOWERS && guard++ < 2600) {
      const ang = rng() * Math.PI * 2;
      const rr = Math.sqrt(rng()) * 9.2;
      const fx = Math.cos(ang) * rr;
      const fz = Math.sin(ang) * rr;
      if (!isOpenGround(fx, fz)) continue;
      const fy = terrainHeight(fx, fz);
      dummy.position.set(fx, fy + 0.36, fz);
      dummy.rotation.set(0, rng() * Math.PI, 0);
      const s = 0.8 + rng() * 0.6;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      heads.setMatrixAt(fi, dummy.matrix);
      colTmp.copy(flowerCols[fi % flowerCols.length]).offsetHSL(0, 0, (rng() - 0.5) * 0.06);
      heads.setColorAt(fi, colTmp);
      dummy.position.y = fy + 0.17;
      dummy.updateMatrix();
      stems.setMatrixAt(fi, dummy.matrix);
      fi++;
    }
    heads.count = fi;
    stems.count = fi;
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
    group.add(heads);
    group.add(stems);

    // Grass tufts: one merged 3-blade geometry, wind bend patched into the shader.
    const blade = (tiltZ: number, tiltX: number, ox: number, oz: number): THREE.BufferGeometry => {
      const g = new THREE.ConeGeometry(0.05, 0.46, 4).toNonIndexed();
      g.translate(0, 0.23, 0);
      g.rotateX(tiltX);
      g.rotateZ(tiltZ);
      g.translate(ox, 0, oz);
      return g;
    };
    const tuftGeo = mergeGeoms([blade(0, 0, 0, 0), blade(0.3, 0.1, 0.08, 0.03), blade(-0.28, -0.12, -0.08, -0.02)]);
    const tuftMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
    tuftMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = tuftUniforms.uTime;
      shader.uniforms.uWind = tuftUniforms.uWind;
      shader.vertexShader = 'uniform float uTime;\nuniform float uWind;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float swayPh = instanceMatrix[3][0] * 1.7 + instanceMatrix[3][2] * 1.3;
          transformed.x += sin(uTime * 2.1 + swayPh) * uWind * transformed.y * 0.38;
          transformed.z += cos(uTime * 1.7 + swayPh * 1.3) * uWind * transformed.y * 0.22;
        #endif
        `,
      );
    };
    const TUFTS = 380;
    const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, TUFTS);
    tufts.castShadow = false;
    tufts.receiveShadow = true;
    const tuftCols = [0x5da24e, 0x6cab57, 0x4c9041, 0x7cb661].map((c) => new THREE.Color(c));
    let ti = 0;
    guard = 0;
    while (ti < TUFTS && guard++ < 7000) {
      const ang = rng() * Math.PI * 2;
      const rr = Math.sqrt(rng()) * 9.3;
      const tx = Math.cos(ang) * rr;
      const tz = Math.sin(ang) * rr;
      if (!isOpenGround(tx, tz)) continue;
      dummy.position.set(tx, terrainHeight(tx, tz) - 0.02, tz);
      dummy.rotation.set(0, rng() * Math.PI, 0);
      dummy.scale.setScalar(0.75 + rng() * 0.8);
      dummy.updateMatrix();
      tufts.setMatrixAt(ti, dummy.matrix);
      colTmp.copy(tuftCols[ti % tuftCols.length]).offsetHSL(0, 0, (rng() - 0.5) * 0.05);
      tufts.setColorAt(ti, colTmp);
      ti++;
    }
    tufts.count = ti;
    if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true;
    group.add(tufts);
  }


  // --- Clouds ----------------------------------------------------------------------------------
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
  const cloudGeo = new THREE.SphereGeometry(1, 18, 12);
  interface Cloud {
    node: THREE.Group;
    speed: number;
  }
  const clouds: Cloud[] = [];
  {
    for (let i = 0; i < 6; i++) {
      const cloud = new THREE.Group();
      const puffs = 4 + Math.floor(rng() * 4);
      for (let p = 0; p < puffs; p++) {
        const m = put(cloud, cloudGeo, cloudMat, (p - (puffs - 1) / 2) * 0.95 + (rng() - 0.5) * 0.4, (rng() - 0.5) * 0.35, (rng() - 0.5) * 0.9, false);
        const s = 0.75 + rng() * 0.85;
        m.scale.set(s * 1.35, s * 0.55, s);
      }
      const ang = (i / 6) * Math.PI * 2 + rng() * 0.7;
      const rr = 19 + rng() * 10;
      cloud.position.set(Math.cos(ang) * rr, 11.5 + rng() * 4.5, Math.sin(ang) * rr);
      cloud.scale.setScalar(0.55 + rng() * 0.35);
      group.add(cloud);
      clouds.push({ node: cloud, speed: 0.7 + rng() * 0.6 });
    }
  }

  // --- Chimney smoke ------------------------------------------------------------------------------
  interface SmokePuff {
    sprite: THREE.Sprite;
    mat: THREE.SpriteMaterial;
    age: number;
    life: number;
    seed: number;
  }
  const smokes: SmokePuff[] = [];
  {
    for (let i = 0; i < 22; i++) {
      const mat = new THREE.SpriteMaterial({ map: softTex, color: 0xd9d9dd, transparent: true, opacity: 0, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      group.add(sprite);
      const life = 3.4 + rng() * 1.6;
      smokes.push({ sprite, mat, age: (i / 22) * life, life, seed: rng() * Math.PI * 2 });
    }
  }

  // --- Fireflies --------------------------------------------------------------------------------------
  const FLIES = 40;
  const flyBase = new Float32Array(FLIES * 3);
  const flyPos = new Float32Array(FLIES * 3);
  const flySeed = new Float32Array(FLIES);
  const flyMat = new THREE.PointsMaterial({
    color: 0xffdf8a,
    size: 0.16,
    sizeAttenuation: true,
    map: softTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const flyGeo = new THREE.BufferGeometry();
  {
    for (let i = 0; i < FLIES; i++) {
      const ang = rng() * Math.PI * 2;
      const rr = 1.5 + rng() * 6.5;
      const fx = Math.cos(ang) * rr;
      const fz = Math.sin(ang) * rr;
      flyBase[i * 3] = fx;
      flyBase[i * 3 + 1] = terrainHeight(fx, fz) + 0.55 + rng() * 1.25;
      flyBase[i * 3 + 2] = fz;
      flySeed[i] = rng() * Math.PI * 2;
    }
    flyPos.set(flyBase);
    flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
    const points = new THREE.Points(flyGeo, flyMat);
    points.frustumCulled = false;
    group.add(points);
  }

  // --- Floating rock shards below the island --------------------------------------------------------------
  interface Shard {
    mesh: THREE.Mesh;
    angle: number;
    radius: number;
    yBase: number;
    speed: number;
  }
  const shards: Shard[] = [];
  {
    const shardSpecs: Array<[number, number, number, number]> = [
      [3.4, 0.4, -8.6, 0.5],
      [5.1, 2.6, -9.4, 0.38],
      [4.2, 4.7, -8.9, 0.3],
    ];
    shardSpecs.forEach(([radius, angle, yBase, size], i) => {
      const m = put(group, blobGeometry(size, i * 13.7 + 5, 0.9), stonePlainMat, Math.cos(angle) * radius, yBase, Math.sin(angle) * radius);
      shards.push({ mesh: m, angle, radius, yBase, speed: 0.045 + i * 0.014 });
    });
  }

  // --- Per-frame update --------------------------------------------------------------------------------------
  const update = (dt: number, t: number, ctx: WorldCtx): void => {
    // Whole-island float.
    group.position.y = ctx.calm ? 0 : Math.sin(t * 0.45) * 0.16;
    group.rotation.y = ctx.calm ? 0 : Math.sin(t * 0.11) * 0.01;

    // Windmill rotor: ease toward the wind-driven target speed.
    const targetSpeed = Math.pow(Math.max(ctx.wind, 0), 1.15) * 3.2;
    rotorSpeed = lerp(rotorSpeed, targetSpeed, clamp(dt * 1.6, 0, 1));
    if (rotorSpeed > 0.0005) rotor.rotation.z -= rotorSpeed * dt;

    // Tree sway from the one shared wind state.
    const swayAmp = ctx.calm ? 0 : 0.055 * (0.15 + ctx.wind);
    if (swayAmp > 0) {
      const swayFreq = 0.7 + ctx.wind * 1.6;
      for (const s of swayers) {
        s.node.rotation.z = Math.sin(t * swayFreq + s.phase) * swayAmp;
        s.node.rotation.x = Math.cos(t * swayFreq * 0.83 + s.phase * 1.3) * swayAmp * 0.6;
      }
    }

    // House lights: panes, porch light and the fake glow all share one amount.
    paneMat.emissiveIntensity = ctx.lightsAmount * (0.25 + ctx.night * 2.2);
    paneMat.color.lerpColors(PANE_DAY, PANE_LIT, clamp(ctx.lightsAmount * (0.3 + ctx.night * 0.7), 0, 1));
    porchLight.intensity = ctx.lightsAmount * (ctx.night > 0.25 ? 14 : 5);
    glowMat.opacity = ctx.lightsAmount * (0.1 + ctx.night * 0.3);

    // Pond: shader clock + colour from the environment, pooled ripples.
    waterUniforms.uTime.value = t;
    (waterUniforms.uColor.value as THREE.Color).copy(ctx.waterColor);
    waterUniforms.uRain.value = ctx.rainAmount;
    const rippleRate = ctx.rainAmount > 0.03 ? 14 * ctx.rainAmount : 0.7;
    rippleAcc += dt * rippleRate;
    while (rippleAcc >= 1) {
      rippleAcc -= 1;
      spawnRipple();
    }
    for (const r of ripples) {
      if (!r.active) continue;
      r.life += dt / 1.15;
      if (r.life >= 1) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const s = lerp(0.12, 1.05, r.life);
      r.mesh.scale.set(s, s, s);
      r.mat.opacity = (1 - r.life) * 0.5;
    }

    // Grass tuft shader wind.
    tuftUniforms.uTime.value = t;
    tuftUniforms.uWind.value = ctx.calm ? 0 : ctx.wind;

    // Clouds drift on the same wind; wrap around the island.
    cloudMat.color.copy(ctx.cloudColor);
    cloudMat.opacity = 0.92 - ctx.rainAmount * 0.07;
    const cloudSpeed = ctx.calm ? 0.12 : 0.25 + ctx.wind * 2.6;
    for (const c of clouds) {
      c.node.position.x += cloudSpeed * c.speed * dt;
      if (c.node.position.x > 34) c.node.position.x = -34;
    }

    // Chimney smoke: rise, expand, fade, lean with the wind.
    for (const p of smokes) {
      p.age += dt;
      if (p.age >= p.life) {
        p.age = 0;
        p.life = 3.4 + ((p.seed * 7.7) % 1.6);
      }
      const k = p.age / p.life;
      const drift = (0.2 + ctx.wind * 1.8) * k * k * 1.7;
      const flutter = ctx.calm ? 0 : Math.sin(p.age * 2.2 + p.seed) * 0.09 * k;
      p.sprite.position.set(chimneyTop.x + drift + flutter, chimneyTop.y + k * 2.7, chimneyTop.z + flutter * 0.6);
      p.sprite.scale.setScalar(0.38 + k * 1.6);
      p.mat.opacity = Math.sin(k * Math.PI) * 0.32 * (1 - ctx.rainAmount * 0.35);
    }

    // Fireflies wander on sine fields, visible only after dark.
    const flyOpacity = ctx.night * 0.9 * (1 - ctx.rainAmount * 0.7);
    flyMat.opacity = flyOpacity;
    if (flyOpacity > 0.02) {
      for (let i = 0; i < FLIES; i++) {
        const sd = flySeed[i];
        flyPos[i * 3] = flyBase[i * 3] + Math.sin(t * 0.6 + sd * 3.1) * 0.4;
        flyPos[i * 3 + 1] = flyBase[i * 3 + 1] + Math.sin(t * 0.9 + sd * 5.3) * 0.22;
        flyPos[i * 3 + 2] = flyBase[i * 3 + 2] + Math.cos(t * 0.5 + sd * 4.2) * 0.4;
      }
      (flyGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // Shards orbit slowly beneath the island.
    if (!ctx.calm) {
      for (const s of shards) {
        s.angle += s.speed * dt;
        s.mesh.position.x = Math.cos(s.angle) * s.radius;
        s.mesh.position.z = Math.sin(s.angle) * s.radius;
        s.mesh.position.y = s.yBase + Math.sin(t * 0.5 + s.radius) * 0.14;
        s.mesh.rotation.y += dt * 0.05;
      }
    }
  };

  return { group, house, update };
}
