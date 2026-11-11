import * as THREE from 'three';
import { mulberry32, range } from '../util/math';
import { PAL } from './palette';
import { standard, wetness } from './materials';
import { contactShadowTexture } from './textures';
import { onIsland as land } from './island';

export interface Vegetation {
  group: THREE.Group;
  update(dt: number, elapsed: number, wind: number, reducedMotion: boolean): void;
}

interface Swayable {
  obj: THREE.Object3D;
  phase: number;
  amp: number;
  freq: number;
}

function contact(group: THREE.Group, size: number): void {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false, opacity: 0.6 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.014;
  group.add(m);
}

export function createVegetation(): Vegetation {
  const group = new THREE.Group();
  group.name = 'vegetation';
  const rng = mulberry32(5150);
  const swayables: Swayable[] = [];

  const bark = wetness.track(standard(PAL.trunk, { roughness: 1, flatShading: true }), 0.8);
  const leafMats = [PAL.leaf, PAL.leafLight, PAL.leafDark].map((c) =>
    wetness.track(standard(c, { roughness: 0.95, flatShading: true }), 0.9));
  const pineMats = [PAL.pine, PAL.pineDark, PAL.leafDark].map((c) =>
    wetness.track(standard(c, { roughness: 0.95, flatShading: true }), 0.9));
  const blossomMats = [PAL.blossom, PAL.blossomLight].map((c) =>
    wetness.track(standard(c, { roughness: 0.95, flatShading: true }), 0.9));
  const fruitMat = wetness.track(standard(PAL.flowerRed, { roughness: 0.9, flatShading: true }), 0.8);

  const blobGeo = new THREE.IcosahedronGeometry(1, 1);
  const coneGeo = new THREE.ConeGeometry(1, 1, 7);

  function trunk(height: number, radius: number): THREE.Group {
    const g = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.68, radius, height, 7), bark);
    t.position.y = height / 2;
    t.castShadow = true;
    t.receiveShadow = true;
    g.add(t);
    for (let i = 0; i < 2; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, height * 0.55, 5), bark);
      b.position.set(0, height * 0.72, 0);
      b.rotation.z = (i ? 1 : -1) * 0.55;
      b.castShadow = true;
      g.add(b);
    }
    return g;
  }

  function oak(x: number, z: number, scale: number, fruit: boolean): void {
    if (!land(x, z, 0.16)) return;
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);
    tree.add(trunk(1.35, 0.19));
    const crown = new THREE.Group();
    crown.position.y = 1.62;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const r = i === 0 ? 0 : 0.48 + rng() * 0.22;
      const b = new THREE.Mesh(blobGeo, leafMats[i % leafMats.length]);
      b.position.set(Math.cos(a) * r, i === 0 ? 0.24 : (rng() - 0.5) * 0.32, Math.sin(a) * r);
      b.scale.set(0.58 + rng() * 0.18, 0.52 + rng() * 0.20, 0.58 + rng() * 0.18);
      b.castShadow = true;
      b.receiveShadow = true;
      crown.add(b);
    }
    if (fruit) {
      for (let i = 0; i < 6; i++) {
        const a = rng() * Math.PI * 2;
        const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), fruitMat);
        f.position.set(Math.cos(a) * 0.66, (rng() - 0.5) * 0.5, Math.sin(a) * 0.66);
        crown.add(f);
      }
    }
    tree.add(crown);
    contact(tree, 2.2);
    group.add(tree);
    swayables.push({ obj: crown, phase: rng() * 6.28, amp: 0.055, freq: 0.9 + rng() * 0.35 });
  }

  function pine(x: number, z: number, scale: number): void {
    if (!land(x, z, 0.16)) return;
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);
    tree.add(trunk(0.55, 0.13));
    const crown = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const cone = new THREE.Mesh(coneGeo, pineMats[i % pineMats.length]);
      cone.scale.set(0.78 - i * 0.15, 0.95 - i * 0.10, 0.78 - i * 0.15);
      cone.position.y = 0.62 + i * 0.50;
      cone.castShadow = true;
      cone.receiveShadow = true;
      crown.add(cone);
    }
    tree.add(crown);
    contact(tree, 1.9);
    group.add(tree);
    swayables.push({ obj: crown, phase: rng() * 6.28, amp: 0.045, freq: 1.1 + rng() * 0.4 });
  }

  function blossom(x: number, z: number, scale: number): void {
    if (!land(x, z, 0.16)) return;
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);
    tree.add(trunk(1.05, 0.15));
    const crown = new THREE.Group();
    crown.position.y = 1.35;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const b = new THREE.Mesh(blobGeo, blossomMats[i % blossomMats.length]);
      b.position.set(Math.cos(a) * 0.42, (rng() - 0.5) * 0.3, Math.sin(a) * 0.42);
      b.scale.setScalar(0.46 + rng() * 0.14);
      b.castShadow = true;
      crown.add(b);
    }
    tree.add(crown);
    contact(tree, 1.8);
    group.add(tree);
    swayables.push({ obj: crown, phase: rng() * 6.28, amp: 0.07, freq: 1.0 + rng() * 0.3 });
  }

  function bush(x: number, z: number, scale: number): void {
    if (!land(x, z, 0.12)) return;
    const b = new THREE.Group();
    b.position.set(x, 0, z);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(blobGeo, leafMats[(i + 1) % leafMats.length]);
      m.position.set((rng() - 0.5) * 0.45, 0.22 + rng() * 0.12, (rng() - 0.5) * 0.4);
      m.scale.setScalar((0.28 + rng() * 0.14) * scale);
      m.castShadow = true;
      b.add(m);
    }
    group.add(b);
    swayables.push({ obj: b, phase: rng() * 6.28, amp: 0.04, freq: 1.3 });
  }

  // An intentional composition: one large tree anchors the left, pines close
  // the back, a blossom tree and a second oak balance the right and foreground.
  oak(-3.55, 0.35, 1.20, true);
  oak(3.85, 0.55, 0.78, false);
  pine(-2.70, -2.45, 1.05);
  pine(0.55, -3.15, 0.86);
  pine(4.05, -0.45, 0.78);
  blossom(-2.85, 2.75, 1.0);
  bush(-2.35, -0.15, 1.0);
  bush(-1.95, -2.75, 0.9);
  bush(0.65, -2.05, 0.85);
  bush(2.15, -2.90, 0.8);
  bush(3.55, 2.55, 0.9);
  bush(-3.95, 1.85, 0.8);
  for (let i = 0; i < 5; i++) bush(range(rng, -4.2, 4.2), range(rng, -3.2, 3.2), range(rng, 0.55, 0.9));

  return {
    group,
    update(_dt, elapsed, wind, reducedMotion) {
      const amount = reducedMotion ? wind * 0.25 : wind;
      for (const s of swayables) {
        const w = Math.sin(elapsed * s.freq + s.phase) + 0.35 * Math.sin(elapsed * s.freq * 2.3 + s.phase * 1.7);
        s.obj.rotation.z = w * s.amp * amount;
        s.obj.rotation.x = w * s.amp * amount * 0.55;
      }
    },
  };
}
