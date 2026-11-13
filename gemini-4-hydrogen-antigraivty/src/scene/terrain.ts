import * as THREE from 'three';
import { ProceduralTextures } from './textures';

export interface LandmarkFootprint {
  id: string;
  x: number;
  z: number;
  radius: number;
}

export const POND_CENTER = Object.freeze({
  x: 1.85,
  z: 1.35,
  rx: 1.55,
  rz: 1.15,
  waterY: -0.14,
});

export const HOUSE_ANCHOR = Object.freeze({
  x: -1.15,
  z: -0.45,
  rotationY: 0.42,
  radius: 1.55,
});

export const WINDMILL_ANCHOR = Object.freeze({
  x: 1.95,
  z: -1.95,
  rotationY: -0.44,
  radius: 1.22,
});

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function getIslandRadiusAtAngle(theta: number): number {
  return (
    5.35 +
    0.42 * Math.cos(2 * theta - 0.5) +
    0.34 * Math.sin(3 * theta + 0.9) +
    0.18 * Math.cos(5 * theta + 0.3)
  );
}

export function isInsideIsland(x: number, z: number, margin = 0): boolean {
  const r = Math.hypot(x, z);
  const theta = Math.atan2(z, x);
  return r <= getIslandRadiusAtAngle(theta) - margin;
}

function getPondNormalizedDistance(x: number, z: number): number {
  const dx = x - POND_CENTER.x;
  const dz = z - POND_CENTER.z;
  const angle = Math.atan2(dz, dx);
  const organicWarp = 1 + 0.08 * Math.sin(3 * angle + 0.6) + 0.05 * Math.cos(2 * angle - 0.4);
  return Math.hypot(dx / (POND_CENTER.rx * organicWarp), dz / (POND_CENTER.rz * organicWarp));
}

export function isInsidePond(x: number, z: number, margin = 0): boolean {
  const dx = x - POND_CENTER.x;
  const dz = z - POND_CENTER.z;
  const angle = Math.atan2(dz, dx);
  const organicWarp = 1 + 0.08 * Math.sin(3 * angle + 0.6) + 0.05 * Math.cos(2 * angle - 0.4);
  const rx = Math.max(0.1, POND_CENTER.rx * organicWarp + margin);
  const rz = Math.max(0.1, POND_CENTER.rz * organicWarp + margin);
  return Math.hypot(dx / rx, dz / rz) <= 1;
}

export function getIslandSurfaceHeight(x: number, z: number): number {
  const theta = Math.atan2(z, x);
  const maxR = getIslandRadiusAtAngle(theta);
  const radialRatio = Math.min(1.1, Math.hypot(x, z) / maxR);

  // Rolling knoll under windmill and gentle terrace under house
  const dxWind = x - WINDMILL_ANCHOR.x;
  const dzWind = z - WINDMILL_ANCHOR.z;
  const windmillKnoll = 0.44 * Math.exp(-(dxWind * dxWind + dzWind * dzWind) / 5.2);

  const dxHouse = x - HOUSE_ANCHOR.x;
  const dzHouse = z - HOUSE_ANCHOR.z;
  const houseTerrace = 0.16 * Math.exp(-(dxHouse * dxHouse + dzHouse * dzHouse) / 6.5);

  const meadowUndulation = 0.065 * Math.sin(x * 0.58 + 0.5) * Math.cos(z * 0.52 - 0.3);

  // Soft edge slope near island cliff rim
  const rimTaper = 1 - smoothstep(0.76, 1.02, radialRatio);
  const baseElevation = (0.04 + windmillKnoll + houseTerrace + meadowUndulation) * (0.35 + 0.65 * rimTaper);

  // Pond basin carving
  const pondDist = getPondNormalizedDistance(x, z);
  const pondCarve = 1 - smoothstep(0.55, 1.38, pondDist);
  const basinFloor = -0.58;

  return baseElevation * (1 - pondCarve) + basinFloor * pondCarve;
}

