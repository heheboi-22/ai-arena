import * as THREE from 'three';
import { lerp, mulberry32, smoothstep, TAU } from '../util/math';
import { dotTexture } from '../util/textures';
import type { Pond } from '../world/pond';
import { SurfaceKind, type SurfaceMap } from '../world/surfaces';
import type { Environment } from './environment';
import { ParticlePool } from './particles';
import type { Wind } from './wind';

/** Where drops are born and where they are retired if they miss every surface. */
const Y_TOP = 8.8;
const Y_FLOOR = -3.4;
const FALL_SPEED = 10.5;
const WIND_PUSH = 8.2;
const SPAWN_RADIUS = 6.1;
const SPLASHES = 150;
const SPLASH_LIFE = 0.3;

// Drop and splash colours by day and by night, parsed once.
const DROP_DAY = new THREE.Color('#e6f0fb');
const DROP_NIGHT = new THREE.Color('#9db3e0');
const SPLASH_DAY = new THREE.Color('#f3f8ff');
const SPLASH_NIGHT = new THREE.Color('#a9bde6');

const vertexShader = /* glsl */ `
  attribute vec3 aPos;
  attribute float aSeed;
  uniform vec3 uVel;
  uniform float uTrail;
  uniform float uWidth;
  uniform float uRain;
  uniform float uAlpha;
  uniform float uTop;
  uniform float uFloor;
  varying float vAlpha;
  void main() {
    vec2 corner = position.xy;
    vec3 head = aPos;
    vec3 tail = aPos - uVel * uTrail;
    vec4 mvHead = modelViewMatrix * vec4(head, 1.0);
    vec4 mvTail = modelViewMatrix * vec4(tail, 1.0);
    vec4 mv = mix(mvTail, mvHead, corner.y);
    vec3 dir = mvHead.xyz - mvTail.xyz;
    vec3 across = cross(dir, vec3(0.0, 0.0, 1.0));
    float l = length(across);
    vec3 side = l > 1e-5 ? across / l : vec3(1.0, 0.0, 0.0);
    mv.xyz += side * corner.x * uWidth * mix(0.45, 1.0, corner.y);
    gl_Position = projectionMatrix * mv;

    float present = smoothstep(aSeed, aSeed + 0.1, uRain);
    float fadeIn = smoothstep(uTop, uTop - 1.8, aPos.y);
    float fadeOut = smoothstep(uFloor, uFloor + 1.4, aPos.y);
    vAlpha = present * fadeIn * fadeOut * mix(0.1, 1.0, corner.y) * uAlpha;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(uColor, vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * Rain that belongs to the world. Each drop is born above a spot that is
 * actually over the island, falls along the wind, and is retired the moment it
 * touches whatever is under it (grass, a roof, a canopy, the pond) or, failing
 * that, drops below the island. A fixed number of drops is recycled forever:
 * toggling the weather never creates or leaves behind anything.
 */
export class Rain {
  readonly group = new THREE.Group();
  readonly splashes: ParticlePool;
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly positions: Float32Array;
  private readonly seeds: Float32Array;
  private readonly count: number;
  private readonly rng = mulberry32(777);
  private readonly splashAges = new Float32Array(SPLASHES).fill(1);
  private readonly splashMap = dotTexture();
  private splashCursor = 0;
  private splashesAlive = false;
  private readonly vel = new THREE.Vector3();
  private wasActive = false;

  constructor(
    count: number,
    private readonly surfaces: SurfaceMap,
    private readonly pond: Pond,
  ) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.seeds = new Float32Array(count);

    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3));
    this.geometry.setIndex([0, 1, 2, 1, 3, 2]);
    this.geometry.setAttribute('aPos', new THREE.InstancedBufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(this.seeds, 1));
    this.geometry.instanceCount = count;

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uVel: { value: this.vel },
        uTrail: { value: 0.042 },
        uWidth: { value: 0.013 },
        uRain: { value: 0 },
        uAlpha: { value: 0.5 },
        uTop: { value: Y_TOP },
        uFloor: { value: Y_FLOOR },
        uColor: { value: new THREE.Color('#dfeaf7') },
      },
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.mesh.visible = false;
    this.mesh.name = 'rain';
    this.group.add(this.mesh);

    this.splashes = new ParticlePool(SPLASHES, this.splashMap);
    this.splashes.points.renderOrder = 9;
    this.splashes.points.visible = false;
    this.splashes.points.name = 'rain-splashes';
    this.group.add(this.splashes.points);

    this.vel.set(0, -FALL_SPEED, 0);
    for (let i = 0; i < count; i++) {
      this.seeds[i] = (i + this.rng()) / count;
      this.spawn(i, true);
    }
  }

  /** Sends drop `i` back up, aimed at a fresh spot over the island (or scattered along its fall, at start-up). */
  private spawn(i: number, scatter: boolean): void {
    let x = 0;
    let z = 0;
    let ground = 0;
    for (let tries = 0; tries < 8; tries++) {
      const r = Math.sqrt(this.rng()) * SPAWN_RADIUS;
      const a = this.rng() * TAU;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      if (this.surfaces.query(x, z)) {
        ground = this.surfaces.height;
        break;
      }
      ground = -2;
    }
    const startY = Y_TOP + this.rng() * 2.6;
    const fall = (startY - ground) / FALL_SPEED;
    // Back-trace along the wind so the drop lands where we aimed.
    let px = x - this.vel.x * fall;
    let pz = z - this.vel.z * fall;
    let py = startY;
    if (scatter) {
      const s = this.rng();
      px = lerp(px, x, s);
      pz = lerp(pz, z, s);
      py = lerp(startY, ground, s);
    }
    this.positions[i * 3] = px;
    this.positions[i * 3 + 1] = py;
    this.positions[i * 3 + 2] = pz;
  }

  private splash(x: number, y: number, z: number): void {
    const i = this.splashCursor;
    this.splashCursor = (this.splashCursor + 1) % SPLASHES;
    this.splashes.positions[i * 3] = x;
    this.splashes.positions[i * 3 + 1] = y + 0.015;
    this.splashes.positions[i * 3 + 2] = z;
    this.splashAges[i] = 0;
  }

  setScale(pixelsPerUnit: number): void {
    this.splashes.setScale(pixelsPerUnit);
  }

  update(dt: number, wind: Wind, env: Environment): void {
    const rain = env.rain;
    const active = rain > 0.002;
    this.mesh.visible = active;
    this.splashes.points.visible = active || this.splashesAlive;
    if (!active && !this.wasActive) {
      this.fadeSplashes(dt);
      return;
    }
    this.wasActive = active;

    // One shared velocity: gravity plus the push of the wind, which the windmill and trees feel too.
    this.vel.set(wind.dir.x * wind.effective * WIND_PUSH, -FALL_SPEED, wind.dir.z * wind.effective * WIND_PUSH);

    const u = this.material.uniforms;
    u.uRain.value = rain;
    u.uAlpha.value = lerp(0.42, 0.5, env.night) * smoothstep(0, 0.2, rain);
    u.uColor.value.copy(DROP_DAY).lerp(DROP_NIGHT, env.night).multiplyScalar(lerp(1, 0.78, env.night * 0.5));

    if (active) {
      const { positions, seeds, vel, surfaces, count } = this;
      for (let i = 0; i < count; i++) {
        // Drops that are not part of the current intensity stay parked.
        if (seeds[i] > rain + 0.12) continue;
        const o = i * 3;
        const x = (positions[o] += vel.x * dt);
        const y = (positions[o + 1] += vel.y * dt);
        const z = (positions[o + 2] += vel.z * dt);
        if (surfaces.query(x, z)) {
          if (y <= surfaces.height) {
            if (surfaces.kind === SurfaceKind.Water) {
              if (this.rng() < 0.4) this.pond.addRipple(x, z, 0.6 + 0.4 * this.rng());
            } else if (this.rng() < 0.45) {
              this.splash(x, surfaces.height, z);
            }
            this.spawn(i, false);
          }
        } else if (y < Y_FLOOR) {
          this.spawn(i, false);
        }
      }
      (this.geometry.getAttribute('aPos') as THREE.InstancedBufferAttribute).needsUpdate = true;
    }
    this.fadeSplashes(dt);
    this.splashes.color.copy(SPLASH_DAY).lerp(SPLASH_NIGHT, env.night);
  }

  private fadeSplashes(dt: number): void {
    const { sizes, alphas } = this.splashes;
    let alive = false;
    for (let i = 0; i < SPLASHES; i++) {
      if (this.splashAges[i] >= 1) {
        alphas[i] = 0;
        continue;
      }
      alive = true;
      this.splashAges[i] = Math.min(1, this.splashAges[i] + dt / SPLASH_LIFE);
      const a = this.splashAges[i];
      sizes[i] = 0.05 + 0.15 * Math.sqrt(a);
      alphas[i] = (1 - a) * 0.55;
    }
    this.splashesAlive = alive;
    this.splashes.commit();
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.splashes.dispose();
    this.splashMap.dispose();
  }
}
