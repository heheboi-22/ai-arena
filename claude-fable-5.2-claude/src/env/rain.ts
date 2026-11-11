import * as THREE from 'three';
import { clamp01, mulberry32 } from '../core/math';
import type { Wind } from './wind';

const VERT = /* glsl */ `
attribute vec3 aDrop;
attribute float aSeed;
uniform vec3 uStreak;
uniform float uWidth;
varying float vAlong;
varying float vAcross;
varying float vFade;
void main() {
  vec3 world = aDrop + uStreak * position.y * (0.65 + 0.7 * aSeed);
  vec4 mv = modelViewMatrix * vec4(world, 1.0);
  vec3 dir = normalize((modelViewMatrix * vec4(uStreak, 0.0)).xyz);
  vec3 side = normalize(cross(dir, vec3(0.0, 0.0, 1.0)));
  mv.xyz += side * position.x * uWidth;
  gl_Position = projectionMatrix * mv;
  vAlong = position.y;
  vAcross = position.x * 2.0;
  // Drops that miss the island thin out as they fall into the haze below.
  vFade = smoothstep(-8.5, -3.5, aDrop.y) * smoothstep(9.9, 8.3, aDrop.y) * (0.6 + 0.4 * aSeed);
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlong;
varying float vAcross;
varying float vFade;
void main() {
  float a = (1.0 - vAlong) * (1.0 - abs(vAcross)) * vFade * uOpacity;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

const SPLASH_VERT = /* glsl */ `
attribute float aLife;
uniform float uScale;
varying float vLife;
void main() {
  vLife = aLife;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uScale * (0.5 + 1.1 * (1.0 - aLife)) / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const SPLASH_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vLife;
void main() {
  if (vLife <= 0.0) discard;
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float ring = smoothstep(1.0, 0.75, d) * smoothstep(0.25, 0.6, d);
  gl_FragColor = vec4(uColor, ring * vLife * uOpacity);
  #include <colorspace_fragment>
}`;

export interface RainOptions {
  count: number;
  /** Height of whatever a drop would hit at (x, z); -Infinity for open sky. */
  surface: (x: number, z: number) => number;
  isWater: (x: number, z: number) => boolean;
  /** Called when a drop lands on water (rate-limited by the rain itself). */
  onRipple: (x: number, z: number) => void;
}

const TOP = 9.4;
const FLOOR = -8.5;
const RADIUS = 9.2;
const GRID = 112;
const EXTENT = 7.6;
const SPLASHES = 90;
const SPLASH_LIFE = 0.28;

/**
 * Rain as a fixed pool of streaks living in the island's own space. Drops are
 * simulated on the CPU (a few thousand additions per frame), land on a baked
 * height field of the island and its buildings, and are recycled from the
 * cloud deck. Nothing is allocated after construction.
 */
export class Rain {
  readonly group = new THREE.Group();
  private readonly count: number;
  private readonly drops: Float32Array;
  private readonly speed: Float32Array;
  private readonly alive: Uint8Array;
  private readonly dropAttr: THREE.InstancedBufferAttribute;
  private readonly heights = new Float32Array(GRID * GRID);
  private readonly water = new Uint8Array(GRID * GRID);
  private readonly uniforms = {
    uStreak: { value: new THREE.Vector3(0, 0.8, 0) },
    uWidth: { value: 0.034 },
    uColor: { value: new THREE.Color('#dbe8f5') },
    uOpacity: { value: 0.6 },
  };
  private readonly splashUniforms = {
    uColor: this.uniforms.uColor,
    uOpacity: { value: 0.7 },
    uScale: { value: 300 },
  };
  private readonly splashPos = new Float32Array(SPLASHES * 3);
  private readonly splashLife = new Float32Array(SPLASHES);
  private readonly splashPosAttr: THREE.BufferAttribute;
  private readonly splashLifeAttr: THREE.BufferAttribute;
  private splashCursor = 0;
  private readonly streaks: THREE.Mesh;
  private readonly splashes: THREE.Points;
  private readonly rng = mulberry32(31337);
  private readonly onRipple: (x: number, z: number) => void;
  private rippleBudget = 0;
  private active = 0;

  constructor(opts: RainOptions) {
    this.group.name = 'rain';
    this.count = opts.count;
    this.onRipple = opts.onRipple;
    this.drops = new Float32Array(this.count * 3);
    this.speed = new Float32Array(this.count);
    this.alive = new Uint8Array(this.count);

    // Bake what the rain can land on, once.
    for (let iz = 0; iz < GRID; iz++) {
      for (let ix = 0; ix < GRID; ix++) {
        const x = ((ix + 0.5) / GRID) * 2 * EXTENT - EXTENT;
        const z = ((iz + 0.5) / GRID) * 2 * EXTENT - EXTENT;
        this.heights[iz * GRID + ix] = opts.surface(x, z);
        this.water[iz * GRID + ix] = opts.isWater(x, z) ? 1 : 0;
      }
    }

    const seeds = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      seeds[i] = this.rng();
      this.speed[i] = 15 + this.rng() * 5;
      this.drops[i * 3 + 1] = -999;
    }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3),
    );
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.dropAttr = new THREE.InstancedBufferAttribute(this.drops, 3);
    this.dropAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aDrop', this.dropAttr);
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    g.instanceCount = this.count;
    this.streaks = new THREE.Mesh(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.streaks.frustumCulled = false;
    this.streaks.raycast = () => {};
    this.streaks.renderOrder = 5;

    for (let i = 0; i < SPLASHES; i++) this.splashPos[i * 3 + 1] = -999;
    const sg = new THREE.BufferGeometry();
    this.splashPosAttr = new THREE.BufferAttribute(this.splashPos, 3);
    this.splashLifeAttr = new THREE.BufferAttribute(this.splashLife, 1);
    this.splashPosAttr.setUsage(THREE.DynamicDrawUsage);
    this.splashLifeAttr.setUsage(THREE.DynamicDrawUsage);
    sg.setAttribute('position', this.splashPosAttr);
    sg.setAttribute('aLife', this.splashLifeAttr);
    this.splashes = new THREE.Points(
      sg,
      new THREE.ShaderMaterial({
        uniforms: this.splashUniforms,
        vertexShader: SPLASH_VERT,
        fragmentShader: SPLASH_FRAG,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.splashes.frustumCulled = false;
    this.splashes.raycast = () => {};
    this.splashes.renderOrder = 4;

    this.group.add(this.streaks, this.splashes);
    this.group.visible = false;
  }

  /** Number of drops currently in the air (for diagnostics and tests). */
  get activeDrops(): number {
    return this.active;
  }

  setViewport(heightPx: number, fovDeg: number): void {
    // World-space splash size → pixels at unit distance.
    this.splashUniforms.uScale.value =
      (0.2 * heightPx) / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
  }

  private cell(x: number, z: number): number {
    const ix = Math.floor(((x + EXTENT) / (2 * EXTENT)) * GRID);
    const iz = Math.floor(((z + EXTENT) / (2 * EXTENT)) * GRID);
    if (ix < 0 || iz < 0 || ix >= GRID || iz >= GRID) return -1;
    return iz * GRID + ix;
  }

  private spawn(i: number, vx: number, vz: number, stagger: boolean): void {
    const a = this.rng() * Math.PI * 2;
    const r = Math.sqrt(this.rng()) * RADIUS;
    const y = TOP + this.rng() * (stagger ? 7 : 1.2);
    // Start upwind so the slanted fall still covers the island evenly.
    const lead = ((y - 0.5) / this.speed[i]) * 0.55;
    this.drops[i * 3] = Math.cos(a) * r - vx * lead;
    this.drops[i * 3 + 1] = y;
    this.drops[i * 3 + 2] = Math.sin(a) * r - vz * lead;
    this.alive[i] = 1;
  }

  private splash(x: number, y: number, z: number): void {
    const i = this.splashCursor;
    this.splashCursor = (i + 1) % SPLASHES;
    this.splashPos[i * 3] = x;
    this.splashPos[i * 3 + 1] = y + 0.03;
    this.splashPos[i * 3 + 2] = z;
    this.splashLife[i] = 1;
  }

  /**
   * @param amount 0..1 eased rain amount; drives how many drops are in play
   * @param night  0..1, dims the streaks after dark
   */
  update(dt: number, amount: number, wind: Wind, night: number): void {
    const target = Math.round(this.count * clamp01(amount));
    if (target === 0 && this.active === 0 && !this.group.visible) return;
    this.group.visible = true;

    const vx = wind.dir.x * wind.speed * 9.5;
    const vz = wind.dir.y * wind.speed * 9.5;
    // Streaks trail behind the drop, opposite to its velocity.
    this.uniforms.uStreak.value.set(-vx, 17, -vz).normalize().multiplyScalar(0.62);
    this.uniforms.uOpacity.value = 0.62 - 0.2 * night;
    this.uniforms.uColor.value.setRGB(0.72 - 0.2 * night, 0.82 - 0.2 * night, 0.93 - 0.12 * night);

    this.rippleBudget = Math.min(3, this.rippleBudget + dt * 26);
    const drops = this.drops;
    let active = 0;
    for (let i = 0; i < this.count; i++) {
      const k = i * 3;
      if (!this.alive[i]) {
        if (i < target) this.spawn(i, vx, vz, true);
        else continue;
      }
      drops[k] += vx * dt;
      drops[k + 1] -= this.speed[i] * dt;
      drops[k + 2] += vz * dt;
      const y = drops[k + 1];
      let landed = y < FLOOR;
      if (!landed && y < 6) {
        const c = this.cell(drops[k], drops[k + 2]);
        if (c >= 0 && y <= this.heights[c]) {
          landed = true;
          const top = this.heights[c];
          // A drop blown in under the rim just ends; one from above splashes.
          if (top - y < 0.9) {
            if (this.water[c]) {
              if (this.rippleBudget >= 1) {
                this.rippleBudget -= 1;
                this.onRipple(drops[k], drops[k + 2]);
              }
            } else if (this.rng() < 0.45) {
              this.splash(drops[k], top, drops[k + 2]);
            }
          }
        }
      }
      if (landed) {
        if (i < target) {
          this.spawn(i, vx, vz, false);
        } else {
          this.alive[i] = 0;
          drops[k + 1] = -999;
          continue;
        }
      }
      active++;
    }
    this.active = active;
    this.dropAttr.needsUpdate = true;

    let anySplash = false;
    for (let i = 0; i < SPLASHES; i++) {
      if (this.splashLife[i] > 0) {
        this.splashLife[i] = Math.max(0, this.splashLife[i] - dt / SPLASH_LIFE);
        anySplash = true;
      }
    }
    this.splashLifeAttr.needsUpdate = true;
    this.splashPosAttr.needsUpdate = true;

    // Fully idle again: hide so a clear day costs nothing.
    if (target === 0 && active === 0 && !anySplash) this.group.visible = false;
  }
}
