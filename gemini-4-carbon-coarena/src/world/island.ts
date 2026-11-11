import * as THREE from 'three';
import { createRng, fbm2D, fbm3D, lerp, smoothstep } from '../utils/math';
import { getProceduralTextures } from '../utils/textures';
import {
  getBrookFactor,
  getIslandOuterRadius,
  getIslandSurfaceHeight,
  ISLAND_BASE_RADIUS,
  LANDMARKS,
  POND_WATER_Y,
} from './terrainMath';

export interface IslandRig {
  group: THREE.Group;
  update: (elapsed: number, wind: number, rainAmount: number, dayFactor: number, reducedMotion: boolean) => void;
}

interface FloatingShard {
  mesh: THREE.Mesh;
  basePos: THREE.Vector3;
  bobAmp: number;
  bobSpeed: number;
  phase: number;
  rotAxis: THREE.Vector3;
}

export function createIsland(): IslandRig {
  const group = new THREE.Group();
  group.name = 'IslandGroup';

  const textures = getProceduralTextures();

  // 1. Grassy Top + Overhanging Turf Lip (polar concentric mesh matching exact irregular silhouette)
  const topGeo = buildMeadowTopGeometry();
  const meadowMat = new THREE.MeshStandardMaterial({
    map: textures.meadow,
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.02,
  });
  const topMesh = new THREE.Mesh(topGeo, meadowMat);
  topMesh.castShadow = true;
  topMesh.receiveShadow = true;
  topMesh.name = 'IslandMeadowTop';
  group.add(topMesh);

  // 2. Warm Earth / Soil Rim Collar tucked right under the overhanging turf lip
  const soilGeo = buildSoilRimGeometry();
  const soilMat = new THREE.MeshStandardMaterial({
    color: 0x7b563c,
    roughness: 0.94,
    metalness: 0.02,
    flatShading: true,
  });
  const soilMesh = new THREE.Mesh(soilGeo, soilMat);
  soilMesh.castShadow = true;
  soilMesh.receiveShadow = true;
  group.add(soilMesh);

  // 3. Sculpted Faceted Rocky Underside Spire
  const rockGeo = buildRockyUndersideGeometry();
  const rockMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.04,
    flatShading: true,
  });
  const rockMesh = new THREE.Mesh(rockGeo, rockMat);
  rockMesh.castShadow = true;
  rockMesh.receiveShadow = true;
  rockMesh.name = 'IslandRockUnderside';
  group.add(rockMesh);

  // 4. Hanging Root Tendrils & Cliff Moss Cushions beneath the rim
  addHangingRootsAndMoss(group, soilMat);

  // 5. Floating Miniature Satellite Rock Shards
  const shards = createFloatingShards(group, rockMat, meadowMat);

  return {
    group,
    update(elapsed, wind, rainAmount, _dayFactor, reducedMotion) {
      // Subtle wet sheen during rain
      meadowMat.roughness = lerp(0.88, 0.62, rainAmount);
      rockMat.roughness = lerp(0.9, 0.64, rainAmount);
      soilMat.roughness = lerp(0.94, 0.7, rainAmount);

      const motionScale = reducedMotion ? 0.12 : 1.0;
      for (const shard of shards) {
        const yOff =
          Math.sin(elapsed * shard.bobSpeed + shard.phase) * shard.bobAmp * motionScale;
        const xOff =
          Math.cos(elapsed * (shard.bobSpeed * 0.65) + shard.phase) *
          0.035 *
          (0.4 + wind) *
          motionScale;
        shard.mesh.position.set(
          shard.basePos.x + xOff,
          shard.basePos.y + yOff,
          shard.basePos.z
        );
        shard.mesh.rotation.y = Math.sin(elapsed * 0.35 + shard.phase) * 0.08 * motionScale;
      }
    },
  };
}

