import * as THREE from 'three';
import { glowTexture, plasterTexture, shingleTexture, stoneTexture, woodTexture } from '../util/textures';
import { paintGround } from './terrainPaint';
import type { Quality } from '../util/quality';

/** Uniforms shared by every wind-swayed material. Written once per frame. */
export interface WindUniforms {
  uTime: { value: number };
  uWind: { value: number };
}

type Matte = THREE.MeshLambertMaterial;

export interface Materials {
  ground: Matte;
  turf: Matte;
  rock: Matte;
  plaster: Matte;
  wood: Matte;
  roof: Matte;
  stone: Matte;
  clay: Matte;
  foliage: Matte;
  /** The only glossy material: window glass. */
  glass: THREE.MeshStandardMaterial;
  cloth: Matte;
  grass: Matte;
  flower: Matte;
  glow: THREE.Texture;
  wind: WindUniforms;
  /** Darkens the surfaces that would get wet in the rain. 0 = dry, 1 = soaked. */
  setWetness(amount: number): void;
  dispose(): void;
}

/**
 * Everything on the island is matte, so it uses Lambert shading: the same diffuse light as a
 * rough standard material, without paying for specular on every light in every pixel.
 */
export function createMaterials(quality: Quality): Materials {
  const wind: WindUniforms = { uTime: { value: 0 }, uWind: { value: 0 } };

  const ground = new THREE.MeshLambertMaterial({ map: paintGround(quality.groundTexture, 8) });
  const turf = new THREE.MeshLambertMaterial({ vertexColors: true });
  const rock = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const plaster = new THREE.MeshLambertMaterial({ map: plasterTexture(), vertexColors: true });

  const woodTex = woodTexture();
  const wood = new THREE.MeshLambertMaterial({ map: woodTex.map, bumpMap: woodTex.bump, bumpScale: 1.2, vertexColors: true });

  const shingles = shingleTexture();
  const roof = new THREE.MeshLambertMaterial({ map: shingles.map, bumpMap: shingles.bump, bumpScale: 2.2, vertexColors: true });

  const stoneTex = stoneTexture();
  const stone = new THREE.MeshLambertMaterial({ map: stoneTex.map, bumpMap: stoneTex.bump, bumpScale: 2.2, vertexColors: true });

  const clay = new THREE.MeshLambertMaterial({ vertexColors: true });
  const foliage = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

  // Colour and emissive are driven every frame by the house.
  const glass = new THREE.MeshStandardMaterial({
    color: 0x9fb8c8,
    roughness: 0.18,
    metalness: 0.05,
    emissive: new THREE.Color(0x000000),
  });

  const cloth = new THREE.MeshLambertMaterial({ color: 0xf3ead6, vertexColors: true, side: THREE.DoubleSide });

  // Grass tufts and flower heads share one shader tweak: sway scaled by the wind.
  const grass = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  // Flowers: stem and head are one mesh. `aHead` marks head vertices, which take a per-flower tint.
  const flower = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  for (const [material, amount, key] of [
    [grass, 0.9, 'grass-sway'],
    [flower, 0.55, 'flower-sway'],
  ] as const) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = wind.uTime;
      shader.uniforms.uWind = wind.uWind;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uTime;
          uniform float uWind;
          ${key === 'flower-sway' ? 'attribute float aHead;\n attribute vec3 aTint;' : ''}`,
        )
        .replace(
          '#include <color_vertex>',
          `#include <color_vertex>
          ${key === 'flower-sway' ? 'vColor.rgb = mix(vColor.rgb, aTint, aHead);' : ''}`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec2 anchor = instanceMatrix[3].xz;
          #else
            vec2 anchor = vec2(0.0);
          #endif
          float phase = anchor.x * 2.1 + anchor.y * 1.7;
          float gust = sin(uTime * 2.4 + phase) * 0.6 + sin(uTime * 4.1 + phase * 1.7) * 0.4;
          float bend = max(position.y, 0.0) * uWind * ${amount.toFixed(3)} * (0.55 + gust * 0.45);
          transformed.x += bend;
          transformed.z += bend * 0.35;`,
        );
    };
    material.customProgramCacheKey = () => key;
  }

  const all = [ground, turf, rock, plaster, wood, roof, stone, clay, foliage, cloth, grass, flower];
  const baseColor = new Map(all.map((m) => [m, m.color.clone()]));
  const wet = new THREE.Color();

  return {
    ground,
    turf,
    rock,
    plaster,
    wood,
    roof,
    stone,
    clay,
    foliage,
    glass,
    cloth,
    grass,
    flower,
    glow: glowTexture(),
    wind,
    setWetness(amount: number): void {
      for (const m of all) {
        wet.copy(baseColor.get(m)!).multiplyScalar(1 - 0.16 * amount);
        m.color.copy(wet);
      }
    },
    dispose(): void {
      for (const m of [...all, glass]) {
        m.map?.dispose();
        m.bumpMap?.dispose();
        m.dispose();
      }
    },
  };
}
