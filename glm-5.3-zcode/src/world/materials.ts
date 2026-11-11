import * as THREE from 'three';
import { WORLD } from '../palette';

/**
 * Shared materials. One instance per surface role; systems that need to
 * animate a look (cloud graying, window glow) keep a reference to the
 * singleton so a single property write updates every user of it.
 */
export interface SharedMaterials {
  grass: THREE.MeshStandardMaterial;
  rock: THREE.MeshStandardMaterial;
  rockDeep: THREE.MeshStandardMaterial;
  sand: THREE.MeshStandardMaterial;
  dirt: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  woodDark: THREE.MeshStandardMaterial;
  trunk: THREE.MeshStandardMaterial;
  leaf: THREE.MeshStandardMaterial;
  leaf2: THREE.MeshStandardMaterial;
  pine: THREE.MeshStandardMaterial;
  pine2: THREE.MeshStandardMaterial;
  cloud: THREE.MeshStandardMaterial;
}

export function createMaterials(): SharedMaterials {
  const std = (color: number, rough = 0.9, flat = false) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, flatShading: flat });

  return {
    // vertex colors carry the meadow variation; base color must stay white
    grass: new THREE.MeshStandardMaterial({
      color: 0xffffff, vertexColors: true, roughness: 0.95, metalness: 0,
    }),
    rock: std(WORLD.rock, 0.96, true),
    rockDeep: std(WORLD.rockDeep, 0.98, true),
    sand: std(WORLD.sand, 0.95),
    dirt: std(WORLD.dirt, 0.95),
    stone: std(WORLD.stone, 0.9, true),
    wood: std(WORLD.wood, 0.85),
    woodDark: std(WORLD.woodDark, 0.9),
    trunk: std(WORLD.trunk, 0.95),
    leaf: std(WORLD.leaf1, 0.9, true),
    leaf2: std(WORLD.leaf2, 0.9, true),
    pine: std(WORLD.pine, 0.92, true),
    pine2: std(WORLD.pine2, 0.92, true),
    // one material for every cloud puff so weather can tint them together
    cloud: new THREE.MeshStandardMaterial({
      color: WORLD.cloud, roughness: 1, metalness: 0, flatShading: true,
    }),
  };
}

/** Soft radial sprite texture used by smoke and waterfall mist. */
export function makeSoftDotTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
