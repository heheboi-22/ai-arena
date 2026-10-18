import * as THREE from 'three';
import {
  HOUSE_POS,
  WINDMILL_POS,
  getIslandSurfaceHeight,
} from './island';
import { createGlowTexture, createShingleTexture } from '../utils/textures';

export interface StructuresComponents {
  root: THREE.Group;
  houseGroup: THREE.Group;
  windmillBlades: THREE.Group;
  chimneyWorldPos: THREE.Vector3;
  update: (
    dt: number,
    windFactor: number,
    houseLightsFactor: number,
    nightFactor: number,
    reducedMotion: boolean
  ) => void;
}

export function createStructures(): StructuresComponents {
  const root = new THREE.Group();
  root.name = 'StructuresRoot';

  const shingleTex = createShingleTexture();
  const glowTex = createGlowTexture();

  // Shared Window & Lantern Emissive Materials
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x3b4f63,
    emissive: 0xff9e32,
    emissiveIntensity: 0.0,
    roughness: 0.2,
    metalness: 0.1,
  });

  const lanternMaterial = new THREE.MeshStandardMaterial({
    color: 0x524b44,
    emissive: 0xffab3d,
    emissiveIntensity: 0.0,
    roughness: 0.25,
  });

  const pathLanternMat = new THREE.MeshStandardMaterial({
    color: 0x6e6257,
    emissive: 0xffb14a,
    emissiveIntensity: 0.15,
    roughness: 0.3,
  });

  const glowSprites: THREE.Sprite[] = [];

  // 1. Build the House
  const {
    houseGroup,
    chimneyWorldPos,
    porchLight,
    windowSpillLightLeft,
    windowSpillLightRight,
  } = buildHouse(
    shingleTex,
    glowTex,
    windowMaterial,
    lanternMaterial,
    glowSprites
  );
  root.add(houseGroup);

  // 2. Build the Windmill
  const { windmillGroup, bladesGroup } = buildWindmill(
    shingleTex,
    windowMaterial
  );
  root.add(windmillGroup);

  // 3. Build Fences, Garden Bench, and Path Lantern
  const { detailsGroup, pathLight } = buildEnvironmentalStructures(
    pathLanternMat,
    glowTex
  );
  root.add(detailsGroup);

  const offGlassColor = new THREE.Color(0x3b4f63);
  const onGlassColor = new THREE.Color(0xffe199);

  const update = (
    dt: number,
    windFactor: number,
    houseLightsFactor: number,
    nightFactor: number,
    reducedMotion: boolean
  ) => {
    // Rotate windmill blades based on shared windFactor
    // At 0% wind, rotation stops; higher wind produces clear, steady rotation
    const minSpin = windFactor > 0.005 ? 0.18 : 0.0;
    const angularSpeed =
      (minSpin + windFactor * 3.8) * (reducedMotion ? 0.45 : 1.0);
    bladesGroup.rotation.z -= angularSpeed * dt;

    // Update House Window & Lantern Materials + Lights
    const nightBoost = nightFactor * 0.75;
    windowMaterial.color.lerpColors(offGlassColor, onGlassColor, houseLightsFactor);
    windowMaterial.emissiveIntensity =
      houseLightsFactor * (1.5 + nightBoost * 1.1);

    lanternMaterial.color.lerpColors(offGlassColor, onGlassColor, houseLightsFactor);
    lanternMaterial.emissiveIntensity =
      houseLightsFactor * (1.8 + nightBoost * 1.2);

    // Subtle warm lights around the house when lights are toggled on
    const lightIntensityScale = 1.0 + nightFactor * 0.9;
    porchLight.intensity = houseLightsFactor * 2.2 * lightIntensityScale;
    windowSpillLightLeft.intensity = houseLightsFactor * 1.4 * lightIntensityScale;
    windowSpillLightRight.intensity = houseLightsFactor * 1.4 * lightIntensityScale;

    for (const sprite of glowSprites) {
      sprite.material.opacity =
        houseLightsFactor * (0.38 + nightFactor * 0.34);
      sprite.visible = houseLightsFactor > 0.01;
    }

    // Path lantern by the pond glows gently at dusk/night or when house lights are on
    const pathGlow = Math.max(nightFactor * 0.9, houseLightsFactor * 0.65);
    pathLanternMat.emissiveIntensity = 0.15 + pathGlow * 1.5;
    pathLight.intensity = pathGlow * 1.1;
  };

  return {
    root,
    houseGroup,
    windmillBlades: bladesGroup,
    chimneyWorldPos,
    update,
  };
}

