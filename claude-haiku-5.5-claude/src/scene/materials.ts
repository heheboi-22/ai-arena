import {
  CanvasTexture,
  Color,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { createRng } from '../util/math';

// Palette: soft greens, warm wood, cream walls, muted water, amber windows.
export const PALETTE = {
  grassLight: 0xa6cc7a,
  grassMid: 0x88b462,
  grassDark: 0x6d9a4f,
  soil: 0x7d6247,
  rockMoss: 0x8a9a6a,
  rockWarm: 0xb9a78a,
  rockDeep: 0xa39a8e,
  plaster: 0xf3e7cc,
  roof: 0xbd6d50,
  wood: 0x9c6b40,
  woodDark: 0x6a4628,
  door: 0x7f5130,
  glassOff: 0x3e586a,
  glassOn: 0xffc46e,
  water: 0x4f8fb3,
  bank: 0xb7a77f,
  pathStone: 0xd9c49a,
  fence: 0xcaa67c,
  cloud: 0xfcf7ee,
  treeLight: 0x7db565,
  treeMid: 0x5f9c4d,
  treeDeep: 0x4b8042,
  conifer: 0x3f7050,
  trunk: 0x7a5634,
  windmillWall: 0xf2e4c8,
  windmillCap: 0xb8664a,
  blade: 0xf6ecd8,
  flowerYellow: 0xf2c14e,
  flowerPink: 0xf08aa0,
  flowerWhite: 0xfff4e4,
  shrub: 0x6f9f58,
} as const;

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is unavailable');
  return [canvas, ctx];
}

function toTexture(canvas: HTMLCanvasElement, repeat: boolean): CanvasTexture {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  if (repeat) {
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
  }
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Greyscale plaster speckle. Multiplied by a material colour, so one texture serves many tints. */
function plasterTexture(): Texture {
  const [canvas, ctx] = makeCanvas(256);
  const rng = createRng(11);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = 200 + Math.floor(rng() * 55);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(rng() * 256, rng() * 256, 1 + rng() * 2, 1 + rng() * 2);
  }
  return toTexture(canvas, true);
}

/** Vertical wood grain. */
function woodTexture(): Texture {
  const [canvas, ctx] = makeCanvas(256);
  const rng = createRng(29);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 4) {
    const v = 185 + Math.floor(rng() * 70);
    ctx.fillStyle = `rgba(${v},${v},${v},0.9)`;
    ctx.fillRect(x, 0, 2 + rng() * 2, 256);
  }
  for (let i = 0; i < 260; i++) {
    const v = 150 + Math.floor(rng() * 40);
    ctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
    ctx.fillRect(rng() * 256, rng() * 256, 1, 8 + rng() * 22);
  }
  return toTexture(canvas, true);
}

/** Horizontal clay roof tiles with staggered joints. */
function roofTexture(): Texture {
  const [canvas, ctx] = makeCanvas(256);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 256);
  const rows = 8;
  const cols = 8;
  for (let row = 0; row < rows; row++) {
    const y = (row / rows) * 256;
    const offset = row % 2 ? 128 / cols : 0;
    for (let col = 0; col < cols; col++) {
      const x = (col / cols) * 256 + offset;
      ctx.fillStyle = `rgb(${236 + (col % 3) * 6},${236 + (row % 2) * 6},${236})`;
      ctx.fillRect(x + 2, y + 2, 256 / cols - 4, 256 / rows - 4);
    }
    ctx.fillStyle = 'rgba(90,90,90,0.5)';
    ctx.fillRect(0, y, 256, 2);
  }
  return toTexture(canvas, true);
}

/** Radial falloff for the soft glow around the house. Used as a sprite map. */
export function glowTexture(): Texture {
  const [canvas, ctx] = makeCanvas(128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return toTexture(canvas, false);
}

export interface SharedMaterials {
  grass: MeshStandardMaterial;
  rock: MeshStandardMaterial;
  pond: MeshStandardMaterial;
  path: MeshStandardMaterial;
  plaster: MeshStandardMaterial;
  roof: MeshStandardMaterial;
  wood: MeshStandardMaterial;
  woodDark: MeshStandardMaterial;
  door: MeshStandardMaterial;
  glass: MeshStandardMaterial;
  windmillWall: MeshStandardMaterial;
  windmillCap: MeshStandardMaterial;
  blade: MeshStandardMaterial;
  trunk: MeshStandardMaterial;
  treeLight: MeshStandardMaterial;
  treeMid: MeshStandardMaterial;
  treeDeep: MeshStandardMaterial;
  conifer: MeshStandardMaterial;
  shrub: MeshStandardMaterial;
  stone: MeshStandardMaterial;
  fence: MeshStandardMaterial;
  cloud: MeshStandardMaterial;
  flower: MeshStandardMaterial;
}

export function createMaterials(): SharedMaterials {
  const plasterMap = plasterTexture();
  const woodMap = woodTexture();
  const roofMap = roofTexture();
  const std = (color: number, extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}) =>
    new MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, ...extra });

  return {
    grass: std(0xffffff, { vertexColors: true }),
    rock: std(0xffffff, { vertexColors: true, roughness: 1 }),
    pond: new MeshStandardMaterial({ color: PALETTE.water, roughness: 0.18, metalness: 0.02 }),
    path: std(PALETTE.pathStone),
    plaster: std(PALETTE.plaster, { map: plasterMap }),
    roof: std(PALETTE.roof, { map: roofMap }),
    wood: std(PALETTE.wood, { map: woodMap }),
    woodDark: std(PALETTE.woodDark, { map: woodMap }),
    door: std(PALETTE.door, { map: woodMap }),
    // One glass material for every window. The world eases its colour from the
    // dark "off" glass to amber and raises its emissive intensity together.
    glass: new MeshStandardMaterial({
      color: PALETTE.glassOff,
      emissive: new Color(PALETTE.glassOn),
      emissiveIntensity: 0,
      roughness: 0.25,
      metalness: 0.05,
    }),
    windmillWall: std(PALETTE.windmillWall, { map: plasterMap }),
    windmillCap: std(PALETTE.windmillCap, { map: roofMap }),
    blade: std(PALETTE.blade, { map: woodMap }),
    trunk: std(PALETTE.trunk),
    treeLight: std(PALETTE.treeLight, { flatShading: true }),
    treeMid: std(PALETTE.treeMid, { flatShading: true }),
    treeDeep: std(PALETTE.treeDeep, { flatShading: true }),
    conifer: std(PALETTE.conifer, { flatShading: true }),
    shrub: std(PALETTE.shrub, { flatShading: true }),
    stone: std(PALETTE.rockWarm, { flatShading: true }),
    fence: std(PALETTE.fence, { map: woodMap }),
    cloud: std(PALETTE.cloud, { flatShading: false, roughness: 1 }),
    flower: std(0xffffff, { roughness: 0.7 }),
  };
}
