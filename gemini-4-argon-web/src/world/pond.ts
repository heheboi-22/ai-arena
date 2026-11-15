import * as THREE from 'three';
import { POND_CENTER, getIslandSurfaceHeight } from '../state';
import { ProceduralTextureSet } from './textures';

interface PondRipple {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  duration: number;
  maxScale: number;
  cx: number;
  cz: number;
}

interface SwayReed {
  group: THREE.Group;
  baseRotZ: number;
  phase: number;
}

export interface PondSystem {
  group: THREE.Group;
  waterY: number;
  update: (
    elapsed: number,
    dt: number,
    rainFactor: number,
    windFactor: number,
    daylight: number,
    twilight: number,
    nightness: number,
    reducedMotion: boolean,
  ) => void;
}

export function createPond(textures: ProceduralTextureSet): PondSystem {
  const group = new THREE.Group();
  group.name = 'PondSystem';

  const waterY = -0.02;
  const { x: px, z: pz, rx, rz } = POND_CENTER;

  // 1. Sandy/Pebbly Pond Bed & Shoreline Rim
  const bedShape = new THREE.Shape();
  const segs = 48;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const warp = 1 + 0.07 * Math.sin(a * 3 + 0.5) - 0.04 * Math.cos(a * 2);
    const x = Math.cos(a) * rx * 1.05 * warp;
    const y = Math.sin(a) * rz * 1.05 * warp;
    if (i === 0) bedShape.moveTo(x, y);
    else bedShape.lineTo(x, y);
  }

  const shoreGeo = new THREE.ShapeGeometry(bedShape, 24);
  shoreGeo.rotateX(-Math.PI / 2);
  const shoreMat = new THREE.MeshStandardMaterial({
    color: '#c9b694',
    bumpMap: textures.stoneBump,
    bumpScale: 0.02,
    roughness: 0.9,
  });
  const shoreMesh = new THREE.Mesh(shoreGeo, shoreMat);
  shoreMesh.position.set(px, waterY - 0.04, pz);
  shoreMesh.receiveShadow = true;
  group.add(shoreMesh);

  // 2. Translucent Water Surface
  const waterShape = new THREE.Shape();
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const warp = 1 + 0.07 * Math.sin(a * 3 + 0.5) - 0.04 * Math.cos(a * 2);
    const x = Math.cos(a) * (rx * 0.96) * warp;
    const y = Math.sin(a) * (rz * 0.96) * warp;
    if (i === 0) waterShape.moveTo(x, y);
    else waterShape.lineTo(x, y);
  }

  const waterGeo = new THREE.ShapeGeometry(waterShape, 32);
  waterGeo.rotateX(-Math.PI / 2);

  const waterBasePos = (waterGeo.attributes.position as THREE.BufferAttribute).clone();

  const waterMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2d95b5'),
    emissive: new THREE.Color('#0c2d40'),
    emissiveIntensity: 0.25,
    roughness: 0.12,
    metalness: 0.22,
    transparent: true,
    opacity: 0.88,
  });

  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set(px, waterY, pz);
  waterMesh.receiveShadow = true;
  group.add(waterMesh);

  // 3. Shoreline Pebbles & Mossy Boulders around the Pond Perimeter
  const rockMat = new THREE.MeshStandardMaterial({
    color: '#888580',
    roughness: 0.82,
    flatShading: true,
  });
  const pebbleMat = new THREE.MeshStandardMaterial({
    color: '#a89f91',
    roughness: 0.78,
    flatShading: true,
  });

  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + 0.13;
    // Leave an opening on the NE shore for the wooden dock
    if (a > -0.95 && a < -0.35) continue;
    const warp = 1 + 0.07 * Math.sin(a * 3 + 0.5) - 0.04 * Math.cos(a * 2);
    const sx = px + Math.cos(a) * rx * 0.97 * warp;
    const sz = pz + Math.sin(a) * rz * 0.97 * warp;

    const isBoulder = i % 4 === 0;
    const rMesh = new THREE.Mesh(rockGeo, isBoulder ? rockMat : pebbleMat);
    const rxScale = isBoulder ? 0.22 + (i % 3) * 0.07 : 0.12 + (i % 3) * 0.04;
    const ryScale = rxScale * 0.62;
    const rzScale = rxScale * 0.85;
    rMesh.scale.set(rxScale, ryScale, rzScale);
    rMesh.position.set(sx, waterY + ryScale * 0.35, sz);
    rMesh.rotation.set(i * 0.4, a, i * 0.2);
    rMesh.castShadow = true;
    rMesh.receiveShadow = true;
    group.add(rMesh);
  }

  // 4. Miniature Wooden Dock / Jetty & Gently Bobbing Rowboat
  const woodMat = new THREE.MeshStandardMaterial({
    color: '#7f5539',
    map: textures.woodColor,
    bumpMap: textures.woodBump,
    bumpScale: 0.025,
    roughness: 0.78,
  });

  const dockGroup = new THREE.Group();
  dockGroup.position.set(px + 1.25, waterY + 0.12, pz - 0.85);
  dockGroup.rotation.y = -0.68;

  for (let p = 0; p < 6; p++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.055, 0.16), woodMat);
    plank.position.set(0, 0, p * 0.19 - 0.45);
    plank.castShadow = true;
    plank.receiveShadow = true;
    dockGroup.add(plank);
  }
  const postPositions = [
    [-0.28, -0.42],
    [0.28, -0.42],
    [-0.28, 0.46],
    [0.28, 0.46],
  ];
  for (const [postX, postZ] of postPositions) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.42, 7), woodMat);
    post.position.set(postX, -0.06, postZ);
    post.castShadow = true;
    dockGroup.add(post);
  }
  group.add(dockGroup);

  // Miniature Rowboat moored near the dock
  const boatGroup = new THREE.Group();
  boatGroup.position.set(px + 0.55, waterY + 0.03, pz - 0.35);
  boatGroup.rotation.y = 0.45;

  const hullMat = new THREE.MeshStandardMaterial({
    color: '#9c4a32',
    roughness: 0.72,
  });
  const hullBottom = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.11, 0.68), hullMat);
  hullBottom.castShadow = true;
  boatGroup.add(hullBottom);

  const bench = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.14), woodMat);
  bench.position.y = 0.05;
  boatGroup.add(bench);
  group.add(boatGroup);

  // 5. Floating Lily Pads & Lotus Flowers + Swaying Cattails/Reeds
  const padMat = new THREE.MeshStandardMaterial({
    color: '#4c9540',
    roughness: 0.75,
  });
  const lotusMat = new THREE.MeshStandardMaterial({
    color: '#ffbfd3',
    roughness: 0.55,
  });

  const lilyPositions = [
    { x: px - 0.85, z: pz + 0.35, r: 0.21, flower: true },
    { x: px - 0.55, z: pz + 0.58, r: 0.16, flower: false },
    { x: px - 1.08, z: pz + 0.08, r: 0.18, flower: true },
    { x: px + 0.25, z: pz + 0.72, r: 0.20, flower: true },
    { x: px + 0.52, z: pz + 0.55, r: 0.15, flower: false },
  ];

  for (let i = 0; i < lilyPositions.length; i++) {
    const lp = lilyPositions[i];
    const padGeo = new THREE.CylinderGeometry(lp.r, lp.r, 0.02, 12, 1, false, 0, Math.PI * 1.82);
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(lp.x, waterY + 0.015, lp.z);
    pad.rotation.y = i * 1.3;
    group.add(pad);

    if (lp.flower) {
      const lotus = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06, 0), lotusMat);
      lotus.scale.set(1.2, 0.75, 1.2);
      lotus.position.set(lp.x, waterY + 0.045, lp.z);
      group.add(lotus);
    }
  }

  // Swaying Cattails / Reeds along the West & South Banks
  const reedStemMat = new THREE.MeshStandardMaterial({ color: '#588c41', roughness: 0.8 });
  const reedHeadMat = new THREE.MeshStandardMaterial({ color: '#5c3c24', roughness: 0.9 });
  const reeds: SwayReed[] = [];

  const reedClusters = [
    { x: px - 1.75, z: pz - 0.45 },
    { x: px - 1.88, z: pz + 0.15 },
    { x: px - 1.45, z: pz + 0.95 },
    { x: px + 1.45, z: pz + 0.65 },
  ];

  reedClusters.forEach((cl, cIdx) => {
    for (let r = 0; r < 4; r++) {
      const reedGroup = new THREE.Group();
      const ox = (r - 1.5) * 0.11;
      const oz = ((r % 2) - 0.5) * 0.11;
      const sy = getIslandSurfaceHeight(cl.x + ox, cl.z + oz) ?? waterY;
      reedGroup.position.set(cl.x + ox, Math.max(waterY - 0.02, sy), cl.z + oz);

      const h = 0.42 + (r % 3) * 0.12;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, h, 5), reedStemMat);
      stem.position.y = h / 2;
      stem.castShadow = true;
      reedGroup.add(stem);

      if (r % 2 === 0) {
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.13, 6), reedHeadMat);
        head.position.y = h - 0.08;
        reedGroup.add(head);
      }

      const baseRotZ = (r - 1.5) * 0.08;
      reedGroup.rotation.z = baseRotZ;
      group.add(reedGroup);
      reeds.push({
        group: reedGroup,
        baseRotZ,
        phase: cIdx * 1.4 + r * 0.7,
      });
    }
  });

  // 6. Pooled 3D Concentric Rain Ripples on Pond Surface
  const ripplePoolSize = 28;
  const ripples: PondRipple[] = [];
  const ringGeo = new THREE.RingGeometry(0.72, 1.0, 24);
  ringGeo.rotateX(-Math.PI / 2);

  const samplePondPoint = (seed: number): [number, number] => {
    const a = (seed * 2.39996) % (Math.PI * 2);
    const rad = Math.sqrt((seed * 0.618034) % 1) * 0.76;
    return [px + Math.cos(a) * rx * rad, pz + Math.sin(a) * rz * rad];
  };

  for (let i = 0; i < ripplePoolSize; i++) {
    const rMat = new THREE.MeshBasicMaterial({
      color: '#e6f7ff',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const rMesh = new THREE.Mesh(ringGeo, rMat);
    const [cx, cz] = samplePondPoint(i + 1);
    rMesh.position.set(cx, waterY + 0.012, cz);
    rMesh.visible = false;
    group.add(rMesh);

    ripples.push({
      mesh: rMesh,
      mat: rMat,
      age: (i / ripplePoolSize) * 1.35,
      duration: 1.15 + (i % 4) * 0.18,
      maxScale: 0.24 + (i % 3) * 0.09,
      cx,
      cz,
    });
  }

  let spawnCounter = 30;
  const dayWaterColor = new THREE.Color('#2d95b5');
  const sunsetWaterColor = new THREE.Color('#4d7a9e');
  const nightWaterColor = new THREE.Color('#163b54');
  const rainWaterColor = new THREE.Color('#2d596e');
  const targetColor = new THREE.Color();

  return {
    group,
    waterY,
    update: (
      elapsed: number,
      dt: number,
      rainFactor: number,
      windFactor: number,
      _daylight: number,
      twilight: number,
      nightness: number,
      reducedMotion: boolean,
    ) => {
      // Adapt water color smoothly to time of day & weather
      targetColor
        .copy(dayWaterColor)
        .lerp(sunsetWaterColor, twilight * 0.65)
        .lerp(nightWaterColor, nightness * 0.85)
        .lerp(rainWaterColor, rainFactor * 0.55);
      waterMat.color.copy(targetColor);

      const motionScale = reducedMotion ? 0.2 : 1.0;

      // Subtle vertex wave animation on pond surface
      const posAttr = waterGeo.attributes.position as THREE.BufferAttribute;
      const waveAmp = (0.008 + windFactor * 0.014 + rainFactor * 0.01) * motionScale;
      const waveSpeed = elapsed * (2.2 + windFactor * 2.5);
      for (let i = 0; i < posAttr.count; i++) {
        const bx = waterBasePos.getX(i);
        const bz = waterBasePos.getZ(i);
        const dy = Math.sin(bx * 3.2 + waveSpeed) * Math.cos(bz * 3.6 - waveSpeed * 0.8) * waveAmp;
        posAttr.setY(i, dy);
      }
      posAttr.needsUpdate = true;

      // Gentle rowboat bobbing
      boatGroup.position.y = waterY + 0.03 + Math.sin(elapsed * 2.1) * 0.018 * motionScale;
      boatGroup.rotation.z = Math.sin(elapsed * 1.7) * (0.03 + windFactor * 0.06) * motionScale;

      // Reed wind sway
      for (const reed of reeds) {
        const sway =
          windFactor * 0.32 +
          Math.sin(elapsed * (2.4 + windFactor * 3.2) + reed.phase) * (0.08 * windFactor) * motionScale;
        reed.group.rotation.z = reed.baseRotZ - sway;
      }

      // Pooled Rain Ripples on Pond Surface
      const showRipples = rainFactor > 0.015;
      for (const rp of ripples) {
        if (!showRipples) {
          rp.mesh.visible = false;
          rp.mat.opacity = 0;
          continue;
        }
        rp.mesh.visible = true;
        rp.age += dt * (reducedMotion ? 0.5 : 1.0);
        if (rp.age >= rp.duration) {
          rp.age %= rp.duration;
          spawnCounter += 1;
          const [nx, nz] = samplePondPoint(spawnCounter);
          rp.cx = nx;
          rp.cz = nz;
          rp.mesh.position.set(nx, waterY + 0.012, nz);
        }
        const t = rp.age / rp.duration;
        const scale = 0.04 + t * rp.maxScale;
        rp.mesh.scale.setScalar(scale);
        const fade = Math.sin(t * Math.PI) * (1 - t * 0.65);
        rp.mat.opacity = fade * rainFactor * 0.68;
      }
    },
  };
}
