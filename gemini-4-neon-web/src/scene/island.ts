import * as THREE from "three";
import { AtmosphereSnapshot, clamp, smoothstep } from "../state/worldState";
import {
  WATER_LEVEL,
  LANDMARKS,
  createRng,
  fbm2D,
  getDistanceToPath,
  getIslandRadiusAtAngle,
  getIslandTopHeight,
  getIslandUndersideHeight,
  getPondMetric,
} from "./terrainMath";
import { ProceduralTextures } from "./textures";

export interface IslandSystem {
  group: THREE.Group;
  waterMaterial: THREE.ShaderMaterial;
  update: (elapsed: number, dt: number, atmosphere: AtmosphereSnapshot, windStrength: number, reducedMotion: boolean) => void;
  dispose: () => void;
}

interface FloatingRock {
  mesh: THREE.Mesh;
  baseY: number;
  phase: number;
  amp: number;
  rotSpeed: number;
}

interface ReedTuft {
  group: THREE.Group;
  phase: number;
  baseRotZ: number;
}

function buildTopTerrainGeometry(): THREE.BufferGeometry {
  const radialSegs = 40;
  const angularSegs = 84;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const lushGreen = new THREE.Color(0x7fa368);
  const meadowMid = new THREE.Color(0x698f58);
  const mossEdge = new THREE.Color(0x527347);
  const warmPath = new THREE.Color(0xc4b393);
  const sandShore = new THREE.Color(0xd5c4a1);
  const wetShore = new THREE.Color(0x9a8f76);
  const pondBed = new THREE.Color(0x3f616e);
  const tmpColor = new THREE.Color();

  const pushVertex = (x: number, y: number, z: number, normR: number) => {
    positions.push(x, y, z);
    uvs.push(x * 0.14 + 0.5, z * 0.14 + 0.5);

    const n = fbm2D(x * 0.36 + 5.2, z * 0.36 - 2.9, 2) * 0.5 + 0.5;
    tmpColor.copy(meadowMid).lerp(lushGreen, clamp(n * 0.9 + (y - 0.25) * 0.55, 0, 1));

    // Slightly deeper mossy tone near the island cliff rim
    const edgeTint = smoothstep(0.76, 1.0, normR);
    tmpColor.lerp(mossEdge, edgeTint * 0.65);

    // Subtle worn soil tint beneath flagstone path
    const pathDist = getDistanceToPath(x, z);
    if (pathDist < 0.78) {
      const pathMask = 1 - smoothstep(0.24, 0.78, pathDist);
      tmpColor.lerp(warmPath, pathMask * 0.55);
    }

    // Visible sandy-pebble shoreline and recessed pond bed
    const pondM = getPondMetric(x, z);
    if (pondM < 1.32) {
      const shoreBand = 1 - smoothstep(0.95, 1.28, pondM);
      tmpColor.lerp(sandShore, shoreBand * 0.85);
      if (y < WATER_LEVEL + 0.08) {
        const wetMask = smoothstep(WATER_LEVEL + 0.08, WATER_LEVEL - 0.12, y);
        tmpColor.lerp(wetShore, wetMask * 0.72);
      }
      if (y < WATER_LEVEL - 0.08) {
        const bedMask = smoothstep(WATER_LEVEL - 0.08, WATER_LEVEL - 0.48, y);
        tmpColor.lerp(pondBed, bedMask * 0.88);
      }
    }

    colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
  };

  // Center vertex (index 0)
  pushVertex(0, getIslandTopHeight(0, 0), 0, 0);

  for (let r = 1; r <= radialSegs; r++) {
    const normR = r / radialSegs;
    for (let a = 0; a < angularSegs; a++) {
      const theta = (a / angularSegs) * Math.PI * 2;
      const radius = getIslandRadiusAtAngle(theta) * normR;
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      const y = getIslandTopHeight(x, z);
      pushVertex(x, y, z, normR);
    }
  }

  // Center fan triangles
  for (let a = 0; a < angularSegs; a++) {
    const next = (a + 1) % angularSegs;
    indices.push(0, 1 + next, 1 + a);
  }

  // Concentric rings
  for (let r = 1; r < radialSegs; r++) {
    const ringStart = 1 + (r - 1) * angularSegs;
    const nextRingStart = 1 + r * angularSegs;
    for (let a = 0; a < angularSegs; a++) {
      const next = (a + 1) % angularSegs;
      const v00 = ringStart + a;
      const v01 = ringStart + next;
      const v10 = nextRingStart + a;
      const v11 = nextRingStart + next;
      indices.push(v00, v01, v11);
      indices.push(v00, v11, v10);
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

function buildTurfSkirtGeometry(): THREE.BufferGeometry {
  // Thick mossy overhang collar bridging the top grass edge to the rocky cliff rim
  const segs = 84;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const topCol = new THREE.Color(0x527347);
  const rimCol = new THREE.Color(0x45633e);
  const soilCol = new THREE.Color(0x6e5a49);

  for (let a = 0; a < segs; a++) {
    const theta = (a / segs) * Math.PI * 2;
    const r = getIslandRadiusAtAngle(theta);
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const xTop = cos * r;
    const zTop = sin * r;
    const yTop = getIslandTopHeight(xTop, zTop);

    // Slight cushion overhang outward then tucked inward into the cliff top
    const wave = 0.08 * Math.sin(theta * 9 + 0.7) + 0.05 * Math.cos(theta * 13);
    const rMid = r + 0.14;
    const yMid = yTop - 0.16 + wave * 0.35;
    const rBot = r - 0.14;
    const yBot = yTop - 0.46 + wave;

    const u = a / segs;
    positions.push(xTop, yTop + 0.01, zTop);
    colors.push(topCol.r, topCol.g, topCol.b);
    uvs.push(u * 8, 0);

    positions.push(cos * rMid, yMid, sin * rMid);
    colors.push(rimCol.r, rimCol.g, rimCol.b);
    uvs.push(u * 8, 0.5);

    positions.push(cos * rBot, yBot, sin * rBot);
    colors.push(soilCol.r, soilCol.g, soilCol.b);
    uvs.push(u * 8, 1);
  }

  for (let a = 0; a < segs; a++) {
    const next = (a + 1) % segs;
    const i0 = a * 3;
    const j0 = next * 3;
    // Upper overhang band
    indices.push(i0, j0, j0 + 1);
    indices.push(i0, j0 + 1, i0 + 1);
    // Lower tucked lip
    indices.push(i0 + 1, j0 + 1, j0 + 2);
    indices.push(i0 + 1, j0 + 2, i0 + 2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildRockyUndersideGeometry(): THREE.BufferGeometry {
  const depthRings = 16;
  const angularSegs = 44;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const upperLimestone = new THREE.Color(0x9d8a77);
  const midOchreStone = new THREE.Color(0x7c6f64);
  const deepSlate = new THREE.Color(0x524c50);
  const cragTip = new THREE.Color(0x3f3c44);
  const tmpColor = new THREE.Color();

  // Offset spire slightly for sculptural hand-carved asymmetry
  const spireOffsetX = -0.35;
  const spireOffsetZ = -0.22;

  for (let r = 0; r <= depthRings; r++) {
    // Keep upper cliff chunky near the rim before tapering organically into the sculpted rock keel
    const progress = r / depthRings;
    const normR = Math.pow(1 - progress, 0.58);

    for (let a = 0; a < angularSegs; a++) {
      const theta = (a / angularSegs) * Math.PI * 2;
      const baseRadius = getIslandRadiusAtAngle(theta) * 0.99;
      // Add sculpted rock facet irregularity along depth
      const facet =
        1 +
        0.11 * Math.sin(theta * 5 + progress * 4.2) * Math.sin(progress * Math.PI) +
        0.075 * Math.cos(theta * 8 - progress * 5.0) * Math.sin(progress * Math.PI);
      const radius = Math.max(0.08, baseRadius * normR * facet);

      const x = Math.cos(theta) * radius + spireOffsetX * Math.pow(progress, 1.35);
      const z = Math.sin(theta) * radius + spireOffsetZ * Math.pow(progress, 1.35);

      let y: number;
      if (r === 0) {
        // Tuck seamlessly under the grass turf skirt
        y = getIslandTopHeight(Math.cos(theta) * baseRadius, Math.sin(theta) * baseRadius) - 0.3;
      } else {
        y = getIslandUndersideHeight(1 - progress, theta);
      }

      positions.push(x, y, z);
      uvs.push((a / angularSegs) * 4, progress * 2.5);

      // Stratified geological color variation
      const strataBand = Math.sin(progress * Math.PI * 6.5 + Math.sin(theta * 3) * 0.5) * 0.5 + 0.5;
      if (progress < 0.38) {
        tmpColor.copy(upperLimestone).lerp(midOchreStone, progress / 0.38);
      } else if (progress < 0.78) {
        tmpColor.copy(midOchreStone).lerp(deepSlate, (progress - 0.38) / 0.4);
      } else {
        tmpColor.copy(deepSlate).lerp(cragTip, (progress - 0.78) / 0.22);
      }
      tmpColor.offsetHSL(0, 0, (strataBand - 0.5) * 0.055);
      colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }

  // Bottom spire vertex
  const tipIdx = (depthRings + 1) * angularSegs;
  positions.push(spireOffsetX, -5.85, spireOffsetZ);
  colors.push(cragTip.r, cragTip.g, cragTip.b);
  uvs.push(0.5, 3.0);

  for (let r = 0; r < depthRings; r++) {
    const rowA = r * angularSegs;
    const rowB = (r + 1) * angularSegs;
    for (let a = 0; a < angularSegs; a++) {
      const next = (a + 1) % angularSegs;
      const v00 = rowA + a;
      const v01 = rowA + next;
      const v10 = rowB + a;
      const v11 = rowB + next;
      // Outward facing downward-sloped normals
      indices.push(v00, v01, v11);
      indices.push(v00, v11, v10);
    }
  }

  const lastRow = depthRings * angularSegs;
  for (let a = 0; a < angularSegs; a++) {
    const next = (a + 1) % angularSegs;
    indices.push(lastRow + a, lastRow + next, tipIdx);
  }

  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  indexed.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  indexed.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  indexed.setIndex(indices);

  // Convert to non-indexed for crisp hand-carved faceted limestone planes!
  const faceted = indexed.toNonIndexed();
  indexed.dispose();
  faceted.computeVertexNormals();
  return faceted;
}

function buildPondWaterMesh(): { mesh: THREE.Mesh; material: THREE.ShaderMaterial } {
  // Polar disc shaped to match the kidney pond contour cleanly with zero jagged clipping
  const radialSegs = 20;
  const angularSegs = 56;
  const positions: number[] = [];
  const uvs: number[] = [];
  const shoreDistAttr: number[] = [];
  const indices: number[] = [];

  const cx = LANDMARKS.pond.x;
  const cz = LANDMARKS.pond.z;
  const rot = LANDMARKS.pond.rot;
  const cosR = Math.cos(-rot);
  const sinR = Math.sin(-rot);

  // Find pond boundary distance for each angle by binary search on getPondMetric === 1.03
  const boundaryPoints: Array<[number, number]> = [];
  for (let a = 0; a < angularSegs; a++) {
    const ang = (a / angularSegs) * Math.PI * 2;
    const dirX = Math.cos(ang);
    const dirZ = Math.sin(ang);
    let lo = 0.2;
    let hi = 3.2;
    for (let iter = 0; iter < 12; iter++) {
      const mid = (lo + hi) * 0.5;
      const wx = cx + (dirX * mid * cosR - dirZ * mid * sinR);
      const wz = cz + (dirX * mid * sinR + dirZ * mid * cosR);
      if (getPondMetric(wx, wz) < 1.03) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    const r = lo;
    const wx = cx + (dirX * r * cosR - dirZ * r * sinR);
    const wz = cz + (dirX * r * sinR + dirZ * r * cosR);
    boundaryPoints.push([wx, wz]);
  }

  positions.push(cx, WATER_LEVEL, cz);
  uvs.push(0.5, 0.5);
  shoreDistAttr.push(0.0);

  for (let r = 1; r <= radialSegs; r++) {
    const t = r / radialSegs;
    for (let a = 0; a < angularSegs; a++) {
      const [bx, bz] = boundaryPoints[a];
      const wx = cx + (bx - cx) * t;
      const wz = cz + (bz - cz) * t;
      positions.push(wx, WATER_LEVEL, wz);
      uvs.push((wx - cx) * 0.25 + 0.5, (wz - cz) * 0.25 + 0.5);
      shoreDistAttr.push(t);
    }
  }

  for (let a = 0; a < angularSegs; a++) {
    const next = (a + 1) % angularSegs;
    indices.push(0, 1 + next, 1 + a);
  }
  for (let r = 1; r < radialSegs; r++) {
    const rowA = 1 + (r - 1) * angularSegs;
    const rowB = 1 + r * angularSegs;
    for (let a = 0; a < angularSegs; a++) {
      const next = (a + 1) % angularSegs;
      indices.push(rowA + a, rowA + next, rowB + next);
      indices.push(rowA + a, rowB + next, rowB + a);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("aShore", new THREE.Float32BufferAttribute(shoreDistAttr, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uWind: { value: 0.3 },
      uDeepColor: { value: new THREE.Color(0x4a7b94) },
      uShallowColor: { value: new THREE.Color(0x7aa7b5) },
      uSkyColor: { value: new THREE.Color(0xead9c3) },
      uSunDir: { value: new THREE.Vector3(0.6, 0.5, 0.5) },
      uSunColor: { value: new THREE.Color(0xffe1b0) },
      uSunIntensity: { value: 1.5 },
    },
    vertexShader: /* glsl */ `
      attribute float aShore;
      uniform float uTime;
      uniform float uWind;
      varying float vShore;
      varying vec3 vWorldPos;
      varying vec2 vUv;

      void main() {
        vShore = aShore;
        vUv = uv;
        vec3 pos = position;
        float waveAmp = (0.008 + uWind * 0.016) * (1.0 - aShore * 0.75);
        pos.y += sin(pos.x * 3.4 + uTime * 1.8) * cos(pos.z * 2.9 - uTime * 1.4) * waveAmp;
        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uWind;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      uniform vec3 uSkyColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uSunIntensity;
      varying float vShore;
      varying vec3 vWorldPos;
      varying vec2 vUv;

      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPos);

        // Animated micro-normal for sparkling miniature pond shimmer
        float speed = 0.7 + uWind * 1.8;
        float nx = cos(vWorldPos.x * 5.2 + uTime * speed) * 0.045 +
                   sin((vWorldPos.x + vWorldPos.z) * 8.5 - uTime * speed * 1.3) * 0.025;
        float nz = sin(vWorldPos.z * 4.8 - uTime * speed * 0.9) * 0.045 +
                   cos((vWorldPos.x - vWorldPos.z) * 7.8 + uTime * speed * 1.1) * 0.025;
        vec3 N = normalize(vec3(nx, 1.0, nz));

        float fresnel = pow(1.0 - clamp(dot(viewDir, N), 0.0, 1.0), 3.0);
        vec3 baseWater = mix(uDeepColor, uShallowColor, smoothstep(0.35, 0.96, vShore));
        vec3 color = mix(baseWater, uSkyColor, clamp(fresnel * 0.52 + 0.08, 0.0, 0.68));

        // Gentle sun/moon specular glint
        vec3 halfVec = normalize(normalize(uSunDir) + viewDir);
        float spec = pow(max(dot(N, halfVec), 0.0), 48.0) * clamp(uSunIntensity * 0.35, 0.08, 0.72);
        color += uSunColor * spec;

        // Soft animated shoreline foam kiss
        float foamWave = sin(vWorldPos.x * 7.0 + vWorldPos.z * 6.0 - uTime * 1.6) * 0.025;
        float foam = smoothstep(0.86 + foamWave, 0.975, vShore);
        vec3 foamTint = mix(vec3(0.92, 0.95, 0.96), uSkyColor, 0.35);
        color = mix(color, foamTint, foam * 0.42);

        // Soft alpha near exact bank edge so water blends cleanly into damp sand
        float alpha = mix(0.88, 0.48, smoothstep(0.88, 1.0, vShore));
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.renderOrder = 2;
  mesh.receiveShadow = false;
  return { mesh, material };
}

export function createIsland(textures: ProceduralTextures): IslandSystem {
  const group = new THREE.Group();
  group.name = "FloatingIsland";
  const disposables: Array<{ dispose: () => void }> = [];

  // 1. Grassy top terrain
  const topGeo = buildTopTerrainGeometry();
  const topMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.0,
    bumpMap: textures.grassBump,
    bumpScale: 0.035,
  });
  const topMesh = new THREE.Mesh(topGeo, topMat);
  topMesh.receiveShadow = true;
  topMesh.castShadow = true;
  group.add(topMesh);
  disposables.push(topGeo, topMat);

  // 2. Lush beveled turf skirt lip
  const skirtGeo = buildTurfSkirtGeometry();
  const skirtMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.0,
    bumpMap: textures.grassBump,
    bumpScale: 0.04,
  });
  const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
  skirtMesh.receiveShadow = true;
  skirtMesh.castShadow = true;
  group.add(skirtMesh);
  disposables.push(skirtGeo, skirtMat);

  // 3. Sculpted faceted rocky underside
  const undersideGeo = buildRockyUndersideGeometry();
  const undersideMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.04,
    bumpMap: textures.rockBump,
    bumpScale: 0.09,
    flatShading: true,
  });
  const undersideMesh = new THREE.Mesh(undersideGeo, undersideMat);
  undersideMesh.castShadow = true;
  undersideMesh.receiveShadow = true;
  group.add(undersideMesh);
  disposables.push(undersideGeo, undersideMat);

  // 4. Secondary sculptural underside rock spurs & tiny bobbing floating pebbles
  const rng = createRng(777);
  const spurMat = new THREE.MeshStandardMaterial({
    color: 0x736862,
    roughness: 0.88,
    metalness: 0.04,
    bumpMap: textures.rockBump,
    bumpScale: 0.07,
    flatShading: true,
  });
  disposables.push(spurMat);

  const spurSpecs = [
    { x: -3.1, y: -2.4, z: 2.0, sx: 1.4, sy: 1.65, sz: 1.25, rz: 0.16 },
    { x: 3.1, y: -2.3, z: -1.5, sx: 1.35, sy: 1.65, sz: 1.2, rz: -0.15 },
    { x: 1.9, y: -2.95, z: 2.1, sx: 1.3, sy: 1.55, sz: 1.15, rz: 0.1 },
    { x: -1.0, y: -3.3, z: 2.8, sx: 1.2, sy: 1.5, sz: 1.1, rz: -0.06 },
  ];
  const spurGeo = new THREE.CylinderGeometry(0.92, 0.28, 1.9, 6);
  disposables.push(spurGeo);
  for (const s of spurSpecs) {
    const m = new THREE.Mesh(spurGeo, spurMat);
    m.position.set(s.x, s.y, s.z);
    m.scale.set(s.sx, s.sy, s.sz);
    m.rotation.set((rng() - 0.5) * 0.2, rng() * Math.PI, s.rz);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }

  // Tiny floating satellite pebbles drifting softly below the island
  const floatingRocks: FloatingRock[] = [];
  const pebbleGeo = new THREE.DodecahedronGeometry(0.45, 0);
  disposables.push(pebbleGeo);
  const floatSpecs = [
    { x: -4.2, y: -4.1, z: 3.4, s: 0.65, amp: 0.14, phase: 0.2 },
    { x: 3.7, y: -4.5, z: 2.5, s: 0.52, amp: 0.18, phase: 2.1 },
    { x: 0.6, y: -6.45, z: -0.9, s: 0.48, amp: 0.12, phase: 4.0 },
    { x: -2.3, y: -5.3, z: -3.1, s: 0.4, amp: 0.16, phase: 5.2 },
  ];
  for (const fs of floatSpecs) {
    const m = new THREE.Mesh(pebbleGeo, spurMat);
    m.position.set(fs.x, fs.y, fs.z);
    m.scale.set(fs.s * 1.15, fs.s * 0.78, fs.s);
    m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    m.castShadow = true;
    group.add(m);
    floatingRocks.push({
      mesh: m,
      baseY: fs.y,
      phase: fs.phase,
      amp: fs.amp,
      rotSpeed: 0.12 + rng() * 0.14,
    });
  }

  // 5. Pond water surface
  const water = buildPondWaterMesh();
  group.add(water.mesh);
  disposables.push(water.mesh.geometry, water.material);

  // 6. Mini weathered wooden dock extending into the pond
  const dockGroup = new THREE.Group();
  dockGroup.position.set(LANDMARKS.dock.x, WATER_LEVEL + 0.14, LANDMARKS.dock.z);
  dockGroup.rotation.y = LANDMARKS.dock.rotationY;

  const dockWoodMat = new THREE.MeshStandardMaterial({
    color: 0xb0865c,
    map: textures.woodMap,
    bumpMap: textures.woodBump,
    bumpScale: 0.03,
    roughness: 0.84,
    metalness: 0.02,
  });
  const dockPostMat = new THREE.MeshStandardMaterial({
    color: 0x7b5b3e,
    roughness: 0.9,
    metalness: 0.02,
  });
  disposables.push(dockWoodMat, dockPostMat);

  // Support stringers
  const stringerGeo = new THREE.BoxGeometry(1.18, 0.06, 0.08);
  disposables.push(stringerGeo);
  for (const zOff of [-0.26, 0.26]) {
    const st = new THREE.Mesh(stringerGeo, dockPostMat);
    st.position.set(0.32, -0.04, zOff);
    st.castShadow = true;
    dockGroup.add(st);
  }
  // 6 wooden deck planks
  const plankGeo = new THREE.BoxGeometry(0.17, 0.045, 0.78);
  disposables.push(plankGeo);
  for (let i = 0; i < 6; i++) {
    const plank = new THREE.Mesh(plankGeo, dockWoodMat);
    plank.position.set(-0.16 + i * 0.2, 0.01 + (i % 2) * 0.004, (rng() - 0.5) * 0.02);
    plank.rotation.y = (rng() - 0.5) * 0.03;
    plank.castShadow = true;
    plank.receiveShadow = true;
    dockGroup.add(plank);
  }
  // 4 grounded pilings reaching into the pond bed
  const postGeo = new THREE.CylinderGeometry(0.055, 0.062, 0.92, 8);
  disposables.push(postGeo);
  const postCoords: Array<[number, number, number]> = [
    [-0.1, -0.22, -0.32],
    [-0.1, -0.22, 0.32],
    [0.82, -0.24, -0.32],
    [0.82, -0.14, 0.32], // slightly taller mooring post
  ];
  for (const [px, py, pz] of postCoords) {
    const post = new THREE.Mesh(postGeo, dockPostMat);
    post.position.set(px, py, pz);
    post.castShadow = true;
    dockGroup.add(post);
  }
  group.add(dockGroup);

  // 7. Shoreline stones, lily pads, and reeds around the pond
  const stoneGeo = new THREE.DodecahedronGeometry(0.22, 1);
  const shoreStoneMat = new THREE.MeshStandardMaterial({
    color: 0x9b958b,
    roughness: 0.85,
    metalness: 0.03,
    flatShading: true,
  });
  disposables.push(stoneGeo, shoreStoneMat);

  const shoreStoneAngles = [0.2, 0.55, 0.95, 1.45, 2.1, 2.55, 3.4, 3.85, 4.4, 5.1, 5.65, 6.05];
  for (let i = 0; i < shoreStoneAngles.length; i++) {
    const ang = shoreStoneAngles[i];
    // Find exact shoreline at pondM ~= 1.02
    const dirX = Math.cos(ang);
    const dirZ = Math.sin(ang);
    let r = 1.6;
    for (let step = 0; step < 10; step++) {
      const m = getPondMetric(LANDMARKS.pond.x + dirX * r, LANDMARKS.pond.z + dirZ * r);
      r += (1.04 - m) * 0.8;
    }
    const sx = LANDMARKS.pond.x + dirX * r;
    const sz = LANDMARKS.pond.z + dirZ * r;
    // Skip area right over the dock
    if (Math.hypot(sx - LANDMARKS.dock.x, sz - LANDMARKS.dock.z) < 0.85) continue;
    const sy = getIslandTopHeight(sx, sz);
    const stone = new THREE.Mesh(stoneGeo, shoreStoneMat);
    const scale = 0.65 + (i % 3) * 0.32;
    stone.position.set(sx, sy + 0.03, sz);
    stone.scale.set(scale * 1.25, scale * 0.62, scale);
    stone.rotation.set(0.1 * i, ang, 0.08 * i);
    stone.castShadow = true;
    stone.receiveShadow = true;
    group.add(stone);
  }

  // Lily pads & tiny pale lotus bloom
  const padGeo = new THREE.CircleGeometry(0.24, 16, 0.25, Math.PI * 1.85);
  padGeo.rotateX(-Math.PI / 2);
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x5c8a53,
    roughness: 0.65,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const lotusMat = new THREE.MeshStandardMaterial({
    color: 0xf6e6dc,
    roughness: 0.55,
    metalness: 0.0,
  });
  const lotusGeo = new THREE.ConeGeometry(0.06, 0.1, 6);
  disposables.push(padGeo, padMat, lotusMat, lotusGeo);

  const lilyCoords: Array<[number, number, number, boolean]> = [
    [2.35, 1.55, 1.05, true],
    [2.72, 1.85, 0.78, false],
    [1.15, 2.75, 0.92, false],
    [0.82, 2.52, 0.68, false],
  ];
  for (let i = 0; i < lilyCoords.length; i++) {
    const [lx, lz, sc, hasFlower] = lilyCoords[i];
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(lx, WATER_LEVEL + 0.02, lz);
    pad.scale.setScalar(sc);
    pad.rotation.y = i * 1.8;
    group.add(pad);
    if (hasFlower) {
      const flower = new THREE.Mesh(lotusGeo, lotusMat);
      flower.position.set(lx, WATER_LEVEL + 0.06, lz);
      flower.rotation.x = Math.PI;
      group.add(flower);
    }
  }

  // Shoreline cattail reeds
  const reedTufts: ReedTuft[] = [];
  const reedStemGeo = new THREE.CylinderGeometry(0.014, 0.02, 0.75, 5);
  reedStemGeo.translate(0, 0.375, 0);
  const reedHeadGeo = new THREE.CapsuleGeometry(0.032, 0.11, 4, 6);
  const reedStemMat = new THREE.MeshStandardMaterial({ color: 0x5f7d49, roughness: 0.8 });
  const reedHeadMat = new THREE.MeshStandardMaterial({ color: 0x6b4730, roughness: 0.88 });
  disposables.push(reedStemGeo, reedHeadGeo, reedStemMat, reedHeadMat);

  const reedSpots: Array<[number, number]> = [
    [3.15, 1.15],
    [2.9, 2.8],
    [0.45, 2.95],
  ];
  for (let s = 0; s < reedSpots.length; s++) {
    const [rx, rz] = reedSpots[s];
    const ry = getIslandTopHeight(rx, rz);
    const tuft = new THREE.Group();
    tuft.position.set(rx, Math.max(ry, WATER_LEVEL - 0.08), rz);
    for (let k = 0; k < 5; k++) {
      const ang = (k / 5) * Math.PI * 2 + s;
      const ox = Math.cos(ang) * 0.14;
      const oz = Math.sin(ang) * 0.14;
      const hScale = 0.72 + (k % 3) * 0.24;
      const stem = new THREE.Mesh(reedStemGeo, reedStemMat);
      stem.position.set(ox, 0, oz);
      stem.scale.set(1, hScale, 1);
      stem.rotation.z = (rng() - 0.5) * 0.22;
      stem.rotation.x = (rng() - 0.5) * 0.22;
      tuft.add(stem);

      if (k % 2 === 0) {
        const head = new THREE.Mesh(reedHeadGeo, reedHeadMat);
        head.position.set(ox + stem.rotation.z * 0.45, 0.62 * hScale, oz);
        tuft.add(head);
      }
    }
    group.add(tuft);
    reedTufts.push({ group: tuft, phase: s * 1.9, baseRotZ: 0 });
  }

  // Sculpted cliff-rim rock outcrops adding geological character around the island edge
  const rimRockGeo = new THREE.DodecahedronGeometry(0.55, 0);
  disposables.push(rimRockGeo);
  const rimAngles = [0.42, 1.35, 2.55, 3.85, 5.25];
  for (let i = 0; i < rimAngles.length; i++) {
    const theta = rimAngles[i];
    const r = getIslandRadiusAtAngle(theta) * 0.92;
    const tx = Math.cos(theta) * r;
    const tz = Math.sin(theta) * r;
    const ty = getIslandTopHeight(tx, tz) - 0.52;
    const outcrop = new THREE.Mesh(rimRockGeo, spurMat);
    outcrop.position.set(tx, ty, tz);
    outcrop.scale.set(1.35, 0.88, 1.15);
    outcrop.rotation.set(i * 0.5, theta, i * 0.35);
    outcrop.castShadow = true;
    outcrop.receiveShadow = true;
    group.add(outcrop);
  }

  return {
    group,
    waterMaterial: water.material,
    update: (elapsed, _dt, atmosphere, windStrength, reducedMotion) => {
      // Water shader sync
      water.material.uniforms.uTime.value = reducedMotion ? 0 : elapsed;
      water.material.uniforms.uWind.value = windStrength;
      water.material.uniforms.uDeepColor.value.setRGB(
        atmosphere.waterDeepColor.r,
        atmosphere.waterDeepColor.g,
        atmosphere.waterDeepColor.b
      );
      water.material.uniforms.uShallowColor.value.setRGB(
        atmosphere.waterShallowColor.r,
        atmosphere.waterShallowColor.g,
        atmosphere.waterShallowColor.b
      );
      water.material.uniforms.uSkyColor.value.setRGB(
        atmosphere.skyHorizon.r,
        atmosphere.skyHorizon.g,
        atmosphere.skyHorizon.b
      );
      const isNight = atmosphere.nightFactor > 0.55;
      const lDir = isNight ? atmosphere.moonDirection : atmosphere.sunDirection;
      water.material.uniforms.uSunDir.value.set(lDir.x, Math.max(0.12, lDir.y), lDir.z);
      water.material.uniforms.uSunColor.value.setRGB(
        atmosphere.sunLightColor.r,
        atmosphere.sunLightColor.g,
        atmosphere.sunLightColor.b
      );
      water.material.uniforms.uSunIntensity.value = atmosphere.sunLightIntensity;

      // Subtle floating satellite pebble bobbing
      for (const fr of floatingRocks) {
        if (reducedMotion) {
          fr.mesh.position.y = fr.baseY;
        } else {
          fr.mesh.position.y = fr.baseY + Math.sin(elapsed * 0.9 + fr.phase) * fr.amp;
          fr.mesh.rotation.y += fr.rotSpeed * 0.008;
        }
      }

      // Gentle reed sway driven by shared wind
      const swayAmp = reducedMotion ? 0 : windStrength <= 0.002 ? 0 : 0.02 + windStrength * 0.14;
      for (const reed of reedTufts) {
        reed.group.rotation.z =
          reed.baseRotZ + Math.sin(elapsed * (1.8 + windStrength * 2.2) + reed.phase) * swayAmp;
      }
    },
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
