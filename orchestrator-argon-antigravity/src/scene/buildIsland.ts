import * as THREE from 'three';
import {
  POND_CENTER,
  POND_WATER_Y,
  getIslandBoundaryRadius,
  getIslandSurfaceHeight,
} from '../state/worldState';
import { SceneMaterials } from './materials';

export interface IslandBuildResult {
  root: THREE.Group;
  waterMesh: THREE.Mesh;
  floatingShards: Array<{ mesh: THREE.Mesh; baseY: number; phase: number }>;
}

function createGrassyTopGeometry(): THREE.BufferGeometry {
  const radialSegs = 64;
  const ringSegs = 26;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const grassBright = new THREE.Color(0x79ab5c);
  const grassMid = new THREE.Color(0x639453);
  const grassKnoll = new THREE.Color(0x83b464);
  const shoreSand = new THREE.Color(0xd2bf95);
  const rimMoss = new THREE.Color(0x557c47);
  const tmpColor = new THREE.Color();

  // Center vertex
  const centerY = getIslandSurfaceHeight(0, 0);
  positions.push(0, centerY, 0);
  colors.push(grassMid.r, grassMid.g, grassMid.b);

  for (let ring = 1; ring <= ringSegs; ring++) {
    const t = ring / ringSegs;
    for (let seg = 0; seg < radialSegs; seg++) {
      const theta = (seg / radialSegs) * Math.PI * 2;
      const boundary = getIslandBoundaryRadius(theta);
      const r = boundary * t;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const y = getIslandSurfaceHeight(x, z);
      positions.push(x, y, z);

      // Blend vertex color organically
      const pondDist = Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z);
      const pondNorm = pondDist / POND_CENTER.radius;
      const knollWeight = Math.exp(-((x + 2.45) ** 2 + (z - 0.25) ** 2) / 3.0);

      tmpColor.copy(grassMid).lerp(grassBright, 0.5 + 0.5 * Math.sin(x * 0.7 + z * 0.5));
      tmpColor.lerp(grassKnoll, knollWeight * 0.65);

      if (t > 0.85) {
        tmpColor.lerp(rimMoss, ((t - 0.85) / 0.15) * 0.7);
      }
      if (pondNorm < 1.24) {
        const shoreT = Math.max(0, Math.min(1, 1 - (pondNorm - 0.85) / 0.39));
        tmpColor.lerp(shoreSand, shoreT * 0.92);
      }

      colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }

  // First ring triangles around center
  for (let seg = 0; seg < radialSegs; seg++) {
    const next = (seg + 1) % radialSegs;
    indices.push(0, 1 + next, 1 + seg);
  }

  // Outer rings
  for (let ring = 1; ring < ringSegs; ring++) {
    const rowStart = 1 + (ring - 1) * radialSegs;
    const nextRowStart = 1 + ring * radialSegs;
    for (let seg = 0; seg < radialSegs; seg++) {
      const next = (seg + 1) % radialSegs;
      const a = rowStart + seg;
      const b = rowStart + next;
      const c = nextRowStart + seg;
      const d = nextRowStart + next;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createSkirtLayerGeometry(
  topOffsetY: number,
  depthBase: number,
  taperTop: number,
  taperBottom: number,
  jaggedAmp: number,
  seedOffset: number,
): THREE.BufferGeometry {
  const radialSegs = 40;
  const heightSegs = 5;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let h = 0; h <= heightSegs; h++) {
    const v = h / heightSegs;
    const scaleR = THREE.MathUtils.lerp(taperTop, taperBottom, Math.pow(v, 1.18));
    for (let seg = 0; seg < radialSegs; seg++) {
      const theta = (seg / radialSegs) * Math.PI * 2;
      const boundary = getIslandBoundaryRadius(theta);
      const facetNoise =
        1 +
        jaggedAmp *
          (Math.sin(theta * 5 + v * 3.1 + seedOffset) * 0.5 +
            Math.cos(theta * 9 - v * 4.7 + seedOffset) * 0.5);

      const r = boundary * scaleR * (h === 0 ? 1 : facetNoise);
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;

      let y: number;
      if (h === 0) {
        y = getIslandSurfaceHeight(Math.cos(theta) * boundary * taperTop, Math.sin(theta) * boundary * taperTop) + topOffsetY;
      } else {
        const verticalRipple =
          Math.sin(theta * 4 + seedOffset) * 0.14 * (1 - v) +
          Math.cos(theta * 7 - seedOffset) * 0.1 * v;
        y = topOffsetY - v * depthBase + verticalRipple;
      }
      positions.push(x, y, z);
    }
  }

  for (let h = 0; h < heightSegs; h++) {
    const row = h * radialSegs;
    const nextRow = (h + 1) * radialSegs;
    for (let seg = 0; seg < radialSegs; seg++) {
      const next = (seg + 1) % radialSegs;
      const a = row + seg;
      const b = row + next;
      const c = nextRow + seg;
      const d = nextRow + next;
      indices.push(a, c, d);
      indices.push(a, d, b);
    }
  }

  // Cap bottom apex
  const apexIndex = positions.length / 3;
  positions.push(0.12 * Math.sin(seedOffset), topOffsetY - depthBase - 0.55, -0.08 * Math.cos(seedOffset));
  const lastRow = heightSegs * radialSegs;
  for (let seg = 0; seg < radialSegs; seg++) {
    const next = (seg + 1) % radialSegs;
    indices.push(lastRow + seg, apexIndex, lastRow + next);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildIsland(materials: SceneMaterials): IslandBuildResult {
  const root = new THREE.Group();
  root.name = 'FloatingIsland';

  // 1. Grassy terrain cap
  const grassGeo = createGrassyTopGeometry();
  const grassMesh = new THREE.Mesh(grassGeo, materials.grass);
  grassMesh.receiveShadow = true;
  grassMesh.castShadow = true;
  root.add(grassMesh);

  // 2. Warm soil collar directly beneath grass lip
  const soilGeo = createSkirtLayerGeometry(-0.045, 0.52, 0.968, 0.91, 0.035, 1.2);
  const soilMesh = new THREE.Mesh(soilGeo, materials.soilRim);
  soilMesh.castShadow = true;
  soilMesh.receiveShadow = true;
  root.add(soilMesh);

  // 3. Sculpted rocky underside (main strata + deeper dark core spire)
  const rockMainGeo = createSkirtLayerGeometry(-0.44, 3.15, 0.915, 0.24, 0.14, 2.7);
  const rockMainMesh = new THREE.Mesh(rockMainGeo, materials.rockPrimary);
  rockMainMesh.castShadow = true;
  rockMainMesh.receiveShadow = true;
  root.add(rockMainMesh);

  const rockSpireGeo = createSkirtLayerGeometry(-1.35, 2.85, 0.62, 0.07, 0.18, 5.4);
  const rockSpireMesh = new THREE.Mesh(rockSpireGeo, materials.rockDark);
  rockSpireMesh.position.set(0.22, 0, -0.15);
  rockSpireMesh.castShadow = true;
  rockSpireMesh.receiveShadow = true;
  root.add(rockSpireMesh);

  // Sculpted cliff buttresses around the underside for handcrafted silhouette
  const buttressGeo = new THREE.DodecahedronGeometry(1, 0);
  const buttresses: Array<{ pos: [number, number, number]; scale: [number, number, number]; rot: [number, number, number]; dark?: boolean }> = [
    { pos: [-2.4, -1.2, 1.5], scale: [1.1, 1.45, 0.95], rot: [0.2, 0.6, 0.35] },
    { pos: [2.2, -1.35, -1.8], scale: [1.15, 1.55, 1.0], rot: [-0.25, 1.1, -0.2], dark: true },
    { pos: [-0.8, -2.35, -1.9], scale: [0.9, 1.4, 0.85], rot: [0.3, -0.4, 0.25], dark: true },
    { pos: [1.6, -1.95, 2.1], scale: [0.95, 1.35, 0.9], rot: [-0.15, 0.8, 0.28] },
    { pos: [-2.9, -0.9, -1.3], scale: [0.88, 1.1, 0.85], rot: [0.1, -0.9, -0.3] },
    { pos: [0.3, -3.2, 0.4], scale: [0.65, 1.35, 0.65], rot: [0.2, 0.3, -0.15], dark: true },
  ];

  for (const b of buttresses) {
    const mesh = new THREE.Mesh(buttressGeo, b.dark ? materials.rockDark : materials.rockPrimary);
    mesh.position.set(...b.pos);
    mesh.scale.set(...b.scale);
    mesh.rotation.set(...b.rot);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  // 4. Pond water surface + shoreline stones + lily pads
  const waterGeo = new THREE.CircleGeometry(POND_CENTER.radius * 0.96, 36);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMesh = new THREE.Mesh(waterGeo, materials.water);
  waterMesh.position.set(POND_CENTER.x, POND_WATER_Y, POND_CENTER.z);
  waterMesh.receiveShadow = true;
  root.add(waterMesh);

  // Subtle shoreline pebbles & rocks around the pond
  const pebbleGeo = new THREE.DodecahedronGeometry(0.18, 0);
  const pebbleAngles = [0.15, 0.6, 1.15, 1.8, 2.35, 3.1, 3.85, 4.5, 5.15, 5.75];
  pebbleAngles.forEach((angle, idx) => {
    const rad = POND_CENTER.radius * (0.94 + (idx % 3) * 0.08);
    const px = POND_CENTER.x + Math.cos(angle) * rad;
    const pz = POND_CENTER.z + Math.sin(angle) * rad;
    const py = getIslandSurfaceHeight(px, pz) + 0.02;
    const pebble = new THREE.Mesh(
      pebbleGeo,
      idx % 2 === 0 ? materials.rockLight : materials.stoneGrey,
    );
    const s = 0.7 + (idx % 4) * 0.25;
    pebble.position.set(px, py, pz);
    pebble.scale.set(s * 1.15, s * 0.65, s);
    pebble.rotation.set(idx * 0.5, angle, idx * 0.3);
    pebble.castShadow = true;
    pebble.receiveShadow = true;
    root.add(pebble);
  });

  // Lily pads floating gently on the pond
  const lilyGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.015, 14, 1, false, 0.2, Math.PI * 1.82);
  const lilyOffsets: Array<[number, number, number, number]> = [
    [-0.38, 0.25, 1.0, 0.4],
    [-0.16, 0.46, 0.78, 1.9],
    [0.44, -0.35, 0.92, -0.8],
  ];
  for (const [ox, oz, scale, rotY] of lilyOffsets) {
    const pad = new THREE.Mesh(lilyGeo, materials.lilyPad);
    pad.position.set(POND_CENTER.x + ox, POND_WATER_Y + 0.012, POND_CENTER.z + oz);
    pad.scale.setScalar(scale);
    pad.rotation.y = rotY;
    pad.receiveShadow = true;
    root.add(pad);
  }

  // 5. Floating satellite rock shards hovering around the underside
  const shardGeo = new THREE.OctahedronGeometry(0.28, 0);
  const shardSpecs: Array<{ pos: [number, number, number]; scale: [number, number, number]; phase: number }> = [
    { pos: [-3.9, -1.85, 2.2], scale: [0.85, 1.25, 0.85], phase: 0.2 },
    { pos: [3.6, -2.15, -1.6], scale: [0.7, 1.1, 0.68], phase: 1.7 },
    { pos: [1.4, -3.45, 2.6], scale: [0.55, 0.9, 0.55], phase: 3.1 },
    { pos: [-2.1, -3.1, -2.9], scale: [0.62, 1.0, 0.6], phase: 4.5 },
  ];
  const floatingShards = shardSpecs.map((spec) => {
    const mesh = new THREE.Mesh(shardGeo, materials.rockDark);
    mesh.position.set(...spec.pos);
    mesh.scale.set(...spec.scale);
    mesh.rotation.set(spec.phase * 0.4, spec.phase, 0.2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return { mesh, baseY: spec.pos[1], phase: spec.phase };
  });

  return {
    root,
    waterMesh,
    floatingShards,
  };
}
