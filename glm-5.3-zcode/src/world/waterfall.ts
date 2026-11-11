import * as THREE from 'three';
import { lerp, smoothstep, makeRng, clamp01 } from '../lib/math';
import { WORLD } from '../palette';
import { streamSpill } from './island';
import { makeSoftDotTexture } from './materials';

const FALL_VERT = /* glsl */ `
uniform float uTime;
uniform float uWind;
uniform float uLipY;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  float depth = max(0.0, uLipY - p.y);
  p.x += uWind * depth * depth * 0.09;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const FALL_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uFoam;
uniform vec3 uTint;
varying vec2 vUv;
void main() {
  float flow = sin(vUv.y * 30.0 - uTime * 7.5 + sin(vUv.x * 4.0 + uTime * 0.9) * 0.9);
  float streak = smoothstep(0.15, 0.9, flow * 0.5 + 0.5);
  vec3 col = mix(uDeep, uFoam, 0.5 + streak * 0.42);
  col *= uTint;
  float a = 0.78 + streak * 0.2;
  a *= smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
  a *= smoothstep(0.0, 0.07, vUv.y);
  a *= 1.0 - smoothstep(0.8, 1.0, vUv.y) * 0.85;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface Waterfall {
  group: THREE.Group;
  update: (dt: number, time: number, wind: number, tint: THREE.Color) => void;
}

/** The pond spills into a short stream that slides off the island lip. */
export function createWaterfall(): Waterfall {
  const group = new THREE.Group();
  const a = streamSpill.a;
  const b = streamSpill.b;
  const lipY = Math.min(streamSpill.lipY, -0.3);
  const dir = new THREE.Vector2(b.x - a.x, b.y - a.y).normalize();
  const perp = new THREE.Vector3(-dir.y, 0, dir.x);

  // ribbon from the pond edge, over the lip, then straight down into the void
  const rows = 30;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const streamLen = a.distanceTo(b);
  const fallLen = 3.6;
  for (let i = 0; i <= rows; i++) {
    const s = i / rows;
    let x: number, y: number, z: number, w: number;
    if (s < 0.4) {
      const t = s / 0.4;
      x = lerp(a.x, b.x, t);
      z = lerp(a.y, b.y, t);
      y = lerp(POND_LEVEL, lipY, t * t);
      w = lerp(0.42, 0.58, t);
    } else {
      const u = (s - 0.4) / 0.6;
      const drop = u * u * fallLen;
      x = b.x + dir.x * u * 0.22;
      z = b.y + dir.y * u * 0.22;
      y = lipY - drop;
      w = lerp(0.58, 0.88, Math.min(u * 1.5, 1)) * (1 - 0.35 * smoothstep(0.75, 1, u));
    }
    positions.push(
      x - perp.x * w * 0.5, y, z - perp.z * w * 0.5,
      x + perp.x * w * 0.5, y, z + perp.z * w * 0.5,
    );
    uvs.push(0, s, 1, s);
  }
  for (let i = 0; i < rows; i++) {
    const p0 = i * 2;
    indices.push(p0, p0 + 2, p0 + 1, p0 + 1, p0 + 2, p0 + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);

  const uniforms = {
    uTime: { value: 0 },
    uWind: { value: 0 },
    uLipY: { value: lipY },
    uDeep: { value: new THREE.Color(WORLD.waterDeep) },
    uFoam: { value: new THREE.Color(WORLD.foam) },
    uTint: { value: new THREE.Color(0xffffff) },
  };
  const sheet = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      vertexShader: FALL_VERT,
      fragmentShader: FALL_FRAG,
      uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  group.add(sheet);

  // pooled droplets continuing below the sheet
  const DROPS = 26;
  const rng = makeRng(777);
  const dropGeo = new THREE.BufferGeometry();
  const dropPos = new Float32Array(DROPS * 3);
  const dropSeed: number[] = [];
  for (let i = 0; i < DROPS; i++) dropSeed.push(rng());
  dropGeo.setAttribute('position', new THREE.BufferAttribute(dropPos, 3));
  const dropMat = new THREE.PointsMaterial({
    color: WORLD.foam, size: 0.07, transparent: true, opacity: 0.8, depthWrite: false,
  });
  const drops = new THREE.Points(dropGeo, dropMat);
  group.add(drops);

  // soft mist where the water gives up on gravity
  const dot = makeSoftDotTexture();
  const mists: THREE.Sprite[] = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: dot, transparent: true, opacity: 0.2, depthWrite: false, color: 0xe8f2f5,
      }),
    );
    m.position.set(
      b.x + dir.x * 0.35 + perp.x * (i - 1) * 0.55,
      lipY - fallLen + 0.25 + i * 0.12,
      b.y + dir.y * 0.35 + perp.z * (i - 1) * 0.55,
    );
    m.scale.setScalar(1.45 + i * 0.35);
    group.add(m);
    mists.push(m);
  }

  return {
    group,
    update(dt, time, wind, tint) {
      uniforms.uTime.value = time;
      uniforms.uWind.value = wind;
      uniforms.uTint.value.copy(tint);
      const bottom = lipY - fallLen;
      for (let i = 0; i < DROPS; i++) {
        const seed = dropSeed[i];
        const cycle = (time * (0.75 + seed * 0.4) + seed * 7) % 1;
        const y = lerp(bottom - 0.05, bottom - 1.7, cycle);
        dropPos[i * 3] = b.x + dir.x * 0.28 + perp.x * (seed - 0.5) * 0.8 + wind * cycle * 0.7;
        dropPos[i * 3 + 1] = y;
        dropPos[i * 3 + 2] = b.y + dir.y * 0.28 + perp.z * (seed - 0.5) * 0.8;
      }
      dropGeo.attributes.position.needsUpdate = true;
      dropMat.opacity = 0.65 * clamp01(tint.r + 0.35);
      for (let i = 0; i < mists.length; i++) {
        const pulse = 0.72 + 0.28 * Math.sin(time * 1.4 + i * 2.2);
        mists[i].material.opacity = 0.22 * pulse * clamp01(tint.r + 0.3);
      }
    },
  };
}

const POND_LEVEL = -0.12;
