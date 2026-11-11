import * as THREE from 'three';
import { mulberry32 } from '../core/math';
import type { Wind } from '../env/wind';

const PUFFS = 9;

/** Chimney smoke: a small ring buffer of puffs, lit with the house lights. */
export class Smoke {
  readonly group = new THREE.Group();
  private readonly puffs: { mesh: THREE.Mesh; age: number; x: number; z: number; live: boolean }[] = [];
  private readonly material = new THREE.MeshStandardMaterial({
    color: '#e9e6e1',
    roughness: 1,
    flatShading: true,
    transparent: true,
    opacity: 0.85,
  });
  private timer = 0;
  private cursor = 0;
  private readonly rng = mulberry32(8);

  /** @param origin chimney mouth in the same space as this group */
  constructor(private readonly origin: THREE.Vector3) {
    const geo = new THREE.IcosahedronGeometry(0.16, 1);
    for (let i = 0; i < PUFFS; i++) {
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.visible = false;
      mesh.raycast = () => {};
      this.group.add(mesh);
      this.puffs.push({ mesh, age: 0, x: 0, z: 0, live: false });
    }
  }

  update(dt: number, amount: number, wind: Wind, motion: number): void {
    const LIFE = 3.4;
    this.timer -= dt;
    if (amount > 0.5 && motion > 0.5 && this.timer <= 0) {
      this.timer = 0.42;
      const p = this.puffs[this.cursor];
      this.cursor = (this.cursor + 1) % PUFFS;
      p.live = true;
      p.age = 0;
      p.x = (this.rng() - 0.5) * 0.06;
      p.z = (this.rng() - 0.5) * 0.06;
    }
    for (const p of this.puffs) {
      if (!p.live) continue;
      p.age += dt / LIFE;
      if (p.age >= 1) {
        p.live = false;
        p.mesh.visible = false;
        continue;
      }
      // Rise, and lean further downwind the higher the puff gets.
      const drift = wind.speed * 2.6 * p.age * (0.4 + p.age);
      p.x += (this.rng() - 0.5) * dt * 0.1;
      p.mesh.position.set(
        this.origin.x + p.x + wind.dir.x * drift,
        this.origin.y + p.age * 1.9,
        this.origin.z + p.z + wind.dir.y * drift,
      );
      const grow = 0.45 + p.age * 1.5;
      const fade = Math.sin(Math.min(1, p.age * 1.12) * Math.PI);
      p.mesh.scale.setScalar(grow * Math.min(1, fade * 2.2));
      p.mesh.visible = true;
    }
  }
}

const FLY_VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uScale;
varying float vBlink;
void main() {
  float t = uTime * (0.25 + aSeed * 0.2) + aSeed * 60.0;
  vec3 p = position + vec3(sin(t * 1.3) * 0.45, sin(t * 2.1 + aSeed * 9.0) * 0.18, cos(t * 1.1) * 0.45);
  vBlink = 0.35 + 0.65 * smoothstep(-0.2, 0.9, sin(t * 4.0 + aSeed * 20.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FLY_FRAG = /* glsl */ `
uniform float uOpacity;
varying float vBlink;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (smoothstep(1.0, 0.0, d) * 0.5 + smoothstep(0.35, 0.0, d)) * vBlink * uOpacity;
  gl_FragColor = vec4(1.0, 0.9, 0.5, a);
  #include <colorspace_fragment>
}`;

/** Fireflies that come out on clear nights. */
export class Fireflies {
  readonly points: THREE.Points;
  private readonly uniforms = { uTime: { value: 0 }, uOpacity: { value: 0 }, uScale: { value: 60 } };

  constructor(spots: [number, number, number][]) {
    const rng = mulberry32(64);
    const pos: number[] = [], seed: number[] = [];
    for (const [x, y, z] of spots) {
      for (let i = 0; i < 4; i++) {
        pos.push(x + (rng() - 0.5) * 1.3, y + 0.25 + rng() * 0.75, z + (rng() - 0.5) * 1.3);
        seed.push(rng());
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    this.points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: FLY_VERT,
        fragmentShader: FLY_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.points.frustumCulled = false;
    this.points.raycast = () => {};
    this.points.visible = false;
  }

  setViewport(heightPx: number, fovDeg: number): void {
    this.uniforms.uScale.value =
      (0.17 * heightPx) / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
  }

  update(time: number, night: number, rain: number, motion: number): void {
    const o = night * (1 - rain);
    this.points.visible = o > 0.01;
    this.uniforms.uOpacity.value = o;
    this.uniforms.uTime.value = motion > 0.5 ? time : 0;
  }
}
