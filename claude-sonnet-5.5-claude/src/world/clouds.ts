import * as THREE from 'three';
import { GeoBuilder } from '../util/geo';
import { angleDelta, mulberry32, range, smoothstep } from '../util/math';
import type { Quality } from '../util/quality';
import type { Environment } from '../fx/environment';
import type { Wind } from '../fx/wind';

/** How far along the wind a cloud travels before it wraps around. */
const SPAN = 19;

/** The island as a keep-clear zone: a cylinder of this radius, between these heights. */
const ISLAND_RADIUS = 6.9;
const ISLAND_BOTTOM = -6.9;
const ISLAND_TOP = 5.6;
const ISLAND_CENTER = new THREE.Vector3(0, -0.6, 0);

/**
 * A cloud's place in wind space: `u` is where it starts along the wind, `v` is its lane across
 * the wind. The island sits at the origin, so lanes close to v = 0 would carry a cloud straight
 * through it; mid-height clouds keep to lanes well clear of it, and the ones that do come close
 * pass far above or far below.
 */
interface CloudSpec {
  u: number;
  v: number;
  y: number;
  scale: number;
  shape: number;
}

/** Fair-weather clouds. Negative lanes are behind the island as seen from the opening view. */
const CLOUDS: CloudSpec[] = [
  { u: -14, v: -12.5, y: 4.2, scale: 1.6, shape: 0 },
  { u: 6, v: -16.5, y: 6.8, scale: 1.9, shape: 1 },
  { u: -6, v: -20, y: 1.8, scale: 1.7, shape: 2 },
  { u: 12, v: -13.5, y: -1.5, scale: 1.4, shape: 3 },
  { u: -9, v: -7, y: 8.6, scale: 1.5, shape: 1 },
  { u: -10, v: 13, y: -4.6, scale: 1.5, shape: 0 },
  { u: 3, v: 16, y: -8, scale: 2, shape: 2 },
  { u: -8, v: -3, y: -11.5, scale: 2.5, shape: 3 },
  { u: 7, v: 4, y: -10.8, scale: 2.2, shape: 1 },
  { u: -1, v: -10, y: -10, scale: 2, shape: 2 },
  { u: 2, v: -11, y: 2.4, scale: 1.3, shape: 3 },
  { u: -16, v: -9.5, y: 6, scale: 1.2, shape: 0 },
];

/** Dark clouds that gather above the island while it rains (u, v are offsets from the island). */
const STORM_CLOUDS: CloudSpec[] = [
  { u: -1.5, v: -5.8, y: 6.6, scale: 2.3, shape: 1 },
  { u: 3.5, v: -6.4, y: 7.3, scale: 2.5, shape: 2 },
  { u: 0.2, v: -2.4, y: 8.2, scale: 2, shape: 3 },
  { u: -6.4, v: -3.2, y: 5.9, scale: 1.8, shape: 0 },
  { u: 6.2, v: -3.6, y: 6.3, scale: 1.9, shape: 1 },
];

interface CloudItem {
  mesh: THREE.Mesh;
  spec: CloudSpec;
  u: number;
  v: number;
  phase: number;
  storm: boolean;
  /** Eased 0..1 factor that shrinks a cloud away when it would block the view or touch the island. */
  clear: number;
}

function cloudGeometry(seed: number, detail: number): THREE.BufferGeometry {
  const rng = mulberry32(seed * 131 + 7);
  const b = new GeoBuilder();
  const puffs = 5 + Math.floor(rng() * 3);
  for (let i = 0; i < puffs; i++) {
    const t = i / (puffs - 1) - 0.5;
    const r = range(rng, 0.62, 1.05) * (1 - Math.abs(t) * 0.55);
    b.sphere(r, Math.round(20 * detail), Math.round(14 * detail), {
      at: [t * 3.6 + range(rng, -0.15, 0.15), range(rng, -0.05, 0.35) + (1 - Math.abs(t) * 2) * 0.25, range(rng, -0.45, 0.45)],
      scale: [1.1, 0.85, 1],
    });
  }
  const geo = b.build();
  // Flatten the underside and shade it a little.
  const pos = geo.getAttribute('position');
  const col = geo.getAttribute('color');
  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i);
    if (y < -0.2) y = -0.2 + (y + 0.2) * 0.22;
    pos.setY(i, y);
    const shade = 0.8 + 0.26 * smoothstep(-0.25, 1.1, y);
    col.setXYZ(i, shade, shade, shade);
  }
  geo.computeVertexNormals();
  return geo;
}

export class Clouds {
  readonly group = new THREE.Group();
  private readonly items: CloudItem[] = [];
  private readonly fair: THREE.MeshLambertMaterial;
  private readonly storm: THREE.MeshLambertMaterial;
  private readonly geometries: THREE.BufferGeometry[];
  private readonly perp = new THREE.Vector3();
  private readonly toIsland = new THREE.Vector3();
  private readonly toCloud = new THREE.Vector3();
  private primed = false;

