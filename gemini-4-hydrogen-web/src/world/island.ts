import * as THREE from "three";
import {
  createRng,
  fbm2D,
  groundHeightAt,
  islandRadiusAt,
  pondNormalizedRadius,
  smoothstep,
} from "../util/math";
import type { ProceduralTextures } from "./textures";

export interface IslandRig {
  group: THREE.Group;
  update: (elapsed: number, reducedMotion: boolean) => void;
  dispose: () => void;
}

interface FloatingShard {
  mesh: THREE.Mesh;
  baseY: number;
  amplitude: number;
  speed: number;
  phase: number;
  rotSpeed: number;
}

function buildGrassTopGeometry(): THREE.BufferGeometry {
  const radialSegs = 34;
  const angularSegs = 84;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const meadowColor = new THREE.Color("#739c5d");
  const hillColor = new THREE.Color("#84aa68");
  const mossColor = new THREE.Color("#4f7346");
  const pondBedColor = new THREE.Color("#8b7f66");
  const c = new THREE.Color();

  // Center vertex
  const h0 = groundHeightAt(0, 0);
  positions.push(0, h0, 0);
  uvs.push(0.5, 0.5);
  c.copy(meadowColor);
  colors.push(c.r, c.g, c.b);

  for (let rIdx = 1; rIdx <= radialSegs; rIdx++) {
    const t = rIdx / radialSegs;
    for (let aIdx = 0; aIdx <= angularSegs; aIdx++) {
      const theta = (aIdx / angularSegs) * Math.PI * 2;
      const maxR = islandRadiusAt(theta);
      const r = t * maxR;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const y = groundHeightAt(x, z);

      positions.push(x, y, z);
      uvs.push(0.5 + x / 16, 0.5 + z / 16);

      const pondR = pondNormalizedRadius(x, z);
      const n = fbm2D(x * 0.45 + 9.2, z * 0.45 - 3.7, 2);
      c.copy(meadowColor).lerp(hillColor, smoothstep(0.25, 0.72, y) * 0.75 + (n - 0.5) * 0.35);

      if (pondR < 1.32) {
        const shoreT = 1 - smoothstep(0.95, 1.32, pondR);
        c.lerp(mossColor, shoreT * 0.55);
      }
      if (pondR < 1.05) {
        const bedT = 1 - smoothstep(0.7, 1.05, pondR);
        c.lerp(pondBedColor, bedT * 0.92);
      }
      if (t > 0.88) {
        c.lerp(mossColor, smoothstep(0.88, 1.0, t) * 0.35);
      }

      colors.push(c.r, c.g, c.b);
    }
  }

  const ringStride = angularSegs + 1;
  // First ring fan
  for (let aIdx = 0; aIdx < angularSegs; aIdx++) {
    indices.push(0, 1 + aIdx + 1, 1 + aIdx);
  }
  // Subsequent rings
  for (let rIdx = 1; rIdx < radialSegs; rIdx++) {
    const rowA = 1 + (rIdx - 1) * ringStride;
    const rowB = 1 + rIdx * ringStride;
    for (let aIdx = 0; aIdx < angularSegs; aIdx++) {
      const a = rowA + aIdx;
      const b = rowA + aIdx + 1;
      const d = rowB + aIdx;
      const e = rowB + aIdx + 1;
      indices.push(a, b, e);
      indices.push(a, e, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function buildGrassTurfLipGeometry(): THREE.BufferGeometry {
  const angularSegs = 84;
  const rows = 5;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const topGrass = new THREE.Color("#6b9358");
  const bottomMoss = new THREE.Color("#49683f");
  const col = new THREE.Color();

  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    for (let aIdx = 0; aIdx <= angularSegs; aIdx++) {
      const theta = (aIdx / angularSegs) * Math.PI * 2;
      const maxR = islandRadiusAt(theta);
      const topX = Math.cos(theta) * maxR;
      const topZ = Math.sin(theta) * maxR;
      const topY = groundHeightAt(topX, topZ);

      // Scalloped organic overhang lip
      const scallop =
        0.16 * Math.sin(theta * 11 + 0.7) +
        0.09 * Math.cos(theta * 19 - 0.3);
      const dropDepth = 0.36 + scallop * 0.45;
      const bulge = Math.sin(v * Math.PI) * 0.16;
      const r = maxR + bulge - v * 0.14;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const y = topY - v * dropDepth;

      positions.push(x, y, z);
      uvs.push((aIdx / angularSegs) * 8, v);
      col.copy(topGrass).lerp(bottomMoss, v);
      colors.push(col.r, col.g, col.b);
    }
  }

  const stride = angularSegs + 1;
  for (let row = 0; row < rows; row++) {
    for (let aIdx = 0; aIdx < angularSegs; aIdx++) {
      const a = row * stride + aIdx;
      const b = a + 1;
      const c = (row + 1) * stride + aIdx;
      const d = c + 1;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function buildRockyUndersideGeometry(): THREE.BufferGeometry {
  const angularSegs = 84;
  const ringProfile = [
    { t: 0.0, scaleR: 0.985, depth: 0.18, crag: 0.06 },
    { t: 0.15, scaleR: 0.94, depth: 0.78, crag: 0.24 },
    { t: 0.32, scaleR: 0.8, depth: 1.58, crag: 0.38 },
    { t: 0.5, scaleR: 0.64, depth: 2.55, crag: 0.42 },
    { t: 0.68, scaleR: 0.43, depth: 3.62, crag: 0.36 },
    { t: 0.85, scaleR: 0.24, depth: 4.55, crag: 0.24 },
    { t: 0.96, scaleR: 0.1, depth: 5.25, crag: 0.12 },
  ];

  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const upperSoil = new THREE.Color("#735742");
  const warmStrata = new THREE.Color("#9b7857");
  const midRock = new THREE.Color("#796252");
  const deepSlate = new THREE.Color("#4e4643");
  const col = new THREE.Color();

  for (let rIdx = 0; rIdx < ringProfile.length; rIdx++) {
    const ring = ringProfile[rIdx];
    for (let aIdx = 0; aIdx <= angularSegs; aIdx++) {
      const theta = (aIdx / angularSegs) * Math.PI * 2;
      const baseR = islandRadiusAt(theta);
      const topX = Math.cos(theta) * baseR;
      const topZ = Math.sin(theta) * baseR;
      const topY = groundHeightAt(topX, topZ);

      // Multi-frequency rocky crag ridges spiraling down the underside
      const ridge =
        Math.sin(theta * 7 + ring.t * 2.4) * 0.48 +
        Math.cos(theta * 13 - ring.t * 3.1) * 0.32 +
        Math.sin(theta * 21 + ring.t * 4.5) * 0.2;
      const facet = (fbm2D(Math.cos(theta) * 2.2 + ring.t * 3, Math.sin(theta) * 2.2 - ring.t * 2, 2) - 0.5) * 0.9;
      const r = Math.max(0.08, baseR * ring.scaleR + (ridge + facet) * ring.crag);

      // Stepped geological strata shelf effect
      const strataOffset = Math.sin(ring.t * Math.PI * 5 + theta * 2) * 0.12;
      const y = topY - ring.depth + strataOffset * (1 - ring.t * 0.5);

      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;

      positions.push(x, y, z);
      uvs.push((aIdx / angularSegs) * 4, ring.t * 3);

      // Color stratification by depth
      const band = Math.sin(ring.t * Math.PI * 6 + facet * 2) * 0.5 + 0.5;
      if (ring.t < 0.25) {
        col.copy(upperSoil).lerp(warmStrata, band * 0.6);
      } else if (ring.t < 0.65) {
        col.copy(warmStrata).lerp(midRock, band * 0.85);
      } else {
        col.copy(midRock).lerp(deepSlate, smoothstep(0.6, 0.98, ring.t));
      }
      colors.push(col.r, col.g, col.b);
    }
  }

  // Bottom spire tip
  const tipIndex = positions.length / 3;
  positions.push(0.12, -5.75, -0.08);
  uvs.push(0.5, 4);
  colors.push(deepSlate.r, deepSlate.g, deepSlate.b);

  const stride = angularSegs + 1;
  for (let rIdx = 0; rIdx < ringProfile.length - 1; rIdx++) {
    for (let aIdx = 0; aIdx < angularSegs; aIdx++) {
      const a = rIdx * stride + aIdx;
      const b = a + 1;
      const c = (rIdx + 1) * stride + aIdx;
      const d = c + 1;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  // Close bottom tip
  const lastRow = (ringProfile.length - 1) * stride;
  for (let aIdx = 0; aIdx < angularSegs; aIdx++) {
    indices.push(lastRow + aIdx, lastRow + aIdx + 1, tipIndex);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

export function createIsland(textures: ProceduralTextures): IslandRig {
  const group = new THREE.Group();
  group.name = "FloatingIsland";

  const disposables: { dispose: () => void }[] = [];

  // 1. Grass Top
  const grassGeo = buildGrassTopGeometry();
  const grassMat = new THREE.MeshStandardMaterial({
    map: textures.grassMap,
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.02,
  });
  const grassMesh = new THREE.Mesh(grassGeo, grassMat);
  grassMesh.receiveShadow = true;
  grassMesh.castShadow = false;
  group.add(grassMesh);
  disposables.push(grassGeo, grassMat);

  // 2. Overhanging Turf Rim
  const lipGeo = buildGrassTurfLipGeometry();
  const lipMat = new THREE.MeshStandardMaterial({
    map: textures.grassMap,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
  });
  const lipMesh = new THREE.Mesh(lipGeo, lipMat);
  lipMesh.castShadow = true;
  lipMesh.receiveShadow = true;
  group.add(lipMesh);
  disposables.push(lipGeo, lipMat);

  // 3. Sculpted Rocky Underside
  const rockGeo = buildRockyUndersideGeometry();
  const rockMat = new THREE.MeshStandardMaterial({
    map: textures.rockMap,
    vertexColors: true,
    roughness: 0.95,
    metalness: 0.05,
    flatShading: true,
  });
  const rockMesh = new THREE.Mesh(rockGeo, rockMat);
  rockMesh.castShadow = true;
  rockMesh.receiveShadow = true;
  group.add(rockMesh);
  disposables.push(rockGeo, rockMat);

  // 4. Dangling gnarled roots & hanging moss vines under the rim
  const rootMat = new THREE.MeshStandardMaterial({
    color: "#6b4f3a",
    roughness: 0.92,
    metalness: 0.02,
  });
  const vineMat = new THREE.MeshStandardMaterial({
    color: "#557a49",
    roughness: 0.88,
    metalness: 0.02,
  });
  disposables.push(rootMat, vineMat);

  const rng = createRng(777);
  for (let i = 0; i < 11; i++) {
    const theta = (i / 11) * Math.PI * 2 + (rng() - 0.5) * 0.35;
    const maxR = islandRadiusAt(theta) * (0.72 + rng() * 0.22);
    const startX = Math.cos(theta) * maxR;
    const startZ = Math.sin(theta) * maxR;
    const startY = -0.35 - rng() * 0.45;
    const len = 0.85 + rng() * 1.45;
    const isVine = i % 2 === 0;

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(startX, startY, startZ),
      new THREE.Vector3(
        startX * 0.92 + (rng() - 0.5) * 0.3,
        startY - len * 0.42,
        startZ * 0.92 + (rng() - 0.5) * 0.3
      ),
      new THREE.Vector3(
        startX * 0.84 + (rng() - 0.5) * 0.35,
        startY - len,
        startZ * 0.84 + (rng() - 0.5) * 0.35
      ),
    ]);
    const tubeGeo = new THREE.TubeGeometry(curve, 8, isVine ? 0.032 : 0.048, 5, false);
    const tube = new THREE.Mesh(tubeGeo, isVine ? vineMat : rootMat);
    tube.castShadow = false;
    group.add(tube);
    disposables.push(tubeGeo);
  }

  // 5. Floating satellite rock shards around the underside
  const shardGeo = new THREE.DodecahedronGeometry(1, 0);
  const shardMat = new THREE.MeshStandardMaterial({
    map: textures.rockMap,
    color: "#886f5c",
    roughness: 0.92,
    metalness: 0.04,
    flatShading: true,
  });
  disposables.push(shardGeo, shardMat);

  const shards: FloatingShard[] = [];
  const shardConfigs = [
    { x: 5.8, y: -2.2, z: 3.1, s: 0.42, amp: 0.14, spd: 0.9 },
    { x: -5.4, y: -2.6, z: 2.6, s: 0.35, amp: 0.12, spd: 1.1 },
    { x: -3.6, y: -3.5, z: -4.6, s: 0.48, amp: 0.16, spd: 0.78 },
    { x: 4.5, y: -3.1, z: -4.2, s: 0.3, amp: 0.11, spd: 1.25 },
    { x: 0.6, y: -5.1, z: 2.4, s: 0.28, amp: 0.13, spd: 1.0 },
  ];

  shardConfigs.forEach((cfg, idx) => {
    const mesh = new THREE.Mesh(shardGeo, shardMat);
    mesh.position.set(cfg.x, cfg.y, cfg.z);
    mesh.scale.set(cfg.s, cfg.s * 1.35, cfg.s * 0.88);
    mesh.rotation.set(idx * 0.8, idx * 1.1, idx * 0.4);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    shards.push({
      mesh,
      baseY: cfg.y,
      amplitude: cfg.amp,
      speed: cfg.spd,
      phase: idx * 1.35,
      rotSpeed: 0.15 + idx * 0.04,
    });
  });

  // 6. Subtle floating island drift anchor
  const update = (elapsed: number, reducedMotion: boolean) => {
    const motionScale = reducedMotion ? 0 : 1;
    group.position.y = Math.sin(elapsed * 0.55) * 0.06 * motionScale;

    for (const s of shards) {
      s.mesh.position.y =
        s.baseY + Math.sin(elapsed * s.speed + s.phase) * s.amplitude * motionScale;
      if (!reducedMotion) {
        s.mesh.rotation.y += 0.002 * s.rotSpeed;
      }
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

