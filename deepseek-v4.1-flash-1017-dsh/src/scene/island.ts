import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  TubeGeometry,
  Vector3,
  Float32BufferAttribute,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRadialSurface } from '../lib/geometry';
import { fbm2, Rng, smoothstep } from '../lib/noise';
import { PALETTE, type SceneMaterials } from './palette';

export const ISLAND_RADIUS = 5.25;
export const POND_CENTER = new Vector3(-2.05, 0, 1.2);
export const HOUSE_CENTER = new Vector3(1.42, 0, 0.3);
export const WINDMILL_CENTER = new Vector3(-2.8, 0, -2.35);

export function boundaryRadius(angle: number): number {
  return (
    ISLAND_RADIUS *
    (1 +
      0.052 * Math.sin(3 * angle + 0.7) +
      0.03 * Math.sin(7 * angle + 2.1) +
      0.016 * Math.sin(11 * angle + 4.2) +
      0.012 * Math.sin(17 * angle + 1.2))
  );
}

function pondDistance(x: number, z: number): number {
  const dx = (x - POND_CENTER.x) / 1.45;
  const dz = (z - POND_CENTER.z) / 1.32;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Terrain height for any point on the island top. */
export function terrainHeight(x: number, z: number): number {
  const angle = Math.atan2(z, x);
  const edge = Math.hypot(x, z) / boundaryRadius(angle);
  const base =
    0.16 +
    0.12 * (1 - Math.min(1, edge * edge)) +
    (fbm2(x * 0.52 + 10.3, z * 0.52 + 4.1, 4, 7) - 0.5) * 0.11;

  const houseDistance = Math.hypot(x - HOUSE_CENTER.x, z - HOUSE_CENTER.z);
  const housePad = smoothstep(2.2, 1.35, houseDistance);
  const flattened = base + (0.235 - base) * housePad;

  const basin = smoothstep(1.18, 0.32, pondDistance(x, z));
  const withPond = flattened - basin * 0.16;

  const windmillDistance = Math.hypot(x - WINDMILL_CENTER.x, z - WINDMILL_CENTER.z);
  const knoll = smoothstep(2.25, 0.15, windmillDistance) * 0.22;
  const withKnoll = withPond + knoll;

  const edgeBlend = smoothstep(0.94, 1.01, edge);
  return withKnoll + (0.035 - withKnoll) * edgeBlend;
}

export function isOnIsland(x: number, z: number, margin = 0): boolean {
  const angle = Math.atan2(z, x);
  return Math.hypot(x, z) <= boundaryRadius(angle) - margin;
}

export interface Island {
  group: Group;
  terrainMesh: Mesh;
  boundaryRadius: (angle: number) => number;
  terrainHeight: (x: number, z: number) => number;
  isOnIsland: (x: number, z: number, margin?: number) => boolean;
}

/** Builds the sculpted body, the meadow top, grass tufts and hanging roots. */
export function createIsland(materials: SceneMaterials, quality: 'high' | 'low'): Island {
  const group = new Group();
  group.name = 'island';

  const body = createIslandBody();
  const bodyMesh = new Mesh(body, materials.island);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  const segments = quality === 'high' ? 96 : 64;
  const rings = quality === 'high' ? 30 : 22;
  const terrainGeometry = createRadialSurface(
    0,
    0,
    boundaryRadius,
    segments,
    rings,
    (x, z) => terrainHeight(x, z),
    1.05,
  );
  const terrainMesh = new Mesh(terrainGeometry, materials.terrain);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = false;
  group.add(terrainMesh);

  group.add(createGrassTufts(quality));
  group.add(createHangingRoots(materials));
  group.add(createRockOutcrops(materials));

  return {
    group,
    terrainMesh,
    boundaryRadius,
    terrainHeight,
    isOnIsland,
  };
}

function createIslandBody(): BufferGeometry {
  const segments = 72;
  const ringDefs = [
    { y: 0.06, r: 0.998, kind: 'grass' },
    { y: 0.008, r: 1.028, kind: 'grass' },
    { y: -0.13, r: 1.018, kind: 'edge' },
    { y: -0.24, r: 0.994, kind: 'soil' },
    { y: -0.42, r: 1.006, kind: 'soil' },
    { y: -0.68, r: 0.968, kind: 'rockUpper' },
    { y: -0.93, r: 0.925, kind: 'rockUpper' },
    { y: -1.04, r: 0.968, kind: 'rockUpper' },
    { y: -1.32, r: 0.86, kind: 'rock' },
    { y: -1.68, r: 0.79, kind: 'rock' },
    { y: -1.94, r: 0.845, kind: 'rock' },
    { y: -2.35, r: 0.695, kind: 'rockLow' },
    { y: -2.78, r: 0.56, kind: 'rockLow' },
    { y: -3.18, r: 0.475, kind: 'rockLow' },
    { y: -3.62, r: 0.32, kind: 'rockDeep' },
    { y: -4.0, r: 0.19, kind: 'rockDeep' },
    { y: -4.32, r: 0.075, kind: 'rockDeep' },
    { y: -4.48, r: 0.012, kind: 'rockDeep' },
  ] as const;

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const color = new Color();

  const grass = new Color(PALETTE.grassEdge);
  const grassDark = new Color(PALETTE.grassDark);
  const soil = new Color(PALETTE.soil);
  const soilDark = new Color(PALETTE.soilDark);
  const rock = new Color(PALETTE.rock);
  const rockDark = new Color(PALETTE.rockDark);
  const rockLight = new Color(PALETTE.rockLight);
  const moss = new Color('#6d7d55');

  for (let ringIndex = 0; ringIndex < ringDefs.length; ringIndex += 1) {
    const ring = ringDefs[ringIndex];
    const depth = Math.max(0, -ring.y);
    for (let segment = 0; segment <= segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const base = boundaryRadius(angle);
      const angularNoise =
        Math.sin(angle * 5 + ringIndex * 1.31) * 0.045 +
        Math.sin(angle * 9 + 1.7 + ringIndex * 0.74) * 0.026 +
        Math.sin(angle * 13 + ringIndex * 2.1) * 0.014;
      const depthFactor = smoothstep(0.15, 2.8, depth);
      const radial = 1 + angularNoise * (0.18 + depthFactor * 0.85);
      const x = Math.cos(angle) * base * ring.r * radial;
      const z = Math.sin(angle) * base * ring.r * radial;
      const lipNoise = Math.sin(angle * 3.3 + 0.8) * 0.018 * (0.3 + depthFactor);
      const y = ring.y + lipNoise;
      positions.push(x, y, z);

      if (ring.kind === 'grass') {
        color.copy(grass).lerp(grassDark, 0.25 + 0.2 * Math.sin(angle * 2));
      } else if (ring.kind === 'edge') {
        color.copy(grassDark).lerp(soil, 0.25);
      } else if (ring.kind === 'soil') {
        color.copy(soil).lerp(soilDark, 0.2 + 0.4 * fbm2(x * 0.8, z * 0.8, 2, 21));
      } else if (ring.kind === 'rockUpper') {
        color.copy(rock).lerp(rockDark, 0.45);
        if (fbm2(x * 1.3 + 4, z * 1.3 + 6, 2, 44) > 0.56) color.lerp(moss, 0.35);
        color.offsetHSL(0, 0, (fbm2(x * 2, z * 2, 2, 13) - 0.5) * 0.08);
      } else {
        const depthMix = smoothstep(0.8, 4.0, depth);
        color.copy(rock).lerp(rockDark, 0.35 + depthMix * 0.15);
        if (fbm2(x * 0.95, z * 0.95, 3, 5) > 0.48) color.lerp(rockLight, 0.18);
        color.offsetHSL(0, 0, (fbm2(x * 2.3, z * 2.3, 2, 67) - 0.5) * 0.13);
      }

      colors.push(color.r, color.g, color.b);
    }
  }

  const stride = segments + 1;
  for (let ringIndex = 0; ringIndex < ringDefs.length - 1; ringIndex += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const a = ringIndex * stride + segment;
      const b = a + stride;
      // Outward-facing winding around the tapered body.
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createGrassTufts(quality: 'high' | 'low'): InstancedMesh {
  const blade = new ConeGeometry(0.026, 0.2, 3, 1);
  blade.translate(0, 0.1, 0);
  const blades: BufferGeometry[] = [];
  for (let i = 0; i < 3; i += 1) {
    const part = blade.clone();
    part.rotateZ((i - 1) * 0.28);
    part.rotateY((i * Math.PI * 2) / 3);
    part.translate((i - 1) * 0.026, 0, (i % 2) * 0.02);
    blades.push(part);
  }
  const tuft = mergeGeometries(blades, false) ?? blade;
  tuft.computeVertexNormals();

  const material = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
    flatShading: true,
    side: DoubleSide,
  });

  const count = quality === 'high' ? 260 : 130;
  const mesh = new InstancedMesh(tuft, material, count);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.name = 'grass-tufts';

  const random = new Rng(417);
  const matrix = new Matrix4();
  const quaternion = new Quaternion();
  const position = new Vector3();
  const scale = new Vector3();
  const color = new Color();

  const nearPath = (x: number, z: number): boolean => {
    const ax = 1.5;
    const az = 1.4;
    const bx = 2.72;
    const bz = 4.35;
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - (ax + dx * t), z - (az + dz * t)) < 0.46;
  };

  let placed = 0;
  let guard = 0;
  while (placed < count && guard < count * 40) {
    guard += 1;
    const angle = random.range(0, Math.PI * 2);
    const radial = Math.sqrt(random.next()) * 0.93;
    const x = Math.cos(angle) * boundaryRadius(angle) * radial;
    const z = Math.sin(angle) * boundaryRadius(angle) * radial;

    if (Math.hypot(x - HOUSE_CENTER.x, z - HOUSE_CENTER.z) < 1.85) continue;
    if (pondDistance(x, z) < 1.32) continue;
    if (Math.hypot(x - WINDMILL_CENTER.x, z - WINDMILL_CENTER.z) < 1.05) continue;
    if (nearPath(x, z)) continue;

    position.set(x, terrainHeight(x, z) - 0.01, z);
    quaternion.setFromAxisAngle(new Vector3(0, 1, 0), random.range(0, Math.PI * 2));
    const s = random.range(0.72, 1.35);
    scale.set(s, s * random.range(0.8, 1.25), s);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(placed, matrix);
    color.set(random.pick(['#819b67', '#728f5c', '#96ae7f', '#6a8558']));
    mesh.setColorAt(placed, color);
    placed += 1;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

function createRockOutcrops(materials: SceneMaterials): Group {
  const group = new Group();
  group.name = 'island-crags';
  const random = new Rng(1774);
  const geometry = new DodecahedronGeometry(1, 0);
  const spots = [
    { angle: 0.75, y: -1.3, radius: 0.93, scale: 0.48 },
    { angle: 2.35, y: -1.9, radius: 0.84, scale: 0.62 },
    { angle: 3.75, y: -2.45, radius: 0.7, scale: 0.52 },
    { angle: 5.15, y: -1.55, radius: 0.9, scale: 0.4 },
  ];

  for (const spot of spots) {
    const radius = boundaryRadius(spot.angle) * spot.radius;
    const rock = new Mesh(geometry, materials.rock);
    rock.position.set(
      Math.cos(spot.angle) * radius,
      spot.y,
      Math.sin(spot.angle) * radius,
    );
    rock.scale.set(
      spot.scale * random.range(0.8, 1.3),
      spot.scale * random.range(0.7, 1.4),
      spot.scale * random.range(0.8, 1.3),
    );
    rock.rotation.set(random.range(0, Math.PI), random.range(0, Math.PI), random.range(0, Math.PI));
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }
  return group;
}

function createHangingRoots(materials: SceneMaterials): Group {
  const group = new Group();
  group.name = 'hanging-roots';
  const random = new Rng(902);
  const angles = [0.55, 1.5, 2.5, 3.6, 5.0, 5.85];

  for (const angle of angles) {
    const radius = boundaryRadius(angle) * random.range(0.62, 0.86);
    const start = new Vector3(
      Math.cos(angle) * radius,
      random.range(-1.75, -2.5),
      Math.sin(angle) * radius,
    );
    const points = [
      start,
      start.clone().add(new Vector3(random.range(-0.25, 0.25), -random.range(0.5, 0.9), random.range(-0.25, 0.25))),
      start.clone().add(new Vector3(random.range(-0.4, 0.4), -random.range(0.9, 1.5), random.range(-0.4, 0.4))),
      start.clone().add(new Vector3(random.range(-0.5, 0.5), -random.range(1.4, 2.1), random.range(-0.5, 0.5))),
    ];
    const curve = new CatmullRomCurve3(points);
    const geometry = new TubeGeometry(curve, 12, random.range(0.02, 0.042), 4, false);
    const mesh = new Mesh(geometry, materials.woodDark);
    mesh.castShadow = true;
    group.add(mesh);
  }

  return group;
}

export { pondDistance };
