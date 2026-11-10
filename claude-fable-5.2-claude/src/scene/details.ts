import * as THREE from 'three';
import { Builder, box, cone, cyl, ico } from '../core/builder';
import { TAU, lerp, mulberry32 } from '../core/math';
import { clay } from './materials';
import { C } from './palette';
import { lumpy } from './shapes';
import { HOUSE, MILL, POND, groundHeight, pondRadius, pondS } from './terrain';

type V2 = [number, number];

const bezier = (a: V2, c: V2, b: V2, t: number): V2 => [
  (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
  (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1],
];

/** A point in front of an object that sits at (x, z) and is rotated by `rot`. */
const ahead = (o: { x: number; z: number; rot: number }, side: number, fwd: number): V2 => [
  o.x + side * Math.cos(o.rot) + fwd * Math.sin(o.rot),
  o.z - side * Math.sin(o.rot) + fwd * Math.cos(o.rot),
];

/** Fence line along the front-left edge. */
const FENCE: V2[] = [
  [-4.75, 1.75],
  [-4.45, 2.6],
  [-3.95, 3.35],
  [-3.25, 3.95],
  [-2.4, 4.35],
  [-1.5, 4.55],
];

/** Static dressing: path, fence, rocks, shrubs, flowers, tufts. One draw call. */
export function createDetails(): THREE.Mesh {
  const rng = mulberry32(42);
  const b = new Builder(rng);
  const gy = groundHeight;

  // --- stepping-stone paths ---------------------------------------------------
  const stone = (x: number, z: number, r: number): void => {
    if (pondS(x, z) < 1.34) return;
    b.add(
      cyl(r, r * 1.08, 0.07, 7),
      rng() > 0.5 ? C.stoneLight : C.stone,
      { p: [x, gy(x, z) + 0.012, z], r: [(rng() - 0.5) * 0.08, rng() * TAU, (rng() - 0.5) * 0.08], s: [1, 1, 0.82 + rng() * 0.3] },
      0.05,
    );
  };
  const door = ahead(HOUSE, -0.5, 1.95);
  const jr = 1.44 * pondRadius(3.42);
  const jetty: V2 = [POND.x + jr * Math.cos(3.42), POND.z + jr * Math.sin(3.42)];
  const fork: V2 = [0.35, 2.15];
  const millDoor = ahead(MILL, 0, 1.3);
  const walk = (a: V2, c: V2, e: V2, n: number, skipFirst = false): void => {
    for (let i = skipFirst ? 1 : 0; i <= n; i++) {
      const p = bezier(a, c, e, i / n);
      const jx = (rng() - 0.5) * 0.1, jz = (rng() - 0.5) * 0.1;
      stone(p[0] + jx, p[1] + jz, 0.17 + rng() * 0.06);
    }
  };
  walk(door, [-0.9, 2.75], fork, 4);
  walk(fork, [0.7, 2.2], jetty, 2, true);
  walk(fork, [1.35, 0.25], millDoor, 8, true);

  // --- fence -------------------------------------------------------------------
  for (let i = 0; i < FENCE.length; i++) {
    const [x, z] = FENCE[i];
    const y = gy(x, z);
    const lean: [number, number, number] = [(rng() - 0.5) * 0.1, rng() * 0.6, (rng() - 0.5) * 0.1];
    b.add(box(0.075, 0.52, 0.075), C.wood, { p: [x, y + 0.2, z], r: lean }, 0.07);
    b.add(cone(0.06, 0.08, 4), C.woodLight, { p: [x, y + 0.49, z], r: [lean[0], lean[1] + Math.PI / 4, lean[2]] });
    if (i === FENCE.length - 1) break;
    const [nx, nz] = FENCE[i + 1];
    const len = Math.hypot(nx - x, nz - z);
    const yaw = -Math.atan2(nz - z, nx - x);
    const ny = gy(nx, nz);
    const pitch = Math.atan2(ny - y, len);
    for (const h of [0.17, 0.35]) {
      b.add(
        box(len + 0.06, 0.05, 0.035),
        C.woodLight,
        { p: [(x + nx) / 2, (y + ny) / 2 + h + (rng() - 0.5) * 0.02, (z + nz) / 2], r: [0, yaw, pitch + (rng() - 0.5) * 0.03] },
        0.07,
      );
    }
  }

  // --- rocks -------------------------------------------------------------------
  const rock = (x: number, z: number, r: number, seed: number, color: string = C.stone): void => {
    b.add(
      lumpy(r, 1, 0.24, seed, [1, 0.68, 0.85]),
      color,
      { p: [x, gy(x, z) + r * 0.22, z], r: [0, rng() * TAU, 0] },
      0.07,
    );
  };
  rock(3.95, 3.65, 0.34, 1);
  rock(4.3, 3.3, 0.2, 2, C.stoneLight);
  rock(1.15, 3.9, 0.24, 3);
  rock(0.85, 4.15, 0.14, 4, C.stoneLight);
  rock(-0.55, -2.6, 0.3, 5, C.stoneDark);
  rock(-0.15, -2.75, 0.17, 6);
  rock(4.2, -2.3, 0.3, 7);
  rock(-4.9, -0.85, 0.26, 8, C.stoneDark);
  rock(1.75, -0.5, 0.16, 9, C.stoneLight);
  rock(-2.75, 4.0, 0.18, 10);

  // --- shrubs ------------------------------------------------------------------
  const shrub = (x: number, z: number, r: number, seed: number, color: string): void => {
    b.add(lumpy(r, 1, 0.14, seed, [1, 0.8, 1]), color, { p: [x, gy(x, z) + r * 0.45, z] }, 0.06);
  };
  const hb = (side: number, fwd: number): V2 => ahead(HOUSE, side, fwd);
  shrub(...hb(1.75, 0.75), 0.36, 21, C.leafDeep);
  shrub(...hb(1.95, 0.3), 0.26, 22, C.leaf);
  shrub(...hb(-1.75, 0.6), 0.32, 23, C.leaf);
  shrub(...hb(-1.4, -1.35), 0.4, 24, C.leafDeep);
  shrub(3.6, -3.75, 0.34, 25, C.leaf);
  shrub(-3.0, -2.75, 0.3, 26, C.leafLight);
  shrub(1.75, -4.3, 0.28, 27, C.leafDeep);

  // --- flowers -----------------------------------------------------------------
  const petals = [C.petalYellow, C.petalCoral, C.petalWhite, C.petalLilac];
  const flowers = (cx: number, cz: number, spread: number, n: number, hue?: number): void => {
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, d = Math.sqrt(rng()) * spread;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (pondS(x, z) < 1.3) continue;
      const h = 0.11 + rng() * 0.08;
      const y = gy(x, z);
      b.add(box(0.016, h, 0.016), C.leafDeep, { p: [x, y + h / 2, z] });
      b.add(ico(0.042 + rng() * 0.014, 0), petals[hue ?? Math.floor(rng() * petals.length)], {
        p: [x, y + h + 0.02, z],
        r: [rng(), rng(), 0],
      });
    }
  };
  flowers(...hb(0.75, 1.55), 0.42, 8);
  flowers(...hb(-1.55, 1.5), 0.4, 6, 1);
  flowers(-3.3, 3.25, 0.5, 8, 0);
  flowers(-2.05, 3.75, 0.45, 6, 2);
  flowers(3.3, 0.35, 0.5, 7, 3);
  flowers(1.2, 4.35, 0.35, 5, 2);
  flowers(4.55, 0.95, 0.35, 4, 0);
  flowers(-1.9, -2.4, 0.5, 6, 2);
  flowers(1.55, -3.45, 0.4, 5, 0);

  // --- grass tufts -------------------------------------------------------------
  const blade = cone(0.03, 0.2, 4);
  for (let i = 0; i < 70; i++) {
    const a = rng() * TAU, d = Math.sqrt(rng()) * 5.0;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (pondS(x, z) < 1.4) continue;
    if (Math.hypot(x - HOUSE.x, z - HOUSE.z) < 2.0) continue;
    if (Math.hypot(x - MILL.x, z - MILL.z) < 1.25) continue;
    const y = gy(x, z);
    const tone = rng() > 0.5 ? C.grassDark : C.leaf;
    for (let k = 0; k < 3; k++) {
      const s = lerp(0.7, 1.25, rng());
      b.add(blade, tone, {
        p: [x + (k - 1) * 0.045, y + 0.09 * s, z + (rng() - 0.5) * 0.05],
        r: [(rng() - 0.5) * 0.5, rng() * TAU, (k - 1) * 0.28],
        s,
      }, 0.08);
    }
  }

  const mesh = b.mesh(clay);
  mesh.name = 'details';
  return mesh;
}

