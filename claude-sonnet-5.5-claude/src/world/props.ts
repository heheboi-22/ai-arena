import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GeoBuilder } from '../util/geo';
import { mulberry32, range, TAU } from '../util/math';
import type { Quality } from '../util/quality';
import {
  FENCE_POINTS,
  FLOWER_PATCHES,
  HOUSE,
  ROCKS,
  TREES,
  WINDMILL,
  computePathStones,
  islandRho,
  pondMetric,
  terrainHeight,
  worldToHouse,
} from './layout';
import type { Materials } from './materials';
import type { SurfaceMap } from './surfaces';

/** True where nothing is built, so grass and flowers may grow. */
function isFree(x: number, z: number, stones: Array<{ x: number; z: number }>, margin = 0): boolean {
  if (islandRho(x, z) > 0.94) return false;
  if (pondMetric(x, z).d < 1.2 + margin) return false;
  const { lx, lz } = worldToHouse(x, z);
  if (Math.abs(lx) < HOUSE.width / 2 + 0.4 + margin && lz > -HOUSE.depth / 2 - 0.4 - margin && lz < HOUSE.depth / 2 + 1.0 + margin) return false;
  if (Math.hypot(x - WINDMILL.x, z - WINDMILL.z) < 0.85 + margin) return false;
  for (const t of TREES) if (Math.hypot(x - t.x, z - t.z) < 0.25 + margin) return false;
  for (const r of ROCKS) if (Math.hypot(x - r.x, z - r.z) < r.size + 0.12 + margin) return false;
  for (const s of stones) if (Math.hypot(x - s.x, z - s.z) < 0.3 + margin) return false;
  return true;
}

export class Props {
  readonly group = new THREE.Group();

  constructor(private readonly materials: Materials, surfaces: SurfaceMap, quality: Quality) {
    this.group.name = 'props';
    const stones = computePathStones();
    this.group.add(this.buildStones(stones));
    this.group.add(this.buildFence());
    this.group.add(this.buildRocks(surfaces));
    this.group.add(this.buildFlowers(stones));
    this.group.add(this.buildGrass(stones, quality.grassTufts));
  }

  private buildStones(stones: Array<{ x: number; z: number; r: number; rot: number }>): THREE.Object3D {
    const rng = mulberry32(55);
    const b = new GeoBuilder();
    const tones = ['#ddd3c0', '#d2c7b1', '#e4dbc9', '#c9bda8'];
    for (const s of stones) {
      const y = terrainHeight(s.x, s.z);
      const geo = new THREE.CylinderGeometry(s.r * 0.9, s.r, 0.07, 7, 1);
      const pa = geo.getAttribute('position');
      for (let i = 0; i < pa.count; i++) {
        const k = 1 + (rng() - 0.5) * 0.16;
        pa.setX(i, pa.getX(i) * k);
        pa.setZ(i, pa.getZ(i) * k);
      }
      b.add(geo, {
        at: [s.x, y + 0.012, s.z],
        rot: [(rng() - 0.5) * 0.06, s.rot, (rng() - 0.5) * 0.06],
        scale: [1, 1, 0.82 + rng() * 0.2],
        color: tones[Math.floor(rng() * tones.length)],
        noise: 0.1,
      });
      geo.dispose();
    }
    const mesh = new THREE.Mesh(b.build(), this.materials.clay);
    mesh.name = 'path-stones';
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    return mesh;
  }

