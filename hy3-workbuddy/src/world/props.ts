import * as THREE from 'three';
import { GROUND_Y, ISLAND_TOP_RADIUS } from '../config';

export interface Props {
  group: THREE.Group;
}

const rockMat = new THREE.MeshStandardMaterial({
  color: '#8c8a86',
  roughness: 1.0,
  flatShading: true,
});
const pathMat = new THREE.MeshStandardMaterial({ color: '#cbb78c', roughness: 1.0 });
const woodMat = new THREE.MeshStandardMaterial({ color: '#7a5230', roughness: 0.9 });
const stemMat = new THREE.MeshStandardMaterial({ color: '#4f7a3a', roughness: 1.0 });

function makeRock(scale: number): THREE.Mesh {
  const r = new THREE.Mesh(new THREE.IcosahedronGeometry(scale, 0), rockMat);
  r.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
  r.castShadow = true;
  r.receiveShadow = true;
  return r;
}

function buildRocks(): THREE.Group {
  const g = new THREE.Group();
  const spots: [number, number, number][] = [
    [-3.35, -0.35, 0.55],
    [0.1, -2.35, 0.5],
    [2.75, 0.95, 0.45],
  ];
  for (const [x, z, s] of spots) {
    const r = makeRock(s);
    r.position.set(x, GROUND_Y + s * 0.4, z);
    g.add(r);
  }
  return g;
}

function buildPath(): THREE.Group {
  const g = new THREE.Group();
  // Leads from the house door round to the pond shore.
  const pts: THREE.Vector3[] = [];
  const steps = 9;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = THREE.MathUtils.lerp(-1.25, 0.55, t);
    const z = 0.5 + 0.34 * Math.sin(t * Math.PI * 0.9);
    pts.push(new THREE.Vector3(x, GROUND_Y + 0.04, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const samples = curve.getPoints(40);
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.42), pathMat);
    seg.position.copy(mid);
    const dir = b.clone().sub(a);
    seg.rotation.y = Math.atan2(dir.x, dir.z);
    seg.receiveShadow = true;
    g.add(seg);
  }
  return g;
}

function buildFence(): THREE.Group {
  const g = new THREE.Group();
  const a = new THREE.Vector3(-0.85, GROUND_Y, 2.25);
  const b = new THREE.Vector3(0.55, GROUND_Y, 2.95);
  const len = a.distanceTo(b);
  const count = Math.round(len / 0.6);
  const dir = b.clone().sub(a).normalize();
  const angle = Math.atan2(dir.x, dir.z);

  for (let i = 0; i <= count; i++) {
    const p = a.clone().lerp(b, i / count);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.6, 8), woodMat);
    post.position.set(p.x, GROUND_Y + 0.3, p.z);
    post.castShadow = true;
    g.add(post);
  }
  // two horizontal rails
  for (const h of [0.22, 0.46]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.06), woodMat);
    const mid = a.clone().lerp(b, 0.5);
    rail.position.set(mid.x, GROUND_Y + h, mid.z);
    rail.rotation.y = angle;
    rail.castShadow = true;
    g.add(rail);
  }
  return g;
}

function buildFlowers(): THREE.Group {
  const g = new THREE.Group();
  const colors = ['#e8627a', '#f2b134', '#c47be0', '#ff8a5b', '#ffffff'];
  let placed = 0;
  let guard = 0;
  while (placed < 16 && guard < 400) {
    guard++;
    const ang = Math.random() * Math.PI * 2;
    const rad = 1.2 + Math.random() * (ISLAND_TOP_RADIUS * 0.62);
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    // keep clear of the pond & house footprints
    if (Math.hypot(x - 1.35, z - 1.45) < 1.7) continue;
    if (Math.hypot(x - (-2.75), z - 1.95) < 1.0) continue;
    if (Math.hypot(x - (-1.15), z - (-0.95)) < 1.9) continue;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.32, 6), stemMat);
    stem.position.set(x, GROUND_Y + 0.16, z);
    g.add(stem);
    const bloom = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.09, 0),
      new THREE.MeshStandardMaterial({
        color: colors[placed % colors.length],
        roughness: 0.8,
      })
    );
    bloom.position.set(x, GROUND_Y + 0.36, z);
    g.add(bloom);
    placed++;
  }
  return g;
}

export function createProps(): Props {
  const group = new THREE.Group();
  group.add(buildRocks());
  group.add(buildPath());
  group.add(buildFence());
  group.add(buildFlowers());
  return { group };
}
