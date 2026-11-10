import * as THREE from 'three';
import { Builder, box, cyl, ico } from '../core/builder';
import { TAU, hash3, lerp, mulberry32, noise2, smoothstep } from '../core/math';
import { TriSoup, type P3 } from '../core/trisoup';
import { clay } from './materials';
import { C } from './palette';
import { POND, bankHeight, groundHeight, pondRadius, pondS } from './terrain';

const MAX_RIPPLES = 28;
const RIPPLE_LIFE = 1.25;

/**
 * Pond: sand bank, water surface and a fixed pool of ripple rings that are
 * drawn inside the water shader (so they are clipped to the water for free).
 */
export class Pond {
  readonly group = new THREE.Group();
  private readonly ripples: THREE.Vector4[] = [];
  private readonly uniforms = {
    uRipples: { value: [] as THREE.Vector4[] },
    uPhase: { value: 0 },
    uRain: { value: 0 },
  };
  private cursor = 0;
  private fishTimer = 3;
  private readonly rng = mulberry32(77);

  constructor() {
    this.group.name = 'pond';
    for (let i = 0; i < MAX_RIPPLES; i++) this.ripples.push(new THREE.Vector4(0, 0, 1, 0));
    this.uniforms.uRipples.value = this.ripples;
    this.group.add(this.buildBank(), this.buildWater(), this.buildDressing());
  }

  private at(s: number, j: number, n: number): P3 {
    const phi = (j / n) * TAU;
    const r = s * pondRadius(phi);
    return [POND.x + r * Math.cos(phi), 0, POND.z + r * Math.sin(phi)];
  }

