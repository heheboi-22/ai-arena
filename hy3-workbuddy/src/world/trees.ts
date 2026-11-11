import * as THREE from 'three';
import { GROUND_Y } from '../config';
import { TAU } from '../util/math';

export interface Swayer {
  pivot: THREE.Group;
  phase: number;
  amp: number;
  speed: number;
}

export interface Trees {
  group: THREE.Group;
  swayers: Swayer[];
}

interface TreeDef {
  pos: [number, number];
  kind: 'pine' | 'round';
  scale: number;
  hue: number; // 0..1 green variation
}

function makeTrunk(height: number, radius: number): THREE.Mesh {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.7, radius, height, 8),
    new THREE.MeshStandardMaterial({ color: '#6e4a2e', roughness: 1.0 })
  );
  trunk.position.y = height / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  return trunk;
}

function makePine(scale: number, hue: number): THREE.Group {
  const g = new THREE.Group();
  const h = 1.5 * scale;
  g.add(makeTrunk(h * 0.55, 0.16 * scale));

  const base = new THREE.Color().setHSL(0.3 + hue * 0.06, 0.45, 0.32);
  const mat = new THREE.MeshStandardMaterial({ color: base, roughness: 0.9, flatShading: true });
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const r = (0.85 - i * 0.22) * scale;
    const ch = 0.7 * scale;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, ch, 9), mat);
    cone.position.y = h * 0.5 + i * (ch * 0.62);
    cone.castShadow = true;
    cone.receiveShadow = true;
    g.add(cone);
  }
  return g;
}

function makeRound(scale: number, hue: number): THREE.Group {
  const g = new THREE.Group();
  const h = 1.0 * scale;
  g.add(makeTrunk(h * 0.7, 0.14 * scale));

  const base = new THREE.Color().setHSL(0.28 + hue * 0.08, 0.5, 0.4);
  const mat = new THREE.MeshStandardMaterial({ color: base, roughness: 0.9, flatShading: true });
  const blobs = [
    { r: 0.62 * scale, y: h * 0.9, x: 0, z: 0 },
    { r: 0.46 * scale, y: h * 1.35, x: 0.18 * scale, z: 0.05 },
    { r: 0.42 * scale, y: h * 1.2, x: -0.16 * scale, z: -0.1 },
  ];
  for (const b of blobs) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(b.r, 1), mat);
    m.position.set(b.x, b.y, b.z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

export function createTrees(): Trees {
  const group = new THREE.Group();
  const swayers: Swayer[] = [];

  const defs: TreeDef[] = [
    { pos: [-2.95, -1.95], kind: 'pine', scale: 0.95, hue: 0.1 },
    { pos: [-1.05, -3.15], kind: 'pine', scale: 1.0, hue: 0.3 },
    { pos: [-3.25, 0.85], kind: 'round', scale: 0.9, hue: 0.5 },
    { pos: [-0.45, 3.15], kind: 'pine', scale: 0.8, hue: 0.2 },
    { pos: [3.3, -0.55], kind: 'round', scale: 0.85, hue: 0.8 },
  ];

  for (const d of defs) {
    const pivot = new THREE.Group();
    pivot.position.set(d.pos[0], GROUND_Y, d.pos[1]);
    const tree = d.kind === 'pine' ? makePine(d.scale, d.hue) : makeRound(d.scale, d.hue);
    pivot.add(tree);
    group.add(pivot);

    const heightFactor = 0.9 + d.scale * 0.4;
    swayers.push({
      pivot,
      phase: Math.random() * TAU,
      amp: 0.045 * heightFactor,
      speed: 1.1 + Math.random() * 0.5,
    });
  }

  return { group, swayers };
}
