import * as THREE from 'three';
import type { WorldMaterials } from './materials';
import {
  POND_ANCHOR,
  WATER_LEVEL,
  getIslandRadius,
  getPondNormalizedDist,
  getTerrainHeight,
  getUndersideDepth,
  smoothstep,
} from './terrainMath';

export interface IslandBundle {
  group: THREE.Group;
  update: (
    dt: number,
    elapsed: number,
    windStrength: number,
    rainAmount: number,
    nightFactor: number,
    sunsetFactor: number,
    reducedMotion: boolean,
  ) => void;
  dispose: () => void;
}

interface FloatingShard {
  mesh: THREE.Mesh;
  baseY: number;
  amplitude: number;
  speed: number;
  phase: number;
}

export function createIsland(materials: WorldMaterials): IslandBundle {
  const group = new THREE.Group();
  group.name = 'floating-island';
  const geometries: THREE.BufferGeometry[] = [];

  // 1. Grassy top surface with organic shoreline & pond depression
  const topGeo = buildIslandTopGeometry();
  geometries.push(topGeo);
  const topMesh = new THREE.Mesh(topGeo, materials.grassTop);
  topMesh.receiveShadow = true;
  topMesh.castShadow = true;
  group.add(topMesh);

  // 2. Thick scalloped overhanging turf lip
  const lipGeo = buildTurfLipGeometry();
  geometries.push(lipGeo);
  const lipMesh = new THREE.Mesh(lipGeo, materials.turfLip);
  lipMesh.castShadow = true;
  lipMesh.receiveShadow = true;
  group.add(lipMesh);

  // 3. Sculpted rocky underside tapering into a floating crag spire
  const rockGeo = buildRockyUndersideGeometry();
  geometries.push(rockGeo);
  const rockMesh = new THREE.Mesh(rockGeo, materials.rockUnderside);
  rockMesh.castShadow = true;
  rockMesh.receiveShadow = true;
  group.add(rockMesh);

  // 4. Translucent pond water surface fitted cleanly to the basin
  const waterGeo = buildPondWaterGeometry();
  geometries.push(waterGeo);
  const waterMesh = new THREE.Mesh(waterGeo, materials.pondWater);
  waterMesh.position.y = WATER_LEVEL;
  waterMesh.receiveShadow = true;
  group.add(waterMesh);

  // 5. Delicate hanging root tendrils tucked beneath the soil lip
  const roots = buildHangingRoots(materials, geometries);
  group.add(roots);

  // 6. Floating satellite rocklets hovering gently near the rocky underside
  const shards = buildFloatingShards(materials, geometries);
  for (const shard of shards) {
    group.add(shard.mesh);
  }

  const dayWaterColor = new THREE.Color(0x4d8290);
  const sunsetWaterColor = new THREE.Color(0x637185);
  const nightWaterColor = new THREE.Color(0x274159);
  const rainWaterColor = new THREE.Color(0x435e6d);
  const targetWaterColor = new THREE.Color();

  const update: IslandBundle['update'] = (
    dt,
    elapsed,
    windStrength,
    rainAmount,
    nightFactor,
    sunsetFactor,
    reducedMotion,
  ) => {
    // Gentle floating bob on satellite rocklets (disabled when reducedMotion is active)
    for (const shard of shards) {
      if (reducedMotion) {
        shard.mesh.position.y = shard.baseY;
      } else {
        shard.mesh.position.y =
          shard.baseY + Math.sin(elapsed * shard.speed + shard.phase) * shard.amplitude;
      }
    }

    // Subtle pond surface shimmer driven by wind + gentle time drift
    if (!reducedMotion) {
      const drift = (0.014 + windStrength * 0.055 + rainAmount * 0.025) * dt;
      materials.textures.waterBump.offset.x = (materials.textures.waterBump.offset.x + drift) % 1;
      materials.textures.waterBump.offset.y =
        (materials.textures.waterBump.offset.y + drift * 0.65) % 1;
    }

    // Adapt water palette smoothly to time of day and weather
    targetWaterColor.copy(dayWaterColor);
    targetWaterColor.lerp(sunsetWaterColor, sunsetFactor * 0.65);
    targetWaterColor.lerp(nightWaterColor, nightFactor * 0.85);
    targetWaterColor.lerp(rainWaterColor, rainAmount * 0.45);
    materials.pondWater.color.copy(targetWaterColor);
    materials.pondWater.roughness = 0.16 + rainAmount * 0.14;
    materials.pondWater.bumpScale = 0.014 + windStrength * 0.016 + rainAmount * 0.02;
  };

  return {
    group,
    update,
    dispose: () => {
      for (const geo of geometries) {
        geo.dispose();
      }
    },
  };
}

