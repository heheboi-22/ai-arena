import * as THREE from 'three';
import {
  HOUSE_ANCHOR,
  WINDMILL_KNOLL,
  getIslandSurfaceHeight,
} from '../state/worldState';
import { SceneMaterials } from './materials';

export interface ArchitectureBuildResult {
  houseGroup: THREE.Group;
  houseHitTargets: THREE.Object3D[];
  housePointLight: THREE.PointLight;
  porchPointLight: THREE.PointLight;
  chimneySmokeOrigin: THREE.Vector3;
  windmillGroup: THREE.Group;
  windmillBladesPivot: THREE.Group;
}

function buildWindowUnit(
  width: number,
  height: number,
  materials: SceneMaterials,
  withShutters: boolean,
): THREE.Group {
  const win = new THREE.Group();

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.08, height + 0.08, 0.06),
    materials.woodDark,
  );
  frame.castShadow = true;
  win.add(frame);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, 0.075),
    materials.windowGlass,
  );
  win.add(glass);

  // Mullion crossbars
  const vBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, height, 0.085),
    materials.woodDark,
  );
  const hBar = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.025, 0.085),
    materials.woodDark,
  );
  win.add(vBar, hBar);

  // Sill
  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.14, 0.045, 0.11),
    materials.woodWarm,
  );
  sill.position.set(0, -height / 2 - 0.03, 0.025);
  sill.castShadow = true;
  win.add(sill);

  if (withShutters) {
    const shutterGeo = new THREE.BoxGeometry(width * 0.42, height + 0.04, 0.035);
    const leftShutter = new THREE.Mesh(shutterGeo, materials.woodWarm);
    leftShutter.position.set(-(width / 2 + width * 0.25 + 0.04), 0, 0.015);
    leftShutter.castShadow = true;
    const rightShutter = new THREE.Mesh(shutterGeo, materials.woodWarm);
    rightShutter.position.set(width / 2 + width * 0.25 + 0.04, 0, 0.015);
    rightShutter.castShadow = true;
    win.add(leftShutter, rightShutter);
  }

  return win;
}

