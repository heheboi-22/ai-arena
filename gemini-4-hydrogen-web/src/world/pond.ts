import * as THREE from "three";
import {
  createRng,
  groundHeightAt,
  POND_CENTER,
  pondNormalizedRadius,
  WATER_LEVEL,
} from "../util/math";
import type { ProceduralTextures } from "./textures";

export interface PondRig {
  group: THREE.Group;
  update: (
    dt: number,
    elapsed: number,
    rainMix: number,
    windStrength: number,
    daylight: number,
    nightness: number,
    reducedMotion: boolean
  ) => void;
  dispose: () => void;
}

interface RippleSlot {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  maxScale: number;
  active: boolean;
}

interface ReedBlade {
  group: THREE.Group;
  phase: number;
}

function buildPondWaterGeometry(): THREE.BufferGeometry {
  const radialSegs = 16;
  const angularSegs = 48;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const deepColor = new THREE.Color("#2b6f86");
  const shallowColor = new THREE.Color("#69b0b5");
  const c = new THREE.Color();

  // Center vertex at POND_CENTER
  positions.push(POND_CENTER.x, WATER_LEVEL, POND_CENTER.z);
  uvs.push(0.5, 0.5);
  colors.push(deepColor.r, deepColor.g, deepColor.b);

  const cos = 0.94;
  const sin = -0.34;

  for (let rIdx = 1; rIdx <= radialSegs; rIdx++) {
    const t = rIdx / radialSegs;
    for (let aIdx = 0; aIdx <= angularSegs; aIdx++) {
      const angle = (aIdx / angularSegs) * Math.PI * 2;
      const wobble =
        1 + 0.09 * Math.sin(2 * angle + 0.6) + 0.06 * Math.cos(3 * angle - 0.8);
      const lx = Math.cos(angle) * 2.12 * wobble * t;
      const lz = Math.sin(angle) * 1.49 * wobble * t;
      // Inverse rotation to world space
      const wx = POND_CENTER.x + (lx * cos + lz * sin);
      const wz = POND_CENTER.z + (-lx * sin + lz * cos);

      positions.push(wx, WATER_LEVEL, wz);
      uvs.push(0.5 + (lx / 4.5), 0.5 + (lz / 3.2));
      c.copy(deepColor).lerp(shallowColor, t * t);
      colors.push(c.r, c.g, c.b);
    }
  }

  const stride = angularSegs + 1;
  for (let aIdx = 0; aIdx < angularSegs; aIdx++) {
    indices.push(0, 1 + aIdx + 1, 1 + aIdx);
  }
  for (let rIdx = 1; rIdx < radialSegs; rIdx++) {
    const rowA = 1 + (rIdx - 1) * stride;
    const rowB = 1 + rIdx * stride;
    for (let aIdx = 0; aIdx < angularSegs; aIdx++) {
      const a = rowA + aIdx;
      const b = rowA + aIdx + 1;
      const d = rowB + aIdx;
      const e = rowB + aIdx + 1;
      indices.push(a, b, e);
      indices.push(a, e, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function randomPondPoint(rng: () => number): [number, number] {
  for (let i = 0; i < 20; i++) {
    const x = POND_CENTER.x + (rng() * 2 - 1) * 1.9;
    const z = POND_CENTER.z + (rng() * 2 - 1) * 1.35;
    if (pondNormalizedRadius(x, z) < 0.78) {
      return [x, z];
    }
  }
  return [POND_CENTER.x, POND_CENTER.z];
}

export function createPond(textures: ProceduralTextures): PondRig {
  const group = new THREE.Group();
  group.name = "Pond";

  const disposables: { dispose: () => void }[] = [];

  // 1. PBR Water Surface with gentle procedural GLSL wave ripples
  const waterGeo = buildPondWaterGeometry();
  const waterMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.14,
    metalness: 0.18,
    transparent: true,
    opacity: 0.85,
  });

  const shaderUniforms = { uTime: { value: 0 }, uRain: { value: 0 } };
  waterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shaderUniforms.uTime;
    shader.uniforms.uRain = shaderUniforms.uRain;
    shader.vertexShader =
      `uniform float uTime;
uniform float uRain;
` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       float waveAmp = 0.008 + uRain * 0.009;
       transformed.y += sin(position.x * 4.2 + uTime * 2.1) * cos(position.z * 3.8 - uTime * 1.7) * waveAmp;
      `
    );
  };
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.receiveShadow = true;
  group.add(waterMesh);
  disposables.push(waterGeo, waterMat);

  // 2. Shoreline Cobbles & River Stones
  const rng = createRng(888);
  const cobbleGeo = new THREE.DodecahedronGeometry(1, 1);
  const cobbleMat = new THREE.MeshStandardMaterial({
    map: textures.stoneMap,
    color: "#8b857b",
    roughness: 0.88,
    metalness: 0.04,
  });
  disposables.push(cobbleGeo, cobbleMat);

  const cos = 0.94;
  const sin = -0.34;
  const stoneCount = 34;
  for (let i = 0; i < stoneCount; i++) {
    const angle = (i / stoneCount) * Math.PI * 2 + (rng() - 0.5) * 0.1;
    // Leave small gap near dock entrance (~ -0.3 rad)
    if (Math.abs(Math.atan2(Math.sin(angle + 0.35), Math.cos(angle + 0.35))) < 0.24) {
      continue;
    }
    const wobble =
      1 + 0.09 * Math.sin(2 * angle + 0.6) + 0.06 * Math.cos(3 * angle - 0.8);
    const radialScale = 1.03 + (rng() - 0.5) * 0.1;
    const lx = Math.cos(angle) * 2.1 * wobble * radialScale;
    const lz = Math.sin(angle) * 1.48 * wobble * radialScale;
    const wx = POND_CENTER.x + (lx * cos + lz * sin);
    const wz = POND_CENTER.z + (-lx * sin + lz * cos);
    const wy = groundHeightAt(wx, wz);

    const stone = new THREE.Mesh(cobbleGeo, cobbleMat);
    const sx = 0.14 + rng() * 0.16;
    const sy = 0.07 + rng() * 0.08;
    const sz = 0.12 + rng() * 0.15;
    stone.scale.set(sx, sy, sz);
    stone.position.set(wx, wy + sy * 0.25, wz);
    stone.rotation.set((rng() - 0.5) * 0.2, rng() * Math.PI, (rng() - 0.5) * 0.2);
    stone.castShadow = true;
    stone.receiveShadow = true;
    group.add(stone);
  }

  // 3. Lily Pads & Lotus Blossoms
  const padGeo = new THREE.CircleGeometry(0.18, 16, 0.25, Math.PI * 1.85);
  padGeo.rotateX(-Math.PI * 0.5);
  const padMat = new THREE.MeshStandardMaterial({
    color: "#5c8c51",
    roughness: 0.72,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const lotusMat = new THREE.MeshStandardMaterial({
    color: "#f2bac4",
    roughness: 0.55,
    metalness: 0.02,
  });
  const petalGeo = new THREE.ConeGeometry(0.055, 0.09, 5);
  disposables.push(padGeo, padMat, lotusMat, petalGeo);

  const lilyGroup = new THREE.Group();
  const lilyOffsets: [number, number, number, boolean][] = [
    [-1.45, 2.25, 1.0, true],
    [-1.72, 1.82, 0.78, false],
    [-1.12, 2.68, 0.88, false],
    [0.08, 2.55, 0.94, true],
    [-0.48, 1.48, 0.72, false],
  ];
  const lilyMeshes: { mesh: THREE.Object3D; phase: number }[] = [];
  lilyOffsets.forEach(([lx, lz, sc, hasFlower], idx) => {
    const padHolder = new THREE.Group();
    padHolder.position.set(lx, WATER_LEVEL + 0.012, lz);
    padHolder.rotation.y = idx * 1.4;
    padHolder.scale.setScalar(sc);
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.receiveShadow = true;
    padHolder.add(pad);
    if (hasFlower) {
      const bloom = new THREE.Mesh(petalGeo, lotusMat);
      bloom.position.set(0.02, 0.04, 0);
      bloom.rotation.x = Math.PI;
      padHolder.add(bloom);
    }
    lilyGroup.add(padHolder);
    lilyMeshes.push({ mesh: padHolder, phase: idx * 1.2 });
  });
  group.add(lilyGroup);

  // 4. Shoreline Reeds / Cattails
  const stalkGeo = new THREE.CylinderGeometry(0.012, 0.018, 0.56, 5);
  stalkGeo.translate(0, 0.28, 0);
  const headGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.12, 6);
  const stalkMat = new THREE.MeshStandardMaterial({ color: "#587c45", roughness: 0.85 });
  const headMat = new THREE.MeshStandardMaterial({ color: "#68442f", roughness: 0.9 });
  disposables.push(stalkGeo, headGeo, stalkMat, headMat);

  const reeds: ReedBlade[] = [];
  const reedClusters: [number, number][] = [
    [-2.25, 1.35],
    [-2.42, 1.68],
    [-2.12, 2.75],
    [-1.55, 3.08],
    [0.35, 3.12],
  ];
  reedClusters.forEach(([rx, rz], cIdx) => {
    const ry = groundHeightAt(rx, rz);
    for (let k = 0; k < 3; k++) {
      const rg = new THREE.Group();
      const ox = rx + (k - 1) * 0.08;
      const oz = rz + ((k % 2) - 0.5) * 0.09;
      rg.position.set(ox, ry - 0.03, oz);
      rg.rotation.y = cIdx * 0.9 + k * 0.7;
      const stalk = new THREE.Mesh(stalkGeo, stalkMat);
      stalk.scale.y = 0.8 + k * 0.18;
      rg.add(stalk);
      if (k !== 1) {
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = (0.8 + k * 0.18) * 0.48;
        rg.add(head);
      }
      group.add(rg);
      reeds.push({ group: rg, phase: cIdx * 1.3 + k * 0.6 });
    }
  });

  // 5. Mini Wooden Dock & Moored Tiny Rowboat
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.woodMap,
    color: "#805a3b",
    roughness: 0.82,
    metalness: 0.03,
  });
  const boatHullMat = new THREE.MeshStandardMaterial({
    map: textures.woodMap,
    color: "#9b6b45",
    roughness: 0.75,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  disposables.push(woodMat, boatHullMat);

  const dockGroup = new THREE.Group();
  dockGroup.position.set(0.94, WATER_LEVEL + 0.14, 1.54);
  dockGroup.rotation.y = -0.78;
  const postGeo = new THREE.CylinderGeometry(0.036, 0.04, 0.44, 6);
  const plankGeo = new THREE.BoxGeometry(0.62, 0.04, 0.13);
  const stringerGeo = new THREE.BoxGeometry(0.06, 0.05, 0.98);
  disposables.push(postGeo, plankGeo, stringerGeo);

  for (const px of [-0.24, 0.24]) {
    for (const pz of [-0.36, 0.36]) {
      const p = new THREE.Mesh(postGeo, woodMat);
      p.position.set(px, -0.1, pz);
      p.castShadow = true;
      dockGroup.add(p);
    }
    const str = new THREE.Mesh(stringerGeo, woodMat);
    str.position.set(px, -0.02, 0);
    dockGroup.add(str);
  }
  for (let i = 0; i < 6; i++) {
    const plank = new THREE.Mesh(plankGeo, woodMat);
    plank.position.set(0, 0.02, -0.4 + i * 0.16);
    plank.castShadow = true;
    plank.receiveShadow = true;
    dockGroup.add(plank);
  }
  group.add(dockGroup);

  // Tiny Moored Wooden Rowboat
  const boatGroup = new THREE.Group();
  boatGroup.position.set(0.05, WATER_LEVEL + 0.02, 2.02);
  boatGroup.rotation.y = 0.42;

  const hullGeo = new THREE.CylinderGeometry(0.18, 0.12, 0.72, 8, 1, false, 0, Math.PI);
  hullGeo.rotateZ(Math.PI * 0.5);
  hullGeo.rotateY(Math.PI * 0.5);
  const hull = new THREE.Mesh(hullGeo, boatHullMat);
  hull.scale.set(1.1, 0.75, 1.0);
  hull.castShadow = true;
  boatGroup.add(hull);

  const seatGeo = new THREE.BoxGeometry(0.32, 0.025, 0.12);
  const seat = new THREE.Mesh(seatGeo, woodMat);
  seat.position.set(0, 0.03, 0);
  boatGroup.add(seat);
  group.add(boatGroup);
  disposables.push(hullGeo, seatGeo);

  // 6. Pooled Expanding Rain Ripples (Zero Per-Frame Allocation)
  const rippleGeo = new THREE.RingGeometry(0.05, 0.085, 24);
  rippleGeo.rotateX(-Math.PI * 0.5);
  disposables.push(rippleGeo);

  const RIPPLE_POOL_SIZE = 26;
  const ripples: RippleSlot[] = [];
  for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: "#d9eef5",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    disposables.push(mat);
    const mesh = new THREE.Mesh(rippleGeo, mat);
    mesh.visible = false;
    group.add(mesh);
    ripples.push({
      mesh,
      material: mat,
      age: (i / RIPPLE_POOL_SIZE) * 1.1,
      life: 1.05,
      maxScale: 1.8 + (i % 4) * 0.45,
      active: false,
    });
  }

  let spawnAccumulator = 0;
  let rippleCursor = 0;

  const update = (
    dt: number,
    elapsed: number,
    rainMix: number,
    windStrength: number,
    daylight: number,
    nightness: number,
    reducedMotion: boolean
  ) => {
    shaderUniforms.uTime.value = reducedMotion ? 0 : elapsed;
    shaderUniforms.uRain.value = rainMix;

    // Tint water naturally across day, sunset, rain, and night
    const baseOpacity = 0.82 + nightness * 0.08 + rainMix * 0.05;
    waterMat.opacity = Math.min(0.94, baseOpacity);
    waterMat.roughness = 0.12 + rainMix * 0.14;
    waterMat.color
      .setRGB(
        0.72 + daylight * 0.28 - rainMix * 0.18,
        0.8 + daylight * 0.2 - rainMix * 0.15,
        0.88 + daylight * 0.12 - rainMix * 0.1
      );

    // Subtle lily pad bobbing
    const bobScale = reducedMotion ? 0 : 1;
    for (const l of lilyMeshes) {
      l.mesh.position.y =
        WATER_LEVEL + 0.012 + Math.sin(elapsed * 1.6 + l.phase) * 0.006 * bobScale;
    }

    // Gentle boat rocking
    const boatMotion = reducedMotion ? 0 : 1 + rainMix * 0.45 + windStrength * 0.5;
    boatGroup.position.y =
      WATER_LEVEL + 0.02 + Math.sin(elapsed * 1.8) * 0.012 * (reducedMotion ? 0 : 1);
    boatGroup.rotation.z = Math.sin(elapsed * 1.5) * 0.045 * boatMotion;
    boatGroup.rotation.x = Math.cos(elapsed * 1.2) * 0.03 * boatMotion;

    // Reed sway with shared wind
    const reedBend = windStrength * 0.22;
    for (const r of reeds) {
      const gust = reducedMotion || windStrength < 0.01 ? 0 : Math.sin(elapsed * (1.8 + windStrength * 2.2) + r.phase) * (0.015 + windStrength * 0.11);
      r.group.rotation.z = -(reedBend + gust);
    }

    // Rain ripples on the pond surface
    if (rainMix > 0.04) {
      const spawnRate = rainMix * (reducedMotion ? 8 : 22);
      spawnAccumulator += dt * spawnRate;
      while (spawnAccumulator >= 1) {
        spawnAccumulator -= 1;
        const slot = ripples[rippleCursor];
        rippleCursor = (rippleCursor + 1) % RIPPLE_POOL_SIZE;
        const [rx, rz] = randomPondPoint(rng);
        slot.mesh.position.set(rx, WATER_LEVEL + 0.014, rz);
        slot.age = 0;
        slot.life = 0.85 + rng() * 0.45;
        slot.maxScale = 1.4 + rng() * 1.2;
        slot.active = true;
        slot.mesh.visible = true;
      }
    } else {
      spawnAccumulator = 0;
    }

    for (const slot of ripples) {
      if (!slot.active) continue;
      slot.age += dt;
      const t = slot.age / slot.life;
      if (t >= 1) {
        slot.active = false;
        slot.mesh.visible = false;
        continue;
      }
      const scale = 0.35 + t * slot.maxScale;
      slot.mesh.scale.setScalar(scale);
      slot.material.opacity = (1 - t) * (1 - t) * 0.55 * rainMix;
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

