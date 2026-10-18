import * as THREE from 'three';
import { GeoBuilder } from '../util/geo';
import { clamp, mulberry32, range, TAU } from '../util/math';
import type { Environment } from '../fx/environment';
import { POND, WATER_Y, pondPoint, terrainHeight } from './layout';
import type { Materials } from './materials';

const MAX_RIPPLES = 28;
const RIPPLE_LIFE = 1.15;
/** Half the width of the baked depth map, in world units. */
const MAP_HALF = 2.5;
const MAP_SIZE = 160;
const MAX_DEPTH = 0.42;

const vertexShader = /* glsl */ `
  varying vec2 vLocal;
  varying vec3 vWorld;
  void main() {
    vLocal = position.xz;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uDepth;
  uniform vec2 uCenter;
  uniform float uHalf;
  uniform float uTime;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uSky;
  uniform vec3 uLight;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunStrength;
  uniform float uRain;
  uniform vec4 uRipples[${MAX_RIPPLES}];
  varying vec2 vLocal;
  varying vec3 vWorld;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
  }
  float height(vec2 p) {
    return vnoise(p * 3.1 + vec2(uTime * 0.11, uTime * 0.07)) * 0.6 + vnoise(p * 6.7 - vec2(uTime * 0.09, uTime * 0.14)) * 0.4;
  }

  void main() {
    vec2 uv = (vLocal - uCenter) / (uHalf * 2.0) + 0.5;
    float depth = texture2D(uDepth, uv).r;

    // Ripples: the big ones come from drops the rain simulation landed here.
    float ring = 0.0;
    vec2 push = vec2(0.0);
    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
      vec4 r = uRipples[i];
      if (r.w > 0.0) {
        vec2 d = vLocal - r.xy;
        float dist = length(d);
        float radius = r.z * 0.5 + 0.015;
        float band = smoothstep(0.05, 0.0, abs(dist - radius)) * (1.0 - r.z) * r.w;
        ring += band;
        push += normalize(d + 1e-4) * band;
      }
    }
    // A fine drizzle of small rings everywhere, so the whole surface reads as wet.
    if (uRain > 0.01) {
      vec2 g = vLocal * 5.2;
      vec2 cell = floor(g);
      vec2 local = fract(g) - 0.5;
      float seed = hash12(cell);
      float phase = fract(uTime * (0.8 + seed * 0.6) + seed * 7.0);
      if (seed < uRain * 0.62) {
        vec2 off = (vec2(hash12(cell + 3.1), hash12(cell + 8.7)) - 0.5) * 0.5;
        float dd = length(local - off);
        float band = smoothstep(0.07, 0.0, abs(dd - phase * 0.42)) * (1.0 - phase);
        ring += band * 0.7;
        push += normalize(local - off + 1e-4) * band * 0.7;
      }
    }

    // Surface normal from a small moving height field plus the ripples.
    float e = 0.02;
    float h0 = height(vLocal);
    vec2 grad = vec2(height(vLocal + vec2(e, 0.0)) - h0, height(vLocal + vec2(0.0, e)) - h0) / e;
    float chop = 0.05 + 0.1 * uRain;
    vec3 N = normalize(vec3(-grad.x * chop - push.x * 0.5, 1.0, -grad.y * chop - push.y * 0.5));

    vec3 V = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);

    vec3 base = mix(uShallow, uDeep, smoothstep(0.0, 0.85, depth));
    vec3 col = base * uLight;
    col = mix(col, uSky, clamp(0.1 + 0.42 * fres, 0.0, 0.7));

    vec3 H = normalize(uSunDir + V);
    float glint = pow(max(dot(N, H), 0.0), 120.0) * uSunStrength;
    col += uSunColor * glint * 1.6;

    // Pale rings from the rain, and a soft froth where the water meets the bank.
    float lum = dot(uLight, vec3(0.333));
    col += vec3(0.85, 0.93, 1.0) * ring * (0.16 + 0.34 * clamp(lum, 0.0, 1.0));
    float froth = (1.0 - smoothstep(0.0, 0.08, depth)) * (0.55 + 0.45 * sin(uTime * 1.4 + vLocal.x * 11.0 + vLocal.y * 7.0));
    col = mix(col, vec3(0.95, 0.98, 0.96) * clamp(lum + 0.15, 0.0, 1.0), froth * 0.5);

    float alpha = mix(0.2, 0.92, smoothstep(0.0, 0.2, depth));
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

interface Ripple {
  x: number;
  z: number;
  age: number;
  amp: number;
}

export class Pond {
  readonly group = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;
  private readonly depthMap: THREE.DataTexture;
  private readonly ripples: Ripple[] = [];
  private readonly rippleUniform: THREE.Vector4[] = [];
  private readonly light = new THREE.Color();
  private readonly keyShare = new THREE.Color();

  constructor(private readonly materials: Materials) {
    this.group.name = 'pond';
    this.depthMap = this.bakeDepthMap();

    for (let i = 0; i < MAX_RIPPLES; i++) {
      this.ripples.push({ x: 0, z: 0, age: 1, amp: 0 });
      this.rippleUniform.push(new THREE.Vector4(0, 0, 1, 0));
    }

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uDepth: { value: this.depthMap },
        uCenter: { value: new THREE.Vector2(POND.x, POND.z) },
        uHalf: { value: MAP_HALF },
        uTime: { value: 0 },
        uShallow: { value: new THREE.Color('#7cc0b8') },
        uDeep: { value: new THREE.Color('#2f6f9f') },
        uSky: { value: new THREE.Color() },
        uLight: { value: new THREE.Color(1, 1, 1) },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color() },
        uSunStrength: { value: 0 },
        uRain: { value: 0 },
        uRipples: { value: this.rippleUniform },
      },
    });

    const water = new THREE.Mesh(this.buildWaterGeometry(), this.material);
    water.position.y = WATER_Y;
    water.renderOrder = 2;
    water.name = 'pond-water';
    this.group.add(water);

    this.group.add(this.buildDecor());
  }

  /** Samples the terrain once into a small texture: 0 at the waterline, 1 where it is deep. */
  private bakeDepthMap(): THREE.DataTexture {
    const data = new Uint8Array(MAP_SIZE * MAP_SIZE);
    for (let j = 0; j < MAP_SIZE; j++) {
      for (let i = 0; i < MAP_SIZE; i++) {
        const x = POND.x + ((i + 0.5) / MAP_SIZE - 0.5) * MAP_HALF * 2;
        const z = POND.z + ((j + 0.5) / MAP_SIZE - 0.5) * MAP_HALF * 2;
        const depth = clamp((WATER_Y - terrainHeight(x, z)) / MAX_DEPTH);
        data[j * MAP_SIZE + i] = Math.round(depth * 255);
      }
    }
    const tex = new THREE.DataTexture(data, MAP_SIZE, MAP_SIZE, THREE.RedFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  /** A polar patch a little wider than the shoreline; the bank hides the extra. */
  private buildWaterGeometry(): THREE.BufferGeometry {
    const segments = 72;
    const rings = 10;
    // Expressed in island space, so `position.xz` is the world position the shader needs.
    const c = pondPoint(0, 0);
    const pos: number[] = [c.x, 0, c.z];
    for (let k = 1; k <= rings; k++) {
      const s = (k / rings) * 1.14;
      for (let j = 0; j < segments; j++) {
        const p = pondPoint((j / segments) * TAU, s);
        pos.push(p.x, 0, p.z);
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < segments; j++) idx.push(0, 1 + ((j + 1) % segments), 1 + j);
    for (let k = 1; k < rings; k++) {
      for (let j = 0; j < segments; j++) {
        const j2 = (j + 1) % segments;
        const a = 1 + (k - 1) * segments + j;
        const b = 1 + (k - 1) * segments + j2;
        const cc = 1 + k * segments + j;
        const d = 1 + k * segments + j2;
        idx.push(a, b, cc, b, d, cc);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    return geo;
  }

  /** Reeds along one bank, a few lily pads and a lotus flower. */
  private buildDecor(): THREE.Object3D {
    const rng = mulberry32(606);
    const clay = new GeoBuilder();

    const stands: Array<[number, number, number]> = [
      [0.4, 0.5, 7],
      [3.9, 0.55, 6],
      [5.4, 0.45, 4],
    ];
    for (const [phi, spread, count] of stands) {
      for (let i = 0; i < count; i++) {
        const p = pondPoint(phi + range(rng, -spread, spread) * 0.55, range(rng, 0.97, 1.16));
        const y = terrainHeight(p.x, p.z) - 0.02;
        const h = range(rng, 0.55, 0.95);
        const lean = range(rng, 0.05, 0.22);
        const a = rng() * TAU;
        clay.cone(0.022, h, 4, {
          at: [p.x, y + h / 2, p.z],
          rot: [Math.sin(a) * lean, 0, -Math.cos(a) * lean],
          color: rng() < 0.5 ? '#6fa05a' : '#85b062',
        });
        if (rng() < 0.55) {
          const topY = y + h * 0.78;
          clay.cylinder(0.026, 0.026, 0.16, 6, {
            at: [p.x + Math.cos(a) * lean * h * 0.35, topY + 0.08, p.z + Math.sin(a) * lean * h * 0.35],
            rot: [Math.sin(a) * lean, 0, -Math.cos(a) * lean],
            color: '#7a5238',
          });
        }
      }
    }

    // Lily pads: flat discs with a notch.
    const pads: Array<[number, number, number]> = [
      [0.1, 0.6, 0.2],
      [2.3, 0.45, 0.17],
      [3.4, 0.55, 0.15],
      [1.2, 0.2, 0.13],
      [5.2, 0.5, 0.16],
    ];
    for (const [phi, scale, r] of pads) {
      const p = pondPoint(phi, scale);
      const notch = rng() * TAU;
      const geo = new THREE.CircleGeometry(r, 16, notch, TAU - 0.55);
      clay.add(geo, {
        at: [p.x, WATER_Y + 0.012, p.z],
        rot: [-Math.PI / 2, 0, 0],
        color: rng() < 0.5 ? '#5f9a58' : '#76ad62',
        noise: 0.08,
      });
      geo.dispose();
    }
    // One lotus bloom on the middle pad.
    const lotus = pondPoint(2.3, 0.45);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      clay.cone(0.045, 0.14, 4, {
        at: [lotus.x + Math.cos(a) * 0.045, WATER_Y + 0.08, lotus.z + Math.sin(a) * 0.045],
        rot: [Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55],
        color: i % 2 ? '#f6b6c8' : '#fbd0dc',
      });
    }
    clay.sphere(0.03, 6, 5, { at: [lotus.x, WATER_Y + 0.06, lotus.z], color: '#ffd466' });

    const mesh = new THREE.Mesh(clay.build(), this.materials.clay);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'pond-decor';
    return mesh;
  }

  /** Starts a ring on the water at island-space (x, z). Silently ignored if every slot is busy. */
  addRipple(x: number, z: number, amp = 1): void {
    for (const r of this.ripples) {
      if (r.amp <= 0) {
        r.x = x;
        r.z = z;
        r.age = 0;
        r.amp = amp;
        return;
      }
    }
  }

  update(dt: number, time: number, env: Environment): void {
    for (let i = 0; i < MAX_RIPPLES; i++) {
      const r = this.ripples[i];
      if (r.amp > 0) {
        r.age += dt / RIPPLE_LIFE;
        if (r.age >= 1) r.amp = 0;
      }
      this.rippleUniform[i].set(r.x, r.z, r.age, r.amp);
    }

    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uRain.value = env.rain;
    u.uSky.value.copy(env.skyMid).lerp(env.skyTop, 0.5);
    // Roughly what a flat surface facing up would receive: sky light plus the key light's share.
    this.light.copy(env.hemiSky).multiplyScalar(env.hemiIntensity * 0.42);
    this.light.add(this.keyShare.copy(env.keyColor).multiplyScalar(env.keyIntensity * Math.max(env.keyDir.y, 0) * 0.16));
    u.uLight.value.copy(this.light);
    u.uSunDir.value.copy(env.keyDir);
    u.uSunColor.value.copy(env.keyColor);
    u.uSunStrength.value = clamp(env.keyIntensity / 3.2) * (1 - env.rain * 0.8);
  }

  dispose(): void {
    this.depthMap.dispose();
    this.material.dispose();
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}
