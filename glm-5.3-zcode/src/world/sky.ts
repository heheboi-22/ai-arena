import * as THREE from 'three';
import { makeRng } from '../lib/math';
import type { EnvLighting } from '../palette';
import { sunDirection, dayFactor, nightFactor } from '../palette';

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
varying vec3 vDir;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSunColor;
uniform vec3 uMoonColor;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform float uSunVis;
uniform float uMoonVis;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.42, h));
  col = mix(col, uBottom, smoothstep(0.0, -0.42, h));
  float s = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(s, 1400.0) * 1.7 + pow(s, 80.0) * 0.32 + pow(s, 7.0) * 0.06) * uSunVis;
  float m = max(dot(d, uMoonDir), 0.0);
  col += uMoonColor * (pow(m, 3200.0) * 1.5 + pow(m, 160.0) * 0.12) * uMoonVis;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const sunDirV = new THREE.Vector3();
const moonDirV = new THREE.Vector3();

export interface Sky {
  group: THREE.Group;
  update: (env: EnvLighting, hour: number, time: number, rain: number) => void;
}

export function createSky(): Sky {
  const group = new THREE.Group();

  const uniforms = {
    uTop: { value: new THREE.Color(0x6ea6dd) },
    uHorizon: { value: new THREE.Color(0xe9ddbd) },
    uBottom: { value: new THREE.Color(0x2a3350) },
    uSunColor: { value: new THREE.Color(0xffe6b8) },
    uMoonColor: { value: new THREE.Color(0xdfe8ff) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
    uSunVis: { value: 1 },
    uMoonVis: { value: 0 },
  };

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(60, 32, 20),
    new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  dome.renderOrder = -10;
  group.add(dome);

  // fixed star field on the upper hemisphere
  const starCount = 380;
  const starPos = new Float32Array(starCount * 3);
  const rng = makeRng(9001);
  for (let i = 0; i < starCount; i++) {
    const u = rng() * Math.PI * 2;
    const v = Math.acos(rng() * 0.85); // keep away from straight overhead
    const r = 52;
    starPos[i * 3] = Math.sin(v) * Math.cos(u) * r;
    starPos[i * 3 + 1] = Math.cos(v) * r * 0.92 + 4;
    starPos[i * 3 + 2] = Math.sin(v) * Math.sin(u) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xdfe6ff,
    size: 1.6,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);

  return {
    group,
    update(env, hour, time, rain) {
      uniforms.uTop.value.copy(env.skyTop);
      uniforms.uHorizon.value.copy(env.skyHorizon);
      uniforms.uBottom.value.copy(env.skyBottom);
      uniforms.uSunColor.value.copy(env.sunColor);
      sunDirection(hour, sunDirV);
      moonDirV.copy(sunDirV).negate();
      uniforms.uSunDir.value.copy(sunDirV);
      uniforms.uMoonDir.value.copy(moonDirV);
      uniforms.uSunVis.value = dayFactor(hour);
      uniforms.uMoonVis.value = nightFactor(hour) * (1 - rain * 0.8);

      // gentle global twinkle keeps the night sky alive without per-star cost
      starMat.opacity = env.starAlpha * (0.78 + 0.22 * Math.sin(time * 1.3));
    },
  };
}