function createExtrudedGableRoof(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
): THREE.Mesh {
  const halfW = width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfW, 0);
  shape.lineTo(halfW, 0);
  shape.lineTo(0, height);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildHouse(materials: SceneMaterials): {
  houseGroup: THREE.Group;
  houseHitTargets: THREE.Object3D[];
  housePointLight: THREE.PointLight;
  porchPointLight: THREE.PointLight;
  chimneySmokeOrigin: THREE.Vector3;
} {
  const houseGroup = new THREE.Group();
  houseGroup.name = 'CottageHouse';

  const groundY = getIslandSurfaceHeight(HOUSE_ANCHOR.x, HOUSE_ANCHOR.z);
  houseGroup.position.set(HOUSE_ANCHOR.x, groundY, HOUSE_ANCHOR.z);
  houseGroup.rotation.y = 0.46; // Face toward the three-quarter camera and pond path

  // Stone foundation plinth
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(1.76, 0.24, 1.44),
    materials.stoneGrey,
  );
  plinth.position.y = 0.08;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  houseGroup.add(plinth);

  // Main cream plaster walls
  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(1.62, 1.02, 1.3),
    materials.wallCream,
  );
  walls.position.y = 0.69;
  walls.castShadow = true;
  walls.receiveShadow = true;
  houseGroup.add(walls);

  // Exposed corner timber posts & horizontal trim beam
  const postGeo = new THREE.BoxGeometry(0.08, 1.04, 0.08);
  const corners: Array<[number, number]> = [
    [-0.8, -0.64],
    [0.8, -0.64],
    [-0.8, 0.64],
    [0.8, 0.64],
  ];
  for (const [cx, cz] of corners) {
    const post = new THREE.Mesh(postGeo, materials.woodDark);
    post.position.set(cx, 0.69, cz);
    post.castShadow = true;
    houseGroup.add(post);
  }

  const trimBeam = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.07, 1.38),
    materials.woodDark,
  );
  trimBeam.position.y = 1.21;
  trimBeam.castShadow = true;
  houseGroup.add(trimBeam);

  // Gable core wall + overhanging terracotta pitched roof
  const gableFill = createExtrudedGableRoof(1.58, 0.72, 1.28, materials.wallCream);
  gableFill.position.y = 1.22;
  houseGroup.add(gableFill);

  // Left & right roof slopes for crisp overhanging eaves
  const slopeLen = Math.hypot(0.95, 0.84);
  const slopeAngle = Math.atan2(0.84, 0.95);
  const slopeGeo = new THREE.BoxGeometry(slopeLen, 0.09, 1.56);

  const leftSlope = new THREE.Mesh(slopeGeo, materials.roofTerracotta);
  leftSlope.position.set(-0.46, 1.59, 0);
  leftSlope.rotation.z = slopeAngle;
  leftSlope.castShadow = true;
  leftSlope.receiveShadow = true;
  houseGroup.add(leftSlope);

  const rightSlope = new THREE.Mesh(slopeGeo, materials.roofTerracotta);
  rightSlope.position.set(0.46, 1.59, 0);
  rightSlope.rotation.z = -slopeAngle;
  rightSlope.castShadow = true;
  rightSlope.receiveShadow = true;
  houseGroup.add(rightSlope);

  // Ridge beam cap
  const ridgeCap = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.1, 1.6),
    materials.woodDark,
  );
  ridgeCap.position.set(0, 1.98, 0);
  ridgeCap.castShadow = true;
  houseGroup.add(ridgeCap);

  // Side dormer window facing pond
  const dormerGroup = new THREE.Group();
  dormerGroup.position.set(0.48, 1.55, 0.22);
  dormerGroup.rotation.y = Math.PI / 2;
  const dormerBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.34, 0.42),
    materials.wallCream,
  );
  dormerBody.castShadow = true;
  const dormerRoof = createExtrudedGableRoof(0.52, 0.24, 0.48, materials.roofTerracotta);
  dormerRoof.position.y = 0.16;
  const dormerWin = buildWindowUnit(0.24, 0.22, materials, false);
  dormerWin.position.set(0, 0, 0.21);
  dormerGroup.add(dormerBody, dormerRoof, dormerWin);
  houseGroup.add(dormerGroup);

  // Stone chimney + clay chimney pot
  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 1.05, 0.28),
    materials.stoneGrey,
  );
  chimney.position.set(-0.48, 1.85, -0.35);
  chimney.castShadow = true;
  chimney.receiveShadow = true;
  houseGroup.add(chimney);

  const chimneyRim = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.08, 0.35),
    materials.stoneGrey,
  );
  chimneyRim.position.set(-0.48, 2.38, -0.35);
  chimneyRim.castShadow = true;
  houseGroup.add(chimneyRim);

  const chimneyPot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.09, 0.18, 10),
    materials.roofTerracotta,
  );
  chimneyPot.position.set(-0.48, 2.49, -0.35);
  chimneyPot.castShadow = true;
  houseGroup.add(chimneyPot);

  // Front wooden door + frame + stone threshold steps + porch awning + lantern
  const doorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.68, 0.08),
    materials.woodDark,
  );
  doorFrame.position.set(-0.26, 0.54, 0.65);
  const doorPanel = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.6, 0.09),
    materials.woodWarm,
  );
  doorPanel.position.set(-0.26, 0.52, 0.66);
  const doorKnob = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 8, 8),
    materials.brass,
  );
  doorKnob.position.set(-0.14, 0.5, 0.72);
  houseGroup.add(doorFrame, doorPanel, doorKnob);

  // Porch steps
  const step1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.1, 0.34),
    materials.stoneGrey,
  );
  step1.position.set(-0.26, 0.06, 0.85);
  step1.receiveShadow = true;
  step1.castShadow = true;
  const step2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.09, 0.24),
    materials.stoneGrey,
  );
  step2.position.set(-0.26, 0.14, 0.78);
  step2.receiveShadow = true;
  houseGroup.add(step1, step2);

  // Porch awning + posts
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.06, 0.42),
    materials.roofTerracotta,
  );
  awning.position.set(-0.26, 0.99, 0.84);
  awning.rotation.x = 0.24;
  awning.castShadow = true;
  houseGroup.add(awning);

  const porchPostGeo = new THREE.CylinderGeometry(0.028, 0.032, 0.86, 8);
  const leftPost = new THREE.Mesh(porchPostGeo, materials.woodDark);
  leftPost.position.set(-0.54, 0.52, 0.96);
  leftPost.castShadow = true;
  const rightPost = new THREE.Mesh(porchPostGeo, materials.woodDark);
  rightPost.position.set(0.02, 0.52, 0.96);
  rightPost.castShadow = true;
  houseGroup.add(leftPost, rightPost);

  // Porch hanging lantern
  const lanternCap = new THREE.Mesh(
    new THREE.ConeGeometry(0.065, 0.06, 6),
    materials.woodDark,
  );
  lanternCap.position.set(0.08, 0.88, 0.72);
  const lanternBulb = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.09, 0.065),
    materials.lanternGlow,
  );
  lanternBulb.position.set(0.08, 0.82, 0.72);
  houseGroup.add(lanternCap, lanternBulb);

  // Windows on front, sides, and back
  const frontWin = buildWindowUnit(0.32, 0.34, materials, true);
  frontWin.position.set(0.38, 0.68, 0.65);
  houseGroup.add(frontWin);

  const rightWin = buildWindowUnit(0.34, 0.34, materials, true);
  rightWin.position.set(0.81, 0.68, 0);
  rightWin.rotation.y = Math.PI / 2;
  houseGroup.add(rightWin);

  const leftWin = buildWindowUnit(0.34, 0.34, materials, true);
  leftWin.position.set(-0.81, 0.68, 0.08);
  leftWin.rotation.y = -Math.PI / 2;
  houseGroup.add(leftWin);

  const backWin = buildWindowUnit(0.36, 0.34, materials, true);
  backWin.position.set(0.24, 0.68, -0.65);
  backWin.rotation.y = Math.PI;
  houseGroup.add(backWin);

  const gableWin = buildWindowUnit(0.24, 0.24, materials, false);
  gableWin.position.set(0, 1.48, 0.65);
  houseGroup.add(gableWin);

  // Mark every mesh inside houseGroup as a clickable house target
  const houseHitTargets: THREE.Object3D[] = [];
  houseGroup.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.userData.isHouse = true;
      houseHitTargets.push(child);
    }
  });

  // Warm house illumination lights (intensity driven by houseLightFactor)
  const housePointLight = new THREE.PointLight(0xffb454, 0, 6.2, 1.7);
  housePointLight.position.set(0.35, 0.85, 1.05);
  houseGroup.add(housePointLight);

  const porchPointLight = new THREE.PointLight(0xffc36d, 0, 4.5, 1.8);
  porchPointLight.position.set(0.1, 0.9, -0.95);
  houseGroup.add(porchPointLight);

  // Compute world-space chimney smoke spawn point
  houseGroup.updateMatrixWorld(true);
  const chimneySmokeOrigin = new THREE.Vector3(-0.48, 2.62, -0.35);
  houseGroup.localToWorld(chimneySmokeOrigin);

  return {
    houseGroup,
    houseHitTargets,
    housePointLight,
    porchPointLight,
    chimneySmokeOrigin,
  };
}

