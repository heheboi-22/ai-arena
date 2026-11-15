import * as THREE from 'three';
import {
  computeIslandOutlineRadius,
  getIslandSurfaceHeight,
  isPointInPond,
  clamp,
} from '../state';
import { ProceduralTextureSet } from './textures';

export interface FloatingSatellite {
  mesh: THREE.Group;
  baseY: number;
  bobSpeed: number;
  bobAmp: number;
  phase: number;
  rotSpeed: number;
}

export interface IslandSystem {
  group: THREE.Group;
  update: (elapsed: number, dt: number, reducedMotion: boolean, nightness: number) => void;
}

export function createIsland(textures: ProceduralTextureSet): IslandSystem {
  const group = new THREE.Group();
  group.name = 'FloatingIsland';

  // 1. Sculpted Grassy Top Surface (Radial Polar Grid matching outline & heightfield)
  const radialSegments = 84;
  const ringSegments = 28;
  const topPositions: number[] = [];
  const topColors: number[] = [];
  const topUvs: number[] = [];
  const topIndices: number[] = [];

  const colorGrass = new THREE.Color('#66ac50');
  const colorBluff = new THREE.Color('#78bd5c');
  const colorPondBed = new THREE.Color('#7a6a52');
  const colorRim = new THREE.Color('#519240');
  const tempCol = new THREE.Color();

  // Store the exact outer perimeter ring (rIdx === ringSegments) so the underside welds 100% watertight
  const perimeterRing: Array<{ x: number; y: number; z: number }> = [];

  for (let rIdx = 0; rIdx <= ringSegments; rIdx++) {
    const v = rIdx / ringSegments;
    const radialFrac = Math.pow(v, 0.92);

    for (let aIdx = 0; aIdx <= radialSegments; aIdx++) {
      const u = aIdx / radialSegments;
      const angle = u * Math.PI * 2;
      const maxR = computeIslandOutlineRadius(angle);
      const r = radialFrac * maxR;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      let y = getIslandSurfaceHeight(x * 0.999, z * 0.999) ?? 0.15;
      if (radialFrac > 0.92) {
        const rimT = (radialFrac - 0.92) / 0.08;
        y -= rimT * rimT * 0.22;
      }

      if (rIdx === ringSegments) {
        perimeterRing.push({ x, y, z });
      }

      topPositions.push(x, y, z);
      topUvs.push(x * 0.14 + 0.5, z * 0.14 + 0.5);

      tempCol.copy(colorGrass);
      if (y > 0.55) {
        tempCol.lerp(colorBluff, clamp((y - 0.55) / 0.7, 0, 0.85));
      }
      if (isPointInPond(x, z) || y < 0.05) {
        const pondT = clamp((0.12 - y) / 0.45, 0, 1);
        tempCol.lerp(colorPondBed, pondT);
      }
      if (radialFrac > 0.88) {
        tempCol.lerp(colorRim, (radialFrac - 0.88) / 0.12);
      }
      topColors.push(tempCol.r, tempCol.g, tempCol.b);
    }
  }

  const stride = radialSegments + 1;
  for (let rIdx = 0; rIdx < ringSegments; rIdx++) {
    for (let aIdx = 0; aIdx < radialSegments; aIdx++) {
      const i0 = rIdx * stride + aIdx;
      const i1 = i0 + 1;
      const i2 = (rIdx + 1) * stride + aIdx;
      const i3 = i2 + 1;
      // Upward (+Y) outward normal winding
      topIndices.push(i0, i1, i2);
      topIndices.push(i1, i3, i2);
    }
  }

  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute('position', new THREE.Float32BufferAttribute(topPositions, 3));
  topGeo.setAttribute('color', new THREE.Float32BufferAttribute(topColors, 3));
  topGeo.setAttribute('uv', new THREE.Float32BufferAttribute(topUvs, 2));
  topGeo.setIndex(topIndices);
  topGeo.computeVertexNormals();

  const topMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    map: textures.grassColor,
    bumpMap: textures.grassBump,
    bumpScale: 0.035,
    roughness: 0.86,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const topMesh = new THREE.Mesh(topGeo, topMat);
  topMesh.receiveShadow = true;
  topMesh.castShadow = true;
  group.add(topMesh);

  // 2. Watertight Sculpted Faceted Rocky Underside (Welded to perimeterRing, Outward Normals)
  const underRadial = radialSegments;
  const underLevels = [
    { yDrop: 0.0, rScale: 1.00, jitter: 0.0, col: '#4e8c3d' },   // Exact weld to top perimeter
    { yDrop: 0.36, rScale: 0.985, jitter: 0.03, col: '#6e4c34' }, // Rich dark topsoil band
    { yDrop: 0.88, rScale: 0.93, jitter: 0.07, col: '#695648' },  // Upper earthen rock shelf
    { yDrop: 1.72, rScale: 0.84, jitter: 0.12, col: '#645d6d' },  // Chiseled cliff tier 1
    { yDrop: 2.75, rScale: 0.69, jitter: 0.15, col: '#585161' },  // Chiseled cliff tier 2
    { yDrop: 3.85, rScale: 0.50, jitter: 0.16, col: '#4c4656' },  // Deep crag tier 3
    { yDrop: 4.95, rScale: 0.27, jitter: 0.12, col: '#413b4a' },  // Tapered rock spire
    { yDrop: 6.10, rScale: 0.0, jitter: 0.0, col: '#36313f' },    // Closed bottom apex point
  ];

  const underPos: number[] = [];
  const underCol: number[] = [];
  const underUvs: number[] = [];
  const underIndices: number[] = [];

  for (let l = 0; l < underLevels.length; l++) {
    const lvl = underLevels[l];
    const baseColor = new THREE.Color(lvl.col);

    for (let a = 0; a <= underRadial; a++) {
      const u = a / underRadial;
      const angle = u * Math.PI * 2;
      const perim = perimeterRing[a];

      if (l === 0) {
        // Exact vertex weld with the outer edge of topMesh
        underPos.push(perim.x, perim.y, perim.z);
        underUvs.push(u * 4, 0);
        underCol.push(baseColor.r, baseColor.g, baseColor.b);
        continue;
      }

      if (l === underLevels.length - 1) {
        // Solid bottom apex
        underPos.push(0, -lvl.yDrop, 0);
        underUvs.push(u * 4, l * 0.5);
        underCol.push(baseColor.r, baseColor.g, baseColor.b);
        continue;
      }

      const outlineR = computeIslandOutlineRadius(angle);
      const crag1 = Math.sin(angle * 7 + l * 1.4) * 0.5 + Math.cos(angle * 11 - l * 0.9) * 0.5;
      const crag2 = Math.cos(angle * 5 - l * 2.1) * 0.45;
      const radialMod = 1 + (crag1 * 0.65 + crag2 * 0.35) * lvl.jitter;
      const r = outlineR * lvl.rScale * radialMod;

      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = perim.y * (1 - l / underLevels.length) - lvl.yDrop + crag2 * 0.16;

      underPos.push(x, y, z);
      underUvs.push(u * 4, l * 0.5);

      const c = baseColor.clone();
      c.offsetHSL(0, 0, crag1 * 0.045);
      underCol.push(c.r, c.g, c.b);
    }
  }

  const uStride = underRadial + 1;
  for (let l = 0; l < underLevels.length - 1; l++) {
    for (let a = 0; a < underRadial; a++) {
      const i0 = l * uStride + a;
      const i1 = i0 + 1;
      const i2 = (l + 1) * uStride + a;
      const i3 = i2 + 1;
      // Outward & downward normal winding: (i1 - i0) x (i2 - i0) points outward (+X, -Y, +Z)
      underIndices.push(i0, i1, i2);
      underIndices.push(i1, i3, i2);
    }
  }

  const underIndexedGeo = new THREE.BufferGeometry();
  underIndexedGeo.setAttribute('position', new THREE.Float32BufferAttribute(underPos, 3));
  underIndexedGeo.setAttribute('color', new THREE.Float32BufferAttribute(underCol, 3));
  underIndexedGeo.setAttribute('uv', new THREE.Float32BufferAttribute(underUvs, 2));
  underIndexedGeo.setIndex(underIndices);
  const underGeo = underIndexedGeo.toNonIndexed();
  underGeo.computeVertexNormals();

  const underMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    bumpMap: textures.cliffBump,
    bumpScale: 0.05,
    roughness: 0.88,
    metalness: 0.05,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  const underMesh = new THREE.Mesh(underGeo, underMat);
  underMesh.castShadow = true;
  underMesh.receiveShadow = true;
  group.add(underMesh);

  // 3. Hanging Ancient Roots & Floating Satellite Rock Shards beneath the Island
  const cragMat = new THREE.MeshStandardMaterial({
    color: '#5a5366',
    bumpMap: textures.cliffBump,
    bumpScale: 0.04,
    roughness: 0.88,
    metalness: 0.04,
    flatShading: true,
  });
  const mossCapMat = new THREE.MeshStandardMaterial({
    color: '#5a9c49',
    roughness: 0.85,
    flatShading: true,
  });

  const rootMat = new THREE.MeshStandardMaterial({
    color: '#5c402c',
    roughness: 0.92,
  });
  const rootAngles = [0.5, 1.8, 3.1, 4.4, 5.5];
  for (let i = 0; i < rootAngles.length; i++) {
    const a = rootAngles[i];
    const r = 2.1 + (i % 3) * 1.1;
    const rx = Math.cos(a) * r;
    const rz = Math.sin(a) * r;
    const startY = -2.4 - (i % 2) * 0.7;
    const len = 1.25 + (i % 3) * 0.45;

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(rx, startY, rz),
      new THREE.Vector3(rx + Math.cos(a + 0.5) * 0.3, startY - len * 0.45, rz + Math.sin(a + 0.5) * 0.3),
      new THREE.Vector3(rx - Math.cos(a) * 0.18, startY - len, rz - Math.sin(a) * 0.18),
    ]);
    const tubeGeo = new THREE.TubeGeometry(curve, 8, 0.065, 5, false);
    const rootMesh = new THREE.Mesh(tubeGeo, rootMat);
    group.add(rootMesh);
  }

  // 4. Floating Satellite Rock Shards & Glowing Sky-Crystals beneath the island
  const satellites: FloatingSatellite[] = [];
  const crystalMat = new THREE.MeshStandardMaterial({
    color: '#6ec6ff',
    emissive: '#2998e6',
    emissiveIntensity: 0.45,
    roughness: 0.25,
    metalness: 0.15,
    flatShading: true,
  });

  const satConfigs = [
    { x: -4.8, y: -3.6, z: 3.2, scale: 0.65, hasCrystal: true },
    { x: 5.2, y: -4.1, z: -2.4, scale: 0.75, hasCrystal: false },
    { x: -2.1, y: -5.8, z: -3.6, scale: 0.52, hasCrystal: true },
    { x: 3.1, y: -5.3, z: 3.9, scale: 0.58, hasCrystal: true },
    { x: 0.3, y: -6.9, z: 0.5, scale: 0.48, hasCrystal: false },
  ];

  satConfigs.forEach((cfg, idx) => {
    const satGroup = new THREE.Group();
    satGroup.position.set(cfg.x, cfg.y, cfg.z);

    const rockBottom = new THREE.Mesh(
      new THREE.ConeGeometry(0.75 * cfg.scale, 1.35 * cfg.scale, 6),
      cragMat,
    );
    rockBottom.rotation.x = Math.PI;
    rockBottom.position.y = -0.35 * cfg.scale;
    rockBottom.castShadow = true;
    satGroup.add(rockBottom);

    const mossTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65 * cfg.scale, 0.75 * cfg.scale, 0.28 * cfg.scale, 6),
      mossCapMat,
    );
    mossTop.position.y = 0.38 * cfg.scale;
    mossTop.receiveShadow = true;
    satGroup.add(mossTop);

    if (cfg.hasCrystal) {
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.24 * cfg.scale, 0),
        crystalMat,
      );
      crystal.scale.set(0.7, 1.6, 0.7);
      crystal.position.set(0.1 * cfg.scale, -0.85 * cfg.scale, 0);
      crystal.rotation.z = 0.25;
      satGroup.add(crystal);
    }

    group.add(satGroup);
    satellites.push({
      mesh: satGroup,
      baseY: cfg.y,
      bobSpeed: 1.1 + idx * 0.23,
      bobAmp: 0.14 + (idx % 2) * 0.06,
      phase: idx * 1.35,
      rotSpeed: (idx % 2 === 0 ? 1 : -1) * 0.12,
    });
  });

  // 5. Winding Flagstone Stepping-Stone Path across the Meadow
  const stonePathMat = new THREE.MeshStandardMaterial({
    color: '#c4baaa',
    map: textures.stoneColor,
    bumpMap: textures.stoneBump,
    bumpScale: 0.02,
    roughness: 0.85,
  });

  const steppingStones: Array<{ x: number; z: number; rx: number; rz: number; rot: number }> = [
    { x: -0.95, z: -0.25, rx: 0.34, rz: 0.26, rot: 0.2 },
    { x: -0.65, z: 0.18, rx: 0.31, rz: 0.24, rot: -0.3 },
    { x: -0.62, z: 0.62, rx: 0.33, rz: 0.25, rot: 0.1 },
    { x: -0.35, z: 1.05, rx: 0.28, rz: 0.22, rot: 0.4 },
    { x: 0.05, z: 1.45, rx: 0.30, rz: 0.24, rot: -0.2 },
    { x: 0.45, z: 1.82, rx: 0.27, rz: 0.22, rot: 0.3 },
    { x: -0.22, z: -0.15, rx: 0.29, rz: 0.23, rot: 0.5 },
    { x: 0.25, z: -0.42, rx: 0.32, rz: 0.25, rot: -0.1 },
    { x: 0.72, z: -0.75, rx: 0.30, rz: 0.24, rot: 0.35 },
    { x: 1.22, z: -1.08, rx: 0.33, rz: 0.25, rot: -0.25 },
    { x: 1.72, z: -1.42, rx: 0.31, rz: 0.24, rot: 0.15 },
    { x: 2.15, z: -1.72, rx: 0.34, rz: 0.26, rot: 0.4 },
  ];

  const stoneGeo = new THREE.CylinderGeometry(1, 1.08, 0.08, 7);
  for (const st of steppingStones) {
    if (isPointInPond(st.x, st.z)) continue;
    const sy = getIslandSurfaceHeight(st.x, st.z);
    if (sy === null) continue;
    const stone = new THREE.Mesh(stoneGeo, stonePathMat);
    stone.scale.set(st.rx, 1, st.rz);
    stone.position.set(st.x, sy + 0.025, st.z);
    stone.rotation.y = st.rot;
    stone.receiveShadow = true;
    stone.castShadow = true;
    group.add(stone);
  }

  return {
    group,
    update: (elapsed: number, _dt: number, reducedMotion: boolean, nightness: number) => {
      crystalMat.emissiveIntensity = 0.35 + nightness * 0.85 + Math.sin(elapsed * 2.2) * 0.12;
      const motionScale = reducedMotion ? 0.15 : 1.0;

      group.position.y = Math.sin(elapsed * 0.85) * 0.06 * motionScale;

      for (const sat of satellites) {
        sat.mesh.position.y =
          sat.baseY + Math.sin(elapsed * sat.bobSpeed + sat.phase) * sat.bobAmp * motionScale;
        sat.mesh.rotation.y += sat.rotSpeed * 0.008 * motionScale;
      }
    },
  };
}
