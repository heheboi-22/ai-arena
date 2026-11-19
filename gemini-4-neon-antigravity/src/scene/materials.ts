import * as THREE from 'three';
import { createProceduralTextures, type ProceduralTextures } from './textures';

export interface WorldMaterials {
  textures: ProceduralTextures;
  grassTop: THREE.MeshStandardMaterial;
  turfLip: THREE.MeshStandardMaterial;
  rockUnderside: THREE.MeshStandardMaterial;
  cottageWall: THREE.MeshStandardMaterial;
  roofTile: THREE.MeshStandardMaterial;
  darkWood: THREE.MeshStandardMaterial;
  warmWood: THREE.MeshStandardMaterial;
  lightWood: THREE.MeshStandardMaterial;
  stoneMasonry: THREE.MeshStandardMaterial;
  chimneyTerracotta: THREE.MeshStandardMaterial;
  brassAccent: THREE.MeshStandardMaterial;
  windowGlass: THREE.MeshStandardMaterial;
  windmillGlass: THREE.MeshStandardMaterial;
  windmillLinen: THREE.MeshStandardMaterial;
  bark: THREE.MeshStandardMaterial;
  pineDark: THREE.MeshStandardMaterial;
  pineMid: THREE.MeshStandardMaterial;
  pineLight: THREE.MeshStandardMaterial;
  leafOlive: THREE.MeshStandardMaterial;
  leafSage: THREE.MeshStandardMaterial;
  leafMoss: THREE.MeshStandardMaterial;
  boulder: THREE.MeshStandardMaterial;
  steppingStone: THREE.MeshStandardMaterial;
  reedGreen: THREE.MeshStandardMaterial;
  cattailBrown: THREE.MeshStandardMaterial;
  lilyPad: THREE.MeshStandardMaterial;
  flowerCream: THREE.MeshStandardMaterial;
  flowerButter: THREE.MeshStandardMaterial;
  flowerCoral: THREE.MeshStandardMaterial;
  flowerLavender: THREE.MeshStandardMaterial;
  pondWater: THREE.MeshPhysicalMaterial;
  cloud: THREE.MeshStandardMaterial;
  smoke: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createWorldMaterials(): WorldMaterials {
  const textures = createProceduralTextures();

  const grassTop = new THREE.MeshStandardMaterial({
    map: textures.grass,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.0,
  });

  const turfLip = new THREE.MeshStandardMaterial({
    color: 0x678a57,
    roughness: 0.92,
    metalness: 0.0,
    flatShading: true,
  });

  const rockUnderside = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.02,
    flatShading: true,
  });

  const cottageWall = new THREE.MeshStandardMaterial({
    color: 0xf6eedf,
    map: textures.plaster,
    roughness: 0.88,
    metalness: 0.0,
  });

  const roofTile = new THREE.MeshStandardMaterial({
    color: 0xf7e8df,
    map: textures.roofShingles,
    roughness: 0.84,
    metalness: 0.02,
  });

  const darkWood = new THREE.MeshStandardMaterial({
    color: 0x876246,
    map: textures.wood,
    roughness: 0.84,
    metalness: 0.02,
  });

  const warmWood = new THREE.MeshStandardMaterial({
    color: 0xb6855c,
    map: textures.wood,
    roughness: 0.8,
    metalness: 0.02,
  });

  const lightWood = new THREE.MeshStandardMaterial({
    color: 0xd4b28a,
    map: textures.wood,
    roughness: 0.82,
    metalness: 0.0,
  });

  const stoneMasonry = new THREE.MeshStandardMaterial({
    color: 0xd3cbc0,
    map: textures.stone,
    roughness: 0.92,
    metalness: 0.02,
  });

  const chimneyTerracotta = new THREE.MeshStandardMaterial({
    color: 0xb6694d,
    roughness: 0.86,
    metalness: 0.0,
  });

  const brassAccent = new THREE.MeshStandardMaterial({
    color: 0xd4a459,
    roughness: 0.36,
    metalness: 0.72,
  });

  const windowGlass = new THREE.MeshStandardMaterial({
    color: 0x4b6376,
    emissive: new THREE.Color(0xffa73b),
    emissiveIntensity: 0,
    roughness: 0.24,
    metalness: 0.12,
  });

  const windmillGlass = new THREE.MeshStandardMaterial({
    color: 0x455c6e,
    roughness: 0.28,
    metalness: 0.14,
  });

  const windmillLinen = new THREE.MeshStandardMaterial({
    color: 0xf4ecdc,
    map: textures.linen,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  const bark = new THREE.MeshStandardMaterial({
    color: 0x6f503a,
    roughness: 0.92,
    metalness: 0.0,
  });

  const pineDark = new THREE.MeshStandardMaterial({
    color: 0x476b4c,
    roughness: 0.88,
    metalness: 0.0,
    flatShading: true,
  });

  const pineMid = new THREE.MeshStandardMaterial({
    color: 0x567d57,
    roughness: 0.88,
    metalness: 0.0,
    flatShading: true,
  });

  const pineLight = new THREE.MeshStandardMaterial({
    color: 0x689062,
    roughness: 0.88,
    metalness: 0.0,
    flatShading: true,
  });

  const leafOlive = new THREE.MeshStandardMaterial({
    color: 0x73985f,
    roughness: 0.86,
    metalness: 0.0,
    flatShading: true,
  });

  const leafSage = new THREE.MeshStandardMaterial({
    color: 0x62885c,
    roughness: 0.88,
    metalness: 0.0,
    flatShading: true,
  });

  const leafMoss = new THREE.MeshStandardMaterial({
    color: 0x89ab6c,
    roughness: 0.85,
    metalness: 0.0,
    flatShading: true,
  });

  const boulder = new THREE.MeshStandardMaterial({
    color: 0x918a82,
    roughness: 0.92,
    metalness: 0.02,
    flatShading: true,
  });

  const steppingStone = new THREE.MeshStandardMaterial({
    color: 0xc9bfb0,
    roughness: 0.9,
    metalness: 0.0,
    flatShading: true,
  });

  const reedGreen = new THREE.MeshStandardMaterial({
    color: 0x5c804e,
    roughness: 0.86,
    metalness: 0.0,
  });

  const cattailBrown = new THREE.MeshStandardMaterial({
    color: 0x6c4832,
    roughness: 0.92,
    metalness: 0.0,
  });

  const lilyPad = new THREE.MeshStandardMaterial({
    color: 0x5f8f59,
    roughness: 0.78,
    metalness: 0.0,
  });

  const flowerCream = new THREE.MeshStandardMaterial({
    color: 0xf7f0dd,
    roughness: 0.8,
  });

  const flowerButter = new THREE.MeshStandardMaterial({
    color: 0xefc96e,
    roughness: 0.8,
  });

  const flowerCoral = new THREE.MeshStandardMaterial({
    color: 0xde8b78,
    roughness: 0.8,
  });

  const flowerLavender = new THREE.MeshStandardMaterial({
    color: 0xa99ec7,
    roughness: 0.8,
  });

  const pondWater = new THREE.MeshPhysicalMaterial({
    color: 0x4e8291,
    roughness: 0.18,
    metalness: 0.05,
    reflectivity: 0.65,
    clearcoat: 0.55,
    clearcoatRoughness: 0.2,
    bumpMap: textures.waterBump,
    bumpScale: 0.018,
    transparent: true,
    opacity: 0.84,
  });

  const cloud = new THREE.MeshStandardMaterial({
    color: 0xfcf8f0,
    emissive: new THREE.Color(0x3a3e48),
    emissiveIntensity: 0.22,
    roughness: 0.96,
    metalness: 0.0,
    transparent: true,
    opacity: 0.92,
    flatShading: false,
  });

  const smoke = new THREE.MeshStandardMaterial({
    color: 0xf3eee6,
    roughness: 1.0,
    metalness: 0.0,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });

  const materials: THREE.Material[] = [
    grassTop,
    turfLip,
    rockUnderside,
    cottageWall,
    roofTile,
    darkWood,
    warmWood,
    lightWood,
    stoneMasonry,
    chimneyTerracotta,
    brassAccent,
    windowGlass,
    windmillGlass,
    windmillLinen,
    bark,
    pineDark,
    pineMid,
    pineLight,
    leafOlive,
    leafSage,
    leafMoss,
    boulder,
    steppingStone,
    reedGreen,
    cattailBrown,
    lilyPad,
    flowerCream,
    flowerButter,
    flowerCoral,
    flowerLavender,
    pondWater,
    cloud,
    smoke,
  ];

  return {
    textures,
    grassTop,
    turfLip,
    rockUnderside,
    cottageWall,
    roofTile,
    darkWood,
    warmWood,
    lightWood,
    stoneMasonry,
    chimneyTerracotta,
    brassAccent,
    windowGlass,
    windmillGlass,
    windmillLinen,
    bark,
    pineDark,
    pineMid,
    pineLight,
    leafOlive,
    leafSage,
    leafMoss,
    boulder,
    steppingStone,
    reedGreen,
    cattailBrown,
    lilyPad,
    flowerCream,
    flowerButter,
    flowerCoral,
    flowerLavender,
    pondWater,
    cloud,
    smoke,
    dispose: () => {
      for (const mat of materials) {
        mat.dispose();
      }
      textures.dispose();
    },
  };
}