function buildHouse(
  shingleTex: THREE.CanvasTexture,
  glowTex: THREE.CanvasTexture,
  windowMaterial: THREE.MeshStandardMaterial,
  lanternMaterial: THREE.MeshStandardMaterial,
  glowSprites: THREE.Sprite[]
): {
  houseGroup: THREE.Group;
  chimneyWorldPos: THREE.Vector3;
  porchLight: THREE.PointLight;
  windowSpillLightLeft: THREE.PointLight;
  windowSpillLightRight: THREE.PointLight;
} {
  const houseGroup = new THREE.Group();
  houseGroup.name = 'HouseGroup';
  houseGroup.position.copy(HOUSE_POS);
  houseGroup.rotation.y = Math.PI * 0.18;

  // Materials
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x8d8276,
    roughness: 0.9,
    flatShading: true,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xf5ebd8,
    roughness: 0.82,
  });
  const timberMat = new THREE.MeshStandardMaterial({
    color: 0x7c4e2d,
    roughness: 0.85,
  });
  const darkTimberMat = new THREE.MeshStandardMaterial({
    color: 0x57351d,
    roughness: 0.88,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0xd16643,
    map: shingleTex,
    roughness: 0.78,
  });
  const shutterMat = new THREE.MeshStandardMaterial({
    color: 0x588267,
    roughness: 0.8,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xe0b252,
    roughness: 0.3,
    metalness: 0.7,
  });

  // 1. Stone Foundation Plinth
  const foundationGeo = new THREE.BoxGeometry(1.92, 0.26, 1.58);
  const foundation = new THREE.Mesh(foundationGeo, stoneMat);
  foundation.position.set(0, 0.11, 0);
  foundation.castShadow = true;
  foundation.receiveShadow = true;
  houseGroup.add(foundation);

  // 2. Main Cream Stucco Walls
  const wallW = 1.78;
  const wallH = 1.12;
  const wallD = 1.44;
  const mainWallGeo = new THREE.BoxGeometry(wallW, wallH, wallD);
  const mainWall = new THREE.Mesh(mainWallGeo, wallMat);
  mainWall.position.set(0, 0.24 + wallH / 2, 0);
  mainWall.castShadow = true;
  mainWall.receiveShadow = true;
  houseGroup.add(mainWall);

  // Gable Triangular Prism under the roof
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-wallW / 2, 0);
  gableShape.lineTo(wallW / 2, 0);
  gableShape.lineTo(0, 0.76);
  gableShape.closePath();

  const gableExtrude = new THREE.ExtrudeGeometry(gableShape, {
    depth: wallD,
    bevelEnabled: false,
  });
  gableExtrude.translate(0, 0, -wallD / 2);
  const gableMesh = new THREE.Mesh(gableExtrude, wallMat);
  gableMesh.position.set(0, 0.24 + wallH, 0);
  gableMesh.castShadow = true;
  gableMesh.receiveShadow = true;
  houseGroup.add(gableMesh);

  // 3. Exposed Timber Corner Posts & Horizontal Beams
  const postGeo = new THREE.BoxGeometry(0.09, wallH + 0.02, 0.09);
  const corners = [
    [-wallW / 2, -wallD / 2],
    [wallW / 2, -wallD / 2],
    [-wallW / 2, wallD / 2],
    [wallW / 2, wallD / 2],
  ];
  for (const [cx, cz] of corners) {
    const post = new THREE.Mesh(postGeo, timberMat);
    post.position.set(cx, 0.24 + wallH / 2, cz);
    post.castShadow = true;
    houseGroup.add(post);
  }

  // Horizontal eaves beam front/back & sides
  const frontBeamGeo = new THREE.BoxGeometry(wallW + 0.08, 0.07, 0.07);
  for (const zSign of [-1, 1]) {
    const beam = new THREE.Mesh(frontBeamGeo, timberMat);
    beam.position.set(0, 0.24 + wallH, zSign * (wallD / 2 + 0.01));
    houseGroup.add(beam);
  }

  // 4. Pitched Roof with Overhanging Eaves
  const roofGroup = new THREE.Group();
  roofGroup.position.set(0, 0.24 + wallH + 0.76, 0);

  const roofSlopeLen = 1.24;
  const roofDepth = 1.76;
  const roofThickness = 0.09;
  const roofAngle = Math.atan2(0.78, wallW / 2); // ~41 deg

  const slopeGeo = new THREE.BoxGeometry(roofSlopeLen, roofThickness, roofDepth);

  const leftSlope = new THREE.Mesh(slopeGeo, roofMat);
  leftSlope.position.set(
    -Math.cos(roofAngle) * (roofSlopeLen / 2 - 0.04),
    -Math.sin(roofAngle) * (roofSlopeLen / 2 - 0.04),
    0
  );
  leftSlope.rotation.z = roofAngle;
  leftSlope.castShadow = true;
  leftSlope.receiveShadow = true;
  roofGroup.add(leftSlope);

  const rightSlope = new THREE.Mesh(slopeGeo, roofMat);
  rightSlope.position.set(
    Math.cos(roofAngle) * (roofSlopeLen / 2 - 0.04),
    -Math.sin(roofAngle) * (roofSlopeLen / 2 - 0.04),
    0
  );
  rightSlope.rotation.z = -roofAngle;
  rightSlope.castShadow = true;
  rightSlope.receiveShadow = true;
  roofGroup.add(rightSlope);

  // Wooden ridge cap beam
  const ridgeGeo = new THREE.BoxGeometry(0.14, 0.12, roofDepth + 0.06);
  const ridge = new THREE.Mesh(ridgeGeo, darkTimberMat);
  ridge.position.set(0, 0.02, 0);
  ridge.castShadow = true;
  roofGroup.add(ridge);

  houseGroup.add(roofGroup);

  // 5. Stone Chimney & Terracotta Flue Pot
  const chimneyGroup = new THREE.Group();
  chimneyGroup.position.set(-0.62, 1.75, -0.28);

  const chimneyShaftGeo = new THREE.BoxGeometry(0.34, 0.92, 0.34);
  const chimneyShaft = new THREE.Mesh(chimneyShaftGeo, stoneMat);
  chimneyShaft.castShadow = true;
  chimneyShaft.receiveShadow = true;
  chimneyGroup.add(chimneyShaft);

  const chimneyRimGeo = new THREE.BoxGeometry(0.4, 0.09, 0.4);
  const chimneyRim = new THREE.Mesh(chimneyRimGeo, stoneMat);
  chimneyRim.position.y = 0.44;
  chimneyRim.castShadow = true;
  chimneyGroup.add(chimneyRim);

  const flueGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.18, 10);
  const flue = new THREE.Mesh(flueGeo, roofMat);
  flue.position.y = 0.54;
  flue.castShadow = true;
  chimneyGroup.add(flue);

  houseGroup.add(chimneyGroup);

  // Compute world position of the top of the chimney for smoke emission
  houseGroup.updateMatrixWorld(true);
  const chimneyWorldPos = new THREE.Vector3(0, 0.65, 0);
  chimneyGroup.localToWorld(chimneyWorldPos);

  // 6. Front Door, Steps, Porch Awning, and Hanging Lantern
  const doorX = -0.32;
  const frontZ = wallD / 2;

  const doorFrameGeo = new THREE.BoxGeometry(0.48, 0.78, 0.08);
  const doorFrame = new THREE.Mesh(doorFrameGeo, darkTimberMat);
  doorFrame.position.set(doorX, 0.24 + 0.39, frontZ + 0.01);
  doorFrame.castShadow = true;
  houseGroup.add(doorFrame);

  const doorLeafMat = new THREE.MeshStandardMaterial({
    color: 0x995730,
    roughness: 0.78,
  });
  const doorLeafGeo = new THREE.BoxGeometry(0.38, 0.71, 0.06);
  const doorLeaf = new THREE.Mesh(doorLeafGeo, doorLeafMat);
  doorLeaf.position.set(doorX, 0.24 + 0.37, frontZ + 0.025);
  houseGroup.add(doorLeaf);

  // Small window pane in upper door
  const doorPaneGeo = new THREE.BoxGeometry(0.18, 0.18, 0.02);
  const doorPane = new THREE.Mesh(doorPaneGeo, windowMaterial);
  doorPane.position.set(doorX, 0.24 + 0.54, frontZ + 0.055);
  houseGroup.add(doorPane);

  // Brass doorknob
  const knobGeo = new THREE.SphereGeometry(0.028, 8, 8);
  const knob = new THREE.Mesh(knobGeo, brassMat);
  knob.position.set(doorX + 0.12, 0.24 + 0.35, frontZ + 0.065);
  houseGroup.add(knob);

  // Two stone steps in front of the door
  const step1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.12, 0.28),
    stoneMat
  );
  step1.position.set(doorX, 0.16, frontZ + 0.14);
  step1.castShadow = true;
  step1.receiveShadow = true;
  houseGroup.add(step1);

  const step2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.1, 0.42),
    stoneMat
  );
  step2.position.set(doorX, 0.06, frontZ + 0.24);
  step2.castShadow = true;
  step2.receiveShadow = true;
  houseGroup.add(step2);

  // Porch awning over the door
  const awningGeo = new THREE.BoxGeometry(0.68, 0.06, 0.38);
  const awning = new THREE.Mesh(awningGeo, roofMat);
  awning.position.set(doorX, 0.24 + 0.86, frontZ + 0.16);
  awning.rotation.x = 0.28;
  awning.castShadow = true;
  houseGroup.add(awning);

  // Hanging Porch Lantern beside door
  const lanternBracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.04, 0.18),
    darkTimberMat
  );
  lanternBracket.position.set(doorX - 0.34, 0.24 + 0.74, frontZ + 0.08);
  houseGroup.add(lanternBracket);

  const lanternBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.042, 0.12, 6),
    lanternMaterial
  );
  lanternBody.position.set(doorX - 0.34, 0.24 + 0.66, frontZ + 0.14);
  houseGroup.add(lanternBody);

  const lanternCap = new THREE.Mesh(
    new THREE.ConeGeometry(0.075, 0.05, 6),
    darkTimberMat
  );
  lanternCap.position.set(doorX - 0.34, 0.24 + 0.73, frontZ + 0.14);
  houseGroup.add(lanternCap);

  const lanternSprite = createGlowSprite(glowTex, 0.55);
  lanternSprite.position.set(doorX - 0.34, 0.24 + 0.66, frontZ + 0.16);
  houseGroup.add(lanternSprite);
  glowSprites.push(lanternSprite);

  // 7. Windows with Shutters & Flower Boxes
  const addWindowAssembly = (
    pos: THREE.Vector3,
    rotY: number,
    hasShutters = true,
    hasFlowerBox = true,
    scale = 1.0
  ) => {
    const winGroup = new THREE.Group();
    winGroup.position.copy(pos);
    winGroup.rotation.y = rotY;
    winGroup.scale.setScalar(scale);

    // Outer frame
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.46, 0.06),
      darkTimberMat
    );
    frame.castShadow = true;
    winGroup.add(frame);

    // Glowing glass pane
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.38, 0.068),
      windowMaterial
    );
    winGroup.add(glass);

    // Cross muntin bars
    const vBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.38, 0.076),
      timberMat
    );
    const hBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.03, 0.076),
      timberMat
    );
    winGroup.add(vBar, hBar);

    // Window sill
    const sill = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.045, 0.11),
      stoneMat
    );
    sill.position.set(0, -0.23, 0.02);
    winGroup.add(sill);

    if (hasShutters) {
      const shutterGeo = new THREE.BoxGeometry(0.13, 0.44, 0.035);
      const leftShutter = new THREE.Mesh(shutterGeo, shutterMat);
      leftShutter.position.set(-0.29, 0, 0.02);
      leftShutter.rotation.y = -0.15;
      leftShutter.castShadow = true;

      const rightShutter = new THREE.Mesh(shutterGeo, shutterMat);
      rightShutter.position.set(0.29, 0, 0.02);
      rightShutter.rotation.y = 0.15;
      rightShutter.castShadow = true;

      winGroup.add(leftShutter, rightShutter);
    }

    if (hasFlowerBox) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.1, 0.12),
        timberMat
      );
      box.position.set(0, -0.29, 0.05);
      box.castShadow = true;
      winGroup.add(box);

      const flowerColors = [0xf26b7a, 0xf7cf59, 0xffffff];
      const blossomGeo = new THREE.DodecahedronGeometry(0.045, 0);
      for (let i = 0; i < 3; i++) {
        const flMat = new THREE.MeshStandardMaterial({
          color: flowerColors[i % flowerColors.length],
          roughness: 0.7,
        });
        const fl = new THREE.Mesh(blossomGeo, flMat);
        fl.position.set(-0.13 + i * 0.13, -0.22, 0.06);
        winGroup.add(fl);
      }
    }

    const glow = createGlowSprite(glowTex, 0.85 * scale);
    glow.position.set(0, 0, 0.09);
    winGroup.add(glow);
    glowSprites.push(glow);

    houseGroup.add(winGroup);
  };

  // Front right window (+Z wall)
  addWindowAssembly(
    new THREE.Vector3(0.42, 0.24 + 0.62, wallD / 2 + 0.01),
    0,
    true,
    true,
    1.0
  );

  // Front attic gable window (+Z upper triangle)
  addWindowAssembly(
    new THREE.Vector3(0, 0.24 + wallH + 0.34, wallD / 2 + 0.01),
    0,
    false,
    false,
    0.72
  );

  // Right side window (+X wall)
  addWindowAssembly(
    new THREE.Vector3(wallW / 2 + 0.01, 0.24 + 0.62, 0.0),
    Math.PI / 2,
    true,
    true,
    0.95
  );

  // Left side window (-X wall)
  addWindowAssembly(
    new THREE.Vector3(-wallW / 2 - 0.01, 0.24 + 0.62, 0.0),
    -Math.PI / 2,
    true,
    false,
    0.95
  );

  // Back wall window (-Z wall)
  addWindowAssembly(
    new THREE.Vector3(0.25, 0.24 + 0.62, -wallD / 2 - 0.01),
    Math.PI,
    true,
    false,
    0.95
  );

  // 8. Dedicated PointLights for warm house illumination
  const porchLight = new THREE.PointLight(0xffa63b, 0, 5.5, 1.6);
  porchLight.position.set(0.05, 1.05, wallD / 2 + 0.55);
  houseGroup.add(porchLight);

  const windowSpillLightRight = new THREE.PointLight(0xff9e32, 0, 4.2, 1.7);
  windowSpillLightRight.position.set(wallW / 2 + 0.5, 0.9, 0);
  houseGroup.add(windowSpillLightRight);

  const windowSpillLightLeft = new THREE.PointLight(0xff9e32, 0, 4.2, 1.7);
  windowSpillLightLeft.position.set(-wallW / 2 - 0.5, 0.9, 0.2);
  houseGroup.add(windowSpillLightLeft);

  // Tag all meshes inside houseGroup so raycasting clicks on any part of the house works
  houseGroup.traverse((obj) => {
    obj.userData.isHouse = true;
  });

  return {
    houseGroup,
    chimneyWorldPos,
    porchLight,
    windowSpillLightLeft,
    windowSpillLightRight,
  };
}

