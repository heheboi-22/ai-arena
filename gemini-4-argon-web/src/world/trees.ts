import * as THREE from 'three';
import { getIslandSurfaceHeight } from '../state';
import { ProceduralTextureSet } from './textures';

interface AnimatedTree {
  swayPivot: THREE.Group;
  crownPivot: THREE.Group;
  baseScale: number;
  phase: number;
  stiffness: number;
}

export interface TreeSystem {
  group: THREE.Group;
  update: (elapsed: number, windFactor: number, rainFactor: number, reducedMotion: boolean) => void;
}

export function createTrees(textures: ProceduralTextureSet): TreeSystem {
  const group = new THREE.Group();
  group.name = 'TreesGroup';

  const trunkMat = new THREE.MeshStandardMaterial({
    color: '#6b472e',
    map: textures.woodColor,
    bumpMap: textures.woodBump,
    bumpScale: 0.03,
    roughness: 0.88,
  });

  const foliageMaterials = [
    new THREE.MeshStandardMaterial({ color: '#3b7d3b', roughness: 0.82, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: '#4d9344', roughness: 0.80, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: '#61a84d', roughness: 0.78, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: '#78b856', roughness: 0.78, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: '#e899a8', roughness: 0.74, flatShading: true }), // Pondside blossom
  ];

  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
  });

  const pineConeGeo = new THREE.ConeGeometry(1, 1, 7);
  const oakPuffGeo = new THREE.IcosahedronGeometry(1, 1);

  const animatedTrees: AnimatedTree[] = [];

  const treeSpecs: Array<{
    x: number;
    z: number;
    scale: number;
    type: 'pine' | 'oak' | 'blossom';
    tintIdx: number;
  }> = [
    // Behind cottage (NW cluster)
    { x: -3.75, z: -2.45, scale: 1.18, type: 'pine', tintIdx: 0 },
    { x: -2.65, z: -3.45, scale: 0.96, type: 'oak', tintIdx: 1 },
    { x: -4.45, z: -0.95, scale: 0.92, type: 'pine', tintIdx: 1 },
    // Between cottage and windmill (North ridge)
    { x: 0.35, z: -3.55, scale: 1.12, type: 'pine', tintIdx: 0 },
    { x: 1.45, z: -3.95, scale: 0.85, type: 'oak', tintIdx: 2 },
    // East / SE flank below windmill bluff
    { x: 4.55, z: -0.55, scale: 1.05, type: 'oak', tintIdx: 1 },
    { x: 4.15, z: 1.25, scale: 0.94, type: 'pine', tintIdx: 0 },
    { x: 3.15, z: 2.65, scale: 1.10, type: 'oak', tintIdx: 3 },
    { x: 2.15, z: 3.75, scale: 0.82, type: 'pine', tintIdx: 1 },
    // Pondside accent trees (SW / South)
    { x: -3.95, z: 1.15, scale: 1.04, type: 'blossom', tintIdx: 4 },
    { x: -3.55, z: 3.35, scale: 0.90, type: 'oak', tintIdx: 2 },
    { x: -0.45, z: 4.15, scale: 0.86, type: 'pine', tintIdx: 0 },
  ];

  treeSpecs.forEach((spec, idx) => {
    const groundY = getIslandSurfaceHeight(spec.x, spec.z) ?? 0.2;
    const root = new THREE.Group();
    root.position.set(spec.x, groundY, spec.z);
    root.scale.setScalar(spec.scale);

    // Contact shadow disc on ground
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.75), shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    root.add(shadow);

    const swayPivot = new THREE.Group();
    root.add(swayPivot);

    const crownPivot = new THREE.Group();

    if (spec.type === 'pine') {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, 0.78, 7), trunkMat);
      trunk.position.y = 0.36;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      swayPivot.add(trunk);

      crownPivot.position.y = 0.62;
      swayPivot.add(crownPivot);

      const tiers = [
        { y: 0.18, r: 0.72, h: 0.78 },
        { y: 0.62, r: 0.58, h: 0.72 },
        { y: 1.02, r: 0.44, h: 0.64 },
        { y: 1.36, r: 0.28, h: 0.52 },
      ];
      tiers.forEach((tier, tIdx) => {
        const mat = foliageMaterials[(spec.tintIdx + (tIdx > 1 ? 1 : 0)) % 4];
        const cone = new THREE.Mesh(pineConeGeo, mat);
        cone.scale.set(tier.r, tier.h, tier.r);
        cone.position.y = tier.y;
        cone.rotation.y = tIdx * 0.6;
        cone.castShadow = true;
        cone.receiveShadow = true;
        crownPivot.add(cone);
      });
    } else {
      // Broadleaf Oak or Pondside Blossom Tree
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 0.88, 7), trunkMat);
      trunk.position.y = 0.42;
      trunk.rotation.z = spec.type === 'blossom' ? -0.1 : 0.04;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      swayPivot.add(trunk);

      // Secondary fork branch
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.48, 6), trunkMat);
      branch.position.set(0.14, 0.74, 0.05);
      branch.rotation.z = -0.58;
      branch.castShadow = true;
      swayPivot.add(branch);

      crownPivot.position.y = 0.86;
      swayPivot.add(crownPivot);

      const puffs = [
        { x: 0.0, y: 0.36, z: 0.0, rx: 0.62, ry: 0.54, rz: 0.60 },
        { x: -0.34, y: 0.22, z: 0.18, rx: 0.44, ry: 0.38, rz: 0.42 },
        { x: 0.36, y: 0.26, z: -0.14, rx: 0.46, ry: 0.40, rz: 0.44 },
        { x: 0.08, y: 0.24, z: 0.35, rx: 0.40, ry: 0.36, rz: 0.38 },
        { x: -0.12, y: 0.58, z: -0.12, rx: 0.42, ry: 0.38, rz: 0.40 },
      ];

      puffs.forEach((pf, pIdx) => {
        const mat =
          spec.type === 'blossom'
            ? foliageMaterials[4]
            : foliageMaterials[(spec.tintIdx + (pIdx % 2)) % 4];
        const puff = new THREE.Mesh(oakPuffGeo, mat);
        puff.scale.set(pf.rx, pf.ry, pf.rz);
        puff.position.set(pf.x, pf.y, pf.z);
        puff.rotation.set(pIdx * 0.5, pIdx * 0.9, 0);
        puff.castShadow = true;
        puff.receiveShadow = true;
        crownPivot.add(puff);
      });
    }

    group.add(root);
    animatedTrees.push({
      swayPivot,
      crownPivot,
      baseScale: spec.scale,
      phase: idx * 1.17,
      stiffness: spec.type === 'pine' ? 0.85 : 1.05,
    });
  });

  return {
    group,
    update: (elapsed: number, windFactor: number, rainFactor: number, reducedMotion: boolean) => {
      // Slightly glossier wet leaves in rain
      for (let i = 0; i < foliageMaterials.length; i++) {
        foliageMaterials[i].roughness = 0.8 - rainFactor * 0.22;
      }

      if (windFactor <= 0.002) {
        for (const t of animatedTrees) {
          t.swayPivot.rotation.set(0, 0, 0);
          t.crownPivot.rotation.set(0, 0, 0);
        }
        return;
      }

      const oscScale = reducedMotion ? 0.25 : 1.0;
      const freq = 1.6 + windFactor * 2.8;

      for (const t of animatedTrees) {
        const gust =
          Math.sin(elapsed * freq + t.phase) * 0.65 +
          Math.cos(elapsed * (freq * 1.45) + t.phase * 1.7) * 0.35;

        // Plausible trunk lean + harmonic crown sway driven by shared windFactor
        const steadyLean = windFactor * 0.14 * t.stiffness;
        const dynamicSway = gust * (windFactor * 0.095) * t.stiffness * oscScale;

        t.swayPivot.rotation.z = -(steadyLean + dynamicSway);
        t.swayPivot.rotation.x =
          (windFactor * 0.04 + Math.cos(elapsed * freq * 0.8 + t.phase) * windFactor * 0.04 * oscScale);

        t.crownPivot.rotation.z = -(steadyLean * 0.65 + dynamicSway * 1.25);
      }
    },
  };
}
