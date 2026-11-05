import * as THREE from 'three';
import type { SceneContext } from '../environment/runtime';
import { seededRandom, smoothNoise, smoothstep } from '../utils/math';
import { makeGrassTuft, radialDisc } from '../utils/geometry';
import { makeRockTexture } from '../utils/textures';
import type { WorldMaterials } from './materials';
import { ISLAND_RADIUS, islandEdgeRadius, POND, pondDistance, terrainHeight } from './terrain';

const RIM_SEGMENTS = 96;

interface FloatingChunk {
  group: THREE.Group;
  baseY: number;
  phase: number;
  spin: number;
}

const buildTop = (): THREE.BufferGeometry => {
  const geometry = radialDisc(
    ISLAND_RADIUS,
    20,
    RIM_SEGMENTS,
    (angle) => islandEdgeRadius(angle) / ISLAND_RADIUS,
    (x, z) => terrainHeight(x, z) + 0.008 * Math.sin(x * 3.1 + z * 2.3)
  );
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const dark = new THREE.Color(0x5c7f49);
  const light = new THREE.Color(0x8cab66);
  const sun = new THREE.Color(0xa2b477);
  const sand = new THREE.Color(0xbcab84);
  const edge = new THREE.Color(0x557040);
  const color = new THREE.Color();

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const radius = Math.hypot(x, z);
    const edgeAngle = Math.atan2(z, x);
    const n = smoothNoise(x * 0.62 + 10.3, z * 0.62 - 2.7);
    const n2 = smoothNoise(x * 1.8 - 4.1, z * 1.8 + 7.2);
    color.copy(dark).lerp(light, n * 0.82 + n2 * 0.18);
    if (n2 > 0.62) color.lerp(sun, (n2 - 0.62) * 1.4);
    const pd = pondDistance(x, z);
    const shore = 1 - smoothstep(POND.radius * 0.92, POND.radius * 1.55, pd);
    color.lerp(sand, shore * 0.72);
    const rim = smoothstep(0.82, 1.0, radius / islandEdgeRadius(edgeAngle));
    color.lerp(edge, rim * 0.38);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
};