function buildMeadowTopGeometry(): THREE.BufferGeometry {
  const segs = 104;
  const innerRings = 48;
  // Extra 4 lip rings wrap smoothly over the outer edge to create a plush miniature turf lip
  const lipProfile: ReadonlyArray<readonly [number, number]> = [
    [1.012, -0.06],
    [1.024, -0.15],
    [1.015, -0.25],
    [0.985, -0.33],
  ];
  const totalRings = innerRings + lipProfile.length;

  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const colorGrassRich = new THREE.Color(0x78af5c);
  const colorGrassSun = new THREE.Color(0x95c56c);
  const colorGrassDeep = new THREE.Color(0x5c914b);
  const colorSand = new THREE.Color(0xebd7ae);
  const colorWetSand = new THREE.Color(0xc5ae84);
  const colorWetBed = new THREE.Color(0x5d7570);
  const colorPathTint = new THREE.Color(0xa69e74);
  const tmpColor = new THREE.Color();

  // Center vertex (index 0)
  const centerY = getIslandSurfaceHeight(0, 0);
  positions.push(0, centerY, 0);
  uvs.push(0.5, 0.5);
  colors.push(colorGrassRich.r, colorGrassRich.g, colorGrassRich.b);

  for (let rIdx = 1; rIdx <= totalRings; rIdx++) {
    const isLip = rIdx > innerRings;
    const lipStep = rIdx - innerRings - 1;

    for (let s = 0; s <= segs; s++) {
      const theta = (s / segs) * Math.PI * 2;
      const outerR = getIslandOuterRadius(theta);

      let radScale: number;
      let y: number;

      if (!isLip) {
        // Slightly denser rings near pond & rim
        const t = rIdx / innerRings;
        radScale = Math.pow(t, 0.92);
        const x = Math.cos(theta) * outerR * radScale;
        const z = Math.sin(theta) * outerR * radScale;
        y = getIslandSurfaceHeight(x, z);
      } else {
        const [lipScale, lipDrop] = lipProfile[lipStep];
        radScale = lipScale;
        const edgeX = Math.cos(theta) * outerR;
        const edgeZ = Math.sin(theta) * outerR;
        const rimSurfaceY = getIslandSurfaceHeight(edgeX * 0.98, edgeZ * 0.98);
        const lipWave = fbm2D(edgeX * 0.7 + 4.1, edgeZ * 0.7 - 2.2, 2) * 0.045;
        y = rimSurfaceY + lipDrop + lipWave;
      }

      const x = Math.cos(theta) * outerR * radScale;
      const z = Math.sin(theta) * outerR * radScale;

      positions.push(x, y, z);
      uvs.push(x / (ISLAND_BASE_RADIUS * 2) + 0.5, z / (ISLAND_BASE_RADIUS * 2) + 0.5);

      // Painterly vertex color blending
      const meadowNoise = fbm2D(x * 0.55 - 3.2, z * 0.55 + 5.4, 3) * 0.5 + 0.5;
      tmpColor.copy(colorGrassRich).lerp(colorGrassSun, smoothstep(0.28, 0.82, meadowNoise));

      // Higher knolls slightly warmer sunlit green
      const heightBoost = smoothstep(0.25, 0.88, y);
      tmpColor.lerp(colorGrassSun, heightBoost * 0.35);

      // Subtle worn earth apron right around cottage & windmill thresholds
      const nearMill = 1 - smoothstep(0.6, 1.35, Math.hypot(x + 2.22, z + 1.65));
      const nearHouse = 1 - smoothstep(0.85, 1.65, Math.hypot(x - 1.52, z + 0.68));
      tmpColor.lerp(colorPathTint, Math.max(nearMill, nearHouse) * 0.28);

      // Shoreline sand & submerged pond bed (masked strictly to pond & brook basin)
      if (!isLip) {
        const dxPond = (x - LANDMARKS.pond.x) / LANDMARKS.pond.rx;
        const dzPond = (z - LANDMARKS.pond.z) / LANDMARKS.pond.rz;
        const pondWarp = fbm2D(x * 0.85 + 7.1, z * 0.85 - 3.4, 3) * 0.14;
        const pondMask = 1 - smoothstep(0.92, 1.24, Math.hypot(dxPond, dzPond) + pondWarp);
        const basinMask = Math.max(pondMask, getBrookFactor(x, z));

        if (basinMask > 0.001) {
          const shoreBlend =
            (1 - smoothstep(POND_WATER_Y + 0.01, POND_WATER_Y + 0.24, y)) * basinMask;
          if (shoreBlend > 0.001) {
            tmpColor.lerp(colorSand, Math.min(1, shoreBlend * 1.08));
          }
          const waterlineBlend =
            (1 - smoothstep(POND_WATER_Y - 0.03, POND_WATER_Y + 0.04, y)) * basinMask;
          if (waterlineBlend > 0.001) {
            tmpColor.lerp(colorWetSand, waterlineBlend * 0.78);
          }
          const deepBlend =
            (1 - smoothstep(POND_WATER_Y - 0.36, POND_WATER_Y - 0.05, y)) * basinMask;
          if (deepBlend > 0.001) {
            tmpColor.lerp(colorWetBed, deepBlend * 0.9);
          }
        }
      }

      // Plush deeper moss green along overhanging turf edge
      const rimShade = isLip
        ? 0.42 + lipStep * 0.14
        : smoothstep(0.84, 1.0, radScale) * 0.32;
      tmpColor.lerp(colorGrassDeep, Math.min(0.85, rimShade));

      colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }

  const ringStride = segs + 1;

  // Fan triangles from center (0) to ring 1
  for (let s = 0; s < segs; s++) {
    const a = 1 + s;
    const b = 1 + s + 1;
    indices.push(0, b, a);
  }

  // Quad strips between consecutive rings
  for (let r = 1; r < totalRings; r++) {
    const rowCurr = 1 + (r - 1) * ringStride;
    const rowNext = 1 + r * ringStride;
    for (let s = 0; s < segs; s++) {
      const a = rowCurr + s;
      const b = rowCurr + s + 1;
      const c = rowNext + s;
      const d = rowNext + s + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildSoilRimGeometry(): THREE.BufferGeometry {
  const segs = 76;
  const rows = 3;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    for (let s = 0; s <= segs; s++) {
      const theta = (s / segs) * Math.PI * 2;
      const outerR = getIslandOuterRadius(theta);
      const edgeX = Math.cos(theta) * outerR;
      const edgeZ = Math.sin(theta) * outerR;
      const rimY = getIslandSurfaceHeight(edgeX * 0.98, edgeZ * 0.98);

      const jitter = fbm2D(edgeX * 1.1 + r * 3.1, edgeZ * 1.1 - r * 2.4, 2) * 0.08;
      const radScale = lerp(0.99, 0.945, v) + jitter * 0.025;
      const y = rimY - 0.27 - v * 0.34 + jitter * 0.06;

      positions.push(Math.cos(theta) * outerR * radScale, y, Math.sin(theta) * outerR * radScale);
    }
  }

  const stride = segs + 1;
  for (let r = 0; r < rows; r++) {
    for (let s = 0; s < segs; s++) {
      const a = r * stride + s;
      const b = a + 1;
      const c = (r + 1) * stride + s;
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildRockyUndersideGeometry(): THREE.BufferGeometry {
  const segs = 64;
  const levels = 16;
  const maxDepth = 4.45;

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const colorUpperStone = new THREE.Color(0xa6947e);
  const colorMidStone = new THREE.Color(0x82776e);
  const colorDeepSlate = new THREE.Color(0x52565e);
  const colorMossTint = new THREE.Color(0x5d7253);
  const tmpColor = new THREE.Color();

  for (let lvl = 0; lvl <= levels; lvl++) {
    const t = lvl / levels; // 0 at top under soil, 1 at bottom tip

    for (let s = 0; s <= segs; s++) {
      const theta = (s / segs) * Math.PI * 2;
      const outerR = getIslandOuterRadius(theta);
      const ux = Math.cos(theta);
      const uz = Math.sin(theta);

      if (lvl === levels) {
        // Crisp sculpted apex keel point (slightly off-center for natural asymmetry)
        positions.push(0.18, -maxDepth, -0.12);
        colors.push(colorDeepSlate.r, colorDeepSlate.g, colorDeepSlate.b);
        continue;
      }

      // Stepped sculptural taper curve with subtle rock ledges
      const ledgeStep = Math.sin(t * Math.PI * 5) * 0.032 * (1 - t);
      const baseScale = Math.pow(1 - t, 0.76) * 0.955 + ledgeStep;

      const worldRefX = ux * outerR * baseScale;
      const worldRefZ = uz * outerR * baseScale;
      const baseRimY = getIslandSurfaceHeight(ux * outerR * 0.96, uz * outerR * 0.96);

      const yRaw = lerp(baseRimY - 0.52, -maxDepth, Math.pow(t, 0.94));

      // Ridged geological facets + vertical cliff flutes
      const flute = Math.abs(Math.sin(theta * 7 + 0.4) * Math.cos(theta * 4 - 1.1));
      const ridge3 = 1 - Math.abs(fbm3D(worldRefX * 0.48 + 3.7, yRaw * 0.52, worldRefZ * 0.48 - 1.9, 3));
      const cragFactor = (ridge3 - 0.52) * 0.46 * Math.sin(t * Math.PI) + (flute - 0.35) * 0.14 * (1 - t * 0.6);

      const rFinal = Math.max(0.14, outerR * baseScale + cragFactor);
      const x = ux * rFinal + t * 0.18;
      const z = uz * rFinal - t * 0.12;
      const y = yRaw + (ridge3 - 0.5) * 0.16 * (1 - t);

      positions.push(x, y, z);

      // Geological strata vertex coloring
      tmpColor.copy(colorUpperStone).lerp(colorMidStone, smoothstep(0.08, 0.55, t));
      tmpColor.lerp(colorDeepSlate, smoothstep(0.48, 0.98, t));

      const strataBand = Math.sin(y * 3.8 + ridge3 * 2.2) * 0.5 + 0.5;
      tmpColor.offsetHSL(0, 0, (strataBand - 0.5) * 0.055);

      // Hints of cliff moss near upper damp crevices (especially near waterfall side)
      const cascadeProximity = 1 - smoothstep(0.8, 3.2, Math.hypot(x + 2.36, z - 3.92));
      const mossAmt = (1 - smoothstep(0.0, 0.45, t)) * (0.18 + cascadeProximity * 0.42) * ridge3;
      tmpColor.lerp(colorMossTint, mossAmt);

      colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }

  const stride = segs + 1;
  for (let lvl = 0; lvl < levels; lvl++) {
    for (let s = 0; s < segs; s++) {
      const a = lvl * stride + s;
      const b = a + 1;
      const c = (lvl + 1) * stride + s;
      const d = c + 1;
      indices.push(a, b, c);
      if (lvl < levels - 1) {
        indices.push(b, d, c);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function addHangingRootsAndMoss(parent: THREE.Group, rootMat: THREE.Material): void {
  const rng = createRng(8821);
  const mossMat = new THREE.MeshStandardMaterial({
    color: 0x5d8c4c,
    roughness: 0.92,
    flatShading: true,
  });

  // Hanging twisted root tendrils around the underside rim
  const rootAngles = [0.35, 1.15, 2.05, 2.85, 3.7, 4.55, 5.45];
  for (const baseAngle of rootAngles) {
    const theta = baseAngle + (rng() - 0.5) * 0.25;
    const r = getIslandOuterRadius(theta) * (0.87 + rng() * 0.06);
    const startX = Math.cos(theta) * r;
    const startZ = Math.sin(theta) * r;
    const startY = getIslandSurfaceHeight(startX, startZ) - 0.48;
    const len = 0.52 + rng() * 0.52;

    const pts = [
      new THREE.Vector3(startX, startY, startZ),
      new THREE.Vector3(
        startX * 0.89 + (rng() - 0.5) * 0.28,
        startY - len * 0.48,
        startZ * 0.89 + (rng() - 0.5) * 0.28
      ),
      new THREE.Vector3(
        startX * 0.78 + (rng() - 0.5) * 0.25,
        startY - len,
        startZ * 0.78 + (rng() - 0.5) * 0.25
      ),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const tubeGeo = new THREE.TubeGeometry(curve, 10, 0.042, 5, false);
    // Taper tube radius cleanly toward the tip
    const pos = tubeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const ringIdx = Math.floor(i / 6);
      const u = THREE.MathUtils.clamp(ringIdx / 10, 0, 1);
      const center = curve.getPoint(u);
      const taper = 1 - Math.pow(u, 0.85) * 0.84;
      pos.setXYZ(
        i,
        lerp(center.x, pos.getX(i), taper),
        lerp(center.y, pos.getY(i), taper),
        lerp(center.z, pos.getZ(i), taper)
      );
    }
    tubeGeo.computeVertexNormals();

    const rootMesh = new THREE.Mesh(tubeGeo, rootMat);
    rootMesh.castShadow = true;
    parent.add(rootMesh);

    // Small cliff moss cushion near root origin
    const mossGeo = new THREE.DodecahedronGeometry(0.18 + rng() * 0.1, 0);
    mossGeo.scale(1.3, 0.65, 1.1);
    const moss = new THREE.Mesh(mossGeo, mossMat);
    moss.position.set(startX * 1.03, startY + 0.18, startZ * 1.03);
    moss.rotation.set(rng() * 0.5, theta, rng() * 0.5);
    parent.add(moss);
  }
}

function createFloatingShards(
  parent: THREE.Group,
  rockMat: THREE.Material,
  meadowMat: THREE.Material
): FloatingShard[] {
  const rng = createRng(9931);
  const specs = [
    { x: -4.45, y: -1.95, z: 0.55, scale: 0.45, grassy: true },
    { x: 3.95, y: -2.65, z: 1.85, scale: 0.38, grassy: true },
    { x: -1.45, y: -4.85, z: -1.25, scale: 0.32, grassy: false },
    { x: 1.65, y: -4.45, z: 1.55, scale: 0.28, grassy: false },
    { x: 0.25, y: -5.35, z: 0.15, scale: 0.24, grassy: false },
  ];

  const shards: FloatingShard[] = [];

  for (const s of specs) {
    const shardGeo = new THREE.OctahedronGeometry(s.scale, 1);
    const pos = shardGeo.attributes.position;
    const colors: number[] = [];
    const cTop = new THREE.Color(0x9a8b78);
    const cBot = new THREE.Color(0x565962);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      let vx = pos.getX(i);
      let vy = pos.getY(i);
      let vz = pos.getZ(i);
      const n = 0.82 + (fbm3D(vx * 3.1 + s.x, vy * 3.1, vz * 3.1 + s.z, 2) * 0.5 + 0.5) * 0.36;
      vx *= n * 1.15;
      vz *= n * 1.05;
      if (vy < 0) vy *= 1.65; // Tapered underside crystal/crag look
      else vy *= s.grassy ? 0.16 : 0.62; // Flat top seat when crowned by turf cap
      pos.setXYZ(i, vx, vy, vz);

      tmp.copy(vy >= 0 ? cTop : cBot);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    shardGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    shardGeo.computeVertexNormals();

    const shardMesh = new THREE.Mesh(shardGeo, rockMat);
    shardMesh.castShadow = true;
    shardMesh.receiveShadow = true;
    shardMesh.position.set(s.x, s.y, s.z);

    if (s.grassy) {
      const capGeo = new THREE.CylinderGeometry(s.scale * 0.88, s.scale * 1.02, s.scale * 0.3, 10);
      const capColors: number[] = [];
      for (let i = 0; i < capGeo.attributes.position.count; i++) {
        capColors.push(0.49, 0.71, 0.38);
      }
      capGeo.setAttribute('color', new THREE.Float32BufferAttribute(capColors, 3));
      const cap = new THREE.Mesh(capGeo, meadowMat);
      cap.position.y = s.scale * 0.22;
      cap.receiveShadow = true;
      shardMesh.add(cap);
    }

    parent.add(shardMesh);
    shards.push({
      mesh: shardMesh,
      basePos: new THREE.Vector3(s.x, s.y, s.z),
      bobAmp: 0.08 + rng() * 0.07,
      bobSpeed: 0.9 + rng() * 0.55,
      phase: rng() * Math.PI * 2,
      rotAxis: new THREE.Vector3(0, 1, 0),
    });
  }

  return shards;
}
