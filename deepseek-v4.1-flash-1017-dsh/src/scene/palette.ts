import {
  Color,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Texture,
} from 'three';
import type { TextureSet } from '../lib/textures';

/**
 * The island palette. Every color is sampled from the miniature:
 * moss and meadow greens, weathered stone, warm timber, cream plaster,
 * terracotta tile, muted pond blue and a single amber light.
 */
export const PALETTE = {
  ink: '#29342b',
  grass: '#7fa55d',
  grassLight: '#a1bd7e',
  grassDark: '#5f8548',
  grassEdge: '#54783f',
  soil: '#7c5b41',
  soilDark: '#634833',
  rock: '#8d8578',
  rockDark: '#6c665c',
  rockLight: '#b3a996',
  stone: '#8e887b',
  sand: '#c7ad82',
  path: '#b79a70',
  waterDeep: '#356576',
  waterShallow: '#6d9995',
  waterSky: '#a9c8cc',
  wood: '#715039',
  woodDark: '#4b3426',
  woodLight: '#9b7351',
  cream: '#ecdfc5',
  plaster: '#e8d9bb',
  terracotta: '#a35d49',
  terracottaDark: '#7e4436',
  windowDark: '#2d3a38',
  amber: '#ffb257',
  amberDeep: '#e58b3e',
  leafA: '#789560',
  leafB: '#8da878',
  leafC: '#667f55',
  leafPine: '#506c4e',
  leafPineLight: '#6a8362',
  blossom: '#f0d7c7',
  cloud: '#f2eee2',
  flowerCream: '#f4e8c8',
  flowerRose: '#d98f83',
  flowerGold: '#e5b85b',
  smoke: '#cfc7b8',
} as const;

export interface SceneMaterials {
  terrain: MeshStandardMaterial;
  island: MeshStandardMaterial;
  rock: MeshStandardMaterial;
  stone: MeshStandardMaterial;
  sand: MeshStandardMaterial;
  path: MeshStandardMaterial;
  wood: MeshStandardMaterial;
  woodDark: MeshStandardMaterial;
  woodLight: MeshStandardMaterial;
  plaster: MeshStandardMaterial;
  cream: MeshStandardMaterial;
  roof: MeshStandardMaterial;
  roofDark: MeshStandardMaterial;
  window: MeshStandardMaterial;
  terracottaMat: MeshStandardMaterial;
  brass: MeshStandardMaterial;
  leafA: MeshStandardMaterial;
  leafB: MeshStandardMaterial;
  leafC: MeshStandardMaterial;
  pine: MeshStandardMaterial;
  pineLight: MeshStandardMaterial;
  blossom: MeshStandardMaterial;
  cloud: MeshStandardMaterial;
  flowerCream: MeshStandardMaterial;
  flowerRose: MeshStandardMaterial;
  flowerGold: MeshStandardMaterial;
  glass: MeshStandardMaterial;
  warmGlow: MeshBasicMaterial;
}

function tex(texture: Texture, repeatX = 1, repeatY = 1): Texture {
  const clone = texture.clone();
  clone.needsUpdate = true;
  clone.repeat.set(repeatX, repeatY);
  return clone;
}

export function createMaterials(textures: TextureSet): SceneMaterials {
  const terrain = new MeshStandardMaterial({
    map: tex(textures.grass, 4, 4),
    color: new Color('#e8eadc'),
    roughness: 0.97,
    metalness: 0,
  });

  const island = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.98,
    metalness: 0,
    flatShading: true,
  });

  const rock = new MeshStandardMaterial({
    map: tex(textures.rock, 1, 1),
    color: new Color('#b4aa9b'),
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
  });

  const stone = new MeshStandardMaterial({
    map: tex(textures.rock, 2, 1),
    color: new Color('#a8a094'),
    roughness: 0.92,
    metalness: 0,
    flatShading: true,
  });

  const sand = new MeshStandardMaterial({
    map: tex(textures.sand, 2, 2),
    color: new Color('#ffffff'),
    roughness: 1,
    metalness: 0,
  });

  const path = new MeshStandardMaterial({
    map: tex(textures.path, 1, 1),
    color: new Color('#ffffff'),
    roughness: 1,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const wood = new MeshStandardMaterial({
    map: tex(textures.wood, 1, 1),
    color: new Color('#c19a75'),
    roughness: 0.82,
    metalness: 0,
  });

  const woodDark = new MeshStandardMaterial({
    map: tex(textures.wood, 1, 1),
    color: new Color('#806048'),
    roughness: 0.86,
    metalness: 0,
  });

  const woodLight = new MeshStandardMaterial({
    map: tex(textures.wood, 1, 1),
    color: new Color('#c9a47c'),
    roughness: 0.8,
    metalness: 0,
  });

  const plaster = new MeshStandardMaterial({
    map: tex(textures.plaster, 1, 1),
    color: new Color('#ffffff'),
    roughness: 0.95,
    metalness: 0,
  });

  const cream = new MeshStandardMaterial({
    color: new Color(PALETTE.cream),
    roughness: 0.9,
    metalness: 0,
  });

  const roof = new MeshStandardMaterial({
    map: tex(textures.roof, 2, 2),
    color: new Color('#f0ded7'),
    roughness: 0.9,
    metalness: 0,
  });

  const roofDark = new MeshStandardMaterial({
    color: new Color(PALETTE.terracottaDark),
    roughness: 0.92,
    metalness: 0,
  });

  const windowMaterial = new MeshStandardMaterial({
    color: new Color(PALETTE.windowDark),
    roughness: 0.25,
    metalness: 0.2,
    emissive: new Color(PALETTE.amber),
    emissiveIntensity: 0,
  });

  const leaf = (color: string, flatShading = true, roughness = 0.9): MeshStandardMaterial =>
    new MeshStandardMaterial({ color: new Color(color), roughness, metalness: 0, flatShading });

  const cloud = new MeshStandardMaterial({
    color: new Color(PALETTE.cloud),
    emissive: new Color(PALETTE.cloud),
    emissiveIntensity: 0.12,
    roughness: 1,
    metalness: 0,
    flatShading: false,
  });

  const glass = new MeshStandardMaterial({
    color: new Color('#9fb5b2'),
    roughness: 0.2,
    metalness: 0.15,
    transparent: true,
    opacity: 0.55,
  });

  const warmGlow = new MeshBasicMaterial({
    color: new Color(PALETTE.amber),
    transparent: true,
    opacity: 0.9,
    toneMapped: false,
  });

  return {
    terrain,
    island,
    rock,
    stone,
    sand,
    path,
    wood,
    woodDark,
    woodLight,
    plaster,
    cream,
    roof,
    roofDark,
    window: windowMaterial,
    terracottaMat: new MeshStandardMaterial({
      color: new Color(PALETTE.terracotta),
      roughness: 0.85,
      metalness: 0,
      flatShading: true,
    }),
    brass: new MeshStandardMaterial({
      color: new Color('#b78b4b'),
      roughness: 0.35,
      metalness: 0.65,
    }),
    leafA: leaf(PALETTE.leafA),
    leafB: leaf(PALETTE.leafB),
    leafC: leaf(PALETTE.leafC),
    pine: leaf(PALETTE.leafPine),
    pineLight: leaf(PALETTE.leafPineLight),
    blossom: leaf(PALETTE.blossom, false, 0.85),
    cloud,
    flowerCream: leaf(PALETTE.flowerCream, false, 0.8),
    flowerRose: leaf(PALETTE.flowerRose, false, 0.8),
    flowerGold: leaf(PALETTE.flowerGold, false, 0.8),
    glass,
    warmGlow,
  };
}