const buildRim = (): THREE.BufferGeometry => {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const layers = [
    { lift: 0, factor: 1.0 },
    { lift: -0.045, factor: 1.012 },
    { lift: -0.16, factor: 0.993 },
    { lift: -0.32, factor: 0.958 }
  ];
  const grass = new THREE.Color(0x5f7d48);
  const soilA = new THREE.Color(0x5c4734);
  const soilB = new THREE.Color(0x795b40);
  const scratch = new THREE.Color();
  for (let layer = 0; layer < layers.length; layer += 1) {
    const current = layers[layer]!;
    for (let i = 0; i < RIM_SEGMENTS; i += 1) {
      const angle = (i / RIM_SEGMENTS) * Math.PI * 2;
      const base = islandEdgeRadius(angle);
      const r = base * current.factor;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const h = terrainHeight(Math.cos(angle) * base, Math.sin(angle) * base);
      positions.push(x, h + current.lift, z);
      const noise = smoothNoise(angle * 2.4 + layer, layer);
      scratch.copy(soilA).lerp(soilB, noise);
      if (layer === 0) scratch.copy(grass).lerp(soilB, 0.32);
      else scratch.lerp(grass, Math.max(0, 1 - layer * 0.75) * 0.35);
      colors.push(scratch.r, scratch.g, scratch.b);
    }
  }
  for (let layer = 0; layer < layers.length - 1; layer += 1) {
    for (let i = 0; i < RIM_SEGMENTS; i += 1) {
      const next = (i + 1) % RIM_SEGMENTS;
      const a = layer * RIM_SEGMENTS + i;
      const b = layer * RIM_SEGMENTS + next;
      const c = (layer + 1) * RIM_SEGMENTS + i;
      const d = (layer + 1) * RIM_SEGMENTS + next;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

const buildUnderside = (): THREE.BufferGeometry => {
  const rings = [
    { depth: 0.22, factor: 0.998 },
    { depth: 0.42, factor: 1.045 },
    { depth: 0.66, factor: 0.985 },
    { depth: 0.94, factor: 1.052 },
    { depth: 1.28, factor: 0.965 },
    { depth: 1.66, factor: 0.86 },
    { depth: 2.02, factor: 0.9 },
    { depth: 2.42, factor: 0.69 },
    { depth: 2.82, factor: 0.55 },
    { depth: 3.22, factor: 0.4 },
    { depth: 3.58, factor: 0.27 },
    { depth: 3.9, factor: 0.14 }
  ];
  const random = seededRandom(91);
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const angleOffsets = new Float32Array(RIM_SEGMENTS);
  for (let i = 0; i < RIM_SEGMENTS; i += 1) {
    angleOffsets[i] = (random() - 0.5) * 0.22;
  }
  const moss = new THREE.Color(0x69794d);
  const soil = new THREE.Color(0x5f4b39);
  const rockWarm = new THREE.Color(0xb0a391);
  const rockMid = new THREE.Color(0x948777);
  const rockDeep = new THREE.Color(0x6e665c);
  const scratch = new THREE.Color();

  for (let ring = 0; ring < rings.length; ring += 1) {
    const current = rings[ring]!;
    for (let i = 0; i < RIM_SEGMENTS; i += 1) {
      const angle = (i / RIM_SEGMENTS) * Math.PI * 2;
      const shape = islandEdgeRadius(angle);
      const influence = Math.max(0, 1 - current.depth * 0.42);
      const baseRadius = THREE.MathUtils.lerp(ISLAND_RADIUS * 0.86, shape, influence);
      const ridge =
        1 +
        0.07 * Math.sin(angle * 4 + ring * 0.9) +
        0.04 * Math.sin(angle * 7 - ring * 0.45) +
        0.03 * Math.sin(angle * 11 + ring * 1.7) +
        angleOffsets[i]! * 0.075;
      const r = baseRadius * current.factor * ridge;
      const edgeH = terrainHeight(Math.cos(angle) * shape, Math.sin(angle) * shape);
      const y = edgeH - current.depth + 0.04 * Math.sin(angle * 5 + ring * 1.2);
      positions.push(Math.cos(angle) * r, y, Math.sin(angle) * r);
      uvs.push((i / RIM_SEGMENTS) * 5, current.depth * 0.36);
      const depthNorm = (current.depth - 0.2) / 3.7;
      if (depthNorm < 0.09) {
        scratch.copy(moss).lerp(soil, depthNorm / 0.09);
      } else if (depthNorm < 0.22) {
        scratch.copy(soil).lerp(rockWarm, (depthNorm - 0.09) / 0.13);
      } else {
        scratch.copy(rockWarm).lerp(rockMid, (depthNorm - 0.22) / 0.36);
        if (depthNorm > 0.6) scratch.lerp(rockDeep, (depthNorm - 0.6) / 0.4);
      }
      const stratum = Math.sin(current.depth * 5.2 + angle * 1.4) * 0.5 + 0.5;
      scratch.offsetHSL(0.006, -0.03, (stratum - 0.5) * 0.055);
      const shade = 0.8 + 0.38 * random();
      scratch.multiplyScalar(shade);
      colors.push(scratch.r, scratch.g, scratch.b);
    }
  }
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let i = 0; i < RIM_SEGMENTS; i += 1) {
      const next = (i + 1) % RIM_SEGMENTS;
      const a = ring * RIM_SEGMENTS + i;
      const b = ring * RIM_SEGMENTS + next;
      const c = (ring + 1) * RIM_SEGMENTS + i;
      const d = (ring + 1) * RIM_SEGMENTS + next;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  const tipY = terrainHeight(0, 0) - 4.35;
  const tipIndex = positions.length / 3;
  positions.push(0.16, tipY, -0.22);
  uvs.push(0.5, 1.45);
  scratch.copy(rockDeep).multiplyScalar(0.9);
  colors.push(scratch.r, scratch.g, scratch.b);
  const lastRing = (rings.length - 1) * RIM_SEGMENTS;
  for (let i = 0; i < RIM_SEGMENTS; i += 1) {
    const next = (i + 1) % RIM_SEGMENTS;
    indices.push(lastRing + i, lastRing + next, tipIndex);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

const buildRoot = (seed: number): { tube: THREE.Mesh; pivot: THREE.Group } => {
  const random = seededRandom(seed);
  const pivot = new THREE.Group();
  const startAngle = 1.9 + random() * 3.6;
  const baseR = islandEdgeRadius(startAngle) * 0.97;
  const startX = Math.cos(startAngle) * baseR;
  const startZ = Math.sin(startAngle) * baseR;
  const startY = terrainHeight(startX, startZ) - 0.12;
  pivot.position.set(startX, startY, startZ);
  const points: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0)];
  const length = 0.55 + random() * 0.7;
  const segments = 4;
  for (let i = 1; i <= segments; i += 1) {
    const t = i / segments;
    const outward = Math.sin(t * Math.PI) * (0.14 + random() * 0.13);
    points.push(
      new THREE.Vector3(
        (random() - 0.5) * 0.2 + outward * 0.1 * Math.sign(startX || 1),
        -length * t,
        (random() - 0.5) * 0.2 + outward * 0.1 * Math.sign(startZ || 1)
      )
    );
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 18, 0.024, 4, false),
    new THREE.MeshStandardMaterial({ color: 0x5a4331, roughness: 1 })
  );
  tube.castShadow = false;
  tube.receiveShadow = true;
  pivot.add(tube);
  const leafGeometry = new THREE.SphereGeometry(0.055, 5, 4);
  leafGeometry.scale(1, 0.25, 0.6);
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x728c52, roughness: 1 });
  for (let i = 0; i < 2; i += 1) {
    const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
    const tip = points[points.length - 1]!;
    leaf.position.set(tip.x + (random() - 0.5) * 0.1, tip.y + random() * 0.14, tip.z + (random() - 0.5) * 0.1);
    leaf.rotation.set(random() * 2, random() * 2, random() * 2);
    pivot.add(leaf);
  }
  pivot.userData.phase = random() * Math.PI * 2;
  return { tube, pivot };
};