function buildWindmill(materials: SceneMaterials): {
  windmillGroup: THREE.Group;
  windmillBladesPivot: THREE.Group;
} {
  const windmillGroup = new THREE.Group();
  windmillGroup.name = 'Windmill';

  const groundY = getIslandSurfaceHeight(WINDMILL_KNOLL.x, WINDMILL_KNOLL.z);
  windmillGroup.position.set(WINDMILL_KNOLL.x, groundY - 0.04, WINDMILL_KNOLL.z);
  windmillGroup.rotation.y = 0.65;

  // Stone base plinth
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.54, 0.64, 0.38, 8),
    materials.stoneGrey,
  );
  base.position.y = 0.19;
  base.castShadow = true;
  base.receiveShadow = true;
  windmillGroup.add(base);

  // Tapered cream plaster tower
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.52, 1.48, 8),
    materials.wallCream,
  );
  tower.position.y = 1.1;
  tower.castShadow = true;
  tower.receiveShadow = true;
  windmillGroup.add(tower);

  // Timber collar rings
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.41, 0.42, 0.08, 8),
    materials.woodDark,
  );
  collar.position.y = 1.84;
  collar.castShadow = true;
  windmillGroup.add(collar);

  // Small arched door & tower window
  const millDoor = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.42, 0.08),
    materials.woodWarm,
  );
  millDoor.position.set(0, 0.36, 0.5);
  windmillGroup.add(millDoor);

  const millWin = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.22, 0.06),
    materials.windowGlass,
  );
  millWin.position.set(0, 1.24, 0.42);
  windmillGroup.add(millWin);

  // Conical terracotta cap + brass finial
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(0.47, 0.64, 8),
    materials.roofTerracotta,
  );
  cap.position.y = 2.18;
  cap.castShadow = true;
  windmillGroup.add(cap);

  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 10, 10),
    materials.brass,
  );
  finial.position.y = 2.52;
  windmillGroup.add(finial);

  // Rotor hub & 4 lattice-and-sail blades
  const windmillBladesPivot = new THREE.Group();
  windmillBladesPivot.position.set(0, 1.72, 0.44);
  windmillGroup.add(windmillBladesPivot);

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.065, 0.24, 10),
    materials.woodDark,
  );
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 0.04;
  shaft.castShadow = true;
  windmillBladesPivot.add(shaft);

  const hubCap = new THREE.Mesh(
    new THREE.ConeGeometry(0.085, 0.14, 8),
    materials.woodWarm,
  );
  hubCap.rotation.x = Math.PI / 2;
  hubCap.position.z = 0.18;
  windmillBladesPivot.add(hubCap);

  const sparGeo = new THREE.BoxGeometry(0.045, 1.06, 0.04);
  const sailGeo = new THREE.BoxGeometry(0.24, 0.84, 0.014);
  const rungGeo = new THREE.BoxGeometry(0.28, 0.022, 0.025);

  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;

    const spar = new THREE.Mesh(sparGeo, materials.woodDark);
    spar.position.set(0, 0.56, 0.08);
    spar.castShadow = true;
    arm.add(spar);

    const sail = new THREE.Mesh(sailGeo, materials.sailCloth);
    sail.position.set(0.14, 0.66, 0.085);
    sail.rotation.y = 0.14;
    sail.castShadow = true;
    sail.receiveShadow = true;
    arm.add(sail);

    for (let r = 0; r < 4; r++) {
      const rung = new THREE.Mesh(rungGeo, materials.woodWarm);
      rung.position.set(0.13, 0.34 + r * 0.21, 0.09);
      arm.add(rung);
    }

    windmillBladesPivot.add(arm);
  }

  return { windmillGroup, windmillBladesPivot };
}

export function buildArchitecture(materials: SceneMaterials): ArchitectureBuildResult {
  const house = buildHouse(materials);
  const windmill = buildWindmill(materials);
  return {
    ...house,
    ...windmill,
  };
}
