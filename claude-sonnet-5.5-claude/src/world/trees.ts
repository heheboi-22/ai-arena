import * as THREE from 'three';
import { GeoBuilder } from '../util/geo';
import { mulberry32, range, TAU } from '../util/math';
import { noise3 } from '../util/noise';
import type { Wind } from '../fx/wind';
import { TREES, type TreeSpec, terrainHeight } from './layout';
import type { Materials } from './materials';
import type { SurfaceMap } from './surfaces';

const LEAF_TONES = ['#7fb868', '#92c46e', '#62a56b'];
const PINE_TONES = ['#4c8a63', '#3f7a5a', '#5a965f'];
const BLOSSOM_TONES = ['#f2b4c4', '#f7c6d1', '#eaa6ba'];
const BARK = '#7b5a42';

/** A lumpy icosahedron whose vertex colours get lighter toward the top. */
function blobGeometry(seed: number, detail = 1): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Displacement is a function of position alone, so duplicated vertices of
    // neighbouring faces move together and the surface stays closed.
    const k = 0.8 + 0.4 * noise3(x * 1.7 + 3, y * 1.7 + 5, z * 1.7 + 7, seed);
    pos.setXYZ(i, x * k, y * k * 0.9, z * k);
    const shade = 0.7 + 0.36 * ((y + 1) / 2);
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** A cone tier with a darker underside and a lighter tip. */
function tierGeometry(): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(1, 1, 8, 1);
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const shade = 0.66 + 0.44 * (pos.getY(i) + 0.5);
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

interface TreeItem {
  pivot: THREE.Group;
  crown: THREE.Group;
  phase: number;
  /** Stiffer trees sway less: pines more than blossoms. */
  flex: number;
}

export class Trees {
  readonly group = new THREE.Group();
  private readonly items: TreeItem[] = [];
  private readonly axis = new THREE.Vector3();
  private readonly blobs: THREE.BufferGeometry[];
  private readonly tier: THREE.BufferGeometry;

  constructor(private readonly materials: Materials, private readonly surfaces: SurfaceMap) {
    this.group.name = 'trees';
    this.blobs = [blobGeometry(11), blobGeometry(23), blobGeometry(37)];
    this.tier = tierGeometry();
    for (const spec of TREES) this.items.push(this.build(spec));
  }

