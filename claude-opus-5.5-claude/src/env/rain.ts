import * as THREE from 'three';
import { smoothstep } from '../core/math';
import { Random } from '../core/random';
import type { HeightField } from './heightField';
import { SurfaceKind } from './heightField';
import type { RingPool } from './ripples';
import type { Wind } from './wind';

const TOP_Y = 4.5;
const BOTTOM_Y = -6.5;
const SPAWN_RADIUS = 6.0;
const FALL_SPEED = 12;
const WIND_PUSH = 7.5;

const vertexShader = /* glsl */ `
attribute vec2 corner;  // x: -1..1 across, y: 0 head .. 1 tail
attribute vec4 aDrop;   // head position, visibility
uniform vec3 uDir;      // normalised fall direction
uniform float uLength;
uniform float uWidth;
varying float vAlpha;
void main() {
  vec3 head = aDrop.xyz;
  vec3 p = head - uDir * uLength * corner.y;
  vec3 toCam = normalize(cameraPosition - p);
  vec3 across = normalize(cross(uDir, toCam));
  p += across * corner.x * uWidth * aDrop.w;
  vAlpha = aDrop.w * (1.0 - corner.y);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(uColor, vAlpha * uOpacity);
  #include <colorspace_fragment>
}
`;

/**
 * Rain as a fixed pool of streaks simulated on the CPU (a thousand drops is trivial) and
 * drawn in one instanced call. Drops stop where they meet the island, roof or pond and are
 * recycled from the top; drops that miss the island fall past it and fade out.
 */
export class Rain {
  readonly mesh: THREE.Mesh;
  private readonly drops: Float32Array;
  private readonly speed: Float32Array;
  private readonly alive: Uint8Array;
  private readonly attr: THREE.InstancedBufferAttribute;
  private readonly uniforms;
  private readonly rnd = new Random(9);
  private readonly windVel = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private activeDrops = 0;

  constructor(
    private readonly count: number,
    private readonly surface: HeightField,
    private readonly ripples: RingPool,
    private readonly splashes: RingPool,
  ) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('corner', new THREE.Float32BufferAttribute([-1, 0, 1, 0, -1, 1, 1, 1], 2));
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    this.drops = new Float32Array(count * 4);
    this.speed = new Float32Array(count);
    this.alive = new Uint8Array(count);
    this.attr = new THREE.InstancedBufferAttribute(this.drops, 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aDrop', this.attr);
    g.instanceCount = count;

    this.uniforms = {
      uDir: { value: new THREE.Vector3(0, -1, 0) },
      uLength: { value: 0.34 },
      uWidth: { value: 0.0125 },
      uColor: { value: new THREE.Color('#d4dfeb') },
      uOpacity: { value: 0.55 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.raycast = () => {};
    this.mesh.visible = false;
  }

  private spawn(i: number, spread: number): void {
    const a = this.rnd.next() * Math.PI * 2;
    const r = Math.sqrt(this.rnd.next()) * SPAWN_RADIUS;
    const fall = TOP_Y + 0.5;
    // Start upwind, so the slanted column still lands on the island.
    const lead = fall / FALL_SPEED;
    const o = i * 4;
    this.drops[o] = Math.cos(a) * r - this.windVel.x * lead;
    this.drops[o + 1] = TOP_Y + 0.4 + this.rnd.next() * spread;
    this.drops[o + 2] = Math.sin(a) * r - this.windVel.z * lead;
    this.drops[o + 3] = 0;
    this.speed[i] = FALL_SPEED * (0.85 + this.rnd.next() * 0.3);
    this.alive[i] = 1;
  }

  /**
   * `amount` is the eased rain level, 0..1. `islandY` is the island's current float offset;
   * the surface grid and the ripple pools live in the island's frame.
   */
  update(dt: number, amount: number, wind: Wind, color: THREE.Color, opacity: number, islandY: number): void {
    wind.vector(WIND_PUSH, this.windVel);
    const target = Math.round(this.count * amount);
    if (target === 0 && this.activeDrops === 0) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    this.uniforms.uColor.value.copy(color);
    this.uniforms.uOpacity.value = opacity;
    this.dir.set(this.windVel.x, -FALL_SPEED, this.windVel.z).normalize();
    this.uniforms.uDir.value.copy(this.dir);

    let active = 0;
    const d = this.drops;
    for (let i = 0; i < this.count; i++) {
      const o = i * 4;
      if (!this.alive[i]) {
        if (i >= target) continue;
        // Newly started drops are staggered over several seconds of height.
        this.spawn(i, 7);
      }
      const v = this.speed[i];
      d[o] += this.windVel.x * dt;
      d[o + 1] -= v * dt;
      d[o + 2] += this.windVel.z * dt;
      const x = d[o];
      const y = d[o + 1];
      const z = d[o + 2];

      const hit = this.surface.sample(x, z);
      const below = hit.height - (y - islandY);
      if (hit.kind !== SurfaceKind.None && below >= 0) {
        // A drop blown in under the rim has met the cliff side: it just ends, no splash on top.
        if (below > 0.4) {
          this.recycle(i, target);
          continue;
        }
        if (hit.kind === SurfaceKind.Water) {
          if (this.rnd.next() < 0.55) this.ripples.spawn(x, hit.height + 0.004, z, 0.13 + this.rnd.next() * 0.12, 0.9 + this.rnd.next() * 0.5);
        } else if (this.rnd.next() < 0.22) {
          this.splashes.spawn(x, hit.height + 0.01, z, 0.045 + this.rnd.next() * 0.03, 0.28);
        }
        this.recycle(i, target);
        continue;
      }
      if (y < BOTTOM_Y) {
        this.recycle(i, target);
        continue;
      }
      d[o + 3] = smoothstep(TOP_Y + 0.4, TOP_Y - 0.5, y) * smoothstep(BOTTOM_Y, -2.0, y);
      active++;
    }
    this.activeDrops = active;
    this.attr.needsUpdate = true;
  }

  private recycle(i: number, target: number): void {
    if (i < target) {
      this.spawn(i, 0.6);
    } else {
      this.alive[i] = 0;
      this.drops[i * 4 + 3] = 0;
    }
  }

  get active(): number {
    return this.activeDrops;
  }
}
