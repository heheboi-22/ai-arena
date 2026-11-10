import * as THREE from 'three';
import { Builder, box, cone, cyl, ico } from '../core/builder';
import { TAU, mulberry32 } from '../core/math';
import { clay } from './materials';
import { C } from './palette';

export interface Windmill {
  group: THREE.Group;
  blades: THREE.Group;
}

export function createWindmill(): Windmill {
  const rng = mulberry32(23);
  const b = new Builder(rng);
  const SIDES = 10;
  const towerR = (y: number): number => 0.86 - ((y - 0.28) / 2.9) * 0.3;

  // Stone footing and tapered tower.
  b.add(cyl(0.98, 1.06, 0.5, SIDES), C.stone, { p: [0, 0.05, 0] }, 0.06);
  b.add(cyl(0.56, 0.86, 2.9, SIDES), C.cream, { p: [0, 1.73, 0] }, 0.03);
  b.add(cyl(0.875, 0.89, 0.1, SIDES), C.creamShade, { p: [0, 0.36, 0] });

  // Gallery with a railing.
  const gy = 1.3;
  b.add(cyl(1.0, 0.96, 0.07, SIDES), C.woodLight, { p: [0, gy, 0] }, 0.06);
  b.add(cyl(0.8, 0.74, 0.12, SIDES), C.wood, { p: [0, gy - 0.09, 0] }, 0.05);
  for (let i = 0; i < SIDES; i++) {
    const a = ((i + 0.5) / SIDES) * TAU;
    b.add(box(0.035, 0.27, 0.035), C.wood, {
      p: [Math.sin(a) * 0.95, gy + 0.16, Math.cos(a) * 0.95],
      r: [0, a, 0],
    });
  }
  const rail = new THREE.TorusGeometry(0.95, 0.02, 4, SIDES);
  b.add(rail, C.wood, { p: [0, gy + 0.3, 0], r: [Math.PI / 2, 0, Math.PI / SIDES] });

  // Door and two little windows.
  b.add(box(0.42, 0.82, 0.1), C.woodDark, { p: [0, 0.68, towerR(0.68) - 0.03] }, 0.06);
  b.add(box(0.56, 0.08, 0.12), C.woodLight, { p: [0, 1.12, towerR(1.12) - 0.02] });
  for (const s of [-1, 1]) {
    b.add(box(0.07, 0.86, 0.12), C.woodLight, { p: [s * 0.245, 0.68, towerR(0.68) - 0.03] });
  }
  b.add(ico(0.03, 0), C.brass, { p: [0.13, 0.66, towerR(0.66) + 0.03] });
  const lookout = (y: number, a: number): void => {
    const r = towerR(y);
    const p = (out: number): [number, number, number] => [
      Math.sin(a) * (r + out),
      y,
      Math.cos(a) * (r + out),
    ];
    b.add(box(0.22, 0.3, 0.06), '#4f6675', { p: p(-0.01), r: [0, a, 0] });
    b.add(box(0.3, 0.05, 0.1), C.woodLight, { p: [p(0)[0], y + 0.17, p(0)[2]], r: [0, a, 0] });
    b.add(box(0.32, 0.05, 0.12), C.stoneLight, { p: [p(0.01)[0], y - 0.18, p(0.01)[2]], r: [0, a, 0] });
  };
  lookout(2.2, 0);
  lookout(1.95, TAU * 0.3);
  lookout(2.35, -TAU * 0.3);

  // Cap.
  b.add(cyl(0.62, 0.58, 0.12, SIDES), C.wood, { p: [0, 3.22, 0] }, 0.05);
  b.add(cone(0.78, 0.85, SIDES), '#93583f', { p: [0, 3.7, 0] }, 0.08);
  b.add(ico(0.06, 0), C.brass, { p: [0, 4.15, 0] });
  b.add(box(0.4, 0.4, 0.62), C.wood, { p: [0, 3.14, 0.42] }, 0.05);

  const group = new THREE.Group();
  group.name = 'windmill';
  group.add(b.mesh(clay));

  // --- sails -----------------------------------------------------------------
  const blade = new Builder(rng);
  blade.add(box(0.075, 2.0, 0.05), C.woodDark, { p: [0, 1.02, 0] }, 0.05);
  blade.add(box(0.03, 1.42, 0.03), C.wood, { p: [0.49, 1.25, 0] });
  for (let i = 0; i < 6; i++) {
    blade.add(box(0.47, 0.028, 0.03), C.wood, { p: [0.26, 0.56 + i * 0.275, 0] });
  }
  blade.add(box(0.42, 1.38, 0.012), C.canvas, { p: [0.26, 1.25, -0.014] }, 0.03);
  const pitched = new Builder().addRaw(blade.geometry(), { r: [0, 0.16, 0] }).geometry();

  const rotor = new Builder(rng);
  for (let k = 0; k < 4; k++) rotor.addRaw(pitched, { r: [0, 0, (k * TAU) / 4] });
  rotor.add(cyl(0.14, 0.14, 0.22, 8), C.woodDark, { r: [Math.PI / 2, 0, 0] });
  rotor.add(cone(0.1, 0.18, 8), C.brass, { p: [0, 0, 0.19], r: [Math.PI / 2, 0, 0] });
  pitched.dispose();

  const blades = new THREE.Group();
  blades.position.set(0, 3.14, 0.86);
  blades.add(rotor.mesh(clay));
  group.add(blades);

  return { group, blades };
}