  constructor(quality: Quality) {
    this.group.name = 'clouds';
    this.fair = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.storm = new THREE.MeshLambertMaterial({ vertexColors: true });
    const detail = quality.tier === 'low' ? 0.65 : 1;
    this.geometries = [0, 1, 2, 3].map((i) => cloudGeometry(i + 1, detail));
    const rng = mulberry32(2025);

    const add = (spec: CloudSpec, storm: boolean): void => {
      const mesh = new THREE.Mesh(this.geometries[spec.shape], storm ? this.storm : this.fair);
      mesh.name = storm ? 'storm-cloud' : 'cloud';
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.group.add(mesh);
      this.items.push({ mesh, spec, u: spec.u, v: spec.v, phase: rng() * 6.28, storm, clear: 1 });
    };
    for (const spec of CLOUDS) add(spec, false);
    for (const spec of STORM_CLOUDS) add(spec, true);
  }

  /**
   * 0 when a cloud would hide the island or cut through it, 1 when it is clear. Clouds shrink
   * away instead of passing through, whichever way the camera is turned.
   */
  private keepClear(pos: THREE.Vector3, size: number, viewer: THREE.Vector3): number {
    const reach = 2.8 * size;
    let clear = 1;

    // Not inside the island's volume.
    const above = pos.y - 0.2 * size > ISLAND_TOP;
    const below = pos.y + 1.5 * size < ISLAND_BOTTOM;
    if (!above && !below) {
      const h = Math.hypot(pos.x, pos.z);
      clear = Math.min(clear, smoothstep(ISLAND_RADIUS + 0.4 * reach, ISLAND_RADIUS + reach, h));
    }

    // Not between the camera and the island.
    this.toIsland.copy(ISLAND_CENTER).sub(viewer);
    this.toCloud.copy(pos).sub(viewer);
    const distIsland = this.toIsland.length();
    const distCloud = this.toCloud.length();
    if (distCloud < distIsland + reach) {
      const angle = this.toIsland.angleTo(this.toCloud);
      const islandAngle = Math.asin(Math.min(1, ISLAND_RADIUS / distIsland));
      const cloudAngle = Math.atan2(0.7 * reach, Math.max(distCloud, 0.1));
      clear = Math.min(clear, smoothstep(islandAngle * 0.75, islandAngle * 0.75 + cloudAngle * 1.3, angle));
    }

    // Not filling the screen when the camera is close.
    return Math.min(clear, smoothstep(2, 6, distCloud - 0.6 * reach));
  }

  update(dt: number, time: number, wind: Wind, env: Environment, reducedMotion: boolean, viewer: THREE.Vector3): void {
    this.perp.set(-wind.dir.z, 0, wind.dir.x);
    // Zero wind, zero drift. The slow bob is decorative and stops with reduced motion.
    const speed = wind.strength * 1.7 + wind.strength * wind.strength * 0.8;

    this.fair.color.copy(env.cloudLit);
    this.fair.emissive.copy(env.cloudLit).multiplyScalar(0.2 + 0.1 * env.daylight);
    this.storm.color.copy(env.cloudLit).multiplyScalar(0.7);
    this.storm.emissive.copy(env.cloudLit).multiplyScalar(0.14);

    for (const c of this.items) {
      let size = c.spec.scale;
      let sway = 0;
      let bob = 0;
      if (c.storm) {
        // Storm clouds swell in as the rain arrives and hang about, swaying a little.
        const gather = smoothstep(0.04, 0.85, env.rain);
        size *= gather;
        sway = Math.sin(time * 0.17 + c.phase) * 0.7 * wind.strength;
        bob = reducedMotion ? 0 : Math.sin(time * 0.3 + c.phase) * 0.1;
      } else {
        c.u += speed * dt;
        if (c.u > SPAN) c.u -= SPAN * 2;
        // Shrink to nothing near the wrap point so a cloud never pops in or out.
        size *= smoothstep(SPAN, SPAN - 4.5, Math.abs(c.u)) * (1 + 0.16 * env.rain);
        bob = (reducedMotion ? 0 : Math.sin(time * 0.35 + c.phase) * 0.12) - env.rain * 0.4;
      }
      c.mesh.position.set(
        wind.dir.x * c.u + this.perp.x * c.v + wind.dir.x * sway,
        c.spec.y + bob,
        wind.dir.z * c.u + this.perp.z * c.v + wind.dir.z * sway,
      );

      const target = size > 0.01 ? this.keepClear(c.mesh.position, size, viewer) : 1;
      c.clear = this.primed ? c.clear + (target - c.clear) * (1 - Math.exp(-dt * 2.4)) : target;
      size *= c.clear;
      c.mesh.visible = size > 0.02;
      c.mesh.scale.set(size, size * 0.95, size);

      // A cloud is a row of puffs. Turn it broadside to whoever is looking, slowly, so it
      // always reads as a cloud and never as a stack of balls seen end-on.
      const facing = Math.atan2(c.mesh.position.x - viewer.x, c.mesh.position.z - viewer.z) + Math.PI;
      c.mesh.rotation.y = this.primed ? c.mesh.rotation.y + angleDelta(c.mesh.rotation.y, facing) * (1 - Math.exp(-dt * 1.4)) : facing;
    }
    this.primed = true;
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    this.fair.dispose();
    this.storm.dispose();
  }
}
