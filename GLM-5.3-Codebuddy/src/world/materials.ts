import * as THREE from 'three';

/**
 * Shared materials for props — one instance per "material family" keeps the
 * draw-call count low and lets the environment tint things in one place.
 */

/** Warm mid-tone wood (fences, trunks, windmill blades). */
export const wood = new THREE.MeshStandardMaterial({ color: 0x9c7b52, roughness: 0.82 });
/** Darker wood trim (doors, ridges, bands). */
export const woodDark = new THREE.MeshStandardMaterial({ color: 0x6f4f33, roughness: 0.8 });
/** Cream paint (house walls, windmill tower, window frames). */
export const cream = new THREE.MeshStandardMaterial({ color: 0xf4e9d3, roughness: 0.85 });
/** Slightly brighter cream for proud trim. */
export const trim = new THREE.MeshStandardMaterial({ color: 0xfaf1de, roughness: 0.8 });
/** Muted terracotta roof. */
export const roof = new THREE.MeshStandardMaterial({ color: 0xb56548, roughness: 0.82 });
/** Stone for plinths, stepping stones, rocks. */
export const stone = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  vertexColors: true,
  roughness: 0.95,
  flatShading: true,
});
/** Pond shoreline sand. */
export const sand = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  vertexColors: true,
  roughness: 0.95,
});
/** Muted brick for the chimney. */
export const brick = new THREE.MeshStandardMaterial({ color: 0x9a5a48, roughness: 0.85 });
/** Windmill sails — pale canvas. */
export const sail = new THREE.MeshStandardMaterial({ color: 0xefe3c8, roughness: 0.75 });

export const disposables: THREE.Material[] = [
  wood, woodDark, cream, trim, roof, stone, sand, brick, sail,
];
