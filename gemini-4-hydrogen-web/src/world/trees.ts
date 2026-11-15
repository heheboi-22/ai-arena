import * as THREE from "three";
import { createRng, groundHeightAt } from "../util/math";
import type { ProceduralTextures } from "./textures";

export interface TreesRig {
  group: THREE.Group;
  update: (elapsed: number, windStrength: number, reducedMotion: boolean) => void;
  dispose: () => void;
}

interface SwayTree {
  pivot: THREE.Group;
  crown: THREE.Group;
  phase: number;
  stiffness: number;
}

type TreeKind = "oak" | "pine" | "blossom";

interface TreeSpec {
  x: number;
  z: number;
  kind: TreeKind;
  scale: number;
  rotY: number;
}

export function createTrees(textures: ProceduralTextures): TreesRig {
  const group = new THREE.Group();
  group.name = "Trees";

  const disposables: { dispose: () => void }[] = [];
  const rng = createRng(4141);

  const barkMat = new THREE.MeshStandardMaterial({
    map: textures.woodMap,
    color: "#6c4b34",
    roughness: 0.9,
    metalness: 0.02,
  });
  const oakLeafA = new THREE.MeshStandardMaterial({
    color: "#5b894d",
    roughness: 0.84,
    metalness: 0.02,
  });
  const oakLeafB = new THREE.MeshStandardMaterial({
    color: "#6f9c5c",
    roughness: 0.82,
    metalness: 0.02,
  });
  const pineLeafA = new THREE.MeshStandardMaterial({
    color: "#3e6b48",
    roughness: 0.86,
    metalness: 0.02,
  });
  const pineLeafB = new THREE.MeshStandardMaterial({
    color: "#4a7a52",
    roughness: 0.84,
    metalness: 0.02,
  });
  const blossomMat = new THREE.MeshStandardMaterial({
    color: "#ebb8bf",
    roughness: 0.78,
    metalness: 0.02,
  });
  const blossomCoreMat = new THREE.MeshStandardMaterial({
    color: "#f5d7dc",
    roughness: 0.74,
    metalness: 0.02,
  });

  disposables.push(
    barkMat,
    oakLeafA,
    oakLeafB,
    pineLeafA,
    pineLeafB,
    blossomMat,
    blossomCoreMat
  );

  // Shared geometries
  const trunkGeo = new THREE.CylinderGeometry(0.085, 0.145, 1.0, 8);
  trunkGeo.translate(0, 0.5, 0);
  const branchGeo = new THREE.CylinderGeometry(0.035, 0.06, 0.55, 6);
  branchGeo.translate(0, 0.275, 0);
  const puffGeo = new THREE.IcosahedronGeometry(0.45, 1);
  const coneGeo = new THREE.ConeGeometry(0.65, 0.85, 8);
  coneGeo.translate(0, 0.42, 0);
  disposables.push(trunkGeo, branchGeo, puffGeo, coneGeo);

  const specs: TreeSpec[] = [
    { x: 4.15, z: -2.05, kind: "oak", scale: 1.18, rotY: 0.5 },
    { x: -4.65, z: -0.35, kind: "oak", scale: 1.02, rotY: 1.9 },
    { x: -3.9, z: -3.55, kind: "pine", scale: 1.24, rotY: 0.3 },
    { x: -0.35, z: -3.8, kind: "pine", scale: 0.98, rotY: 2.4 },
    { x: 1.8, z: -4.05, kind: "pine", scale: 0.86, rotY: 1.1 },
    { x: 4.55, z: 0.72, kind: "pine", scale: 0.9, rotY: 2.9 },
    { x: -3.22, z: 1.92, kind: "blossom", scale: 1.06, rotY: -0.7 },
    { x: 3.55, z: 2.25, kind: "oak", scale: 0.88, rotY: 3.4 },
  ];

  const swayTrees: SwayTree[] = [];

  specs.forEach((spec, idx) => {
    const y = groundHeightAt(spec.x, spec.z);
    const pivot = new THREE.Group();
    pivot.position.set(spec.x, y - 0.04, spec.z);
    pivot.rotation.y = spec.rotY;
    pivot.scale.setScalar(spec.scale);

    const crown = new THREE.Group();

    if (spec.kind === "pine") {
      const trunk = new THREE.Mesh(trunkGeo, barkMat);
      trunk.scale.set(0.9, 1.35, 0.9);
      trunk.castShadow = true;
      pivot.add(trunk);

      crown.position.y = 0.65;
      const tiers = 4;
      for (let t = 0; t < tiers; t++) {
        const cone = new THREE.Mesh(coneGeo, t % 2 === 0 ? pineLeafA : pineLeafB);
        const s = 1.08 - t * 0.21;
        cone.scale.set(s, 0.92 - t * 0.08, s);
        cone.position.y = t * 0.44;
        cone.rotation.y = t * 0.55;
        cone.castShadow = true;
        cone.receiveShadow = true;
        crown.add(cone);
      }
      pivot.add(crown);
    } else if (spec.kind === "blossom") {
      const trunk = new THREE.Mesh(trunkGeo, barkMat);
      trunk.scale.set(0.95, 1.05, 0.95);
      trunk.rotation.z = -0.1;
      trunk.castShadow = true;
      pivot.add(trunk);

      const branch1 = new THREE.Mesh(branchGeo, barkMat);
      branch1.position.set(0.05, 0.72, 0);
      branch1.rotation.z = -0.58;
      pivot.add(branch1);

      const branch2 = new THREE.Mesh(branchGeo, barkMat);
      branch2.position.set(-0.04, 0.78, 0.04);
      branch2.rotation.z = 0.5;
      branch2.rotation.x = 0.3;
      pivot.add(branch2);

      crown.position.y = 1.1;
      const puffCoords: [number, number, number, number, boolean][] = [
        [0, 0.25, 0, 1.05, true],
        [-0.36, 0.1, 0.18, 0.76, false],
        [0.4, 0.08, -0.14, 0.82, false],
        [0.12, 0.45, 0.22, 0.68, true],
        [-0.18, 0.36, -0.25, 0.72, false],
      ];
      for (const [px, py, pz, ps, core] of puffCoords) {
        const puff = new THREE.Mesh(puffGeo, core ? blossomCoreMat : blossomMat);
        puff.position.set(px, py, pz);
        puff.scale.set(ps * 1.1, ps * 0.82, ps);
        puff.castShadow = true;
        puff.receiveShadow = true;
        crown.add(puff);
      }
      pivot.add(crown);
    } else {
      const trunk = new THREE.Mesh(trunkGeo, barkMat);
      trunk.scale.set(1.05, 1.12, 1.05);
      trunk.castShadow = true;
      pivot.add(trunk);

      const b1 = new THREE.Mesh(branchGeo, barkMat);
      b1.position.set(0, 0.78, 0);
      b1.rotation.z = 0.55;
      pivot.add(b1);

      const b2 = new THREE.Mesh(branchGeo, barkMat);
      b2.position.set(0, 0.82, 0);
      b2.rotation.z = -0.52;
      b2.rotation.x = 0.25;
      pivot.add(b2);

      crown.position.y = 1.15;
      const puffs: [number, number, number, number, boolean][] = [
        [0, 0.28, 0, 1.12, true],
        [-0.42, 0.08, 0.2, 0.78, false],
        [0.44, 0.12, -0.15, 0.82, true],
        [0.1, 0.5, 0.25, 0.72, false],
        [-0.15, 0.44, -0.28, 0.75, false],
      ];
      for (const [px, py, pz, ps, alt] of puffs) {
        const puff = new THREE.Mesh(puffGeo, alt ? oakLeafB : oakLeafA);
        puff.position.set(px, py, pz);
        puff.scale.set(ps * 1.08, ps * 0.86, ps);
        puff.rotation.set(rng() * 0.5, rng() * 1.5, 0);
        puff.castShadow = true;
        puff.receiveShadow = true;
        crown.add(puff);
      }
      pivot.add(crown);
    }

    group.add(pivot);
    swayTrees.push({
      pivot,
      crown,
      phase: idx * 1.17 + rng() * 0.8,
      stiffness: spec.kind === "pine" ? 0.72 : 1.0,
    });
  });

  const update = (elapsed: number, windStrength: number, reducedMotion: boolean) => {
    // Wind leans trees subtly in +X/+Z direction with gentle rhythmic gusts.
    // At 0% wind, movement stops cleanly.
    const motion = reducedMotion ? 0.25 : 1;
    const steadyLean = windStrength * 0.095;
    for (const t of swayTrees) {
      const gust =
        windStrength < 0.01
          ? 0
          : Math.sin(elapsed * (1.35 + windStrength * 1.65) + t.phase) *
            (0.014 + windStrength * 0.048) *
            motion;
      const cross =
        windStrength < 0.01
          ? 0
          : Math.cos(elapsed * (1.1 + windStrength * 1.2) + t.phase * 1.3) *
            (0.008 + windStrength * 0.025) *
            motion;
      t.pivot.rotation.z = -(steadyLean + gust) * t.stiffness;
      t.pivot.rotation.x = cross * t.stiffness;
      t.crown.rotation.z = -(gust * 0.45) * t.stiffness;
    }
  };

  const dispose = () => {
    for (const d of disposables) d.dispose();
  };

  return {
    group,
    update,
    dispose,
  };
}
