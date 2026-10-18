import * as THREE from 'three';
import { jitter, paintGradient, PartBuilder } from '../core/parts';
import { Random } from '../core/random';
import { HOUSE, PATH_CURVES, pathDistance, place, toLocal, TREES, WINDMILL } from './layout';
import { makeSwaying, PALETTE, type Materials } from './materials';
import { groundHeight, pondQ, rimRadius } from './terrain';

/** True where small decorations are allowed: not on the path, pond, house or trunks. */
function isOpenGround(x: number, z: number, margin = 0): boolean {
  const theta = Math.atan2(z, x);
  if (Math.hypot(x, z) > rimRadius(theta) * 0.93) return false;
  if (pathDistance(x, z) < 0.26 + margin) return false;
  if (pondQ(x, z) < 1.14) return false;
  const h = toLocal(x, z, HOUSE, HOUSE.yaw);
  if (Math.abs(h.x) < 1.15 + margin && Math.abs(h.z) < 1.05 + margin) return false;
  if (Math.hypot(x - WINDMILL.x, z - WINDMILL.z) < 0.8) return false;
  for (const t of TREES) {
    const p = place(t.s, t.d);
    if (Math.hypot(x - p.x, z - p.z) < (t.kind === 'bush' ? 0.3 : 0.2)) return false;
  }
  return true;
}

function steppingStones(m: Materials, b: PartBuilder) {
  const rnd = new Random(77);
  PATH_CURVES.forEach((curve, ci) => {
    const len = curve.getLength();
    const step = 0.3;
    for (let d = ci === 0 ? 0.32 : 0.25; d < len - 0.05; d += step) {
      const t = d / len;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const side = (Math.round(d / step) % 2 ? 1 : -1) * 0.055;
      const x = p.x - tan.z * side;
      const z = p.z + tan.x * side;
      if (Math.hypot(x, z) > rimRadius(Math.atan2(z, x)) * 0.94) continue;
      const r = rnd.range(0.09, 0.13);
      const g = jitter(new THREE.CylinderGeometry(r, r * 1.05, 0.05, 7), r * 0.12, 300 + Math.round(d * 100) + ci);
      b.add(m.stone, g, { x, y: groundHeight(x, z) + 0.006, z, ry: rnd.range(0, 3), sx: 1.15 });
    }
  });
}

function fence(m: Materials, b: PartBuilder) {
  const a = place(-3.65, -2.05);
  const c = place(-1.55, -3.7);
  const t0 = Math.atan2(a.z, a.x);
  let t1 = Math.atan2(c.z, c.x);
  if (t1 - t0 > Math.PI) t1 -= Math.PI * 2;
  if (t0 - t1 > Math.PI) t1 += Math.PI * 2;
  const posts = 9;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < posts; i++) {
    const th = t0 + ((t1 - t0) * i) / (posts - 1);
    const r = rimRadius(th) - 0.45;
    const x = Math.cos(th) * r;
    const z = Math.sin(th) * r;
    const y = groundHeight(x, z);
    pts.push(new THREE.Vector3(x, y, z));
    b.add(m.wood, new THREE.BoxGeometry(0.055, 0.4, 0.055), { x, y: y + 0.15, z, ry: -th, rz: (i % 3) * 0.03 - 0.03 });
    b.add(m.wood, new THREE.ConeGeometry(0.045, 0.06, 4), { x, y: y + 0.38, z, ry: -th + Math.PI / 4 });
  }
  for (let i = 0; i < posts - 1; i++) {
    const p = pts[i];
    const q = pts[i + 1];
    const len = p.distanceTo(q);
    const yaw = Math.atan2(-(q.z - p.z), q.x - p.x);
    const pitch = Math.asin((q.y - p.y) / len);
    for (const h of [0.14, 0.28]) {
      b.add(m.wood, new THREE.BoxGeometry(len + 0.04, 0.035, 0.025), {
        x: (p.x + q.x) / 2,
        y: (p.y + q.y) / 2 + h,
        z: (p.z + q.z) / 2,
        ry: yaw,
        rz: pitch,
      });
    }
  }
}

function boulders(m: Materials, b: PartBuilder) {
  const spots: [number, number, number][] = [
    [-3.95, 0.5, 0.26],
    [-3.7, 0.85, 0.15],
    [3.75, 1.0, 0.22],
    [0.3, -3.15, 0.17],
    [2.15, 2.75, 0.18],
  ];
  spots.forEach(([s, d, r], i) => {
    const p = place(s, d);
    const g = jitter(new THREE.DodecahedronGeometry(r, 0), r * 0.22, 900 + i);
    g.scale(1.2, 0.75, 1);
    paintGradient(g, PALETTE.rockDark, PALETTE.rockLight, -r * 0.5, r * 0.6);
    b.add(m.vertexRock, g, { x: p.x, y: groundHeight(p.x, p.z) + r * 0.25, z: p.z, ry: i * 1.7 });
  });
}

