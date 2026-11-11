import * as THREE from 'three';
import { createRng, damp, lerp } from '../utils/math';
import { getProceduralTextures } from '../utils/textures';
import { LANDMARKS } from './terrainMath';

export interface HouseRig {
  group: THREE.Group;
  hitTargets: THREE.Object3D[];
  triggerPulse: () => void;
  update: (
    dt: number,
    elapsed: number,
    houseLightAmount: number,
    nightFactor: number,
    wind: number,
    rainAmount: number,
    reducedMotion: boolean
  ) => void;
}

interface SmokePuff {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  age: number;
  life: number;
  seed: number;
}

export function createHouse(): HouseRig {
  const textures = getProceduralTextures();
  const group = new THREE.Group();
  group.name = 'CottageGroup';
  group.position.set(LANDMARKS.house.x, LANDMARKS.house.plateauY, LANDMARKS.house.z);
  group.rotation.y = LANDMARKS.house.rotY;

  const visualRoot = new THREE.Group();
  group.add(visualRoot);

  // Shared cottage materials
  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stone,
    color: 0xd8cfc2,
    roughness: 0.9,
    metalness: 0.03,
  });

  const plasterMat = new THREE.MeshStandardMaterial({
    map: textures.plaster,
    color: 0xf7eedc,
    roughness: 0.85,
    metalness: 0.02,
  });

  const roofMat = new THREE.MeshStandardMaterial({
    map: textures.shingles,
    color: 0xc8644c,
    roughness: 0.8,
    metalness: 0.04,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    color: 0x8c5d3c,
    roughness: 0.84,
    metalness: 0.03,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x563824,
    roughness: 0.82,
    metalness: 0.05,
  });

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x3b3a3e,
    roughness: 0.45,
    metalness: 0.72,
  });

  const shutterMat = new THREE.MeshStandardMaterial({
    color: 0x5c7f67,
    roughness: 0.82,
    metalness: 0.02,
  });

  // Shared reactive window material (unlit reflection + warm hearth emissive)
  const windowMat = new THREE.MeshStandardMaterial({
    map: textures.windowUnlit,
    color: 0xdbe9f4,
    emissive: new THREE.Color(0xffa938),
    emissiveMap: textures.windowEmissive,
    emissiveIntensity: 0,
    roughness: 0.24,
    metalness: 0.12,
  });

  const lanternGlassMat = new THREE.MeshStandardMaterial({
    color: 0xfff0cc,
    emissive: new THREE.Color(0xffb142),
    emissiveIntensity: 0,
    roughness: 0.25,
    metalness: 0.05,
  });

  // 1. Stone Foundation Plinth (extends below y=0 so cottage embeds seamlessly into terrace)
  const mainW = 1.62;
  const mainH = 1.16;
  const mainD = 1.36;
  const plinthH = 0.36; // from -0.18 to +0.18

  const plinthGeo = new THREE.BoxGeometry(mainW + 0.12, plinthH, mainD + 0.12);
  const plinth = new THREE.Mesh(plinthGeo, stoneMat);
  plinth.position.y = 0.0;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  visualRoot.add(plinth);

  // 2. Main Cream Plaster Walls
  const wallBaseY = 0.18;
  const wallGeo = new THREE.BoxGeometry(mainW, mainH, mainD);
  const walls = new THREE.Mesh(wallGeo, plasterMat);
  walls.position.y = wallBaseY + mainH * 0.5;
  walls.castShadow = true;
  walls.receiveShadow = true;
  visualRoot.add(walls);

  // Cozy side bay annex on +X side
  const annexW = 0.54;
  const annexH = 0.88;
  const annexD = 0.84;
  const annexPlinth = new THREE.Mesh(
    new THREE.BoxGeometry(annexW + 0.08, plinthH, annexD + 0.08),
    stoneMat
  );
  annexPlinth.position.set(mainW * 0.5 + annexW * 0.42, 0.0, -0.06);
  annexPlinth.castShadow = true;
  annexPlinth.receiveShadow = true;
  visualRoot.add(annexPlinth);

  const annexBody = new THREE.Mesh(new THREE.BoxGeometry(annexW, annexH, annexD), plasterMat);
  annexBody.position.set(mainW * 0.5 + annexW * 0.42, wallBaseY + annexH * 0.5, -0.06);
  annexBody.castShadow = true;
  annexBody.receiveShadow = true;
  visualRoot.add(annexBody);

  // Sloped lean-to roof on side annex
  const annexRoof = new THREE.Mesh(new THREE.BoxGeometry(annexW + 0.22, 0.08, annexD + 0.2), roofMat);
  annexRoof.position.set(mainW * 0.5 + annexW * 0.44, wallBaseY + annexH + 0.08, -0.06);
  annexRoof.rotation.z = -0.36;
  annexRoof.castShadow = true;
  annexRoof.receiveShadow = true;
  visualRoot.add(annexRoof);

  // 3. Exposed Half-Timbering Corner Posts & Wall Beams
  const postGeo = new THREE.BoxGeometry(0.085, mainH + 0.02, 0.085);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, woodMat);
      post.position.set(sx * (mainW * 0.5 - 0.015), wallBaseY + mainH * 0.5, sz * (mainD * 0.5 - 0.015));
      post.castShadow = true;
      post.receiveShadow = true;
      visualRoot.add(post);
    }
  }

  // Top wall plate beams
  const frontBeam = new THREE.Mesh(new THREE.BoxGeometry(mainW + 0.06, 0.075, mainD + 0.06), woodMat);
  frontBeam.position.y = wallBaseY + mainH;
  frontBeam.castShadow = true;
  visualRoot.add(frontBeam);

  // 4. Gable Triangles (+Z front and -Z rear) + Steep Shingled Roof Slopes
  const gableBaseY = wallBaseY + mainH;
  const gablePeakH = 0.78;
  const gableGeo = createGableWallGeometry(mainW, gablePeakH, mainD);
  const gableMesh = new THREE.Mesh(gableGeo, plasterMat);
  gableMesh.position.y = gableBaseY;
  gableMesh.castShadow = true;
  gableMesh.receiveShadow = true;
  visualRoot.add(gableMesh);

  // Pitched Roof Slopes with generous miniature eaves overhang
  const roofOverhangX = 0.24;
  const roofOverhangZ = 0.24;
  const halfSpanX = mainW * 0.5 + roofOverhangX;
  const slopeRise = gablePeakH + 0.14;
  const slopeLen = Math.hypot(halfSpanX, slopeRise);
  const slopeAngle = Math.atan2(slopeRise, halfSpanX);
  const roofDepth = mainD + roofOverhangZ * 2;
  const roofThick = 0.095;

  const slopeGeo = new THREE.BoxGeometry(slopeLen + 0.06, roofThick, roofDepth);
  for (const side of [-1, 1]) {
    const slope = new THREE.Mesh(slopeGeo, roofMat);
    slope.position.set(
      side * (halfSpanX * 0.5 - 0.01),
      gableBaseY + gablePeakH - slopeRise * 0.5 + 0.06,
      0
    );
    slope.rotation.z = -side * slopeAngle;
    slope.castShadow = true;
    slope.receiveShadow = true;
    visualRoot.add(slope);

    // Carved wooden bargeboard trim along front and back gable eaves
    for (const zSide of [-1, 1]) {
      const barge = new THREE.Mesh(
        new THREE.BoxGeometry(slopeLen + 0.08, 0.065, 0.045),
        darkTrimMat
      );
      barge.position.set(
        side * (halfSpanX * 0.5 - 0.01),
        gableBaseY + gablePeakH - slopeRise * 0.5 + 0.04,
        zSide * (roofDepth * 0.5 + 0.01)
      );
      barge.rotation.z = -side * slopeAngle;
      visualRoot.add(barge);
    }
  }

  // Timber ridge beam + finial pegs
  const ridgeBeam = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.11, roofDepth + 0.1),
    darkTrimMat
  );
  ridgeBeam.position.set(0, gableBaseY + gablePeakH + 0.09, 0);
  ridgeBeam.rotation.z = Math.PI * 0.25;
  ridgeBeam.castShadow = true;
  visualRoot.add(ridgeBeam);

  // 5. Stone Chimney & Terracotta Pot (left-rear slope)
  const chimneyGroup = new THREE.Group();
  chimneyGroup.position.set(-0.46, wallBaseY + 0.55, -0.32);

  const chimShaft = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.56, 0.32), stoneMat);
  chimShaft.position.y = 0.78;
  chimShaft.castShadow = true;
  chimShaft.receiveShadow = true;
  chimneyGroup.add(chimShaft);

  const chimCap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.09, 0.4), stoneMat);
  chimCap.position.y = 1.58;
  chimCap.castShadow = true;
  chimneyGroup.add(chimCap);

  const chimPot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.105, 0.22, 10),
    roofMat
  );
  chimPot.position.y = 1.72;
  chimPot.castShadow = true;
  chimneyGroup.add(chimPot);

  visualRoot.add(chimneyGroup);

  // 6. Front Porch, Steps & Arched Wooden Door (+Z facade, offset slightly left)
  const doorX = -0.28;
  const frontZ = mainD * 0.5;

  // Stone porch deck & welcoming step
  const porchDeck = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.22, 0.44), stoneMat);
  porchDeck.position.set(doorX, 0.07, frontZ + 0.22);
  porchDeck.castShadow = true;
  porchDeck.receiveShadow = true;
  visualRoot.add(porchDeck);

  const porchStep = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.12, 0.26), stoneMat);
  porchStep.position.set(doorX, -0.01, frontZ + 0.52);
  porchStep.castShadow = true;
  porchStep.receiveShadow = true;
  visualRoot.add(porchStep);

  // Porch posts & small pitched awning roof
  for (const px of [-0.35, 0.35]) {
    const pPost = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.78, 0.06), woodMat);
    pPost.position.set(doorX + px, 0.56, frontZ + 0.38);
    pPost.castShadow = true;
    visualRoot.add(pPost);
  }

  const awningBeam = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.055, 0.06), darkTrimMat);
  awningBeam.position.set(doorX, 0.96, frontZ + 0.38);
  visualRoot.add(awningBeam);

  const awningRoof = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.065, 0.54), roofMat);
  awningRoof.position.set(doorX, 1.07, frontZ + 0.22);
  awningRoof.rotation.x = 0.34;
  awningRoof.castShadow = true;
  awningRoof.receiveShadow = true;
  visualRoot.add(awningRoof);

  // Wooden Door + Frame + Iron Hinges + Brass Handle + Tiny Peep Window
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.8, 0.06), darkTrimMat);
  doorFrame.position.set(doorX, wallBaseY + 0.4, frontZ + 0.01);
  visualRoot.add(doorFrame);

  const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.73, 0.05), woodMat);
  doorLeaf.position.set(doorX, wallBaseY + 0.375, frontZ + 0.025);
  doorLeaf.castShadow = true;
  visualRoot.add(doorLeaf);

  // Tiny warm glass pane in upper door
  const doorPane = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.058), windowMat);
  doorPane.position.set(doorX, wallBaseY + 0.56, frontZ + 0.026);
  visualRoot.add(doorPane);

  const doorKnob = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), metalMat);
  doorKnob.position.set(doorX + 0.13, wallBaseY + 0.36, frontZ + 0.06);
  visualRoot.add(doorKnob);

  for (const hy of [0.2, 0.55]) {
    const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.024, 0.015), metalMat);
    hinge.position.set(doorX - 0.14, wallBaseY + hy, frontZ + 0.055);
    visualRoot.add(hinge);
  }

  // 7. Cottage Windows with Mullions, Shutters & Flower Boxes
  // Front parlor window (+Z, right of door)
  addFramedWindow(visualRoot, {
    x: 0.38,
    y: wallBaseY + 0.58,
    z: frontZ + 0.015,
    rotY: 0,
    w: 0.42,
    h: 0.44,
    shutters: true,
    flowerBox: true,
    windowMat,
    frameMat: darkTrimMat,
    sillMat: woodMat,
    shutterMat,
  });

  // Upper front gable attic window
  addFramedWindow(visualRoot, {
    x: 0,
    y: gableBaseY + 0.32,
    z: frontZ + 0.015,
    rotY: 0,
    w: 0.28,
    h: 0.3,
    shutters: false,
    flowerBox: false,
    windowMat,
    frameMat: darkTrimMat,
    sillMat: woodMat,
    shutterMat,
  });

  // West wall windows (-X, overlooking pond)
  addFramedWindow(visualRoot, {
    x: -mainW * 0.5 - 0.015,
    y: wallBaseY + 0.58,
    z: 0.26,
    rotY: -Math.PI * 0.5,
    w: 0.38,
    h: 0.42,
    shutters: true,
    flowerBox: true,
    windowMat,
    frameMat: darkTrimMat,
    sillMat: woodMat,
    shutterMat,
  });

  addFramedWindow(visualRoot, {
    x: -mainW * 0.5 - 0.015,
    y: wallBaseY + 0.58,
    z: -0.34,
    rotY: -Math.PI * 0.5,
    w: 0.34,
    h: 0.38,
    shutters: false,
    flowerBox: false,
    windowMat,
    frameMat: darkTrimMat,
    sillMat: woodMat,
    shutterMat,
  });

  // East annex window (+X)
  addFramedWindow(visualRoot, {
    x: mainW * 0.5 + annexW * 0.92 + 0.01,
    y: wallBaseY + 0.48,
    z: -0.06,
    rotY: Math.PI * 0.5,
    w: 0.38,
    h: 0.38,
    shutters: false,
    flowerBox: true,
    windowMat,
    frameMat: darkTrimMat,
    sillMat: woodMat,
    shutterMat,
  });

  // Rear cottage window (-Z)
  addFramedWindow(visualRoot, {
    x: 0.24,
    y: wallBaseY + 0.58,
    z: -mainD * 0.5 - 0.015,
    rotY: Math.PI,
    w: 0.42,
    h: 0.4,
    shutters: true,
    flowerBox: false,
    windowMat,
    frameMat: darkTrimMat,
    sillMat: woodMat,
    shutterMat,
  });

  // 8. Porch Lantern & Warm Exterior Light Spill
  const lanternPos = new THREE.Vector3(0.06, wallBaseY + 0.68, frontZ + 0.09);
  const lanternBracket = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.12), metalMat);
  lanternBracket.position.set(lanternPos.x, lanternPos.y + 0.07, frontZ + 0.05);
  visualRoot.add(lanternBracket);

  const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.06, 6), metalMat);
  lanternCap.position.set(lanternPos.x, lanternPos.y + 0.055, lanternPos.z);
  visualRoot.add(lanternCap);

  const lanternBulb = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.034, 0.09, 6), lanternGlassMat);
  lanternBulb.position.copy(lanternPos);
  visualRoot.add(lanternBulb);

  const lanternHaloMat = new THREE.SpriteMaterial({
    map: textures.softGlow,
    color: 0xffba52,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lanternHalo = new THREE.Sprite(lanternHaloMat);
  lanternHalo.position.copy(lanternPos);
  lanternHalo.scale.set(0.52, 0.52, 0.52);
  visualRoot.add(lanternHalo);

  // Subtle warm lights illuminating the porch, flowerboxes, and surrounding grass
  const porchLight = new THREE.PointLight(0xffad42, 0, 4.6, 1.7);
  porchLight.position.set(0.08, wallBaseY + 0.65, frontZ + 0.42);
  visualRoot.add(porchLight);

  const gardenSpillLight = new THREE.PointLight(0xffa438, 0, 3.8, 1.8);
  gardenSpillLight.position.set(-mainW * 0.68, wallBaseY + 0.58, 0.12);
  visualRoot.add(gardenSpillLight);

  // 9. Gentle Chimney Smoke Puffs (pooled)
  const smokeOrigin = new THREE.Vector3(-0.46, wallBaseY + 0.55 + 1.86, -0.32);
  const smokeGeo = new THREE.IcosahedronGeometry(0.09, 1);
  const smokePuffs: SmokePuff[] = [];
  const rng = createRng(6123);

  for (let i = 0; i < 9; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf0ece6,
      roughness: 1.0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(smokeGeo, mat);
    mesh.position.copy(smokeOrigin);
    visualRoot.add(mesh);
    smokePuffs.push({
      mesh,
      mat,
      age: (i / 9) * 3.2,
      life: 3.2,
      seed: rng() * Math.PI * 2,
    });
  }

  // 10. Clean Invisible Raycast Hit Volume (visible=true with colorWrite=false so Three.js Raycaster hits reliably)
  const hitProxyMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  });
  const hitProxy = new THREE.Mesh(new THREE.BoxGeometry(2.35, 2.25, 1.95), hitProxyMat);
  hitProxy.position.set(0.12, 1.05, 0.08);
  hitProxy.name = 'CottageHitTarget';
  group.add(hitProxy);

  let pulseTimer = 0;
  let currentScale = 1;

  // Convert world wind direction (+X/+Z breeze) into house local coordinates for smoke drift
  const cosInv = Math.cos(-LANDMARKS.house.rotY);
  const sinInv = Math.sin(-LANDMARKS.house.rotY);
  const worldWindDirX = 0.88;
  const worldWindDirZ = 0.47;
  const localWindX = worldWindDirX * cosInv - worldWindDirZ * sinInv;
  const localWindZ = worldWindDirX * sinInv + worldWindDirZ * cosInv;

  return {
    group,
    hitTargets: [hitProxy],
    triggerPulse() {
      pulseTimer = 1.0;
    },
    update(dt, elapsed, houseLightAmount, nightFactor, wind, rainAmount, reducedMotion) {
      // Dampen wet roof & stone sheen during rain
      roofMat.roughness = lerp(0.8, 0.52, rainAmount);
      stoneMat.roughness = lerp(0.9, 0.62, rainAmount);

      // Subtle tactile miniature bounce when house lights are clicked
      if (pulseTimer > 0.001) {
        pulseTimer = Math.max(0, pulseTimer - dt * 4.5);
        const pop = reducedMotion ? 1 : 1 + Math.sin(pulseTimer * Math.PI) * 0.024;
        currentScale = damp(currentScale, pop, 18, dt);
      } else {
        currentScale = damp(currentScale, 1, 12, dt);
      }
      visualRoot.scale.setScalar(currentScale);

      // Cozy hearth flicker & visual prominence (brighter contrast at dusk/night, still clearly visible in daytime)
      const flicker = reducedMotion
        ? 1.0
        : 0.96 + Math.sin(elapsed * 5.3) * 0.025 + Math.sin(elapsed * 11.7) * 0.015;
      const dayNightBoost = lerp(1.35, 2.85, nightFactor);

      windowMat.emissiveIntensity = houseLightAmount * dayNightBoost * flicker;
      windowMat.color.setHex(0xdbe9f4).lerp(_warmGlassTint, houseLightAmount * 0.85);

      lanternGlassMat.emissiveIntensity = houseLightAmount * lerp(1.6, 3.2, nightFactor) * flicker;
      lanternHaloMat.opacity = houseLightAmount * lerp(0.32, 0.82, nightFactor);

      const exteriorLightPower = houseLightAmount * lerp(0.85, 2.55, nightFactor) * flicker;
      porchLight.intensity = exteriorLightPower;
      gardenSpillLight.intensity = exteriorLightPower * 0.68;

      // Update chimney smoke puffs (gentle hearth smoke, drifts with wind)
      const smokeMotion = reducedMotion ? 0.25 : 1.0;
      const smokeDensity = lerp(0.32, 0.52, houseLightAmount) * (1 - rainAmount * 0.35);

      for (const puff of smokePuffs) {
        puff.age += dt * (0.65 + wind * 0.55) * smokeMotion;
        if (puff.age >= puff.life) {
          puff.age -= puff.life;
        }
        const t = puff.age / puff.life; // 0..1
        const rise = t * 1.35;
        const windDrift = Math.pow(t, 1.25) * wind * 1.45;
        const curlX = Math.sin(t * 5.0 + puff.seed) * 0.06 * (0.3 + t);
        const curlZ = Math.cos(t * 4.4 + puff.seed) * 0.06 * (0.3 + t);

        puff.mesh.position.set(
          smokeOrigin.x + localWindX * windDrift + curlX,
          smokeOrigin.y + rise,
          smokeOrigin.z + localWindZ * windDrift + curlZ
        );
        const s = lerp(0.45, 1.85, t);
        puff.mesh.scale.set(s, s * 0.82, s);

        const fadeIn = Math.min(1, t * 4.5);
        const fadeOut = Math.pow(1 - t, 1.6);
        puff.mat.opacity = fadeIn * fadeOut * smokeDensity;
      }
    },
  };
}