  private buildBank(): THREE.Mesh {
    const N = 44;
    const soup = new TriSoup();
    const up = (_x: number, ny: number): number => ny;
    const sand = new THREE.Color(C.sand);
    const wet = new THREE.Color(C.sandWet);
    const tmp = new THREE.Color();
    const rings = [0.86, 0.97, 1.04, 1.12, 1.22, 1.3];
    const pt = (i: number, j: number): P3 => {
      const last = i === rings.length - 1;
      const s = rings[i] + (last ? 0.1 * noise2((j % N) * 0.45, 8.2) : 0);
      const p = this.at(s, j, N);
      p[1] = last ? groundHeight(p[0], p[2]) - 0.04 : bankHeight(p[0], p[2]);
      return p;
    };
    for (let i = 0; i < rings.length - 1; i++) {
      for (let j = 0; j < N; j++) {
        const a = pt(i, j), b = pt(i, j + 1), c = pt(i + 1, j + 1), d = pt(i + 1, j);
        const s = (rings[i] + rings[i + 1]) / 2;
        const shade = 0.95 + 0.1 * hash3(a[0], s, a[2]);
        tmp.copy(wet).lerp(sand, smoothstep(0.98, 1.12, s)).multiplyScalar(shade);
        soup.tri(a, b, c, tmp, up);
        soup.tri(a, c, d, tmp, up);
      }
    }
    const mesh = new THREE.Mesh(soup.geometry(), clay);
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildWater(): THREE.Mesh {
    const N = 48;
    const rings = [0, 0.45, 0.75, 0.92, 1.035];
    const shallow = new THREE.Color(C.waterShallow);
    const mid = new THREE.Color(C.water);
    const deep = new THREE.Color(C.waterDeep);
    const tint = (s: number): THREE.Color =>
      new THREE.Color().copy(deep).lerp(mid, smoothstep(0.1, 0.65, s)).lerp(shallow, smoothstep(0.7, 1.0, s));

    const pos: number[] = [], col: number[] = [], shore: number[] = [], idx: number[] = [];
    for (let i = 0; i < rings.length; i++) {
      const c = tint(rings[i]);
      for (let j = 0; j < N; j++) {
        const p = this.at(rings[i], j, N);
        pos.push(p[0], POND.level, p[2]);
        col.push(c.r, c.g, c.b);
        shore.push(rings[i]);
      }
    }
    for (let i = 0; i < rings.length - 1; i++) {
      for (let j = 0; j < N; j++) {
        const a = i * N + j, b = i * N + ((j + 1) % N);
        const c = (i + 1) * N + ((j + 1) % N), d = (i + 1) * N + j;
        idx.push(a, c, b, a, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aShore', new THREE.Float32BufferAttribute(shore, 1));
    g.setIndex(idx);
    g.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.18,
      metalness: 0.05,
    });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float aShore;\nvarying vec2 vPond;\nvarying float vShore;',
        )
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvPond = position.xz;\nvShore = aShore;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform vec4 uRipples[${MAX_RIPPLES}];
uniform float uPhase;
uniform float uRain;
varying vec2 vPond;
varying float vShore;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
{
  float ring = 0.0;
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 rp = uRipples[i];
    if (rp.z < 1.0) {
      float d = distance(vPond, rp.xy);
      float rad = rp.w * (0.15 + 0.85 * rp.z);
      float fade = (1.0 - rp.z) * (1.0 - rp.z);
      ring += fade * smoothstep(0.05, 0.0, abs(d - rad));
      ring += fade * 0.5 * smoothstep(0.04, 0.0, abs(d - rad * 0.55));
    }
  }
  // Slow drifting glints; they tighten into a chop when it rains.
  float w1 = sin(vPond.x * 6.5 + uPhase * 1.6 + sin(vPond.y * 3.1 + uPhase * 0.9) * 1.3);
  float w2 = sin(vPond.y * 8.0 - uPhase * 1.2 + vPond.x * 2.0);
  float glint = smoothstep(0.72, 1.0, w1 * w2) * (0.09 + 0.05 * uRain);
  float foam = smoothstep(0.93, 1.0, vShore + 0.012 * sin(uPhase * 1.4 + vPond.x * 9.0 + vPond.y * 7.0));
  diffuseColor.rgb += vec3(0.8, 0.9, 0.95) * (min(ring, 1.0) * 0.36 + glint);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.96, 0.95), foam * 0.6);
}`,
        );
    };
    mat.customProgramCacheKey = () => 'pond-water';
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    mesh.name = 'water';
    return mesh;
  }

  /** Lily pads, reeds and a tiny jetty. */
  private buildDressing(): THREE.Mesh {
    const rng = this.rng;
    const b = new Builder(rng);
    const y = POND.level;

    const pads: [number, number, number][] = [
      [0.5, 0.9, 0.17],
      [0.62, 1.35, 0.13],
      [0.42, 4.3, 0.15],
      [0.66, 4.75, 0.11],
    ];
    for (const [s, phi, r] of pads) {
      const rr = s * pondRadius(phi);
      const px = POND.x + rr * Math.cos(phi), pz = POND.z + rr * Math.sin(phi);
      b.add(cyl(r, r, 0.014, 7), C.lily, { p: [px, y + 0.009, pz], r: [0, rng() * TAU, 0] }, 0.08);
    }
    {
      const [s, phi] = pads[0];
      const rr = s * pondRadius(phi);
      b.add(ico(0.05, 0), C.petalCoral, {
        p: [POND.x + rr * Math.cos(phi) + 0.03, y + 0.045, POND.z + rr * Math.sin(phi)],
        s: [1, 0.7, 1],
      });
    }

    // Reeds on the far bank.
    for (let i = 0; i < 9; i++) {
      const phi = lerp(4.6, 5.9, i / 8) + (rng() - 0.5) * 0.12;
      const rr = (0.98 + rng() * 0.08) * pondRadius(phi);
      const px = POND.x + rr * Math.cos(phi), pz = POND.z + rr * Math.sin(phi);
      const h = 0.42 + rng() * 0.3;
      const tilt: [number, number, number] = [(rng() - 0.5) * 0.2, 0, (rng() - 0.5) * 0.2];
      b.add(box(0.022, h, 0.022), C.leafDeep, { p: [px, y + h / 2 - 0.03, pz], r: tilt }, 0.1);
      if (i % 2 === 0) {
        b.add(box(0.042, 0.13, 0.042), C.woodDark, { p: [px + tilt[2] * -h * 0.5, y + h - 0.03, pz + tilt[0] * h * 0.5], r: tilt });
      }
    }

    // Jetty reaching in from the house side.
    const phi = 3.42;
    const dir: [number, number] = [-Math.cos(phi), -Math.sin(phi)];
    const start = 1.32 * pondRadius(phi);
    const yaw = -Math.atan2(dir[1], dir[0]);
    const deck = 0.085;
    for (let i = 0; i < 7; i++) {
      const d = start - i * 0.17;
      const px = POND.x - dir[0] * d, pz = POND.z - dir[1] * d;
      b.add(box(0.15, 0.035, 0.5 + (rng() - 0.5) * 0.04), i % 2 ? C.woodLight : C.wood, {
        p: [px, deck, pz],
        r: [0, yaw + (rng() - 0.5) * 0.05, 0],
      }, 0.07);
    }
    for (const side of [-1, 1]) {
      for (const i of [2.6, 6]) {
        const d = start - i * 0.17;
        const px = POND.x - dir[0] * d - dir[1] * side * 0.24;
        const pz = POND.z - dir[1] * d + dir[0] * side * 0.24;
        const top = i === 6 ? 0.24 : 0.12;
        b.add(cyl(0.035, 0.04, 0.7, 6), C.woodDark, { p: [px, top - 0.35, pz] }, 0.06);
      }
    }
    return b.mesh(clay);
  }

  /** True when a world-space point is over open water. */
  contains(x: number, z: number): boolean {
    return pondS(x, z) < 0.985;
  }

  /** Start a ripple from the pool. Oldest slot is recycled; nothing is allocated. */
  spawnRipple(x: number, z: number, size = 0.3): void {
    const slot = this.ripples[this.cursor];
    this.cursor = (this.cursor + 1) % MAX_RIPPLES;
    slot.set(x, z, 0, size);
  }

  update(dt: number, phase: number, rain: number, motion: number): void {
    for (const r of this.ripples) {
      if (r.z < 1) r.z = Math.min(1, r.z + dt / RIPPLE_LIFE);
    }
    this.uniforms.uPhase.value = phase * motion;
    this.uniforms.uRain.value = rain;

    // Now and then something small breaks the surface on a calm day.
    if (rain < 0.05 && motion > 0.5) {
      this.fishTimer -= dt;
      if (this.fishTimer <= 0) {
        this.fishTimer = 4 + this.rng() * 6;
        const phi = this.rng() * TAU;
        const rr = this.rng() * 0.55 * pondRadius(phi);
        this.spawnRipple(POND.x + rr * Math.cos(phi), POND.z + rr * Math.sin(phi), 0.42);
      }
    }
  }
}