export function validateLandmarkClearance(items: LandmarkFootprint[]): boolean {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      const dist = Math.hypot(a.x - b.x, a.z - b.z);
      if (dist < a.radius + b.radius) {
        return false;
      }
    }
  }
  return true;
}

export interface IslandVisualHandle {
  group: THREE.Group;
  floatingFragments: Array<{ mesh: THREE.Mesh; baseY: number; phase: number; amp: number }>;
  dispose(): void;
}

export function createIslandMesh(textures: ProceduralTextures): IslandVisualHandle {
  const group = new THREE.Group();
  group.name = 'floating-island';
  const disposables: Array<{ dispose(): void }> = [];

  const angularSegs = 72;
  const topRings = 22;
  const skirtRings = 4;

  // --- 1. Grass Top & Overhanging Turf Skirt ---
  const grassPositions: number[] = [];
  const grassColors: number[] = [];
  const grassUvs: number[] = [];
  const grassIndices: number[] = [];

  const lushGreen = new THREE.Color('#77ab5b');
  const sunlitGreen = new THREE.Color('#91bf6c');
  const mossGreen = new THREE.Color('#5f914b');
  const shoreSandTint = new THREE.Color('#9e9d74');
  const skirtShade = new THREE.Color('#4c763e');
  const tmpColor = new THREE.Color();

  // Center vertex
  const centerY = getIslandSurfaceHeight(0, 0);
  grassPositions.push(0, centerY, 0);
  grassColors.push(lushGreen.r, lushGreen.g, lushGreen.b);
  grassUvs.push(0.5, 0.5);

  const ringTotal = topRings + skirtRings;
  for (let rIdx = 1; rIdx <= ringTotal; rIdx++) {
    for (let aIdx = 0; aIdx <= angularSegs; aIdx++) {
      const theta = (aIdx / angularSegs) * Math.PI * 2;
      const edgeR = getIslandRadiusAtAngle(theta);
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      let x = 0;
      let y = 0;
      let z = 0;

      if (rIdx <= topRings) {
        const t = rIdx / topRings;
        const radius = edgeR * t;
        x = cosT * radius;
        z = sinT * radius;
        y = getIslandSurfaceHeight(x, z);

        // Subtle sunlit hill highlight + pond shore warmth
        const pondDist = getPondNormalizedDistance(x, z);
        const shoreBlend = 1 - smoothstep(0.85, 1.32, pondDist);
        const hillBlend = smoothstep(0.05, 0.45, y);

        tmpColor.copy(lushGreen);
        tmpColor.lerp(sunlitGreen, hillBlend * 0.72);
        tmpColor.lerp(mossGreen, smoothstep(0.8, 1.0, t) * 0.38);
        tmpColor.lerp(shoreSandTint, shoreBlend * 0.75);
      } else {
        // Rounded overhanging turf lip curving slightly outward then tucking in
        const skirtT = (rIdx - topRings) / skirtRings;
        const scallop = 0.08 * Math.sin(7 * theta + 0.4) + 0.05 * Math.cos(11 * theta);
        const overhangScale = 1.0 + 0.032 * Math.sin(skirtT * Math.PI) - 0.05 * skirtT * skirtT;
        const radius = edgeR * overhangScale;
        x = cosT * radius;
        z = sinT * radius;

        const rimSurfaceY = getIslandSurfaceHeight(cosT * edgeR, sinT * edgeR);
        y = rimSurfaceY - (0.31 + scallop) * Math.sin(skirtT * Math.PI * 0.5);

        tmpColor.copy(mossGreen).lerp(skirtShade, skirtT * 0.85);
      }

      grassPositions.push(x, y, z);
      grassColors.push(tmpColor.r, tmpColor.g, tmpColor.b);
      grassUvs.push(x * 0.1 + 0.5, z * 0.1 + 0.5);
    }
  }

  const stride = angularSegs + 1;
  // Inner fan triangles around center vertex (index 0)
  const firstRingStart = 1;
  for (let aIdx = 0; aIdx < angularSegs; aIdx++) {
    grassIndices.push(0, firstRingStart + aIdx + 1, firstRingStart + aIdx);
  }

  // Subsequent rings
  for (let rIdx = 1; rIdx < ringTotal; rIdx++) {
    const rowA = 1 + (rIdx - 1) * stride;
    const rowB = 1 + rIdx * stride;
    for (let aIdx = 0; aIdx < angularSegs; aIdx++) {
      const a0 = rowA + aIdx;
      const a1 = rowA + aIdx + 1;
      const b0 = rowB + aIdx;
      const b1 = rowB + aIdx + 1;
      grassIndices.push(a0, a1, b0);
      grassIndices.push(a1, b1, b0);
    }
  }

  const grassGeo = new THREE.BufferGeometry();
  grassGeo.setAttribute('position', new THREE.Float32BufferAttribute(grassPositions, 3));
  grassGeo.setAttribute('color', new THREE.Float32BufferAttribute(grassColors, 3));
  grassGeo.setAttribute('uv', new THREE.Float32BufferAttribute(grassUvs, 2));
  grassGeo.setIndex(grassIndices);
  grassGeo.computeVertexNormals();
  disposables.push(grassGeo);

  const grassMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: textures.grassMap,
    roughness: 0.9,
    metalness: 0.02,
  });
  disposables.push(grassMat);

  const grassMesh = new THREE.Mesh(grassGeo, grassMat);
  grassMesh.name = 'island-grass-top';
  grassMesh.receiveShadow = true;
  grassMesh.castShadow = true;
  group.add(grassMesh);

  // --- 2. Sculpted Rocky Underside & Soil Strata ---
  const rockRings = 13;
  const rockSegs = 44;
  const rockPositions: number[] = [];
  const rockColors: number[] = [];
  const rockUvs: number[] = [];
  const rockIndices: number[] = [];

  const soilColor = new THREE.Color('#8e694c');
  const midRockColor = new THREE.Color('#86766c');
  const deepSlateColor = new THREE.Color('#5c5354');

  // Vertical profile: stepped strata ledges tapering cleanly into a sculpted crag spire
  const ringProfiles = [
    { scale: 0.97, y: -0.22, jag: 0.03 },
    { scale: 0.99, y: -0.52, jag: 0.06 },
    { scale: 0.92, y: -0.95, jag: 0.09 },
    { scale: 0.95, y: -1.32, jag: 0.11 }, // subtle overhanging rock shelf
    { scale: 0.82, y: -1.82, jag: 0.13 },
    { scale: 0.72, y: -2.28, jag: 0.14 },
    { scale: 0.61, y: -2.74, jag: 0.14 },
    { scale: 0.46, y: -3.22, jag: 0.12 },
    { scale: 0.34, y: -3.65, jag: 0.1 },
    { scale: 0.21, y: -4.02, jag: 0.07 },
    { scale: 0.11, y: -4.32, jag: 0.04 },
    { scale: 0.04, y: -4.52, jag: 0.02 },
    { scale: 0.0, y: -4.64, jag: 0.0 },
  ];

  for (let rIdx = 0; rIdx < rockRings; rIdx++) {
    const prof = ringProfiles[rIdx];
    const t = rIdx / (rockRings - 1);
    const offsetX = 0.22 * t * t;
    const offsetZ = -0.14 * t * t;

    for (let aIdx = 0; aIdx <= rockSegs; aIdx++) {
      const theta = (aIdx / rockSegs) * Math.PI * 2;
      const baseR = getIslandRadiusAtAngle(theta);
      const ridge =
        Math.sin(6 * theta + rIdx * 0.75) * 0.55 +
        Math.cos(10 * theta - rIdx * 1.15) * 0.32 +
        Math.sin(3 * theta + 0.4) * 0.25;
      const radius = Math.max(0, baseR * (prof.scale + prof.jag * ridge));
      const x = Math.cos(theta) * radius + offsetX;
      const z = Math.sin(theta) * radius + offsetZ;
      const y = prof.y + (rIdx > 0 && rIdx < rockRings - 1 ? ridge * 0.09 : 0);

      rockPositions.push(x, y, z);

      if (t < 0.24) {
        tmpColor.copy(soilColor).lerp(midRockColor, t / 0.24);
      } else {
        tmpColor.copy(midRockColor).lerp(deepSlateColor, (t - 0.24) / 0.76);
      }
      // Slight facet shading variation
      const toneShift = 0.92 + 0.08 * ridge;
      tmpColor.multiplyScalar(toneShift);

      rockColors.push(tmpColor.r, tmpColor.g, tmpColor.b);
      rockUvs.push(aIdx / rockSegs, t);
    }
  }

  const rockStride = rockSegs + 1;
  for (let rIdx = 0; rIdx < rockRings - 1; rIdx++) {
    const rowA = rIdx * rockStride;
    const rowB = (rIdx + 1) * rockStride;
    for (let aIdx = 0; aIdx < rockSegs; aIdx++) {
      const a0 = rowA + aIdx;
      const a1 = rowA + aIdx + 1;
      const b0 = rowB + aIdx;
      const b1 = rowB + aIdx + 1;
      // Outward facing normals pointing down & out
      rockIndices.push(a0, a1, b0);
      rockIndices.push(a1, b1, b0);
    }
  }

  const rockGeo = new THREE.BufferGeometry();
  rockGeo.setAttribute('position', new THREE.Float32BufferAttribute(rockPositions, 3));
  rockGeo.setAttribute('color', new THREE.Float32BufferAttribute(rockColors, 3));
  rockGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rockUvs, 2));
  rockGeo.setIndex(rockIndices);
  rockGeo.computeVertexNormals();
  disposables.push(rockGeo);

  const rockMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: textures.stoneMap,
    roughness: 0.94,
    metalness: 0.04,
    flatShading: true,
  });
  disposables.push(rockMat);

  const rockMesh = new THREE.Mesh(rockGeo, rockMat);
  rockMesh.name = 'island-rock-underside';
  rockMesh.castShadow = false;
  rockMesh.receiveShadow = true;
  group.add(rockMesh);

  // --- 3. Floating Underside Satellite Pebbles ---
  const fragmentSpecs = [
    { x: -2.4, y: -2.75, z: 1.9, scale: [0.36, 0.28, 0.32], rot: [0.3, 0.8, 0.2], phase: 0.0 },
    { x: 2.55, y: -2.95, z: 1.65, scale: [0.28, 0.24, 0.26], rot: [0.5, 1.4, -0.3], phase: 1.4 },
    { x: 1.6, y: -3.75, z: -2.05, scale: [0.32, 0.22, 0.29], rot: [-0.4, 0.2, 0.6], phase: 2.7 },
    { x: -1.65, y: -3.85, z: -1.75, scale: [0.24, 0.2, 0.22], rot: [0.2, -0.9, 0.4], phase: 4.1 },
    { x: 0.35, y: -5.05, z: 0.2, scale: [0.19, 0.22, 0.18], rot: [0.7, 0.3, -0.5], phase: 5.2 },
  ];

  const fragmentGeo = new THREE.DodecahedronGeometry(1, 0);
  const fragmentMat = new THREE.MeshStandardMaterial({
    color: '#635855',
    map: textures.stoneMap,
    roughness: 0.92,
    flatShading: true,
  });
  disposables.push(fragmentGeo, fragmentMat);

  const floatingFragments: IslandVisualHandle['floatingFragments'] = [];
  for (const spec of fragmentSpecs) {
    const mesh = new THREE.Mesh(fragmentGeo, fragmentMat);
    mesh.position.set(spec.x, spec.y, spec.z);
    mesh.scale.set(spec.scale[0], spec.scale[1], spec.scale[2]);
    mesh.rotation.set(spec.rot[0], spec.rot[1], spec.rot[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    floatingFragments.push({
      mesh,
      baseY: spec.y,
      phase: spec.phase,
      amp: 0.08,
    });
  }

  return {
    group,
    floatingFragments,
    dispose: () => {
      for (const item of disposables) {
        item.dispose();
      }
    },
  };
}
