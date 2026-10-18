import * as THREE from 'three';
import { GeoBuilder } from '../util/geo';
import { clamp, lerp } from '../util/math';
import type { Environment } from '../fx/environment';
import { HOUSE, terrainHeight } from './layout';
import type { Materials } from './materials';
import type { SurfaceMap } from './surfaces';

const W = HOUSE.width;
const D = HOUSE.depth;
const FOUNDATION = 0.22;
const WALL_TOP = 1.36;
const RIDGE = 2.18;
const OVER_Z = 0.27;
const OVER_X = 0.25;
const SLOPE = (RIDGE - WALL_TOP) / (D / 2);

const AMBER = new THREE.Color('#ffb04a');
const AMBER_HOT = new THREE.Color('#ffc978');
const SAGE = '#7ea58d';
const WOOD_LIGHT = '#e6cfae';
const WOOD_DARK = '#a9764a';

/** A box whose top face carries shingle UVs: v counts up the slope from the eave (local +z). */
function roofSlab(length: number, thickness: number, span: number, tile = 0.95): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(length, thickness, span);
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  for (const first of [8, 12]) {
    for (let i = first; i < first + 4; i++) {
      uv.setXY(i, (pos.getX(i) + length / 2) / tile, (span / 2 - pos.getZ(i)) / tile);
    }
  }
  return geo;
}

interface GlowSpot {
  sprite: THREE.Sprite;
  base: number;
}

export class House {
  readonly group = new THREE.Group();
  /** Everything that should toggle the lights when it is clicked. */
  readonly pickTargets: THREE.Object3D[] = [];
  /** Where the chimney smoke starts, in island space (the island sits at the world origin). */
  readonly smokeOrigin = new THREE.Vector3();
  readonly groundY: number;

  private readonly light: THREE.PointLight;
  private readonly lampLight: THREE.PointLight;
  private readonly lamp: THREE.MeshLambertMaterial;
  private readonly glows: GlowSpot[] = [];
  private readonly glowMaterial: THREE.SpriteMaterial;
  private readonly materials: Materials;
  private bounce = 0;
  private bounceVelocity = 0;

