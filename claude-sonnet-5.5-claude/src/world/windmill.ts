import * as THREE from 'three';
import { GeoBuilder } from '../util/geo';
import { damp } from '../util/math';
import type { Wind } from '../fx/wind';
import { WINDMILL, terrainHeight } from './layout';
import type { Materials } from './materials';
import type { SurfaceMap } from './surfaces';

const TOWER_BOTTOM = 0.56;
const TOWER_TOP = 0.38;
const TOWER_BASE_Y = 0.2;
const TOWER_HEIGHT = 1.95;
const CABIN_Y = TOWER_BASE_Y + TOWER_HEIGHT;
const CABIN_HEIGHT = 0.36;
const HUB_Y = CABIN_Y + 0.17;
const HUB_Z = 0.62;
const BLADE_LENGTH = 1.7;
/** Radians per second at full wind. */
const MAX_OMEGA = 4.4;

const CREAM = '#f1e6cf';
const CAP = '#7f5f49';

export class Windmill {
  readonly group = new THREE.Group();
  readonly groundY: number;
  private readonly rotor = new THREE.Group();
  private omega = 0;

  constructor(materials: Materials, surfaces: SurfaceMap) {
    this.groundY = terrainHeight(WINDMILL.x, WINDMILL.z);
    this.group.position.set(WINDMILL.x, this.groundY, WINDMILL.z);
    this.group.rotation.y = WINDMILL.yaw;
    this.group.name = 'windmill';

    const plaster = new GeoBuilder();
    const stone = new GeoBuilder();
    const wood = new GeoBuilder();
    const clay = new GeoBuilder();
    this.buildTower(plaster, stone, wood, clay);

    const parts: Array<[GeoBuilder, THREE.Material, string]> = [
      [plaster, materials.plaster, 'tower'],
      [stone, materials.stone, 'base'],
      [wood, materials.wood, 'timber'],
      [clay, materials.clay, 'trim'],
    ];
    for (const [builder, material, name] of parts) {
      const mesh = new THREE.Mesh(builder.build(), material);
      mesh.name = `windmill-${name}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }

    this.buildRotor(materials);

    // Rain lands on the tower roof; the sails are open frames, so they are left out.
    surfaces.addCylinder(WINDMILL.x, WINDMILL.z, TOWER_BOTTOM, this.groundY + CABIN_Y);
    surfaces.addCone(WINDMILL.x, WINDMILL.z, this.groundY + CABIN_Y + CABIN_HEIGHT, 0.56, 0.78);
  }

  private buildTower(plaster: GeoBuilder, stone: GeoBuilder, wood: GeoBuilder, clay: GeoBuilder): void {
    // Stone plinth.
    stone.cylinder(0.66, 0.74, 0.4, 12, { at: [0, 0.0, 0], uv: { keep: [4.5, 0.6] }, noise: 0.06 });

    // Tapered, plastered tower.
    plaster.cylinder(TOWER_TOP, TOWER_BOTTOM, TOWER_HEIGHT, 12, {
      at: [0, TOWER_BASE_Y + TOWER_HEIGHT / 2, 0],
      uv: { keep: [4, 2.4] },
    });

    // Timber belts, a gallery ring with a rail, and the cabin the sails are fixed to.
    for (const y of [0.62, 1.55]) {
      const r = TOWER_BOTTOM - ((TOWER_BOTTOM - TOWER_TOP) * (y - TOWER_BASE_Y)) / TOWER_HEIGHT + 0.025;
      wood.cylinder(r, r, 0.07, 12, { at: [0, y, 0], uv: { keep: [3, 0.3] }, color: '#e6cfae' });
    }
    wood.cylinder(0.64, 0.64, 0.06, 14, { at: [0, 1.08, 0], uv: { keep: [4, 0.4] }, color: '#e6cfae' });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      wood.box(0.035, 0.26, 0.035, { at: [Math.cos(a) * 0.62, 1.22, Math.sin(a) * 0.62], uv: { box: 1.6 }, color: '#e6cfae' });
    }
    wood.cylinder(0.64, 0.64, 0.035, 14, { at: [0, 1.36, 0], uv: { keep: [4, 0.2] }, color: '#e6cfae' });

    // Cabin and its roof.
    clay.cylinder(0.43, 0.41, CABIN_HEIGHT, 12, { at: [0, CABIN_Y + CABIN_HEIGHT / 2, 0], color: '#a9855f', noise: 0.05 });
    clay.cylinder(0.62, 0.5, 0.06, 12, { at: [0, CABIN_Y + CABIN_HEIGHT + 0.01, 0], color: CAP });
    clay.cone(0.6, 0.8, 12, { at: [0, CABIN_Y + CABIN_HEIGHT + 0.4, 0], color: CAP, noise: 0.05 });
    clay.sphere(0.05, 8, 6, { at: [0, CABIN_Y + CABIN_HEIGHT + 0.83, 0], color: '#d9b25a' });

    // Door with a round top, a frame and a lintel stone.
    const doorY = TOWER_BASE_Y + 0.31;
    const doorZ = 0.505;
    wood.box(0.3, 0.52, 0.06, { at: [0, doorY, doorZ], uv: { box: 1.5 }, color: '#b87b4e' });
    wood.cylinder(0.15, 0.15, 0.06, 10, { at: [0, doorY + 0.26, doorZ], rot: [Math.PI / 2, 0, 0], uv: { box: 1.5 }, color: '#b87b4e' });
    clay.box(0.07, 0.54, 0.08, { at: [-0.185, doorY, doorZ - 0.005], color: '#e6cfae' });
    clay.box(0.07, 0.54, 0.08, { at: [0.185, doorY, doorZ - 0.005], color: '#e6cfae' });
    clay.sphere(0.022, 6, 5, { at: [0.09, doorY, doorZ + 0.035], color: '#d9b25a' });

    // Small windows spread around the tower.
    const windows: Array<[number, number]> = [
      [0, 1.8],
      [0.95, 1.25],
      [-0.95, 1.25],
      [2.6, 1.25],
    ];
    for (const [angle, y] of windows) {
      const r = TOWER_BOTTOM - ((TOWER_BOTTOM - TOWER_TOP) * (y - TOWER_BASE_Y)) / TOWER_HEIGHT;
      clay.within({ at: [Math.sin(angle) * r, y, Math.cos(angle) * r], rot: [0, angle, 0] }, () => {
        clay.box(0.17, 0.22, 0.03, { at: [0, 0, 0.0], color: '#33485a' });
        clay.box(0.23, 0.04, 0.06, { at: [0, 0.13, 0.02], color: '#e6cfae' });
        clay.box(0.23, 0.04, 0.08, { at: [0, -0.13, 0.03], color: '#e6cfae' });
        clay.box(0.04, 0.26, 0.06, { at: [-0.1, 0, 0.02], color: '#e6cfae' });
        clay.box(0.04, 0.26, 0.06, { at: [0.1, 0, 0.02], color: '#e6cfae' });
        clay.box(0.02, 0.22, 0.04, { at: [0, 0, 0.03], color: '#e6cfae' });
        clay.box(0.17, 0.02, 0.04, { at: [0, 0, 0.03], color: '#e6cfae' });
      });
    }
    // A pair of sage shutters on the big front window.
    for (const side of [-1, 1]) {
      const r = TOWER_BOTTOM - ((TOWER_BOTTOM - TOWER_TOP) * (1.8 - TOWER_BASE_Y)) / TOWER_HEIGHT;
      clay.box(0.09, 0.26, 0.025, { at: [side * 0.15, 1.8, r + 0.01], color: '#7ea58d' });
    }
  }

  private buildRotor(materials: Materials): void {
    const frame = new GeoBuilder();
    const cloth = new GeoBuilder();
    const hub = new GeoBuilder();

    // Shaft and hub.
    hub.cylinder(0.06, 0.06, 0.4, 8, { at: [0, 0, -0.1], rot: [Math.PI / 2, 0, 0], color: '#5b3f2c' });
    hub.cylinder(0.16, 0.2, 0.2, 10, { at: [0, 0, 0.1], rot: [Math.PI / 2, 0, 0], color: '#8a5d3f', noise: 0.05 });
    hub.sphere(0.13, 10, 8, { at: [0, 0, 0.23], color: '#d9b25a' });

    // Four sails, each a spar with an outer rail, rungs and a cloth panel, pointing along +y
    // and set at a slight twist the way real sails are. Frame and cloth share the same placement.
    const twist = 0.2;
    for (let k = 0; k < 4; k++) {
      const spin = (k * Math.PI) / 2;
      const place = (b: GeoBuilder, build: () => void): void => {
        b.within({ at: [0, 0, 0.02], rot: [0, 0, spin] }, () => b.within({ rot: [0, twist, 0] }, build));
      };
      place(frame, () => {
        frame.box(0.085, BLADE_LENGTH + 0.1, 0.07, { at: [0, 0.2 + BLADE_LENGTH / 2, 0], uv: { box: 1.6 }, color: '#e8d2b0' });
        frame.box(0.045, BLADE_LENGTH - 0.45, 0.045, { at: [0.4, 0.62 + (BLADE_LENGTH - 0.45) / 2, 0.005], uv: { box: 1.6 }, color: '#e8d2b0' });
        for (let i = 0; i < 8; i++) {
          const y = 0.55 + (i / 7) * (BLADE_LENGTH - 0.5);
          frame.box(0.42, 0.04, 0.04, { at: [0.21, y, 0.005], uv: { box: 1.6 }, color: '#e8d2b0' });
        }
      });
      place(cloth, () => {
        cloth.box(0.34, BLADE_LENGTH - 0.58, 0.012, { at: [0.215, 0.6 + (BLADE_LENGTH - 0.58) / 2, -0.012], color: CREAM, noise: 0.04 });
      });
    }

    this.rotor.position.set(0, HUB_Y, HUB_Z);
    this.rotor.name = 'windmill-rotor';
    for (const [builder, material] of [
      [frame, materials.wood],
      [cloth, materials.cloth],
      [hub, materials.clay],
    ] as const) {
      const mesh = new THREE.Mesh(builder.build(), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.rotor.add(mesh);
    }
    this.group.add(this.rotor);
  }

  update(dt: number, wind: Wind): void {
    // The sails have weight: they speed up and slow down instead of snapping.
    this.omega = damp(this.omega, wind.effective * MAX_OMEGA, 1.2, dt);
    this.rotor.rotation.z += this.omega * dt;
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}