const _warmGlassTint = new THREE.Color(0xffe6b3);

function createGableWallGeometry(width: number, peakH: number, depth: number): THREE.BufferGeometry {
  const hw = width * 0.5;
  const hd = depth * 0.5;

  // Front (+hd) and Back (-hd) gable triangles + thin sloped side closure
  const positions = new Float32Array([
    // Front triangle (+Z)
    -hw, 0, hd,
    hw, 0, hd,
    0, peakH, hd,
    // Back triangle (-Z)
    hw, 0, -hd,
    -hw, 0, -hd,
    0, peakH, -hd,
  ]);

  const uvs = new Float32Array([
    0, 0,
    1, 0,
    0.5, 0.8,
    0, 0,
    1, 0,
    0.5, 0.8,
  ]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

interface WindowSpec {
  x: number;
  y: number;
  z: number;
  rotY: number;
  w: number;
  h: number;
  shutters: boolean;
  flowerBox: boolean;
  windowMat: THREE.Material;
  frameMat: THREE.Material;
  sillMat: THREE.Material;
  shutterMat: THREE.Material;
}

function addFramedWindow(parent: THREE.Group, spec: WindowSpec): void {
  const winGroup = new THREE.Group();
  winGroup.position.set(spec.x, spec.y, spec.z);
  winGroup.rotation.y = spec.rotY;

  // Outer recessed timber casing
  const frameDepth = 0.05;
  const border = 0.042;
  const topBar = new THREE.Mesh(
    new THREE.BoxGeometry(spec.w + border * 2, border, frameDepth),
    spec.frameMat
  );
  topBar.position.y = spec.h * 0.5 + border * 0.5;
  winGroup.add(topBar);

  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(spec.w + border * 2.8, border * 1.15, frameDepth + 0.045),
    spec.sillMat
  );
  sill.position.set(0, -spec.h * 0.5 - border * 0.5, 0.018);
  sill.castShadow = true;
  winGroup.add(sill);

  for (const sx of [-1, 1]) {
    const sideBar = new THREE.Mesh(
      new THREE.BoxGeometry(border, spec.h, frameDepth),
      spec.frameMat
    );
    sideBar.position.x = sx * (spec.w * 0.5 + border * 0.5);
    winGroup.add(sideBar);
  }

  // Glowing/reflective glass pane
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(spec.w, spec.h), spec.windowMat);
  pane.position.z = 0.008;
  winGroup.add(pane);

  // Cross mullions
  const vMullion = new THREE.Mesh(
    new THREE.BoxGeometry(0.022, spec.h, 0.026),
    spec.frameMat
  );
  vMullion.position.z = 0.015;
  winGroup.add(vMullion);

  const hMullion = new THREE.Mesh(
    new THREE.BoxGeometry(spec.w, 0.022, 0.026),
    spec.frameMat
  );
  hMullion.position.z = 0.015;
  winGroup.add(hMullion);

  // Optional sage-green cottage shutters
  if (spec.shutters) {
    const shutW = spec.w * 0.44;
    for (const sx of [-1, 1]) {
      const shutter = new THREE.Mesh(
        new THREE.BoxGeometry(shutW, spec.h + 0.02, 0.026),
        spec.shutterMat
      );
      shutter.position.set(
        sx * (spec.w * 0.5 + border + shutW * 0.5 + 0.012),
        0,
        0.012
      );
      shutter.rotation.y = -sx * 0.14;
      shutter.castShadow = true;
      winGroup.add(shutter);
    }
  }

  // Optional window flowerbox with tiny colorful blooms
  if (spec.flowerBox) {
    const boxW = spec.w + 0.08;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(boxW, 0.095, 0.11),
      spec.sillMat
    );
    box.position.set(0, -spec.h * 0.5 - 0.09, 0.055);
    box.castShadow = true;
    winGroup.add(box);

    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x4f8a46, roughness: 0.9 });
    const bloomColors = [0xf27d72, 0xf7cf65, 0xffffff, 0xd88be8];
    for (let i = 0; i < 4; i++) {
      const fx = -boxW * 0.34 + (i / 3) * (boxW * 0.68);
      const tuft = new THREE.Mesh(new THREE.DodecahedronGeometry(0.048, 0), foliageMat);
      tuft.position.set(fx, -spec.h * 0.5 - 0.032, 0.058);
      winGroup.add(tuft);

      const bloomMat = new THREE.MeshStandardMaterial({
        color: bloomColors[i % bloomColors.length],
        roughness: 0.75,
      });
      const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), bloomMat);
      bloom.position.set(fx + (i % 2 === 0 ? 0.012 : -0.012), -spec.h * 0.5 + 0.008, 0.068);
      winGroup.add(bloom);
    }
  }

  parent.add(winGroup);
}