const makeFloatingChunk = (
  x: number,
  y: number,
  z: number,
  scale: number,
  phase: number,
  materials: WorldMaterials
): FloatingChunk => {
  const group = new THREE.Group();
  const rockGeometry = new THREE.DodecahedronGeometry(0.62, 0);
  const rock = new THREE.Mesh(rockGeometry, materials.rock);
  rock.scale.set(scale * 1.05, scale * 0.95, scale);
  rock.rotation.set(0.4, phase, 0.2);
  group.add(rock);
  const grassGeometry = new THREE.CylinderGeometry(0.54 * scale, 0.46 * scale, 0.1 * scale, 9);
  const grassMaterial = new THREE.MeshStandardMaterial({
    color: 0x78965a,
    roughness: 1,
    flatShading: true
  });
  const grass = new THREE.Mesh(grassGeometry, grassMaterial);
  grass.position.y = 0.54 * scale;
  grass.rotation.y = phase;
  group.add(grass);
  const tuft = new THREE.Mesh(
    new THREE.ConeGeometry(0.06 * scale, 0.22 * scale, 4),
    new THREE.MeshStandardMaterial({ color: 0x8aa967, roughness: 1, flatShading: true })
  );
  tuft.position.set(0.2 * scale, 0.7 * scale, 0.12 * scale);
  group.add(tuft);
  group.position.set(x, y, z);
  return { group, baseY: y, phase, spin: 0.05 + scale * 0.06 };
};

export class Island {
  readonly group = new THREE.Group();
  private readonly floating: FloatingChunk[] = [];
  private readonly roots: THREE.Group[] = [];
  private readonly topMaterial: THREE.MeshStandardMaterial;