  constructor(materials: Materials, surfaces: SurfaceMap) {
    this.materials = materials;
    this.groundY = terrainHeight(HOUSE.x, HOUSE.z);
    this.group.position.set(HOUSE.x, this.groundY, HOUSE.z);
    this.group.rotation.y = HOUSE.yaw;
    this.group.name = 'house';

    this.lamp = new THREE.MeshLambertMaterial({ color: 0xffe3a8, emissive: AMBER.clone(), emissiveIntensity: 0 });
    this.glowMaterial = new THREE.SpriteMaterial({
      map: materials.glow,
      color: AMBER,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0,
      fog: false,
    });

    const plaster = new GeoBuilder();
    const wood = new GeoBuilder();
    const stone = new GeoBuilder();
    const roof = new GeoBuilder();
    const clay = new GeoBuilder();
    const glass = new GeoBuilder();
    const lamp = new GeoBuilder();

    this.buildBody(plaster, wood, stone);
    this.buildRoof(roof, clay, stone);
    this.buildDoor(wood, stone, clay, lamp);
    this.buildWindows(wood, clay, glass);
    this.buildExtras(wood, clay);

    const parts: Array<[GeoBuilder, THREE.Material, string]> = [
      [plaster, materials.plaster, 'walls'],
      [wood, materials.wood, 'timber'],
      [stone, materials.stone, 'stonework'],
      [roof, materials.roof, 'roof'],
      [clay, materials.clay, 'trim'],
      [glass, materials.glass, 'glass'],
      [lamp, this.lamp, 'lamp'],
    ];
    for (const [builder, material, name] of parts) {
      const mesh = new THREE.Mesh(builder.build(), material);
      mesh.name = `house-${name}`;
      mesh.castShadow = name !== 'glass' && name !== 'lamp';
      mesh.receiveShadow = true;
      mesh.userData.house = true;
      this.group.add(mesh);
      this.pickTargets.push(mesh);
    }

    // A slightly generous invisible box, so a fingertip does not have to hit a window frame.
    const proxy = new THREE.Mesh(
      new THREE.BoxGeometry(W + 0.5, 2.7, D + 0.7),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    proxy.position.set(0, 1.3, 0.1);
    proxy.userData.house = true;
    proxy.name = 'house-hit-area';
    this.group.add(proxy);
    this.pickTargets.push(proxy);

    this.light = new THREE.PointLight(AMBER, 0, 7.5, 1.6);
    this.light.position.set(0.15, 1.15, D / 2 + 0.85);
    this.lampLight = new THREE.PointLight(AMBER_HOT, 0, 3.2, 2);
    this.lampLight.position.set(0.46, 0.95, D / 2 + 0.22);
    this.group.add(this.light, this.lampLight);

    // Chimney top, in house space, turned into world space once.
    this.group.updateMatrixWorld(true);
    this.smokeOrigin.set(W / 2 - 0.42, 3.0, -0.1).applyMatrix4(this.group.matrixWorld);

    this.registerSurfaces(surfaces);
  }

  private buildBody(plaster: GeoBuilder, wood: GeoBuilder, stone: GeoBuilder): void {
    const wallH = WALL_TOP - FOUNDATION;
    stone.box(W + 0.12, FOUNDATION + 0.2, D + 0.12, { at: [0, (FOUNDATION - 0.2) / 2, 0], uv: { box: 1.3 }, noise: 0.08 });
    plaster.box(W, wallH, D, { at: [0, FOUNDATION + wallH / 2, 0], uv: { box: 0.8 } });

    // Gable triangles above the end walls.
    const tri = new THREE.Shape();
    tri.moveTo(-D / 2, 0);
    tri.lineTo(D / 2, 0);
    tri.lineTo(0, RIDGE - WALL_TOP);
    tri.closePath();
    for (const side of [-1, 1]) {
      const geo = new THREE.ShapeGeometry(tri);
      plaster.add(geo, { at: [side * (W / 2 + 0.002), WALL_TOP - 0.01, 0], rot: [0, (side * Math.PI) / 2, 0], uv: { box: 0.8 } });
      geo.dispose();
    }

    // Timber frame: corner posts, a top plate and a sill.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        wood.box(0.11, wallH - 0.12, 0.11, { at: [sx * (W / 2), FOUNDATION + (wallH - 0.12) / 2, sz * (D / 2)], uv: { box: 1.6 }, color: WOOD_LIGHT, noise: 0.05 });
      }
    }
    for (const sz of [-1, 1]) {
      wood.box(W + 0.14, 0.1, 0.1, { at: [0, WALL_TOP - 0.22, sz * (D / 2)], uv: { box: 1.6 }, color: WOOD_LIGHT });
      wood.box(W + 0.12, 0.07, 0.1, { at: [0, FOUNDATION + 0.035, sz * (D / 2)], uv: { box: 1.6 }, color: WOOD_LIGHT });
    }
    for (const sx of [-1, 1]) {
      wood.box(0.1, 0.1, D + 0.14, { at: [sx * (W / 2), WALL_TOP - 0.22, 0], uv: { box: 1.6 }, color: WOOD_LIGHT });
      wood.box(0.1, 0.07, D + 0.12, { at: [sx * (W / 2), FOUNDATION + 0.035, 0], uv: { box: 1.6 }, color: WOOD_LIGHT });
    }
  }

  private buildRoof(roof: GeoBuilder, clay: GeoBuilder, stone: GeoBuilder): void {
    const span = Math.hypot(D / 2 + OVER_Z, SLOPE * (D / 2 + OVER_Z));
    const length = W + OVER_X * 2;
    const thickness = 0.085;
    const phi = Math.atan(SLOPE);
    const midZ = (D / 2 + OVER_Z) / 2;
    const midY = RIDGE - (SLOPE * (D / 2 + OVER_Z)) / 2;
    for (const side of [1, -1]) {
      const geo = roofSlab(length, thickness, span + 0.03);
      // The slab's top face lies on the roof plane, so its centre sits half a
      // thickness below the plane, along the plane's normal.
      roof.add(geo, {
        at: [0, midY - (thickness / 2) * Math.cos(phi), side * (midZ - (thickness / 2) * Math.sin(phi))],
        rot: side === 1 ? [phi, 0, 0] : [phi, Math.PI, 0],
        uv: { keep: [1, 1] },
        color: side === 1 ? '#ffffff' : '#f4efe9',
        noise: 0.04,
      });
      geo.dispose();
    }
    // Ridge cap and gable-end fascia boards.
    clay.box(length + 0.08, 0.08, 0.2, { at: [0, RIDGE + 0.02, 0], color: '#a45a42', noise: 0.08 });
    for (const sx of [-1, 1]) {
      for (const side of [1, -1]) {
        clay.box(0.07, 0.1, span + 0.02, {
          at: [sx * (length / 2 + 0.005), midY - 0.04, side * midZ],
          rot: [side * phi, 0, 0],
          color: '#d8bf9a',
        });
      }
    }

    // Chimney with a stone cap and two clay pots.
    const cx = W / 2 - 0.42;
    stone.box(0.42, 1.6, 0.4, { at: [cx, 1.88, -0.1], uv: { box: 1.5 }, noise: 0.06 });
    stone.box(0.54, 0.09, 0.52, { at: [cx, 2.7, -0.1], uv: { box: 1.5 }, color: '#d9d2c4' });
    for (const dx of [-0.1, 0.1]) {
      clay.cylinder(0.065, 0.075, 0.2, 9, { at: [cx + dx, 2.84, -0.1], color: '#b9684a', noise: 0.06 });
    }
  }

  private buildDoor(wood: GeoBuilder, stone: GeoBuilder, clay: GeoBuilder, lamp: GeoBuilder): void {
    const z = D / 2;
    const doorW = 0.5;
    const doorH = 0.92;
    const y0 = FOUNDATION;
    // Door leaf, frame and lintel.
    wood.box(doorW, doorH, 0.07, { at: [0, y0 + doorH / 2, z + 0.005], uv: { box: 1.5 }, color: '#b87b4e', noise: 0.04 });
    wood.box(0.07, doorH + 0.08, 0.1, { at: [-(doorW / 2 + 0.035), y0 + (doorH + 0.08) / 2, z + 0.02], uv: { box: 1.6 }, color: WOOD_LIGHT });
    wood.box(0.07, doorH + 0.08, 0.1, { at: [doorW / 2 + 0.035, y0 + (doorH + 0.08) / 2, z + 0.02], uv: { box: 1.6 }, color: WOOD_LIGHT });
    wood.box(doorW + 0.24, 0.09, 0.12, { at: [0, y0 + doorH + 0.06, z + 0.03], uv: { box: 1.6 }, color: WOOD_LIGHT });
    // Iron straps and a knob.
    for (const dy of [0.2, 0.66]) {
      clay.box(doorW - 0.04, 0.045, 0.02, { at: [0, y0 + dy, z + 0.05], color: '#4a4038' });
    }
    clay.sphere(0.03, 8, 6, { at: [0.15, y0 + 0.46, z + 0.075], color: '#d9b25a' });
    // Two stone steps.
    stone.box(0.88, 0.14, 0.44, { at: [0, 0.03, z + 0.22], uv: { box: 1.4 }, color: '#e4ddd0' });
    stone.box(0.66, 0.14, 0.3, { at: [0, 0.14, z + 0.13], uv: { box: 1.4 }, color: '#e9e3d6' });
    // Wall lantern: a bracket and a glowing glass lamp, on the right of the door.
    clay.box(0.03, 0.03, 0.14, { at: [0.46, 1.02, z + 0.07], color: '#3d352f' });
    clay.box(0.09, 0.025, 0.09, { at: [0.46, 1.09, z + 0.15], color: '#3d352f' });
    clay.box(0.09, 0.025, 0.09, { at: [0.46, 0.87, z + 0.15], color: '#3d352f' });
    lamp.box(0.075, 0.2, 0.075, { at: [0.46, 0.98, z + 0.15] });
  }

  private buildWindows(wood: GeoBuilder, clay: GeoBuilder, glass: GeoBuilder): void {
    const spots: Array<{ frame: { at: [number, number, number]; rot: [number, number, number] }; w: number; h: number; box: boolean; shutters: boolean }> = [
      { frame: { at: [-0.74, 0.84, D / 2], rot: [0, 0, 0] }, w: 0.36, h: 0.5, box: true, shutters: true },
      { frame: { at: [0.74, 0.84, D / 2], rot: [0, 0, 0] }, w: 0.36, h: 0.5, box: true, shutters: true },
      { frame: { at: [-W / 2, 0.84, 0], rot: [0, -Math.PI / 2, 0] }, w: 0.42, h: 0.5, box: false, shutters: true },
      { frame: { at: [-0.5, 0.84, -D / 2], rot: [0, Math.PI, 0] }, w: 0.38, h: 0.46, box: false, shutters: false },
      { frame: { at: [0.5, 0.84, -D / 2], rot: [0, Math.PI, 0] }, w: 0.38, h: 0.46, box: false, shutters: false },
    ];
    for (const s of spots) {
      this.addWindow(wood, clay, glass, s.frame, s.w, s.h, s.box, s.shutters);
    }

    // Round attic window in the left gable.
    const attic = { at: [-W / 2, WALL_TOP + 0.3, 0] as [number, number, number], rot: [0, -Math.PI / 2, 0] as [number, number, number] };
    glass.within(attic, () => {
      glass.cylinder(0.15, 0.15, 0.03, 18, { at: [0, 0, 0.0], rot: [Math.PI / 2, 0, 0] });
    });
    wood.within(attic, () => {
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        wood.box(0.075, 0.05, 0.07, { at: [Math.cos(a) * 0.175, Math.sin(a) * 0.175, 0.02], rot: [0, 0, a + Math.PI / 2], uv: { box: 1.6 }, color: WOOD_LIGHT });
      }
      wood.box(0.3, 0.025, 0.04, { at: [0, 0, 0.03], uv: { box: 1.6 }, color: WOOD_LIGHT });
      wood.box(0.025, 0.3, 0.04, { at: [0, 0, 0.03], uv: { box: 1.6 }, color: WOOD_LIGHT });
    });
    this.addGlow(new THREE.Vector3(-W / 2 - 0.1, WALL_TOP + 0.3, 0), 0.85);
  }

  private addWindow(
    wood: GeoBuilder,
    clay: GeoBuilder,
    glass: GeoBuilder,
    frame: { at: [number, number, number]; rot: [number, number, number] },
    w: number,
    h: number,
    flowerBox: boolean,
    shutters: boolean,
  ): void {
    glass.within(frame, () => {
      glass.box(w, h, 0.02, { at: [0, 0, 0.0] });
    });
    wood.within(frame, () => {
      const t = 0.06;
      wood.box(w + t * 2, t, 0.07, { at: [0, h / 2 + t / 2, 0.02], uv: { box: 1.6 }, color: WOOD_LIGHT });
      wood.box(w + t * 2, t, 0.07, { at: [0, -h / 2 - t / 2, 0.02], uv: { box: 1.6 }, color: WOOD_LIGHT });
      wood.box(t, h, 0.07, { at: [-w / 2 - t / 2, 0, 0.02], uv: { box: 1.6 }, color: WOOD_LIGHT });
      wood.box(t, h, 0.07, { at: [w / 2 + t / 2, 0, 0.02], uv: { box: 1.6 }, color: WOOD_LIGHT });
      wood.box(0.028, h, 0.04, { at: [0, 0, 0.035], uv: { box: 1.6 }, color: WOOD_LIGHT });
      wood.box(w, 0.028, 0.04, { at: [0, 0.02, 0.035], uv: { box: 1.6 }, color: WOOD_LIGHT });
      // Sill that sticks out a little.
      wood.box(w + 0.2, 0.045, 0.14, { at: [0, -h / 2 - t - 0.015, 0.07], uv: { box: 1.6 }, color: WOOD_LIGHT });
    });
    if (shutters) {
      clay.within(frame, () => {
        // Front windows keep only their outer shutter, which leaves room for the lantern and the plaster.
        const sides = frame.rot[1] === 0 && flowerBox ? [Math.sign(frame.at[0])] : [-1, 1];
        for (const side of sides) {
          const x = side * (w / 2 + 0.06 + 0.08);
          clay.box(0.15, h + 0.1, 0.035, { at: [x, 0, 0.025], color: SAGE, noise: 0.05 });
          for (let i = 0; i < 4; i++) {
            clay.box(0.12, 0.018, 0.045, { at: [x, -h / 2 + 0.1 + i * ((h - 0.05) / 3.4), 0.03], color: '#5f8a70' });
          }
        }
      });
    }
    if (flowerBox) {
      wood.within(frame, () => {
        wood.box(w + 0.16, 0.1, 0.14, { at: [0, -h / 2 - 0.16, 0.12], uv: { box: 1.6 }, color: WOOD_DARK });
      });
      clay.within(frame, () => {
        const colors = ['#f6a9bd', '#fff2d6', '#ffd466', '#f6a9bd', '#ffffff', '#ffd466'];
        for (let i = 0; i < 6; i++) {
          const x = -w / 2 - 0.02 + (i / 5) * (w + 0.04);
          clay.sphere(0.055, 6, 5, { at: [x, -h / 2 - 0.09, 0.12], color: '#5f9a58', noise: 0.15 });
          clay.sphere(0.03, 5, 4, { at: [x + (i % 2 ? 0.02 : -0.02), -h / 2 - 0.045, 0.14], color: colors[i] });
        }
      });
    }
    // Glow in the glass and a halo that sits a hair in front of the wall.
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...frame.at),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(frame.rot[0], frame.rot[1], frame.rot[2], 'YXZ')),
      new THREE.Vector3(1, 1, 1),
    );
    this.addGlow(new THREE.Vector3(0, 0, 0.12).applyMatrix4(m), Math.max(w, h) * 2.3);
  }

  private addGlow(position: THREE.Vector3, size: number): void {
    const sprite = new THREE.Sprite(this.glowMaterial);
    sprite.position.copy(position);
    sprite.scale.setScalar(size);
    sprite.visible = false;
    sprite.renderOrder = 6;
    this.group.add(sprite);
    this.glows.push({ sprite, base: size });
  }

  private buildExtras(wood: GeoBuilder, clay: GeoBuilder): void {
    // A rain barrel by the left corner, with two iron hoops.
    const bx = -W / 2 - 0.34;
    const bz = D / 2 - 0.1;
    wood.cylinder(0.2, 0.17, 0.46, 14, { at: [bx, 0.23, bz], uv: { keep: [3, 1.2] }, color: '#d8b48c' });
    for (const y of [0.1, 0.38]) {
      clay.cylinder(0.205, 0.205, 0.03, 14, { at: [bx, y, bz], color: '#4a4640' });
    }
    clay.cylinder(0.17, 0.17, 0.02, 14, { at: [bx, 0.46, bz], color: '#38505e' });
  }

  private registerSurfaces(surfaces: SurfaceMap): void {
    const y = this.groundY;
    const halfSpan = D / 2 + OVER_Z;
    surfaces.addGable(
      HOUSE.x,
      HOUSE.z,
      HOUSE.yaw,
      W / 2 + OVER_X,
      halfSpan,
      y + RIDGE - SLOPE * halfSpan + 0.05,
      y + RIDGE + 0.05,
    );
    const chimney = new THREE.Vector3(W / 2 - 0.42, 0, -0.1).applyMatrix4(this.group.matrixWorld);
    surfaces.addBox(chimney.x, chimney.z, HOUSE.yaw, 0.27, 0.26, y + 2.75);
  }

  /** Little hop when the lights are toggled. */
  pulse(): void {
    this.bounceVelocity = 1.6;
  }

  update(dt: number, time: number, level: number, env: Environment, reducedMotion: boolean): void {
    const l = clamp(level);

    // The windows glow more as the world gets darker.
    const dark = clamp(env.night + env.twilight * 0.55 + env.rain * 0.25 * env.daylight, 0, 1);
    const prominence = l * (0.5 + 1.7 * dark);

    // Hand-made flicker: slow and very small.
    const flicker = reducedMotion ? 1 : 1 + 0.035 * Math.sin(time * 7.1) * Math.sin(time * 2.3 + 1) + 0.02 * Math.sin(time * 13.7);

    const glass = this.materials.glass;
    glass.color.set(0x9fb8c8).lerp(env.skyMid, 0.35).multiplyScalar(lerp(0.35, 1, env.daylight));
    glass.emissive
      .copy(env.skyMid)
      .multiplyScalar(0.22 * env.daylight * (1 - l))
      .lerp(AMBER_HOT, clamp(l * 0.92));
    glass.emissiveIntensity = lerp(1, 0.9 + 2.4 * dark, l) * flicker;

    this.lamp.emissiveIntensity = prominence * 1.8 * flicker;
    this.light.intensity = l * (0.6 + 9.5 * dark) * flicker;
    this.lampLight.intensity = l * (0.2 + 2.8 * dark) * flicker;

    this.glowMaterial.opacity = clamp(l * (0.12 + 0.88 * dark)) * 0.85 * flicker;
    for (const g of this.glows) {
      g.sprite.visible = this.glowMaterial.opacity > 0.01;
      g.sprite.scale.setScalar(g.base * (0.85 + 0.2 * l + 0.25 * dark * l));
    }

    // Spring for the toggle hop.
    if (!reducedMotion) {
      this.bounceVelocity += (-90 * this.bounce - 12 * this.bounceVelocity) * dt;
      this.bounce += this.bounceVelocity * dt;
    } else {
      this.bounce = 0;
      this.bounceVelocity = 0;
    }
    this.group.scale.set(1 - this.bounce * 0.05, 1 + this.bounce * 0.11, 1 - this.bounce * 0.05);
  }

  dispose(): void {
    this.lamp.dispose();
    this.glowMaterial.dispose();
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}