  private buildFence(): THREE.Object3D {
    const rng = mulberry32(909);
    const b = new GeoBuilder();
    const paint = '#f4ecda';
    const posts: THREE.Vector3[] = [];
    // Resample the polyline into evenly spaced posts.
    const curve = new THREE.CatmullRomCurve3(
      FENCE_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false,
      'centripetal',
    );
    const count = Math.max(2, Math.round(curve.getLength() / 0.5));
    for (let i = 0; i <= count; i++) {
      const p = curve.getPointAt(i / count);
      p.y = terrainHeight(p.x, p.z);
      posts.push(p);
    }
    for (const p of posts) {
      const h = 0.42 + rng() * 0.03;
      b.box(0.075, h, 0.075, { at: [p.x, p.y + h / 2 - 0.03, p.z], rot: [0, rng() * 0.3, 0], color: paint, noise: 0.04 });
      b.cone(0.058, 0.07, 4, { at: [p.x, p.y + h - 0.0, p.z], rot: [0, Math.PI / 4, 0], color: paint });
    }
    for (let i = 0; i < posts.length - 1; i++) {
      const a = posts[i];
      const c = posts[i + 1];
      const dx = c.x - a.x;
      const dz = c.z - a.z;
      const len = Math.hypot(dx, dz);
      const yaw = Math.atan2(dx, dz);
      const mx = (a.x + c.x) / 2;
      const mz = (a.z + c.z) / 2;
      for (const rh of [0.14, 0.29]) {
        const ya = a.y + rh;
        const yc = c.y + rh;
        const pitch = Math.atan2(yc - ya, len);
        b.box(0.03, 0.035, len, { at: [mx, (ya + yc) / 2, mz], rot: [-pitch, yaw, 0], color: paint });
      }
      // Pickets between the posts.
      const pickets = Math.max(2, Math.round(len / 0.1));
      for (let k = 1; k < pickets; k++) {
        const t = k / pickets;
        const x = a.x + dx * t;
        const z = a.z + dz * t;
        const y = a.y + (c.y - a.y) * t;
        const h = 0.3 + rng() * 0.035;
        b.box(0.05, h, 0.018, { at: [x, y + h / 2 - 0.02, z], rot: [0, yaw, (rng() - 0.5) * 0.03], color: paint, noise: 0.05 });
        b.cone(0.035, 0.05, 4, { at: [x, y + h - 0.02 + 0.02, z], rot: [0, yaw + Math.PI / 4, 0], scale: [1, 1, 0.45], color: paint });
      }
    }
    const mesh = new THREE.Mesh(b.build(), this.materials.clay);
    mesh.name = 'fence';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildRocks(surfaces: SurfaceMap): THREE.Object3D {
    const rng = mulberry32(31337);
    const b = new GeoBuilder();
    const tones = ['#a09d94', '#8f8d88', '#b0aca0', '#85868c', '#9d958a'];
    for (const r of ROCKS) {
      const geo = new THREE.IcosahedronGeometry(1, 1);
      const pa = geo.getAttribute('position');
      const colors = new Float32Array(pa.count * 3);
      for (let i = 0; i < pa.count; i++) {
        const x = pa.getX(i);
        const y = pa.getY(i);
        const z = pa.getZ(i);
        const k = 0.78 + 0.3 * Math.abs(Math.sin(x * 3.1 + r.seed) * Math.cos(z * 2.7 + y * 1.9));
        pa.setXYZ(i, x * k, y * k, z * k);
        const shade = 0.74 + 0.3 * ((y + 1) / 2);
        colors[i * 3] = shade;
        colors[i * 3 + 1] = shade;
        colors[i * 3 + 2] = shade;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const y = terrainHeight(r.x, r.z);
      const sy = r.size * (0.62 + rng() * 0.2);
      b.add(geo, {
        at: [r.x, y + sy * 0.3, r.z],
        rot: [rng() * 0.3, rng() * TAU, rng() * 0.3],
        scale: [r.size * (1 + rng() * 0.2), sy, r.size * (0.9 + rng() * 0.2)],
        color: tones[Math.floor(rng() * tones.length)],
        noise: 0.1,
      });
      geo.dispose();
      surfaces.addEllipsoid(r.x, y + sy * 0.3, r.z, r.size * 0.95, sy * 0.9, r.size * 0.95);
    }
    const mesh = new THREE.Mesh(b.build(), this.materials.rock);
    mesh.name = 'rocks';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private flowerGeometry(): THREE.BufferGeometry {
    const stem = new GeoBuilder();
    stem.cylinder(0.007, 0.012, 0.16, 4, { at: [0, 0.08, 0], color: '#5f9a58' });
    stem.cone(0.03, 0.08, 3, { at: [0.025, 0.05, 0], rot: [0, 0, -1.15], color: '#6fae5d' });
    stem.cone(0.026, 0.07, 3, { at: [-0.022, 0.08, 0.005], rot: [0, 0, 1.2], color: '#74b361' });
    stem.sphere(0.02, 5, 4, { at: [0, 0.19, 0], color: '#ffd24d' });
    const head = new GeoBuilder();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      head.sphere(0.03, 4, 3, {
        at: [Math.cos(a) * 0.033, 0.185, Math.sin(a) * 0.033],
        scale: [1, 0.4, 0.62],
        rot: [0, -a, 0],
        color: '#ffffff',
      });
    }
    const stemGeo = stem.build();
    const headGeo = head.build();
    for (const [geo, v] of [
      [stemGeo, 0],
      [headGeo, 1],
    ] as const) {
      geo.setAttribute('aHead', new THREE.BufferAttribute(new Float32Array(geo.getAttribute('position').count).fill(v), 1));
    }
    const merged = mergeGeometries([stemGeo, headGeo], false);
    stemGeo.dispose();
    headGeo.dispose();
    return merged;
  }

  private buildFlowers(stones: Array<{ x: number; z: number }>): THREE.Object3D {
    const rng = mulberry32(4242);
    const geo = this.flowerGeometry();
    const spots: Array<{ x: number; z: number }> = [];
    for (const patch of FLOWER_PATCHES) {
      let placed = 0;
      for (let tries = 0; placed < patch.count && tries < patch.count * 12; tries++) {
        const a = rng() * TAU;
        const d = Math.sqrt(rng()) * patch.radius;
        const x = patch.x + Math.cos(a) * d;
        const z = patch.z + Math.sin(a) * d;
        if (!isFree(x, z, stones, -0.05)) continue;
        spots.push({ x, z });
        placed++;
      }
    }
    const palette = ['#fff6e2', '#ffd45e', '#f6a2bb', '#bba7ea', '#f59a7c', '#ffffff', '#9cc9f2'].map((c) => new THREE.Color(c));
    const tints = new Float32Array(spots.length * 3);
    const mesh = new THREE.InstancedMesh(geo, this.materials.flower, spots.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    spots.forEach((s, i) => {
      const k = range(rng, 0.85, 1.5);
      pos.set(s.x, terrainHeight(s.x, s.z) - 0.005, s.z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * TAU);
      scale.set(k, k * range(rng, 0.9, 1.25), k);
      m.compose(pos, q, scale);
      mesh.setMatrixAt(i, m);
      const c = palette[Math.floor(rng() * palette.length)];
      tints[i * 3] = c.r;
      tints[i * 3 + 1] = c.g;
      tints[i * 3 + 2] = c.b;
    });
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 3));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.name = 'flowers';
    return mesh;
  }

  private tuftGeometry(): THREE.BufferGeometry {
    const rng = mulberry32(2718);
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const base = new THREE.Color('#6aab59');
    const blades = 5;
    for (let i = 0; i < blades; i++) {
      const yaw = (i / blades) * TAU + rng() * 0.6;
      const h = range(rng, 0.07, 0.15);
      const w = range(rng, 0.011, 0.019);
      const bend = range(rng, 0.012, 0.04);
      const ox = range(rng, -0.03, 0.03);
      const oz = range(rng, -0.03, 0.03);
      const cos = Math.cos(yaw);
      const sin = Math.sin(yaw);
      const verts: Array<[number, number, number, number]> = [
        [-w, 0, 0, 0.62],
        [w, 0, 0, 0.62],
        [-w * 0.6, h * 0.5, bend * 0.4, 0.85],
        [w * 0.6, h * 0.5, bend * 0.4, 0.85],
        [0, h, bend, 1.12],
      ];
      const start = pos.length / 3;
      const tint = base.clone().offsetHSL(range(rng, -0.02, 0.02), 0, range(rng, -0.04, 0.05));
      for (const [vx, vy, vz, shade] of verts) {
        pos.push(ox + vx * cos + vz * sin, vy, oz - vx * sin + vz * cos);
        col.push(tint.r * shade, tint.g * shade, tint.b * shade);
      }
      idx.push(start, start + 1, start + 2, start + 1, start + 3, start + 2, start + 2, start + 3, start + 4);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  private buildGrass(stones: Array<{ x: number; z: number }>, target: number): THREE.Object3D {
    const rng = mulberry32(8080);
    const spots: Array<{ x: number; z: number }> = [];
    for (let tries = 0; spots.length < target && tries < target * 6; tries++) {
      const a = rng() * TAU;
      const d = Math.sqrt(rng()) * 5.6;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (isFree(x, z, stones)) spots.push({ x, z });
    }
    const geo = this.tuftGeometry();
    const mesh = new THREE.InstancedMesh(geo, this.materials.grass, spots.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    spots.forEach((s, i) => {
      const k = range(rng, 0.8, 1.6);
      pos.set(s.x, terrainHeight(s.x, s.z) - 0.01, s.z);
      q.setFromAxisAngle(up, rng() * TAU);
      scale.set(k, k * range(rng, 0.85, 1.2), k);
      m.compose(pos, q, scale);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.name = 'grass';
    return mesh;
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}
