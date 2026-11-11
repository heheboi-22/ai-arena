import * as THREE from 'three';
import { WORLD } from '../palette';
import { POND } from './layout';

const WATER_VERT = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  p.z += 0.035 * sin(p.x * 5.0 + uTime * 1.5) + 0.03 * cos(p.y * 6.0 - uTime * 1.1);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform float uRain;
uniform float uNight;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uTint;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  vec3 col = mix(uShallow, uDeep, smoothstep(0.3, 0.95, r));
  float w1 = sin(vUv.x * 9.0 + uTime * 1.2 + sin(vUv.y * 7.0 - uTime * 0.8) * 1.6);
  float w2 = sin((vUv.x + vUv.y) * 12.0 - uTime * 1.8);
  float sparkle = smoothstep(0.65, 0.95, w1 * 0.5 + w2 * 0.5 + uRain * 0.25);
  col += uFoam * sparkle * (0.16 + uRain * 0.3);
  col = mix(col, col * 0.82 + vec3(0.09, 0.10, 0.12), uRain * 0.4);
  col *= uTint;
  gl_FragColor = vec4(col, 0.94);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface Pond {
  group: THREE.Group;
  /** water surface height in world space (ripples sit just above it) */
  waterY: number;
  update: (dt: number, time: number, rain: number, tint: THREE.Color) => void;
}

export function createPond(): Pond {
  const group = new THREE.Group();

  const uniforms = {
    uTime: { value: 0 },
    uRain: { value: 0 },
    uNight: { value: 0 },
    uDeep: { value: new THREE.Color(WORLD.waterDeep) },
    uShallow: { value: new THREE.Color(WORLD.waterShallow) },
    uFoam: { value: new THREE.Color(WORLD.foam) },
    uTint: { value: new THREE.Color(0xffffff) },
  };

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(POND.r * 0.92, 44),
    new THREE.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms,
      transparent: true,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(POND.x, POND.waterY, POND.z);
  group.add(water);

  // lily pads drifting near the far shore
  const padMat = new THREE.MeshStandardMaterial({ color: 0x3e7d46, roughness: 0.9 });
  const blossomMat = new THREE.MeshStandardMaterial({ color: WORLD.flowerWhite, roughness: 0.8 });
  const pads: THREE.Mesh[] = [];
  const padSpecs = [
    { x: -2.1, z: 1.3, r: 0.13 },
    { x: -1.85, z: 2.35, r: 0.1 },
    { x: -0.95, z: 2.2, r: 0.15, flower: true },
  ];
  for (const p of padSpecs) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(p.r, 9), padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(p.x, POND.waterY + 0.015, p.z);
    group.add(pad);
    pads.push(pad);
    if (p.flower) {
      const blossom = new THREE.Mesh(new THREE.SphereGeometry(0.045, 7, 5), blossomMat);
      blossom.scale.y = 0.6;
      blossom.position.set(p.x, POND.waterY + 0.05, p.z);
      group.add(blossom);
    }
  }

  return {
    group,
    waterY: POND.waterY,
    update(dt, time, rain, tint) {
      uniforms.uTime.value = time;
      uniforms.uRain.value = rain;
      uniforms.uTint.value.copy(tint);
      for (let i = 0; i < pads.length; i++) {
        pads[i].rotation.z = Math.sin(time * 0.4 + i * 2.1) * 0.08;
      }
    },
  };
}
