import * as THREE from 'three';
import {
  makePlasterTexture,
  makeRoofTexture,
  makeStoneTexture,
  makeWoodTexture
} from '../utils/textures';

export interface WorldMaterials {
  plaster: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  darkWood: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  rock: THREE.MeshStandardMaterial;
  pathStone: THREE.MeshStandardMaterial;
  sand: THREE.MeshStandardMaterial;
  sail: THREE.MeshStandardMaterial;
  foliage: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  soil: THREE.MeshStandardMaterial;
}

export const createMaterials = (): WorldMaterials => {
  const plasterTexture = makePlasterTexture();
  const woodTexture = makeWoodTexture();
  const roofTexture = makeRoofTexture();
  const stoneTexture = makeStoneTexture();

  roofTexture.repeat.set(2, 2);
  stoneTexture.repeat.set(2, 2);
  woodTexture.repeat.set(1.5, 2);
  plasterTexture.repeat.set(1.6, 1.4);

  const plaster = new THREE.MeshStandardMaterial({
    map: plasterTexture,
    color: 0xf8eeda,
    roughness: 0.94,
    metalness: 0
  });
  const wood = new THREE.MeshStandardMaterial({
    map: woodTexture,
    color: 0xd8b48c,
    roughness: 0.86,
    metalness: 0
  });
  const darkWood = new THREE.MeshStandardMaterial({
    map: woodTexture,
    color: 0x8d6849,
    roughness: 0.9,
    metalness: 0
  });
  const roof = new THREE.MeshStandardMaterial({
    map: roofTexture,
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0
  });
  const stone = new THREE.MeshStandardMaterial({
    map: stoneTexture,
    color: 0xd7d0c2,
    roughness: 0.95,
    metalness: 0
  });
  const rock = new THREE.MeshStandardMaterial({
    color: 0x918777,
    roughness: 1,
    metalness: 0,
    flatShading: true
  });
  const pathStone = new THREE.MeshStandardMaterial({
    color: 0xb7ad9a,
    roughness: 0.98,
    metalness: 0,
    flatShading: true
  });
  const sand = new THREE.MeshStandardMaterial({
    color: 0xc9b78e,
    roughness: 1,
    metalness: 0,
    flatShading: true
  });
  const sail = new THREE.MeshStandardMaterial({
    color: 0xefe2c5,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide
  });
  const foliage = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
    flatShading: true
  });
  const metal = new THREE.MeshStandardMaterial({
    color: 0x6b5c48,
    roughness: 0.55,
    metalness: 0.35
  });
  const soil = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    flatShading: true
  });

  return {
    plaster,
    wood,
    darkWood,
    roof,
    stone,
    rock,
    pathStone,
    sand,
    sail,
    foliage,
    metal,
    soil
  };
};
