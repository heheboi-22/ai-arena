import * as THREE from 'three';

/** The palette, in sRGB. Everything in the scene picks from this list. */
export const PALETTE = {
  grass: '#8db466',
  grassLight: '#a9c777',
  grassDark: '#6f9a55',
  grassEdge: '#5f8a4c',
  path: '#d4bf98',
  sand: '#ddcda4',
  pondBed: '#5d7f7a',
  soil: '#7c5a42',
  soilDark: '#5e4433',
  rock: '#ab9b89',
  rockLight: '#c4b4a0',
  rockDark: '#7f7165',
  moss: '#7d9459',
  wall: '#f2e6cf',
  trim: '#fbf5e8',
  wood: '#a8754f',
  woodDark: '#7a5236',
  bark: '#86603f',
  roof: '#b86249',
  roofDark: '#9c4f3b',
  stone: '#bdb5a8',
  stoneDark: '#9b958b',
  shutter: '#7e9c8f',
  glass: '#38475a',
  windowGlow: '#ffb85e',
  canvas: '#f1e6d0',
  leaf: '#7aa55a',
  leafLight: '#9bc070',
  leafDeep: '#55804a',
  pine: '#4f7f55',
  pineLight: '#6d9a63',
  water: '#6f97a8',
  flowerA: '#f3d26e',
  flowerB: '#eaa2ad',
  flowerC: '#b3a3dc',
  flowerD: '#fbf3e4',
  brass: '#c9a35c',
} as const;

/** One shared wind state on the GPU. `Wind` writes these every frame. */
export const windUniforms = {
  uWindDir: { value: new THREE.Vector3(1, 0, 0) },
  uWindBend: { value: 0 },
  uWindFlutter: { value: 0 },
  uWindPhase: { value: 0 },
};

const SWAY_PARS = /* glsl */ `
uniform vec3 uWindDir;
uniform float uWindBend;
uniform float uWindFlutter;
uniform float uWindPhase;
uniform float uSwayScale;
uniform float uLeafFlutter;
`;

// Bends geometry by the square of its height above the local origin (the trunk base),
// so the base stays planted and the crown leans. Phase is offset by world position so
// neighbouring trees do not move in lockstep.
const SWAY_VERTEX = /* glsl */ `
#include <begin_vertex>
{
  #ifdef USE_INSTANCING
    mat4 swayModel = modelMatrix * instanceMatrix;
  #else
    mat4 swayModel = modelMatrix;
  #endif
  vec3 swayRoot = swayModel[3].xyz;
  float swayH = max(position.y, 0.0);
  float swayK = swayH * swayH * uSwayScale;
  float ph = uWindPhase + dot(swayRoot.xz, vec2(0.61, 0.83));
  float wave = sin(ph) * 0.7 + sin(ph * 2.31 + 1.7) * 0.3;
  vec3 localWind = normalize((vec4(uWindDir, 0.0) * swayModel).xyz + vec3(1e-5));
  transformed += localWind * (uWindBend + uWindFlutter * wave) * swayK;
  float leaf = uWindFlutter * uLeafFlutter * swayH;
  transformed.x += leaf * sin(uWindPhase * 3.7 + position.y * 6.0 + position.x * 4.0);
  transformed.z += leaf * cos(uWindPhase * 3.1 + position.z * 5.0 + position.y * 3.0);
}
`;

/** Patches a built-in material so it sways with the shared wind uniforms. */
export function makeSwaying<T extends THREE.Material>(material: T, scale: number, leafFlutter = 0): T {
  const own = { uSwayScale: { value: scale }, uLeafFlutter: { value: leafFlutter } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, windUniforms, own);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${SWAY_PARS}`)
      .replace('#include <begin_vertex>', SWAY_VERTEX);
  };
  material.customProgramCacheKey = () => 'sway';
  return material;
}

/** Matching shadow-pass material, so shadows sway with the leaves that cast them. */
export function swayingDepth(scale: number, leafFlutter = 0): THREE.MeshDepthMaterial {
  return makeSwaying(new THREE.MeshDepthMaterial(), scale, leafFlutter);
}

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });

/** Materials shared by every builder. Created once. */
export function createMaterials() {
  return {
    wall: std(PALETTE.wall, { roughness: 0.92 }),
    trim: std(PALETTE.trim, { roughness: 0.8 }),
    wood: std(PALETTE.wood, { roughness: 0.78 }),
    woodDark: std(PALETTE.woodDark, { roughness: 0.82 }),
    roof: std(PALETTE.roof, { roughness: 0.75, flatShading: true }),
    stone: std(PALETTE.stone, { roughness: 0.95, flatShading: true }),
    stoneDark: std(PALETTE.stoneDark, { roughness: 0.95, flatShading: true }),
    shutter: std(PALETTE.shutter, { roughness: 0.8 }),
    canvas: std(PALETTE.canvas, { roughness: 0.95, side: THREE.DoubleSide }),
    brass: std(PALETTE.brass, { roughness: 0.4, metalness: 0.6 }),
    vertexRock: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }),
    bark: makeSwaying(std(PALETTE.bark, { roughness: 0.9 }), 1),
    foliage: makeSwaying(
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, flatShading: true }),
      1,
      1.2,
    ),
    /** Window glass. Emissive intensity is driven by the house lights. */
    glass: new THREE.MeshStandardMaterial({
      color: PALETTE.glass,
      emissive: PALETTE.windowGlow,
      emissiveIntensity: 0,
      roughness: 0.2,
      metalness: 0.1,
    }),
  };
}

export type Materials = ReturnType<typeof createMaterials>;
