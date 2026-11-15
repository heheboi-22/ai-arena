import * as THREE from "three";
import { damp, groundHeightAt, HOUSE_CENTER } from "../util/math";
import type { ProceduralTextures } from "./textures";

export interface HouseRig {
  group: THREE.Group;
  interactiveMeshes: THREE.Object3D[];
  update: (
    dt: number,
    elapsed: number,
    lightsOn: boolean,
    nightness: number,
    windStrength: number,
    reducedMotion: boolean
  ) => void;
  dispose: () => void;
}

interface SmokePuff {
  sprite: THREE.Sprite;
  age: number;
  life: number;
  driftSeed: number;
}

export function createHouse(textures: ProceduralTextures): HouseRig {
  const group = new THREE.Group();
  group.name = "Cottage";

  const baseY = groundHeightAt(HOUSE_CENTER.x, HOUSE_CENTER.z);
  group.position.set(HOUSE_CENTER.x, baseY - 0.04, HOUSE_CENTER.z);
  group.rotation.y = -0.56;

  const disposables: { dispose: () => void }[] = [];
  const interactiveMeshes: THREE.Object3D[] = [];

  const tagInteractive = (obj: THREE.Object3D) => {
    obj.userData.isHouseTarget = true;
    interactiveMeshes.push(obj);
  };

  // Materials
  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stoneMap,
    color: "#999388",
    roughness: 0.92,
    metalness: 0.04,
  });
  const stuccoMat = new THREE.MeshStandardMaterial({
    map: textures.stuccoMap,
    color: "#f6efe2",
    roughness: 0.86,
    metalness: 0.02,
  });
  const timberMat = new THREE.MeshStandardMaterial({
    map: textures.woodMap,
    color: "#734e34",
    roughness: 0.78,
    metalness: 0.05,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    map: textures.shingleMap,
    color: "#b76148",
    roughness: 0.8,
    metalness: 0.04,
  });
  const shutterMat = new THREE.MeshStandardMaterial({
    color: "#5b7d65",
    roughness: 0.72,
    metalness: 0.04,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: "#d4a64a",
    roughness: 0.28,
    metalness: 0.85,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: "#3f5366",
    emissive: new THREE.Color("#ffb54a"),
    emissiveIntensity: 0,
    roughness: 0.2,
    metalness: 0.15,
  });
  const lanternBulbMat = new THREE.MeshStandardMaterial({
    color: "#ffe4b5",
    emissive: new THREE.Color("#ffbe5c"),
    emissiveIntensity: 0,
    roughness: 0.25,
    metalness: 0.05,
  });
  const flowerBoxMat = new THREE.MeshStandardMaterial({
    color: "#e67c6a",
    roughness: 0.7,
    metalness: 0.02,
  });
  const flowerLeafMat = new THREE.MeshStandardMaterial({
    color: "#578048",
    roughness: 0.85,
  });

  disposables.push(
    stoneMat,
    stuccoMat,
    timberMat,
    roofMat,
    shutterMat,
    brassMat,
    glassMat,
    lanternBulbMat,
    flowerBoxMat,
    flowerLeafMat
  );

  // 1. Stone Foundation Plinth (extends below terrain edge to guarantee no floating gap)
  const plinthGeo = new THREE.BoxGeometry(2.38, 0.42, 1.88);
  const plinth = new THREE.Mesh(plinthGeo, stoneMat);
  plinth.position.set(0, 0.09, 0);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);
  tagInteractive(plinth);
  disposables.push(plinthGeo);

  // 2. Main Stucco Body
  const bodyGeo = new THREE.BoxGeometry(2.14, 1.18, 1.66);
  const body = new THREE.Mesh(bodyGeo, stuccoMat);
  body.position.set(0, 0.88, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  tagInteractive(body);
  disposables.push(bodyGeo);

  // 3. Half-timber corner posts & horizontal fascia beams
  const cornerPostGeo = new THREE.BoxGeometry(0.11, 1.22, 0.11);
  const cornerOffsets: [number, number][] = [
    [-1.05, -0.81],
    [1.05, -0.81],
    [-1.05, 0.81],
    [1.05, 0.81],
  ];
  for (const [cx, cz] of cornerOffsets) {
    const post = new THREE.Mesh(cornerPostGeo, timberMat);
    post.position.set(cx, 0.88, cz);
    post.castShadow = true;
    group.add(post);
  }
  const beltBeamGeo = new THREE.BoxGeometry(2.22, 0.09, 1.74);
  const beltBeam = new THREE.Mesh(beltBeamGeo, timberMat);
  beltBeam.position.set(0, 1.44, 0);
  beltBeam.castShadow = true;
  group.add(beltBeam);
  disposables.push(cornerPostGeo, beltBeamGeo);

  // 4. Gable Walls (extruded triangle on left and right sides along X)
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-0.83, 0);
  gableShape.lineTo(0.83, 0);
  gableShape.lineTo(0, 0.92);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, {
    depth: 2.14,
    bevelEnabled: false,
  });
  gableGeo.rotateY(Math.PI * 0.5);
  gableGeo.translate(-1.07, 1.47, 0);
  const gableMesh = new THREE.Mesh(gableGeo, stuccoMat);
  gableMesh.castShadow = true;
  gableMesh.receiveShadow = true;
  group.add(gableMesh);
  tagInteractive(gableMesh);
  disposables.push(gableGeo);

  // 5. Pitched Gabled Roof (two thick beveled slopes + ridge cap)
  const slopeLen = Math.hypot(0.83 + 0.24, 0.92 + 0.2);
  const slopeAngle = Math.atan2(0.92, 0.83);
  const roofSlopeGeo = new THREE.BoxGeometry(2.56, 0.11, slopeLen);

  const frontSlope = new THREE.Mesh(roofSlopeGeo, roofMat);
  frontSlope.position.set(0, 1.88, 0.52);
  frontSlope.rotation.x = slopeAngle;
  frontSlope.castShadow = true;
  frontSlope.receiveShadow = true;
  group.add(frontSlope);
  tagInteractive(frontSlope);

  const backSlope = new THREE.Mesh(roofSlopeGeo, roofMat);
  backSlope.position.set(0, 1.88, -0.52);
  backSlope.rotation.x = -slopeAngle;
  backSlope.castShadow = true;
  backSlope.receiveShadow = true;
  group.add(backSlope);
  tagInteractive(backSlope);

  const ridgeGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8);
  ridgeGeo.rotateZ(Math.PI * 0.5);
  const ridge = new THREE.Mesh(ridgeGeo, timberMat);
  ridge.position.set(0, 2.38, 0);
  ridge.castShadow = true;
  group.add(ridge);
  disposables.push(roofSlopeGeo, ridgeGeo);

  // 6. Roof Dormer (adds artisanal charm on front slope)
  const dormerGroup = new THREE.Group();
  dormerGroup.position.set(-0.48, 1.72, 0.54);
  const dormerBoxGeo = new THREE.BoxGeometry(0.56, 0.44, 0.54);
  const dormerBox = new THREE.Mesh(dormerBoxGeo, stuccoMat);
  dormerBox.castShadow = true;
  dormerGroup.add(dormerBox);

  const dormerRoofGeo = new THREE.ConeGeometry(0.45, 0.34, 4);
  dormerRoofGeo.rotateY(Math.PI * 0.25);
  const dormerRoof = new THREE.Mesh(dormerRoofGeo, roofMat);
  dormerRoof.position.set(0, 0.37, 0);
  dormerRoof.scale.set(1.0, 1.0, 1.15);
  dormerRoof.castShadow = true;
  dormerGroup.add(dormerRoof);
  group.add(dormerGroup);
  tagInteractive(dormerBox);
  tagInteractive(dormerRoof);
  disposables.push(dormerBoxGeo, dormerRoofGeo);

  // 7. Cobblestone Chimney + Terracotta Chimney Pot
  const chimneyBaseGeo = new THREE.BoxGeometry(0.38, 1.45, 0.38);
  const chimneyBase = new THREE.Mesh(chimneyBaseGeo, stoneMat);
  chimneyBase.position.set(0.68, 2.02, -0.42);
  chimneyBase.castShadow = true;
  chimneyBase.receiveShadow = true;
  group.add(chimneyBase);
  tagInteractive(chimneyBase);

  const chimneyRimGeo = new THREE.BoxGeometry(0.46, 0.1, 0.46);
  const chimneyRim = new THREE.Mesh(chimneyRimGeo, stoneMat);
  chimneyRim.position.set(0.68, 2.74, -0.42);
  chimneyRim.castShadow = true;
  group.add(chimneyRim);

  const chimneyPotGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.22, 10);
  const chimneyPot = new THREE.Mesh(chimneyPotGeo, roofMat);
  chimneyPot.position.set(0.68, 2.86, -0.42);
  chimneyPot.castShadow = true;
  group.add(chimneyPot);
  disposables.push(chimneyBaseGeo, chimneyRimGeo, chimneyPotGeo);

  // 8. Front Covered Timber Porch + Steps + Arched Door
  const step1Geo = new THREE.BoxGeometry(0.86, 0.12, 0.54);
  const step1 = new THREE.Mesh(step1Geo, stoneMat);
  step1.position.set(-0.32, 0.26, 1.12);
  step1.castShadow = true;
  step1.receiveShadow = true;
  group.add(step1);

  const step2Geo = new THREE.BoxGeometry(0.7, 0.1, 0.32);
  const step2 = new THREE.Mesh(step2Geo, stoneMat);
  step2.position.set(-0.32, 0.12, 1.38);
  step2.receiveShadow = true;
  group.add(step2);

  const porchPostGeo = new THREE.CylinderGeometry(0.04, 0.045, 0.94, 8);
  for (const px of [-0.68, 0.04]) {
    const post = new THREE.Mesh(porchPostGeo, timberMat);
    post.position.set(px, 0.78, 1.28);
    post.castShadow = true;
    group.add(post);
  }
  const porchRoofGeo = new THREE.BoxGeometry(0.96, 0.07, 0.62);
  const porchRoof = new THREE.Mesh(porchRoofGeo, roofMat);
  porchRoof.position.set(-0.32, 1.31, 1.11);
  porchRoof.rotation.x = 0.26;
  porchRoof.castShadow = true;
  group.add(porchRoof);
  tagInteractive(porchRoof);

  // Arched Oak Front Door
  const doorFrameGeo = new THREE.BoxGeometry(0.46, 0.78, 0.08);
  const doorFrame = new THREE.Mesh(doorFrameGeo, timberMat);
  doorFrame.position.set(-0.32, 0.7, 0.83);
  group.add(doorFrame);

  const doorPanelGeo = new THREE.BoxGeometry(0.36, 0.72, 0.09);
  const doorPanel = new THREE.Mesh(doorPanelGeo, timberMat);
  doorPanel.position.set(-0.32, 0.68, 0.84);
  group.add(doorPanel);
  tagInteractive(doorPanel);

  const knobGeo = new THREE.SphereGeometry(0.028, 8, 8);
  const knob = new THREE.Mesh(knobGeo, brassMat);
  knob.position.set(-0.2, 0.68, 0.895);
  group.add(knob);
  disposables.push(step1Geo, step2Geo, porchPostGeo, porchRoofGeo, doorFrameGeo, doorPanelGeo, knobGeo);

  // 9. Hanging Brass Porch Lantern
  const lanternGroup = new THREE.Group();
  lanternGroup.position.set(0.06, 1.1, 1.15);
  const capGeo = new THREE.ConeGeometry(0.075, 0.08, 6);
  const cap = new THREE.Mesh(capGeo, brassMat);
  cap.position.y = 0.07;
  lanternGroup.add(cap);
  const bulbGeo = new THREE.CylinderGeometry(0.042, 0.036, 0.1, 6);
  const bulb = new THREE.Mesh(bulbGeo, lanternBulbMat);
  lanternGroup.add(bulb);
  group.add(lanternGroup);
  disposables.push(capGeo, bulbGeo);

  // Helper to construct framed paned window with optional shutters & flower box
  const frameGeo = new THREE.BoxGeometry(0.46, 0.44, 0.07);
  const paneGeo = new THREE.BoxGeometry(0.36, 0.34, 0.08);
  const mullionVGeo = new THREE.BoxGeometry(0.03, 0.36, 0.095);
  const mullionHGeo = new THREE.BoxGeometry(0.38, 0.03, 0.095);
  const shutterGeo = new THREE.BoxGeometry(0.14, 0.44, 0.045);
  const planterGeo = new THREE.BoxGeometry(0.46, 0.1, 0.14);
  const bloomGeo = new THREE.SphereGeometry(0.045, 7, 6);
  disposables.push(frameGeo, paneGeo, mullionVGeo, mullionHGeo, shutterGeo, planterGeo, bloomGeo);

  function addWindow(
    x: number,
    y: number,
    z: number,
    rotY: number,
    scale = 1,
    withShutters = true,
    withFlowers = false
  ) {
    const w = new THREE.Group();
    w.position.set(x, y, z);
    w.rotation.y = rotY;
    w.scale.setScalar(scale);

    const frame = new THREE.Mesh(frameGeo, timberMat);
    const pane = new THREE.Mesh(paneGeo, glassMat);
    const mv = new THREE.Mesh(mullionVGeo, timberMat);
    const mh = new THREE.Mesh(mullionHGeo, timberMat);
    w.add(frame, pane, mv, mh);
    tagInteractive(pane);
    tagInteractive(frame);

    if (withShutters) {
      const sl = new THREE.Mesh(shutterGeo, shutterMat);
      sl.position.set(-0.3, 0, 0.01);
      const sr = new THREE.Mesh(shutterGeo, shutterMat);
      sr.position.set(0.3, 0, 0.01);
      w.add(sl, sr);
    }

    if (withFlowers) {
      const box = new THREE.Mesh(planterGeo, timberMat);
      box.position.set(0, -0.26, 0.07);
      w.add(box);
      for (let i = -1; i <= 1; i++) {
        const leaf = new THREE.Mesh(bloomGeo, flowerLeafMat);
        leaf.position.set(i * 0.13, -0.19, 0.08);
        const flower = new THREE.Mesh(bloomGeo, flowerBoxMat);
        flower.position.set(i * 0.13, -0.15, 0.09);
        flower.scale.setScalar(0.72);
        w.add(leaf, flower);
      }
    }
    group.add(w);
  }

  // Front double window, dormer window, side windows, back window
  addWindow(0.54, 0.88, 0.83, 0, 1.08, true, true);
  addWindow(-0.48, 1.72, 0.81, 0, 0.72, false, false);
  addWindow(1.07, 0.9, -0.1, Math.PI * 0.5, 0.96, true, true);
  addWindow(-1.07, 0.9, -0.1, -Math.PI * 0.5, 0.96, true, false);
  addWindow(-0.35, 0.9, -0.83, Math.PI, 0.95, true, false);

  // Round gable attic windows
  const roundFrameGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 14);
  roundFrameGeo.rotateZ(Math.PI * 0.5);
  const roundGlassGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.09, 14);
  roundGlassGeo.rotateZ(Math.PI * 0.5);
  disposables.push(roundFrameGeo, roundGlassGeo);

  for (const sx of [-1.06, 1.06]) {
    const rf = new THREE.Mesh(roundFrameGeo, timberMat);
    rf.position.set(sx, 1.82, 0);
    const rg = new THREE.Mesh(roundGlassGeo, glassMat);
    rg.position.set(sx, 1.82, 0);
    group.add(rf, rg);
    tagInteractive(rg);
  }

  // 10. Warm House PointLight (illuminates porch, path, and pond edge when lights are on)
  const housePointLight = new THREE.PointLight("#ffaa48", 0, 8.5, 1.65);
  housePointLight.position.set(0.15, 1.05, 1.38);
  group.add(housePointLight);

  // 11. Pooled Rising Chimney Smoke Puffs
  const smokeMat = new THREE.SpriteMaterial({
    map: textures.softSprite,
    color: "#ebe7df",
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  disposables.push(smokeMat);

  const smokePuffs: SmokePuff[] = [];
  const PUFF_COUNT = 10;
  for (let i = 0; i < PUFF_COUNT; i++) {
    const mat = smokeMat.clone();
    disposables.push(mat);
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(0.68, 2.98, -0.42);
    sprite.scale.setScalar(0.18);
    group.add(sprite);
    smokePuffs.push({
      sprite,
      age: (i / PUFF_COUNT) * 3.8,
      life: 3.8,
      driftSeed: i * 1.7,
    });
  }

  let lightMix = 0;

  const update = (
    dt: number,
    elapsed: number,
    lightsOn: boolean,
    nightness: number,
    windStrength: number,
    reducedMotion: boolean
  ) => {
    const targetLight = lightsOn ? 1 : 0;
    lightMix = damp(lightMix, targetLight, 6.5, dt);

    // Subtle twilight hint when off, strong warm amber glow when on
    const currentEmissive = lightMix * (1.55 + nightness * 0.95) + (1 - lightMix) * nightness * 0.04;

    glassMat.emissiveIntensity = currentEmissive;
    glassMat.color.setRGB(
      0.247 + lightMix * 0.72,
      0.325 + lightMix * 0.44,
      0.4 + lightMix * -0.14
    );
    lanternBulbMat.emissiveIntensity = lightMix * (2.1 + nightness * 0.9);
    housePointLight.intensity = lightMix * (2.4 + nightness * 2.1);

    // Gentle breeze smoke from chimney
    const smokeSpeed = reducedMotion ? 0.35 : 0.85;
    const windDriftX = Math.cos(0.45) * (windStrength * 1.65);
    const windDriftZ = Math.sin(0.45) * (windStrength * 1.05);

    for (const p of smokePuffs) {
      p.age += dt * smokeSpeed;
      if (p.age >= p.life) {
        p.age -= p.life;
      }
      const t = p.age / p.life;
      const rise = t * 1.55;
      const sway = Math.sin(elapsed * 1.5 + p.driftSeed) * 0.08 * t;
      p.sprite.position.set(
        0.68 + windDriftX * t * t + sway,
        2.98 + rise,
        -0.42 + windDriftZ * t * t + sway * 0.5
      );
      const scale = 0.14 + t * 0.42;
      p.sprite.scale.setScalar(scale);
      const mat = p.sprite.material as THREE.SpriteMaterial;
      const envelope = Math.sin(t * Math.PI);
      mat.opacity = envelope * (reducedMotion ? 0.18 : 0.36) * (0.65 + currentEmissive * 0.15);
    }
  };

  const dispose = () => {
    for (const d of disposables) d.dispose();
  };

  return {
    group,
    interactiveMeshes,
    update,
    dispose,
  };
}