function buildWindmill(
  shingleTex: THREE.CanvasTexture,
  windowMaterial: THREE.MeshStandardMaterial
): {
  windmillGroup: THREE.Group;
  bladesGroup: THREE.Group;
} {
  const windmillGroup = new THREE.Group();
  windmillGroup.name = 'WindmillGroup';
  windmillGroup.position.copy(WINDMILL_POS);
  windmillGroup.rotation.y = -Math.PI * 0.16;

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x8a7e72,
    roughness: 0.9,
    flatShading: true,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xf2e7d3,
    roughness: 0.82,
  });
  const timberMat = new THREE.MeshStandardMaterial({
    color: 0x784b2a,
    roughness: 0.85,
  });
  const darkWoodMat = new THREE.MeshStandardMaterial({
    color: 0x54341d,
    roughness: 0.88,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0xc25838,
    map: shingleTex,
    roughness: 0.78,
  });
  const sailCanvasMat = new THREE.MeshStandardMaterial({
    color: 0xfbf4e4,
    roughness: 0.72,
    side: THREE.DoubleSide,
  });

  // 1. Stone Octagonal Base
  const baseGeo = new THREE.CylinderGeometry(0.68, 0.82, 0.68, 8);
  const baseMesh = new THREE.Mesh(baseGeo, stoneMat);
  baseMesh.position.y = 0.32;
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  windmillGroup.add(baseMesh);

  // Wooden Gallery Trim Ring
  const galleryGeo = new THREE.CylinderGeometry(0.76, 0.76, 0.08, 8);
  const galleryMesh = new THREE.Mesh(galleryGeo, timberMat);
  galleryMesh.position.y = 0.67;
  galleryMesh.castShadow = true;
  windmillGroup.add(galleryMesh);

  // 2. Tapered Cream Tower Body
  const towerGeo = new THREE.CylinderGeometry(0.48, 0.66, 1.38, 8);
  const towerMesh = new THREE.Mesh(towerGeo, wallMat);
  towerMesh.position.y = 0.68 + 0.69;
  towerMesh.castShadow = true;
  towerMesh.receiveShadow = true;
  windmillGroup.add(towerMesh);

  // Conical Cap Roof
  const capGeo = new THREE.ConeGeometry(0.58, 0.64, 8);
  const capMesh = new THREE.Mesh(capGeo, roofMat);
  capMesh.position.y = 0.68 + 1.38 + 0.3;
  capMesh.castShadow = true;
  windmillGroup.add(capMesh);

  // Finial on top of windmill cap
  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 8),
    darkWoodMat
  );
  finial.position.y = 0.68 + 1.38 + 0.62;
  windmillGroup.add(finial);

  // Small wooden door at base of windmill
  const millDoor = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.46, 0.08),
    timberMat
  );
  millDoor.position.set(0, 0.25, 0.74);
  windmillGroup.add(millDoor);

  // Small glowing window on tower front
  const millWinFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.26, 0.06),
    darkWoodMat
  );
  millWinFrame.position.set(0, 1.25, 0.56);
  windmillGroup.add(millWinFrame);

  const millWinGlass = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.2, 0.07),
    windowMaterial
  );
  millWinGlass.position.set(0, 1.25, 0.56);
  windmillGroup.add(millWinGlass);

  // 3. Rotor Hub & 4 Rotating Blades
  const hubY = 1.98;
  const shaftGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.48, 10);
  shaftGeo.rotateX(Math.PI / 2);
  const shaft = new THREE.Mesh(shaftGeo, darkWoodMat);
  shaft.position.set(0, hubY, 0.42);
  shaft.castShadow = true;
  windmillGroup.add(shaft);

  const bladesGroup = new THREE.Group();
  bladesGroup.name = 'WindmillBlades';
  bladesGroup.position.set(0, hubY, 0.64);

  const noseCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.18, 8),
    darkWoodMat
  );
  noseCone.rotation.x = Math.PI / 2;
  noseCone.position.z = 0.05;
  bladesGroup.add(noseCone);

  // Create 4 distinct windmill sails
  const armLength = 1.48;
  const armGeo = new THREE.BoxGeometry(0.065, armLength, 0.055);
  const sailGeo = new THREE.BoxGeometry(0.32, armLength * 0.76, 0.018);
  const rungGeo = new THREE.BoxGeometry(0.35, 0.026, 0.03);

  for (let i = 0; i < 4; i++) {
    const bladePivot = new THREE.Group();
    bladePivot.rotation.z = (i * Math.PI) / 2;

    // Slight pitch angle so the sail catches the wind visually
    const pitchGroup = new THREE.Group();
    pitchGroup.rotation.y = 0.22;

    const arm = new THREE.Mesh(armGeo, darkWoodMat);
    arm.position.set(0, armLength / 2, 0);
    arm.castShadow = true;
    pitchGroup.add(arm);

    const sail = new THREE.Mesh(sailGeo, sailCanvasMat);
    sail.position.set(0.17, armLength * 0.56, 0);
    sail.castShadow = true;
    pitchGroup.add(sail);

    // Lattice rungs across the sail
    for (let r = 0; r < 5; r++) {
      const rung = new THREE.Mesh(rungGeo, timberMat);
      rung.position.set(0.17, armLength * 0.23 + r * 0.26, 0.005);
      pitchGroup.add(rung);
    }

    bladePivot.add(pitchGroup);
    bladesGroup.add(bladePivot);
  }

  windmillGroup.add(bladesGroup);

  return { windmillGroup, bladesGroup };
}