  private build(spec: TreeSpec): TreeItem {
    const rng = mulberry32(spec.seed * 7919 + 13);
    const groundY = terrainHeight(spec.x, spec.z);
    const H = spec.height;
    const pivot = new THREE.Group();
    pivot.position.set(spec.x, groundY, spec.z);
    pivot.name = `tree-${spec.kind}`;

    const trunk = new GeoBuilder();
    const crown = new GeoBuilder();
    let crownBase = 0.4 * H;
    let flex = 1;

    // Collision shapes are collected in tree space and stamped after the build.
    const stamps: Array<() => void> = [];
    const world = (lx: number, ly: number, lz: number): THREE.Vector3 => new THREE.Vector3(spec.x + lx, groundY + ly, spec.z + lz);

    const addBlob = (
      b: GeoBuilder,
      x: number,
      y: number,
      z: number,
      rx: number,
      ry: number,
      color: THREE.ColorRepresentation,
      collide = true,
    ): void => {
      b.add(this.blobs[Math.floor(rng() * this.blobs.length)], {
        at: [x, y - crownBase, z],
        scale: [rx, ry, rx * (0.9 + rng() * 0.2)],
        rot: [0, rng() * TAU, 0],
        color,
        noise: 0.08,
      });
      if (collide) {
        stamps.push(() => {
          const w = world(x, y, z);
          this.surfaces.addEllipsoid(w.x, w.y, w.z, rx * 0.92, ry * 0.9, rx * 0.92);
        });
      }
    };

    if (spec.kind === 'oak' || spec.kind === 'round' || spec.kind === 'blossom') {
      const blossom = spec.kind === 'blossom';
      const tones = blossom ? BLOSSOM_TONES : LEAF_TONES;
      const base = new THREE.Color(tones[spec.tone % tones.length]);
      const trunkH = (spec.kind === 'oak' ? 0.46 : 0.4) * H;
      crownBase = trunkH * 0.55;
      flex = blossom ? 1.5 : spec.kind === 'oak' ? 0.85 : 1.1;
      const r0 = (spec.kind === 'oak' ? 0.15 : 0.1) * (H / 2.2 + 0.4);

      trunk.cylinder(r0 * 0.58, r0, trunkH, 7, { at: [0, trunkH / 2, 0], color: BARK, noise: 0.1 });
      trunk.cone(r0 * 1.7, 0.2, 7, { at: [0, 0.07, 0], color: BARK, noise: 0.1 });
      // Two stubby branches that disappear into the canopy.
      for (let i = 0; i < 2; i++) {
        const a = rng() * TAU;
        trunk.cylinder(r0 * 0.22, r0 * 0.4, trunkH * 0.5, 5, {
          at: [Math.cos(a) * trunkH * 0.17, trunkH * 0.85, Math.sin(a) * trunkH * 0.17],
          rot: [Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7],
          color: BARK,
        });
      }

      const R = (spec.kind === 'oak' ? 0.31 : 0.36) * H;
      const cy = trunkH + R * 0.62;
      addBlob(crown, 0, cy, 0, R * 1.05, R * 0.95, base);
      const count = spec.kind === 'oak' ? 6 : 4;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU + rng() * 0.6;
        const d = R * range(rng, 0.55, 0.8);
        const tint = base.clone().offsetHSL(range(rng, -0.012, 0.012), 0, range(rng, -0.05, 0.05));
        addBlob(crown, Math.cos(a) * d, cy + range(rng, -0.22, 0.28) * R, Math.sin(a) * d, R * range(rng, 0.52, 0.72), R * range(rng, 0.48, 0.64), tint);
      }
      if (spec.kind !== 'round') {
        addBlob(crown, range(rng, -0.2, 0.2) * R, cy + R * 0.78, range(rng, -0.2, 0.2) * R, R * 0.55, R * 0.46, base.clone().offsetHSL(0, 0, 0.05));
      }
    } else if (spec.kind === 'pine') {
      const base = new THREE.Color(PINE_TONES[spec.tone % PINE_TONES.length]);
      const trunkH = 0.26 * H;
      crownBase = trunkH * 0.5;
      flex = 0.6;
      trunk.cylinder(0.05 * H * 0.5, 0.075 * H * 0.5 + 0.03, trunkH + 0.2, 6, { at: [0, (trunkH + 0.2) / 2, 0], color: BARK, noise: 0.1 });
      const tiers = 5;
      for (let i = 0; i < tiers; i++) {
        const t = i / (tiers - 1);
        const radius = H * 0.2 * (1 - t * 0.78) + 0.04;
        const height = H * 0.3 * (1 - t * 0.35);
        const y = trunkH * 0.7 + t * (H - trunkH * 0.7 - height * 0.9) + height / 2;
        const tint = base.clone().offsetHSL(0, 0, range(rng, -0.03, 0.035));
        crown.add(this.tier, {
          at: [range(rng, -0.03, 0.03), y - crownBase, range(rng, -0.03, 0.03)],
          scale: [radius, height, radius],
          rot: [0, rng() * TAU, 0],
          color: tint,
          noise: 0.07,
        });
        stamps.push(() => {
          const w = world(0, y - height / 2, 0);
          this.surfaces.addCone(w.x, w.z, w.y, radius * 0.95, height * 0.95);
        });
      }
    } else {
      // poplar: a tall, narrow column of leaf masses
      const base = new THREE.Color(LEAF_TONES[spec.tone % LEAF_TONES.length]);
      const trunkH = 0.22 * H;
      crownBase = trunkH * 0.5;
      flex = 0.9;
      trunk.cylinder(0.04, 0.08, trunkH + 0.3, 6, { at: [0, (trunkH + 0.3) / 2, 0], color: BARK, noise: 0.1 });
      const masses = 5;
      for (let i = 0; i < masses; i++) {
        const t = i / (masses - 1);
        const ry = H * range(rng, 0.17, 0.2);
        const rx = H * (0.15 - t * 0.055) * range(rng, 0.92, 1.08);
        const y = trunkH + ry * 0.9 + t * (H - trunkH - ry * 1.8);
        const tint = base.clone().offsetHSL(0, 0, range(rng, -0.04, 0.04));
        addBlob(crown, range(rng, -0.04, 0.04), y, range(rng, -0.04, 0.04), rx, ry, tint);
      }
    }

    const trunkMesh = new THREE.Mesh(trunk.build(), this.materials.clay);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    trunkMesh.name = 'trunk';
    pivot.add(trunkMesh);

    const crownGroup = new THREE.Group();
    crownGroup.position.y = crownBase;
    const crownMesh = new THREE.Mesh(crown.build(), this.materials.foliage);
    crownMesh.castShadow = true;
    crownMesh.receiveShadow = true;
    crownMesh.name = 'crown';
    crownGroup.add(crownMesh);
    pivot.add(crownGroup);
    this.group.add(pivot);

    pivot.updateMatrixWorld(true);
    for (const stamp of stamps) stamp();

    return { pivot, crown: crownGroup, phase: rng() * TAU, flex };
  }

  update(time: number, wind: Wind): void {
    const w = wind.effective;
    const dir = wind.dir;
    // Rotating about (dz, 0, -dx) tips the top of a tree toward `dir`.
    this.axis.set(dir.z, 0, -dir.x);
    for (const t of this.items) {
      const slow = Math.sin(time * 1.15 + t.phase) * 0.6 + Math.sin(time * 2.3 + t.phase * 1.7) * 0.4;
      const quick = Math.sin(time * 4.1 + t.phase * 2.3);
      // A steady lean plus a swing that grows with the wind. Zero wind means zero motion.
      const lean = 0.05 * wind.strength;
      const swing = 0.04 * w * slow;
      t.pivot.quaternion.setFromAxisAngle(this.axis, (lean + swing) * t.flex);
      // On top of the trunk's sway the crown adds a quicker flutter of its own.
      const flutter = 0.022 * w * quick + 0.016 * w * slow;
      t.crown.quaternion.setFromAxisAngle(this.axis, (lean * 0.7 + flutter) * t.flex);
    }
  }

  dispose(): void {
    for (const b of this.blobs) b.dispose();
    this.tier.dispose();
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}