function flowers(rnd: Random): THREE.Group {
  const clusters: [number, number, number][] = [
    [-1.75, -0.35, 18],
    [-1.4, -1.5, 14],
    [0.05, -2.45, 14],
    [0.15, -0.55, 12],
    [2.0, 1.05, 14],
    [-0.35, 1.85, 12],
    [-2.75, -2.55, 16],
    [2.85, -2.55, 10],
    [-3.0, 0.35, 10],
  ];
  const palette = [PALETTE.flowerA, PALETTE.flowerB, PALETTE.flowerC, PALETTE.flowerD];
  const spots: { x: number; y: number; z: number; h: number; color: string }[] = [];
  clusters.forEach(([s, d, n], ci) => {
    const c = place(s, d);
    const main = palette[ci % palette.length];
    for (let i = 0, tries = 0; i < n && tries < n * 8; tries++) {
      const a = rnd.range(0, Math.PI * 2);
      const r = Math.sqrt(rnd.next()) * 0.42;
      const x = c.x + Math.cos(a) * r;
      const z = c.z + Math.sin(a) * r;
      if (!isOpenGround(x, z)) continue;
      spots.push({ x, y: groundHeight(x, z), z, h: rnd.range(0.07, 0.13), color: rnd.next() < 0.75 ? main : rnd.pick(palette) });
      i++;
    }
  });

  // Stems are unit height and scaled per instance. Heads share the same instance matrix and sit
  // at y = 1, pre-stretched to undo the typical stem scale, so both sway by the same amount.
  const typical = 0.1;
  const stemGeo = new THREE.CylinderGeometry(0.005, 0.007, 1, 4).translate(0, 0.5, 0);
  const headGeo = new THREE.IcosahedronGeometry(0.03, 0).scale(1, 0.6 / typical, 1).translate(0, 1, 0);
  const stemMat = makeSwaying(new THREE.MeshStandardMaterial({ color: PALETTE.leaf, roughness: 0.9 }), 0.5);
  const headMat = makeSwaying(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, flatShading: true }), 0.5);
  const stems = new THREE.InstancedMesh(stemGeo, stemMat, spots.length);
  const heads = new THREE.InstancedMesh(headGeo, headMat, spots.length);
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  spots.forEach((f, i) => {
    q.setFromEuler(new THREE.Euler(0, rnd.range(0, 6.28), 0));
    mtx.compose(new THREE.Vector3(f.x, f.y, f.z), q, new THREE.Vector3(1, f.h, 1));
    stems.setMatrixAt(i, mtx);
    heads.setMatrixAt(i, mtx);
    heads.setColorAt(i, col.set(f.color));
  });
  stems.castShadow = false;
  heads.castShadow = true;
  stems.receiveShadow = heads.receiveShadow = true;
  const group = new THREE.Group();
  group.add(stems, heads);
  group.name = 'flowers';
  return group;
}

function tuftGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const blades = 5;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + i * 0.4;
    const lean = 0.35 + (i % 2) * 0.2;
    const h = 1 - (i % 3) * 0.18;
    const cx = Math.cos(a);
    const cz = Math.sin(a);
    const px = -cz * 0.022;
    const pz = cx * 0.022;
    pos.push(-px, 0, -pz, px, 0, pz, cx * lean * 0.18 * h, 0.16 * h, cz * lean * 0.18 * h);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // Upward normals light the blades like the turf they grow from, instead of as dark slivers.
  const normals = new Float32Array(pos.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return g;
}

function grassTufts(count: number, rnd: Random): THREE.InstancedMesh {
  const mat = makeSwaying(
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, side: THREE.DoubleSide }),
    26,
    1.5,
  );
  const mesh = new THREE.InstancedMesh(tuftGeometry(), mat, count);
  const shades = [PALETTE.grassDark, PALETTE.grass, PALETTE.grassLight, '#9fbd6a'];
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  let placed = 0;
  for (let tries = 0; placed < count && tries < count * 20; tries++) {
    const a = rnd.range(0, Math.PI * 2);
    const r = Math.sqrt(rnd.next()) * 4.8;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!isOpenGround(x, z, 0.05)) continue;
    const s = rnd.range(0.7, 1.35);
    q.setFromEuler(new THREE.Euler(0, rnd.range(0, 6.28), 0));
    mesh.setMatrixAt(placed, mtx.compose(new THREE.Vector3(x, groundHeight(x, z) - 0.01, z), q, new THREE.Vector3(s, s, s)));
    mesh.setColorAt(placed, col.set(rnd.pick(shades)));
    placed++;
  }
  mesh.count = placed;
  mesh.receiveShadow = true;
  mesh.name = 'grass';
  return mesh;
}

export function buildProps(m: Materials, tufts: number): THREE.Group {
  const rnd = new Random(2024);
  const b = new PartBuilder();
  steppingStones(m, b);
  fence(m, b);
  boulders(m, b);
  const group = b.build();
  group.add(flowers(rnd), grassTufts(tufts, rnd));
  group.name = 'props';
  return group;
}