/** A few boulders that drift beside the island, gently out of step. */
export class Floaters {
  readonly group = new THREE.Group();
  private readonly items: { mesh: THREE.Mesh; y: number; phase: number; speed: number }[] = [];

  constructor() {
    const rng = mulberry32(9);
    const specs: [number, number, number, number][] = [
      [-6.9, -2.3, 1.6, 0.5],
      [-6.2, -3.5, 2.5, 0.24],
      [6.6, -3.0, -2.1, 0.44],
      [5.9, -4.3, -1.3, 0.2],
      [1.9, -6.5, 3.6, 0.3],
      [-1.2, -7.3, -0.6, 0.2],
    ];
    specs.forEach(([x, y, z, r], i) => {
      const b = new Builder(rng);
      b.add(lumpy(r, 1, 0.26, 30 + i, [1, 1.15, 0.9]), i % 2 ? C.rockDeep : C.rock, {}, 0.1);
      if (r > 0.4) {
        // A scrap of turf on the big ones.
        b.add(lumpy(r * 0.72, 1, 0.12, 40 + i, [1.05, 0.3, 0.95]), C.grass, { p: [0, r * 0.78, 0] }, 0.06);
      }
      const mesh = b.mesh(clay);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rng() * 0.6, rng() * TAU, rng() * 0.6);
      this.group.add(mesh);
      this.items.push({ mesh, y, phase: rng() * TAU, speed: 0.35 + rng() * 0.3 });
    });
  }

  update(time: number, motion: number): void {
    for (const it of this.items) {
      it.mesh.position.y = it.y + Math.sin(time * it.speed + it.phase) * 0.14 * motion;
    }
  }
}