function buildIslandTopGeometry(): THREE.BufferGeometry {
  const radialSegs = 76;
  const ringSegs = 26;

  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const grassSun = new THREE.Color(0x88ab6e);
  const grassRich = new THREE.Color(0x6d935c);
  const grassEdge = new THREE.Color(0x5e8351);
  const shoreSand = new THREE.Color(0xcab998);
  const wetPebble = new THREE.Color(0x8e8677);
  const pondBed = new THREE.Color(0x4b6369);
  const tempColor = new THREE.Color();

  const pushVertex = (x: number, z: number, normR: number) => {
    const y = getTerrainHeight(x, z);
    positions.push(x, y, z);
    uvs.push(x * 0.14 + 0.5, z * 0.14 + 0.5);

    // Rich botanical color variation across hills, rim, and shoreline
    const hillBlend = smoothstep(0.18, 0.85, y);
    tempColor.copy(grassRich).lerp(grassSun, hillBlend);

    const microPatch =
      0.5 + 0.5 * Math.sin(x * 1.15 + 0.6) * Math.cos(z * 1.05 - 0.4);
    tempColor.lerp(grassSun, microPatch * 0.16);

    const edgeShade = smoothstep(0.75, 1.0, normR);
    tempColor.lerp(grassEdge, edgeShade * 0.45);

    const pondDist = getPondNormalizedDist(x, z);
    if (pondDist < 1.36) {
      const shoreBand = 1 - smoothstep(1.06, 1.34, pondDist);
      tempColor.lerp(shoreSand, shoreBand * 0.88);

      const wetBand = 1 - smoothstep(0.84, 1.08, pondDist);
      tempColor.lerp(wetPebble, wetBand * 0.72);

      const deepBand = 1 - smoothstep(0.32, 0.92, pondDist);
      tempColor.lerp(pondBed, deepBand * 0.88);
    }

    colors.push(tempColor.r, tempColor.g, tempColor.b);
  };

  // Center vertex (index 0)
  pushVertex(0, 0, 0);

  for (let r = 1; r <= ringSegs; r++) {
    const normR = r / ringSegs;
    // Slight bias toward more ring detail near the outer rim and mid-meadow
    const curvedR = Math.pow(normR, 0.94);
    for (let s = 0; s < radialSegs; s++) {
      const angle = (s / radialSegs) * Math.PI * 2;
      const radius = getIslandRadius(angle) * curvedR;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      pushVertex(x, z, curvedR);
    }
  }

  // Center fan
  for (let s = 0; s < radialSegs; s++) {
    const next = (s + 1) % radialSegs;
    indices.push(0, 1 + next, 1 + s);
  }

  // Concentric quads
  for (let r = 1; r < ringSegs; r++) {
    const innerStart = 1 + (r - 1) * radialSegs;
    const outerStart = 1 + r * radialSegs;
    for (let s = 0; s < radialSegs; s++) {
      const next = (s + 1) % radialSegs;
      const a = innerStart + s;
      const b = innerStart + next;
      const c = outerStart + next;
      const d = outerStart + s;
      indices.push(a, b, c, a, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildTurfLipGeometry(): THREE.BufferGeometry {
  const radialSegs = 76;
  const bands = [
    { rScale: 0.99, yOffset: 0.01 },
    { rScale: 1.022, yOffset: -0.09 },
    { rScale: 1.01, yOffset: -0.24 },
    { rScale: 0.94, yOffset: -0.34 },
  ];

  const positions: number[] = [];
  const indices: number[] = [];

  for (let b = 0; b < bands.length; b++) {
    const band = bands[b];
    for (let s = 0; s < radialSegs; s++) {
      const angle = (s / radialSegs) * Math.PI * 2;
      const edgeR = getIslandRadius(angle);
      const edgeX = Math.cos(angle) * edgeR;
      const edgeZ = Math.sin(angle) * edgeR;
      const topY = getTerrainHeight(edgeX, edgeZ);

      // Gentle scalloped turf overhang droop on lower bands
      const droop =
        b >= 2
          ? 0.08 * Math.sin(angle * 9 + 0.5) + 0.05 * Math.cos(angle * 13 - 0.8)
          : 0;

      const r = edgeR * band.rScale;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = topY + band.yOffset - Math.max(0, droop);
      positions.push(x, y, z);
    }
  }

  for (let b = 0; b < bands.length - 1; b++) {
    const rowA = b * radialSegs;
    const rowB = (b + 1) * radialSegs;
    for (let s = 0; s < radialSegs; s++) {
      const next = (s + 1) % radialSegs;
      const a = rowA + s;
      const bIdx = rowA + next;
      const c = rowB + next;
      const d = rowB + s;
      // Outward-facing CCW winding in polar (cos, sin) coordinates
      indices.push(a, bIdx, c, a, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildRockyUndersideGeometry(): THREE.BufferGeometry {
  const radialSegs = 44;
  const depthRings = 14;

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const soilColor = new THREE.Color(0x9a7a5e);
  const upperStone = new THREE.Color(0xb6a593);
  const midSlate = new THREE.Color(0x918a84);
  const deepSlate = new THREE.Color(0x707482);
  const tempColor = new THREE.Color();

  for (let d = 0; d < depthRings; d++) {
    const frac = d / (depthRings - 1); // 0 at top collar, 1 near tip
    const normR = Math.pow(1 - frac, 0.82); // shrinks cleanly toward the spire tip

    for (let s = 0; s < radialSegs; s++) {
      const angle = (s / radialSegs) * Math.PI * 2;
      const rimR = getIslandRadius(angle) * 0.945;

      // Sculpted rocky facets, strata steps, and natural spire taper
      const facet =
        1 +
        (0.08 * Math.sin(angle * 6 + frac * 5.2) +
          0.055 * Math.cos(angle * 9 - frac * 3.8)) *
          Math.sin(frac * Math.PI);

      // Subtle terraced geological ledges
      const strataStep = 0.055 * Math.sin(frac * Math.PI * 5);
      const r = Math.max(0.18, rimR * normR * (facet + strataStep * (1 - frac * 0.35)));

      // Slight offset of the bottom spire toward the cottage's visual center of mass
      const centerShiftX = -0.35 * frac * frac;
      const centerShiftZ = -0.15 * frac * frac;

      const x = Math.cos(angle) * r + centerShiftX;
      const z = Math.sin(angle) * r + centerShiftZ;

      let y: number;
      if (d === 0) {
        const edgeX = Math.cos(angle) * getIslandRadius(angle);
        const edgeZ = Math.sin(angle) * getIslandRadius(angle);
        y = getTerrainHeight(edgeX, edgeZ) - 0.16;
      } else {
        y = getUndersideDepth(angle, normR);
      }

      positions.push(x, y, z);

      // Rich strata vertex coloration: warm earth -> limestone -> cool underside slate
      if (frac < 0.22) {
        tempColor.copy(soilColor).lerp(upperStone, frac / 0.22);
      } else if (frac < 0.62) {
        tempColor.copy(upperStone).lerp(midSlate, (frac - 0.22) / 0.4);
      } else {
        tempColor.copy(midSlate).lerp(deepSlate, (frac - 0.62) / 0.38);
      }

      // Subtle crevice darkening for faceted sculptural contrast
      const cragShade = 0.88 + 0.12 * Math.sin(angle * 7 + frac * 4);
      tempColor.multiplyScalar(cragShade);
      colors.push(tempColor.r, tempColor.g, tempColor.b);
    }
  }

  // Bottom spire apex vertex
  const tipIndex = depthRings * radialSegs;
  positions.push(-0.38, -4.18, -0.18);
  colors.push(deepSlate.r * 0.88, deepSlate.g * 0.88, deepSlate.b * 0.92);

  // Side bands (outward-facing CCW winding)
  for (let d = 0; d < depthRings - 1; d++) {
    const rowA = d * radialSegs;
    const rowB = (d + 1) * radialSegs;
    for (let s = 0; s < radialSegs; s++) {
      const next = (s + 1) % radialSegs;
      const a = rowA + s;
      const b = rowA + next;
      const c = rowB + next;
      const dIdx = rowB + s;
      indices.push(a, b, c, a, c, dIdx);
    }
  }

  // Tip cap fan (outward-facing downward cone)
  const lastRow = (depthRings - 1) * radialSegs;
  for (let s = 0; s < radialSegs; s++) {
    const next = (s + 1) % radialSegs;
    indices.push(lastRow + s, lastRow + next, tipIndex);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  // Convert to non-indexed for crisp handcrafted low-poly rock facet lighting
  const faceted = geometry.toNonIndexed();
  geometry.dispose();
  faceted.computeVertexNormals();
  return faceted;
}

function buildPondWaterGeometry(): THREE.BufferGeometry {
  const segs = 48;
  const rings = 6;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const cos = Math.cos(POND_ANCHOR.rotation);
  const sin = Math.sin(POND_ANCHOR.rotation);

  positions.push(POND_ANCHOR.x, 0, POND_ANCHOR.z);
  uvs.push(0.5, 0.5);

  for (let r = 1; r <= rings; r++) {
    const t = (r / rings) * 1.07; // Extend slightly into shoreline rim so zero gaps show
    for (let s = 0; s < segs; s++) {
      const angle = (s / segs) * Math.PI * 2;
      const organicWobble =
        1 + 0.065 * Math.sin(angle * 3 + 0.7) + 0.045 * Math.cos(angle * 2 - 0.4);
      const lx = Math.cos(angle) * POND_ANCHOR.rx * organicWobble * t;
      const lz = Math.sin(angle) * POND_ANCHOR.rz * organicWobble * t;
      const wx = POND_ANCHOR.x + lx * cos - lz * sin;
      const wz = POND_ANCHOR.z + lx * sin + lz * cos;
      positions.push(wx, 0, wz);
      uvs.push(0.5 + (lx / (POND_ANCHOR.rx * 2.2)), 0.5 + (lz / (POND_ANCHOR.rz * 2.2)));
    }
  }

  for (let s = 0; s < segs; s++) {
    const next = (s + 1) % segs;
    indices.push(0, 1 + next, 1 + s);
  }

  for (let r = 1; r < rings; r++) {
    const innerStart = 1 + (r - 1) * segs;
    const outerStart = 1 + r * segs;
    for (let s = 0; s < segs; s++) {
      const next = (s + 1) % segs;
      indices.push(
        innerStart + s,
        innerStart + next,
        outerStart + next,
        innerStart + s,
        outerStart + next,
        outerStart + s,
      );
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildHangingRoots(
  materials: WorldMaterials,
  geometries: THREE.BufferGeometry[],
): THREE.Group {
  const rootGroup = new THREE.Group();
  const rootSpecs = [
    { angle: 0.45, length: 1.05, curl: 0.22 },
    { angle: 1.25, length: 0.85, curl: -0.18 },
    { angle: 2.15, length: 1.25, curl: 0.25 },
    { angle: 3.1, length: 0.95, curl: -0.2 },
    { angle: 4.35, length: 1.15, curl: 0.16 },
    { angle: 5.55, length: 0.88, curl: -0.24 },
  ];

  for (const spec of rootSpecs) {
    const edgeR = getIslandRadius(spec.angle) * 0.92;
    const x0 = Math.cos(spec.angle) * edgeR;
    const z0 = Math.sin(spec.angle) * edgeR;
    const outX = Math.cos(spec.angle);
    const outZ = Math.sin(spec.angle);
    const tanX = -outZ;
    const tanZ = outX;

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x0, -0.22, z0),
      new THREE.Vector3(
        x0 + outX * 0.12 + tanX * spec.curl * 0.5,
        -0.22 - spec.length * 0.42,
        z0 + outZ * 0.12 + tanZ * spec.curl * 0.5,
      ),
      new THREE.Vector3(
        x0 - outX * 0.14 + tanX * spec.curl,
        -0.22 - spec.length,
        z0 - outZ * 0.14 + tanZ * spec.curl,
      ),
    ]);

    const tubeGeo = new THREE.TubeGeometry(curve, 8, 0.042, 5, false);
    // Taper radius gently toward the bottom tip
    const pos = tubeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = smoothstep(-0.22, -0.22 - spec.length, y);
      const center = curve.getPoint(Math.min(1, Math.max(0, t)));
      const shrink = 1 - t * 0.72;
      pos.setXYZ(
        i,
        center.x + (pos.getX(i) - center.x) * shrink,
        center.y + (pos.getY(i) - center.y) * shrink,
        center.z + (pos.getZ(i) - center.z) * shrink,
      );
    }
    tubeGeo.computeVertexNormals();
    geometries.push(tubeGeo);

    const mesh = new THREE.Mesh(tubeGeo, materials.bark);
    mesh.castShadow = true;
    rootGroup.add(mesh);
  }

  return rootGroup;
}

function buildFloatingShards(
  materials: WorldMaterials,
  geometries: THREE.BufferGeometry[],
): FloatingShard[] {
  const shardSpecs = [
    { pos: new THREE.Vector3(-2.65, -2.55, 1.55), scale: [0.52, 0.72, 0.48], amp: 0.14, speed: 0.85, phase: 0.2 },
    { pos: new THREE.Vector3(2.8, -2.15, 1.85), scale: [0.42, 0.58, 0.38], amp: 0.11, speed: 1.05, phase: 2.1 },
    { pos: new THREE.Vector3(-0.35, -4.65, -0.15), scale: [0.36, 0.52, 0.34], amp: 0.12, speed: 0.72, phase: 4.0 },
    { pos: new THREE.Vector3(1.15, -3.55, -2.35), scale: [0.46, 0.62, 0.42], amp: 0.1, speed: 0.92, phase: 1.4 },
  ];

  const baseGeo = new THREE.DodecahedronGeometry(1, 0);
  // Add soft rock vertex colors so rockUnderside material shades them cohesively
  const posAttr = baseGeo.attributes.position;
  const colArr = new Float32Array(posAttr.count * 3);
  const topCol = new THREE.Color(0xa89a8c);
  const botCol = new THREE.Color(0x707482);
  const tmp = new THREE.Color();
  for (let i = 0; i < posAttr.count; i++) {
    const ny = posAttr.getY(i) * 0.5 + 0.5;
    tmp.copy(botCol).lerp(topCol, ny);
    colArr[i * 3] = tmp.r;
    colArr[i * 3 + 1] = tmp.g;
    colArr[i * 3 + 2] = tmp.b;
  }
  baseGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  geometries.push(baseGeo);

  return shardSpecs.map((spec, idx) => {
    const mesh = new THREE.Mesh(baseGeo, materials.rockUnderside);
    mesh.position.copy(spec.pos);
    mesh.scale.set(spec.scale[0], spec.scale[1], spec.scale[2]);
    mesh.rotation.set(idx * 0.7, idx * 1.2, idx * 0.4);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return {
      mesh,
      baseY: spec.pos.y,
      amplitude: spec.amp,
      speed: spec.speed,
      phase: spec.phase,
    };
  });
}
