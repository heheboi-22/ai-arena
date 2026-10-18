import { BufferAttribute, BufferGeometry, Color, Mesh, type MeshStandardMaterial } from 'three';
import { valueNoise } from '../util/noise';
import { smoothstep } from '../util/math';
import { ISLAND, WATER_LEVEL, pondDistance, rimRadius, terrainHeight } from './terrain';
import { PALETTE } from './materials';

const TOP_COLORS = {
  light: new Color(PALETTE.grassLight),
  mid: new Color(PALETTE.grassMid),
  dark: new Color(PALETTE.grassDark),
  soil: new Color(PALETTE.soil),
  bank: new Color(PALETTE.bank),
};

const ROCK_COLORS = {
  moss: new Color(PALETTE.rockMoss),
  warm: new Color(PALETTE.rockWarm),
  deep: new Color(PALETTE.rockDeep),
};

/** Writes the vertex colour for one point of the grass top into `out`. */
function grassVertexColor(x: number, y: number, z: number, rimT: number, out: Color): void {
  out.copy(TOP_COLORS.mid);
  out.lerp(TOP_COLORS.light, smoothstep(0.05, 0.22, y));
  out.lerp(TOP_COLORS.dark, smoothstep(-0.02, -0.18, y));

  // Gentle tonal noise so large areas don't read as one flat fill.
  const n = valueNoise(x * 1.7 + 4.1, z * 1.7 - 2.3);
  out.multiplyScalar(0.94 + (n - 0.5) * 0.14);

  // A thin soil lip where the grass ends at the cliff.
  out.lerp(TOP_COLORS.soil, smoothstep(0.9, 0.985, rimT) * 0.85);

  // Pale pebbly bank around the waterline.
  const shore = 1 - smoothstep(0.0, 0.1, Math.abs(y - WATER_LEVEL));
  const nearPond = 1 - smoothstep(1.0, 1.5, pondDistance(x, z));
  out.lerp(TOP_COLORS.bank, shore * (0.35 + 0.65 * nearPond));
}

/**
 * Grass top: a polar grid whose outer ring follows rimRadius() and whose height
 * comes from terrainHeight(), so the pond, plateau and rim are exact.
 */
export function createIslandTop(material: MeshStandardMaterial): Mesh {
  const ROWS = 64;
  const COLS = 200;
  const stride = COLS + 1;
  const positions = new Float32Array((ROWS + 1) * stride * 3);
  const colors = new Float32Array((ROWS + 1) * stride * 3);
  const tmp = new Color();

  for (let i = 0; i <= ROWS; i++) {
    const t = i / ROWS;
    for (let j = 0; j <= COLS; j++) {
      const theta = (j / COLS) * Math.PI * 2;
      const r = rimRadius(theta) * t;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const y = terrainHeight(x, z);
      const o = (i * stride + j) * 3;
      positions[o] = x;
      positions[o + 1] = y;
      positions[o + 2] = z;
      grassVertexColor(x, y, z, t, tmp);
      colors[o] = tmp.r;
      colors[o + 1] = tmp.g;
      colors[o + 2] = tmp.b;
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < ROWS; i++) {
    for (let j = 0; j < COLS; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + j + 1;
      const d = i * stride + j + 1;
      // Wound so the normal points up (+y).
      indices.push(a, c, b, a, d, c);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'island-top';
  return mesh;
}

/**
 * Rock underside: the same rim as the grass, tapering into a sculpted, slightly
 * lumpy point. Layers are coloured by depth so the stone reads as strata.
 */
export function createIslandRock(material: MeshStandardMaterial): Mesh {
  const ROWS = 44;
  const COLS = 128;
  const stride = COLS + 1;
  const positions = new Float32Array((ROWS + 1) * stride * 3);
  const colors = new Float32Array((ROWS + 1) * stride * 3);
  const tmp = new Color();

  for (let i = 0; i <= ROWS; i++) {
    const v = i / ROWS;
    for (let j = 0; j <= COLS; j++) {
      const theta = (j / COLS) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      // Periodic sampling (cos/sin of theta) keeps the noise seamless around the island.
      const lump = valueNoise(cosT * 1.6 + 5, sinT * 1.6 + v * 2.8);
      const bulge = 1 + (lump - 0.5) * 0.34 * smoothstep(0, 0.22, v);
      const r = rimRadius(theta) * Math.pow(1 - v, 0.72) * bulge;
      const y =
        -ISLAND.depth * v +
        (valueNoise(cosT * 2.4 + 9, sinT * 2.4 - v * 3.2) - 0.5) * 0.9 * v * (1 - v);

      const x = cosT * r;
      const z = sinT * r;
      const o = (i * stride + j) * 3;
      positions[o] = x;
      positions[o + 1] = y;
      positions[o + 2] = z;

      // Strata bands with a little noise so the layers are not perfectly straight.
      const strata = 0.93 + 0.07 * Math.sin(v * 58 + lump * 3.5);
      if (v < 0.13) {
        tmp.copy(ROCK_COLORS.moss).lerp(ROCK_COLORS.warm, smoothstep(0.0, 0.13, v));
      } else {
        tmp.copy(ROCK_COLORS.warm).lerp(ROCK_COLORS.deep, smoothstep(0.3, 0.95, v));
      }
      tmp.multiplyScalar(strata);
      colors[o] = tmp.r;
      colors[o + 1] = tmp.g;
      colors[o + 2] = tmp.b;
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < ROWS; i++) {
    for (let j = 0; j < COLS; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + j + 1;
      const d = i * stride + j + 1;
      // Wound so the normal points outward and down. Verified by hand: the rock
      // grows downward from the rim, so the winding is the reverse of the grass top.
      indices.push(a, c, b, a, d, c);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'island-rock';
  return mesh;
}
