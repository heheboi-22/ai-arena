import * as THREE from 'three';
import { fbm } from './noise';
import { WIND_DIR } from './state';

export interface Swayable {
  obj: THREE.Object3D;
  phase: number;
  amp: number;
}

export interface NatureRefs {
  group: THREE.Group;
  swayables: Swayable[];
  clouds: Clouds;
}

const TRUNK = '#7a4f30';
const PINE_GREENS = ['#4e7d3f', '#59894a', '#41703a'];
const LEAF_GREENS = ['#5f9e46', '#6fae4e', '#548c3e'];

function buildRoundTree(scale: number): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: TRUNK, roughness: 0.95 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.7, 7), trunkMat);
  trunk.position.y = 0.35;
  trunk.castShadow = true;
  group.add(trunk);

  const blobs: Array<[number, number, number, number, string]> = [
    [0, 0.95, 0, 0.55, LEAF_GREENS[1]],
    [0.3, 0.78, 0.12, 0.4, LEAF_GREENS[0]],
    [-0.26, 0.82, -0.14, 0.38, LEAF_GREENS[2]],
    [0.05, 0.68, -0.3, 0.3, LEAF_GREENS[0]],
  ];
  for (const [x, y, z, r, c] of blobs) {
    const mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true });
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat);
    blob.position.set(x, y, z);
    blob.castShadow = true;
    group.add(blob);
  }
  group.scale.setScalar(scale);
  return group;
}

function buildPineTree(scale: number): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: TRUNK, roughness: 0.95 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.5, 7), trunkMat);
  trunk.position.y = 0.25;
  trunk.castShadow = true;
  group.add(trunk);

  const tiers: Array<[number, number, number, string]> = [
    [0.52, 0.72, 0.78, PINE_GREENS[0]],
    [0.4, 0.62, 1.12, PINE_GREENS[1]],
    [0.27, 0.52, 1.44, PINE_GREENS[2]],
  ];
  for (const [r, h, y, c] of tiers) {
    const mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), mat);
    cone.position.y = y;
    cone.castShadow = true;
    group.add(cone);
  }
  group.scale.setScalar(scale);
  return group;
}

/** Stepping-stone path from the house door toward the pond. */
function buildPath(): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#b9b0a0', roughness: 1, flatShading: true });
  // Quadratic bezier: house door → mid → pond west edge
  const a = new THREE.Vector2(-2.25, -0.5);
  const c = new THREE.Vector2(-0.5, -1.35);
  const b = new THREE.Vector2(0.95, -0.85);
  for (let i = 0; i < 7; i++) {
    const t = 0.06 + (i / 6) * 0.9;
    const mt = 1 - t;
    const x = mt * mt * a.x + 2 * mt * t * c.x + t * t * b.x;
    const z = mt * mt * a.y + 2 * mt * t * c.y + t * t * b.y;
    const r = 0.2 + fbm(i * 2.7, 1.1) * 0.1;
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, 0.05, 7), mat);
    stone.position.set(x, 0.028, z);
    stone.rotation.y = fbm(i * 3.3, 8.8) * Math.PI;
    stone.receiveShadow = true;
    stone.castShadow = true;
    group.add(stone);
  }
  return group;
}

/** A short wooden fence line near the house garden. */
function buildFence(): THREE.Group {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: '#a9744a', roughness: 0.9 });
  const posts: THREE.Vector2[] = [
    new THREE.Vector2(-3.45, 0.35),
    new THREE.Vector2(-2.75, 0.8),
    new THREE.Vector2(-2.05, 1.25),
    new THREE.Vector2(-1.35, 1.7),
  ];
  for (const p of posts) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.08), woodMat);
    post.position.set(p.x, 0.27, p.y);
    post.rotation.y = fbm(p.x, p.y) * 0.2;
    post.castShadow = true;
    group.add(post);
  }
  for (let i = 0; i < posts.length - 1; i++) {
    const p0 = posts[i];
    const p1 = posts[i + 1];
    const mid = p0.clone().add(p1).multiplyScalar(0.5);
    const len = p0.distanceTo(p1) + 0.06;
    const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    for (const y of [0.22, 0.4]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.04), woodMat);
      rail.position.set(mid.x, y, mid.y);
      rail.rotation.y = -angle;
      rail.castShadow = true;
      group.add(rail);
    }
  }
  return group;
}

/** Tiny flowers scattered in free patches of grass. */
function buildFlowers(swayables: Swayable[]): THREE.Group {
  const group = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: '#4e7d3f', roughness: 1 });
  const petalColors = ['#e86a5e', '#f2b134', '#e9e4f0', '#c96ab8', '#f2827f'];
  const spots: THREE.Vector2[] = [
    new THREE.Vector2(-1.6, 0.6), new THREE.Vector2(-3.6, -0.4), new THREE.Vector2(0.2, 2.1),
    new THREE.Vector2(1.4, 1.2), new THREE.Vector2(3.9, -0.1), new THREE.Vector2(-0.9, -2.2),
    new THREE.Vector2(0.9, -2.9), new THREE.Vector2(-2.9, 2.6), new THREE.Vector2(4.2, 1.4),
    new THREE.Vector2(0.4, 4.1), new THREE.Vector2(-4.3, 1.2), new THREE.Vector2(2.9, -2.4),
  ];
  spots.forEach((p, i) => {
    const flower = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.17, 5), stemMat);
    stem.position.y = 0.085;
    const head = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.055, 0),
      new THREE.MeshStandardMaterial({ color: petalColors[i % petalColors.length], roughness: 0.8, flatShading: true }),
    );
    head.position.y = 0.19;
    head.castShadow = true;
    flower.add(stem, head);
    flower.position.set(p.x, 0, p.y);
    flower.rotation.y = fbm(i * 1.7, 3.3) * Math.PI * 2;
    group.add(flower);
    swayables.push({ obj: flower, phase: fbm(i, 5.5) * 6.28, amp: 0.5 });
  });
  return group;
}

