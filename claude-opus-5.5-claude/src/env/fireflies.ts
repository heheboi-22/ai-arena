import * as THREE from 'three';
import { Random } from '../core/random';
import { place } from '../world/layout';
import { groundHeight } from '../world/terrain';

const vertexShader = /* glsl */ `
attribute vec3 aSeed;
uniform float uTime;
uniform float uMotion;
uniform float uPixel;
varying float vBlink;
void main() {
  vec3 p = position;
  float t = uTime * uMotion;
  p.x += sin(t * (0.5 + aSeed.x) + aSeed.y * 6.0) * 0.28;
  p.z += cos(t * (0.4 + aSeed.y) + aSeed.z * 6.0) * 0.28;
  p.y += sin(t * (0.7 + aSeed.z) + aSeed.x * 6.0) * 0.12;
  vBlink = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(uTime * (1.3 + aSeed.x * 1.7) + aSeed.z * 9.0), 3.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uPixel * 150.0 / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vBlink;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(uColor * (0.6 + a), a * a * vBlink * uOpacity);
  #include <colorspace_fragment>
}
`;

/** A few fireflies drifting over the meadow and pond after dark, in clear weather. */
export function createFireflies(pixelRatio: number) {
  const rnd = new Random(55);
  const centres = [place(1.6, -1.5), place(-1.6, -0.6), place(-0.4, -2.4), place(0.2, 1.6)];
  const count = 26;
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const c = centres[i % centres.length];
    const x = c.x + rnd.range(-1.1, 1.1);
    const z = c.z + rnd.range(-1.1, 1.1);
    pos.set([x, Math.max(groundHeight(x, z), -0.05) + rnd.range(0.2, 0.75), z], i * 3);
    seed.set([rnd.next(), rnd.next(), rnd.next()], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  const uniforms = {
    uTime: { value: 0 },
    uMotion: { value: 1 },
    uPixel: { value: pixelRatio },
    uColor: { value: new THREE.Color('#ffd36b') },
    uOpacity: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(g, material);
  points.frustumCulled = false;
  points.raycast = () => {};
  points.name = 'fireflies';

  return {
    points,
    update(elapsed: number, night: number, rain: number, motion: number, pixelRatio: number) {
      const visible = Math.max(0, (night - 0.45) / 0.55) * (1 - rain);
      uniforms.uOpacity.value = visible;
      points.visible = visible > 0.01;
      uniforms.uTime.value = elapsed;
      uniforms.uMotion.value = motion;
      uniforms.uPixel.value = pixelRatio;
    },
  };
}
