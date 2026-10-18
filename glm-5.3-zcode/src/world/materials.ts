import * as THREE from 'three';

/**
 * Materials are collected here so every module shares instances - one material
 * per surface type keeps draw calls and memory low, and lets systems retint
 * whole families (clouds, glass) in one write.
 */
function std(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true, ...opts });
}

export const M = {
  wall: std(0xf2e6cd, { roughness: 0.85 }),
  woodDark: std(0x6e4b2f),
  woodMid: std(0x8f6a44),
  roof: std(0xb65a40, { roughness: 0.8 }),
  roofDark: std(0x97452f, { roughness: 0.85 }),
  stone: std(0xb0a89a),
  stoneDark: std(0x8d8577),
  metal: std(0x5a5148, { roughness: 0.5, metalness: 0.6 }),
  gold: std(0xd9b36a, { roughness: 0.4, metalness: 0.5 }),

  trunk: std(0x7a5a3a),
  leafA: std(0x6fae5c),
  leafB: std(0x8cc06b),
  leafC: std(0x4f9350),
  conifer: std(0x4c8a55),

  sand: std(0xd9c08c, { roughness: 1 }),
  water: new THREE.MeshStandardMaterial({
    color: 0x5e9fb8,
    roughness: 0.14,
    metalness: 0.08,
    transparent: true,
    opacity: 0.9,
  }),

  /** Shared by every window pane and lantern - the glow system drives emissiveIntensity. */
  glass: new THREE.MeshStandardMaterial({
    color: 0x3a3327,
    emissive: 0xffb95e,
    emissiveIntensity: 0,
    roughness: 0.4,
  }),

  cloud: std(0xffffff, { roughness: 1, flatShading: true }),
  smoke: new THREE.MeshBasicMaterial({ color: 0xe8e4da, transparent: true, opacity: 0.4, depthWrite: false }),

  flowerStem: std(0x5c8a4a),
  flowers: [std(0xe8875f), std(0xeec559), std(0xf4efe4), std(0xd97b9c)],

  ripple: new THREE.MeshBasicMaterial({ color: 0xdff1f5, transparent: true, opacity: 0, depthWrite: false }),
};