/**
 * Soft stylized clouds drifting on the shared wind.
 * One shared material keeps draw calls low; the material darkens with rain.
 */
export class Clouds {
  readonly group = new THREE.Group();
  readonly material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 1,
    flatShading: true,
    transparent: true,
    opacity: 0.94,
  });
  private puffs: Array<{ cloud: THREE.Group; baseY: number; phase: number }> = [];

  constructor() {
    const layout: Array<{ angle: number; radius: number; y: number; scale: number }> = [
      { angle: 0.35, radius: 14, y: 7.2, scale: 1.15 },
      { angle: 1.5, radius: 17.5, y: 9.0, scale: 1.4 },
      { angle: 2.7, radius: 13, y: 8.1, scale: 0.95 },
      { angle: 3.9, radius: 18.5, y: 10.2, scale: 1.3 },
      { angle: 5.1, radius: 15, y: 8.6, scale: 1.05 },
    ];
    for (const cfg of layout) {
      const cloud = new THREE.Group();
      const puffs = 4 + Math.floor(fbm(cfg.angle * 7, 1.3) * 3);
      for (let i = 0; i < puffs; i++) {
        const r = 0.42 + fbm(cfg.angle * 3 + i * 2.1, 4.4) * 0.42;
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), this.material);
        puff.position.set(
          (fbm(i * 1.9, cfg.angle) - 0.5) * 1.9,
          (fbm(i * 2.7, cfg.angle + 9) - 0.5) * 0.5,
          (fbm(i * 3.1, cfg.angle + 4) - 0.5) * 1.1,
        );
        puff.scale.y = 0.62;
        cloud.add(puff);
      }
      cloud.scale.setScalar(cfg.scale);
      const x = Math.cos(cfg.angle) * cfg.radius;
      const z = Math.sin(cfg.angle) * cfg.radius;
      cloud.position.set(x, cfg.y, z);
      this.group.add(cloud);
      this.puffs.push({ cloud, baseY: cfg.y, phase: cfg.angle * 3.7 });
    }
  }

  update(dt: number, wind: number, rainBlend: number, motionScale: number, elapsed: number): void {
    const speed = (0.25 + wind * 2.1) * motionScale;
    for (let i = 0; i < this.puffs.length; i++) {
      const p = this.puffs[i];
      p.cloud.position.addScaledVector(WIND_DIR, speed * dt);
      p.cloud.position.y = p.baseY + Math.sin(elapsed * 0.25 + p.phase) * 0.25 * motionScale;
      // Wrap around a generous box so clouds recirculate instead of escaping.
      if (p.cloud.position.x > 27) p.cloud.position.x = -27;
      if (p.cloud.position.x < -27) p.cloud.position.x = 27;
      if (p.cloud.position.z > 27) p.cloud.position.z = -27;
      if (p.cloud.position.z < -27) p.cloud.position.z = 27;
    }
    // Rain turns the clouds grey and slightly heavier.
    this.material.color.set('#ffffff').lerp(new THREE.Color('#7e8798'), rainBlend * 0.8);
    this.material.opacity = 0.94 + rainBlend * 0.04;
  }
}

export function buildNature(swayables: Swayable[]): NatureRefs {
  const group = new THREE.Group();

  // Trees: varied sizes and silhouettes, placed to balance the composition
  // around the house (south-west) and windmill (north-east).
  const trees: Array<{ tree: THREE.Group; x: number; z: number; phase: number }> = [
    { tree: buildRoundTree(1.15), x: -3.35, z: 1.65, phase: 0.4 },
    { tree: buildPineTree(1.0), x: -0.7, z: -3.35, phase: 2.1 },
    { tree: buildRoundTree(0.72), x: 3.55, z: 1.95, phase: 4.0 },
    { tree: buildPineTree(0.66), x: -1.95, z: 3.5, phase: 5.3 },
    { tree: buildRoundTree(0.55), x: 0.35, z: -4.0, phase: 1.2 },
  ];
  for (const t of trees) {
    t.tree.position.set(t.x, 0, t.z);
    t.tree.rotation.y = t.phase * 1.7;
    group.add(t.tree);
    swayables.push({ obj: t.tree, phase: t.phase, amp: 1 });
  }

  group.add(buildPath());
  group.add(buildFence());
  group.add(buildFlowers(swayables));

  return { group, swayables, clouds: new Clouds() };
}
