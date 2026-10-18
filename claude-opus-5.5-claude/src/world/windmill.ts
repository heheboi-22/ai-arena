import * as THREE from 'three';
import { damp } from '../core/math';
import { PartBuilder, placementMatrix } from '../core/parts';
import { WINDMILL } from './layout';
import type { Materials } from './materials';
import { WINDMILL_BASE_Y } from './terrain';

const BASE_TOP = 0.25;
const TOWER_H = 1.9;
const R_BOTTOM = 0.52;
const R_TOP = 0.36;
const TOWER_TOP = BASE_TOP + TOWER_H;
const HUB = { y: 2.3, z: 0.8 };
const BLADE_LEN = 1.38;

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const radiusAt = (y: number) => R_BOTTOM + ((y - BASE_TOP) / TOWER_H) * (R_TOP - R_BOTTOM);
const TAPER = Math.atan2(R_BOTTOM - R_TOP, TOWER_H);

export interface Windmill {
  group: THREE.Group;
  update(dt: number, windStrength: number): void;
  topHeightAt(x: number, z: number): number;
}

export function buildWindmill(m: Materials): Windmill {
  const b = new PartBuilder();

  b.add(m.stone, new THREE.CylinderGeometry(0.62, 0.7, 0.4, 8), { y: BASE_TOP - 0.2 });
  b.add(m.wall, new THREE.CylinderGeometry(R_TOP, R_BOTTOM, TOWER_H, 8), { y: BASE_TOP + TOWER_H / 2 });
  for (const y of [0.85, 1.75]) {
    const r = radiusAt(y) + 0.012;
    b.add(m.wood, new THREE.CylinderGeometry(r, r + 0.004, 0.06, 8), { y });
  }

  // Gallery around the tower.
  const galleryY = 1.24;
  b.add(m.wood, new THREE.CylinderGeometry(0.66, 0.66, 0.05, 8), { y: galleryY, ry: Math.PI / 8 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    b.add(m.woodDark, box(0.03, 0.18, 0.03), { x: Math.cos(a) * 0.62, y: galleryY + 0.1, z: Math.sin(a) * 0.62 });
  }
  b.add(m.woodDark, new THREE.TorusGeometry(0.62, 0.016, 4, 8), { y: galleryY + 0.19, rx: Math.PI / 2, rz: Math.PI / 8 });

  // Door and a small window on the front.
  const arch = new THREE.Shape();
  arch.moveTo(-0.12, 0);
  arch.lineTo(0.12, 0);
  arch.lineTo(0.12, 0.3);
  arch.absarc(0, 0.3, 0.12, 0, Math.PI, false);
  arch.closePath();
  b.add(m.woodDark, new THREE.ExtrudeGeometry(arch, { depth: 0.04, bevelEnabled: false, curveSegments: 8 }), {
    y: BASE_TOP,
    z: radiusAt(BASE_TOP + 0.2) - 0.02,
    rx: -TAPER,
  });
  const wy = 1.78 + 0.1;
  b.add(m.glass, box(0.12, 0.16, 0.02), { y: wy, z: radiusAt(wy) - 0.004, rx: -TAPER });
  b.add(m.trim, box(0.17, 0.03, 0.04), { y: wy - 0.095, z: radiusAt(wy), rx: -TAPER });
  b.add(m.trim, box(0.17, 0.03, 0.04), { y: wy + 0.095, z: radiusAt(wy), rx: -TAPER });

  // Cap.
  b.add(m.woodDark, new THREE.CylinderGeometry(0.44, 0.44, 0.08, 8), { y: TOWER_TOP + 0.02 });
  b.add(m.roof, new THREE.CylinderGeometry(0.06, 0.48, 0.58, 8), { y: TOWER_TOP + 0.33 });
  b.add(m.woodDark, new THREE.SphereGeometry(0.06, 8, 6), { y: TOWER_TOP + 0.66 });
  b.add(m.woodDark, new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), { y: HUB.y, z: HUB.z - 0.3, rx: Math.PI / 2 });

  const group = b.build();

  // Rotor: four lattice sails with canvas, merged into one spinning group.
  const rb = new PartBuilder();
  rb.add(m.woodDark, new THREE.CylinderGeometry(0.1, 0.1, 0.14, 10), { rx: Math.PI / 2 });
  rb.add(m.wood, new THREE.SphereGeometry(0.055, 8, 6), { z: 0.08 });
  for (let k = 0; k < 4; k++) {
    const blade = placementMatrix({ rz: (k * Math.PI) / 2 }).clone();
    const at = (x: number, y: number, z: number) => blade.clone().multiply(placementMatrix({ x, y, z }));
    rb.add(m.wood, box(0.05, BLADE_LEN, 0.045), at(0, BLADE_LEN / 2, 0));
    rb.add(m.canvas, box(0.25, 0.98, 0.01), at(0.155, 0.86, -0.012));
    rb.add(m.wood, box(0.022, 1.02, 0.03), at(0.3, 0.86, 0));
    for (let i = 0; i < 6; i++) rb.add(m.wood, box(0.3, 0.018, 0.025), at(0.15, 0.4 + i * 0.185, 0.008));
  }
  const rotor = rb.build();
  rotor.position.set(0, HUB.y, HUB.z);
  group.add(rotor);

  group.position.set(WINDMILL.x, WINDMILL_BASE_Y - 0.02, WINDMILL.z);
  group.rotation.y = WINDMILL.yaw;
  group.name = 'windmill';

  let angle = 0.3;
  let spin = 0;

  return {
    group,
    update(dt, windStrength) {
      // The sails have some inertia: they spin up and coast down instead of snapping.
      spin = damp(spin, windStrength * 4.4, 1.6, dt);
      angle += spin * dt;
      rotor.rotation.z = -angle;
    },
    topHeightAt(x, z) {
      const dx = x - WINDMILL.x;
      const dz = z - WINDMILL.z;
      if (dx * dx + dz * dz > 0.5 * 0.5) return -Infinity;
      return group.position.y + TOWER_TOP + 0.4;
    },
  };
}