  constructor(materials: WorldMaterials) {
    this.group.name = 'island';
    this.topMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.97,
      metalness: 0
    });

    const top = new THREE.Mesh(buildTop(), this.topMaterial);
    top.receiveShadow = true;
    top.castShadow = false;
    this.group.add(top);

    const rim = new THREE.Mesh(buildRim(), materials.soil);
    rim.receiveShadow = true;
    this.group.add(rim);

    const rockMap = makeRockTexture();
    const rockBump = rockMap.clone();
    rockBump.colorSpace = THREE.NoColorSpace;
    rockBump.needsUpdate = true;
    const undersideMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: rockMap,
      bumpMap: rockBump,
      bumpScale: 0.12,
      roughness: 1,
      metalness: 0,
      flatShading: true
    });
    const underside = new THREE.Mesh(buildUnderside(), undersideMaterial);
    underside.receiveShadow = true;
    underside.castShadow = false;
    this.group.add(underside);

    const fringeGeometry = makeGrassTuft();
    const fringeMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide
    });
    const fringeCount = 170;
    const fringe = new THREE.InstancedMesh(fringeGeometry, fringeMaterial, fringeCount);
    fringe.castShadow = false;
    fringe.receiveShadow = true;
    const fringeRandom = seededRandom(771);
    const dummy = new THREE.Object3D();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const tangent = new THREE.Vector3();
    const yaw = new THREE.Quaternion();
    const tilt = new THREE.Quaternion();
    const greens = [new THREE.Color(0x6b8a4c), new THREE.Color(0x7d9b5a), new THREE.Color(0x5c7a42)];
    for (let i = 0; i < fringeCount; i += 1) {
      const angle = (i / fringeCount) * Math.PI * 2 + fringeRandom() * 0.02;
      const edge = islandEdgeRadius(angle);
      const x = Math.cos(angle) * edge * 0.996;
      const z = Math.sin(angle) * edge * 0.996;
      dummy.position.set(x, terrainHeight(x * 0.99, z * 0.99) + 0.008, z);
      yaw.setFromAxisAngle(yAxis, fringeRandom() * Math.PI * 2);
      tangent.set(-Math.sin(angle), 0, Math.cos(angle));
      tilt.setFromAxisAngle(tangent, 0.18 + fringeRandom() * 0.38);
      dummy.quaternion.copy(tilt).multiply(yaw);
      const scale = 0.6 + fringeRandom() * 0.75;
      dummy.scale.set(scale, scale * (0.7 + fringeRandom() * 0.7), scale);
      dummy.updateMatrix();
      fringe.setMatrixAt(i, dummy.matrix);
      fringe.setColorAt(i, greens[Math.floor(fringeRandom() * greens.length)]!);
    }
    this.group.add(fringe);

    for (let i = 0; i < 6; i += 1) {
      const root = buildRoot(31 + i * 17);
      this.roots.push(root.pivot);
      this.group.add(root.pivot);
    }

    const boulderGeometry = new THREE.DodecahedronGeometry(0.42, 0);
    for (let i = 0; i < 4; i += 1) {
      const angle = 0.8 + i * 1.55;
      const edge = islandEdgeRadius(angle);
      const boulder = new THREE.Mesh(boulderGeometry, materials.rock);
      boulder.position.set(
        Math.cos(angle) * edge * (0.7 + (i % 2) * 0.12),
        -1.3 - i * 0.25,
        Math.sin(angle) * edge * (0.7 + (i % 2) * 0.12)
      );
      boulder.scale.set(0.7 + (i % 3) * 0.15, 0.55 + (i % 2) * 0.2, 0.8);
      boulder.rotation.set(i * 0.7, i * 1.3, i * 0.4);
      boulder.castShadow = false;
      boulder.receiveShadow = true;
      this.group.add(boulder);
    }

    const spurGeometry = new THREE.DodecahedronGeometry(1, 0);
    const spurAngles = [0.55, 2.1, 3.5, 5.1, 5.85];
    for (let i = 0; i < spurAngles.length; i += 1) {
      const angle = spurAngles[i]!;
      const depth = 1.05 + (i % 3) * 0.4;
      const edge = islandEdgeRadius(angle);
      const spur = new THREE.Mesh(spurGeometry, materials.rock);
      spur.position.set(
        Math.cos(angle) * edge * (0.96 + i * 0.008),
        -depth,
        Math.sin(angle) * edge * (0.96 + i * 0.008)
      );
      spur.scale.set(0.32 + (i % 2) * 0.12, 0.55 + (i % 3) * 0.2, 0.3);
      spur.rotation.set(angle * 0.8, angle * 2.1, angle * 1.3);
      spur.castShadow = false;
      spur.receiveShadow = true;
      this.group.add(spur);
    }

    const chunkA = makeFloatingChunk(-5.35, -2.7, -1.2, 0.66, 1.4, materials);
    const chunkB = makeFloatingChunk(5.35, -3.2, 2.1, 0.46, 3.8, materials);
    this.floating.push(chunkA, chunkB);
    this.group.add(chunkA.group, chunkB.group);
  }

  update(ctx: SceneContext): void {
    const motion = ctx.reducedMotion ? 0.35 : 1;
    for (const chunk of this.floating) {
      chunk.group.position.y =
        chunk.baseY + Math.sin(ctx.time * 0.55 + chunk.phase) * 0.09 * motion;
      chunk.group.rotation.y += ctx.delta * chunk.spin * (0.4 + ctx.wind) * motion;
    }
    for (let i = 0; i < this.roots.length; i += 1) {
      const root = this.roots[i]!;
      const phase = root.userData.phase as number;
      root.rotation.z = Math.sin(ctx.time * 0.8 + phase) * 0.02 * (0.25 + ctx.wind) * motion;
      root.rotation.x = Math.cos(ctx.time * 0.65 + phase) * 0.014 * (0.25 + ctx.wind) * motion;
    }
  }
}