function buildEnvironmentalStructures(
  pathLanternMat: THREE.MeshStandardMaterial,
  glowTex: THREE.CanvasTexture
): {
  detailsGroup: THREE.Group;
  pathLight: THREE.PointLight;
} {
  const detailsGroup = new THREE.Group();
  detailsGroup.name = 'EnvironmentalStructures';

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x8f603b,
    roughness: 0.86,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x3b3632,
    roughness: 0.5,
    metalness: 0.5,
  });

  // 1. Rustic Wooden Fence Segments
  const addFenceLine = (points: Array<[number, number]>) => {
    const postGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.44, 6);
    for (let i = 0; i < points.length; i++) {
      const [px, pz] = points[i];
      const py = getIslandSurfaceHeight(px, pz);
      const post = new THREE.Mesh(postGeo, woodMat);
      post.position.set(px, py + 0.19, pz);
      post.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.03;
      post.castShadow = true;
      post.receiveShadow = true;
      detailsGroup.add(post);

      if (i < points.length - 1) {
        const [nx, nz] = points[i + 1];
        const ny = getIslandSurfaceHeight(nx, nz);
        const dx = nx - px;
        const dy = ny - py;
        const dz = nz - pz;
        const dist = Math.hypot(dx, dy, dz);

        const railGeo = new THREE.BoxGeometry(0.03, 0.045, dist);
        for (const railH of [0.14, 0.29]) {
          const rail = new THREE.Mesh(railGeo, woodMat);
          rail.position.set(
            (px + nx) / 2,
            (py + ny) / 2 + railH,
            (pz + nz) / 2
          );
          rail.lookAt(nx, ny + railH, nz);
          rail.castShadow = true;
          detailsGroup.add(rail);
        }
      }
    }
  };

  // Garden fence west of the house
  addFenceLine([
    [-2.75, 0.25],
    [-2.55, 0.95],
    [-2.15, 1.52],
    [-1.58, 1.85],
  ]);

  // Fence along the north ridge between house and windmill
  addFenceLine([
    [-0.15, -2.15],
    [0.52, -2.35],
    [1.18, -2.32],
  ]);

  // 2. Cozy Wooden Garden Bench overlooking the pond
  const benchGroup = new THREE.Group();
  const bx = -1.45;
  const bz = 1.65;
  const by = getIslandSurfaceHeight(bx, bz);
  benchGroup.position.set(bx, by, bz);
  benchGroup.rotation.y = Math.PI * 0.32;

  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.04, 0.22),
    woodMat
  );
  seat.position.set(0, 0.18, 0);
  seat.castShadow = true;
  benchGroup.add(seat);

  const backrest = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.16, 0.035),
    woodMat
  );
  backrest.position.set(0, 0.29, -0.09);
  backrest.rotation.x = -0.15;
  backrest.castShadow = true;
  benchGroup.add(backrest);

  const legGeo = new THREE.BoxGeometry(0.05, 0.18, 0.2);
  for (const lx of [-0.23, 0.23]) {
    const leg = new THREE.Mesh(legGeo, darkMetalMat);
    leg.position.set(lx, 0.09, 0);
    leg.castShadow = true;
    benchGroup.add(leg);
  }
  detailsGroup.add(benchGroup);

  // 3. Path Lamp Post near the pond crossroads
  const lx = -0.25;
  const lz = 0.55;
  const ly = getIslandSurfaceHeight(lx, lz);
  const lampGroup = new THREE.Group();
  lampGroup.position.set(lx, ly, lz);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.04, 0.72, 8),
    darkMetalMat
  );
  pole.position.y = 0.36;
  pole.castShadow = true;
  lampGroup.add(pole);

  const lampHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.05, 0.14, 6),
    pathLanternMat
  );
  lampHousing.position.y = 0.76;
  lampGroup.add(lampHousing);

  const lampHat = new THREE.Mesh(
    new THREE.ConeGeometry(0.095, 0.06, 6),
    darkMetalMat
  );
  lampHat.position.y = 0.85;
  lampGroup.add(lampHat);

  const lampGlow = createGlowSprite(glowTex, 0.45);
  lampGlow.position.y = 0.76;
  lampGlow.material.opacity = 0.35;
  lampGroup.add(lampGlow);

  const pathLight = new THREE.PointLight(0xffad42, 0.2, 3.2, 1.8);
  pathLight.position.set(0, 0.78, 0);
  lampGroup.add(pathLight);

  detailsGroup.add(lampGroup);

  return { detailsGroup, pathLight };
}

function createGlowSprite(
  glowTex: THREE.CanvasTexture,
  scale: number
): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    map: glowTex,
    color: 0xffb84d,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.setScalar(scale);
  return sprite;
}

