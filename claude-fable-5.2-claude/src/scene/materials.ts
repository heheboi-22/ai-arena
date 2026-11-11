import * as THREE from 'three';

/** One matte, faceted, vertex-coloured material shared by almost everything. */
export const clay = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.9,
  metalness: 0,
});
