import * as THREE from "three";
import { AtmosphereSnapshot, WindDerived, clamp } from "../state/worldState";
import { LANDMARKS, getIslandTopHeight } from "./terrainMath";
import { ProceduralTextures } from "./textures";

export interface HouseSystem {
  group: THREE.Group;
  hitTargets: THREE.Object3D[];
  update: (
    dt: number,
    elapsed: number,
    lightsOn: boolean,
    atmosphere: AtmosphereSnapshot,
    wind: WindDerived,
    reducedMotion: boolean
  ) => void;
  setHovered: (hovered: boolean) => void;
  dispose: () => void;
}

interface SmokePuff {
  mesh: THREE.Mesh;
  age: number;
  life: number;
  offsetPhase: number;
}

export function createHouse(textures: ProceduralTextures): HouseSystem {
  const group = new THREE.Group();
  group.name = "Cottage";

  const groundY = getIslandTopHeight(LANDMARKS.house.x, LANDMARKS.house.z);
  group.position.set(LANDMARKS.house.x, groundY, LANDMARKS.house.z);
  group.rotation.y = LANDMARKS.house.rotationY;

  const disposables: Array<{ dispose: () => void }> = [];
  const hitTargets: THREE.Object3D[] = [];

  // Materials — cohesive cream plaster, warm wood, terracotta shingles, sage shutters, amber glow glass
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.stoneMap,
    bumpMap: textures.stoneBump,
    bumpScale: 0.04,
    roughness: 0.9,
    metalness: 0.03,
  });

  const plasterMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.plasterMap,
    bumpMap: textures.plasterBump,
    bumpScale: 0.025,
    roughness: 0.86,
    metalness: 0.0,
  });

  const timberMat = new THREE.MeshStandardMaterial({
    color: 0x8e6240,
    map: textures.woodMap,
    bumpMap: textures.woodBump,
    bumpScale: 0.025,
    roughness: 0.78,
    metalness: 0.02,
  });

  const darkWoodMat = new THREE.MeshStandardMaterial({
    color: 0x67422a,
    map: textures.woodMap,
    roughness: 0.75,
    metalness: 0.03,
  });

  const roofMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.shingleMap,
    bumpMap: textures.shingleBump,
    bumpScale: 0.045,
    roughness: 0.78,
    metalness: 0.04,
  });

  const shutterMat = new THREE.MeshStandardMaterial({
    color: 0x5c7769,
    roughness: 0.72,
    metalness: 0.02,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc9a15a,
    roughness: 0.3,
    metalness: 0.82,
  });

  const windowGlassMat = new THREE.MeshStandardMaterial({
    color: 0x526b7a,
    roughness: 0.22,
    metalness: 0.18,
    emissive: new THREE.Color(0xffaa3d),
    emissiveIntensity: 0,
  });

  const lanternGlassMat = new THREE.MeshStandardMaterial({
    color: 0xd9cdb8,
    roughness: 0.28,
    metalness: 0.05,
    emissive: new THREE.Color(0xffbc57),
    emissiveIntensity: 0,
  });

  const bloomMat = new THREE.MeshStandardMaterial({
    color: 0xe68b6b,
    roughness: 0.7,
  });

  disposables.push(
    stoneMat,
    plasterMat,
    timberMat,
    darkWoodMat,
    roofMat,
    shutterMat,
    brassMat,
    windowGlassMat,
    lanternGlassMat,
    bloomMat
  );

  const addMesh = (geo: THREE.BufferGeometry, mat: THREE.Material, cast = true, receive = true) => {
    disposables.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = receive;
    m.userData.interactive = "house";
    return m;
  };

  // 1. Grounded stone plinth foundation (sinks -0.26 below y=0 so zero floating ever)
  const plinth = addMesh(new THREE.BoxGeometry(2.38, 0.56, 1.98), stoneMat);
  plinth.position.set(0, 0.02, 0);
  group.add(plinth);

  // 2. Main cream plaster walls
  const bodyW = 2.22;
  const bodyH = 1.38;
  const bodyD = 1.82;
  const wallBaseY = 0.3;
  const body = addMesh(new THREE.BoxGeometry(bodyW, bodyH, bodyD), plasterMat);
  body.position.set(0, wallBaseY + bodyH / 2, 0);
  group.add(body);

  // Triangular gable end walls (left and right along X, ridge runs along X!)
  const roofRise = 1.15;
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-bodyD / 2, 0);
  gableShape.lineTo(bodyD / 2, 0);
  gableShape.lineTo(0, roofRise);
  gableShape.closePath();

  const gableGeo = new THREE.ExtrudeGeometry(gableShape, {
    depth: bodyW - 0.02,
    bevelEnabled: false,
  });
  gableGeo.rotateY(Math.PI / 2);
  gableGeo.translate(-(bodyW - 0.02) / 2, wallBaseY + bodyH, 0);
  const gables = addMesh(gableGeo, plasterMat);
  group.add(gables);

  // 3. Half-timbering corner posts & horizontal beams
  const postGeo = new THREE.BoxGeometry(0.11, bodyH + 0.04, 0.11);
  disposables.push(postGeo);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const p = new THREE.Mesh(postGeo, timberMat);
      p.position.set(sx * (bodyW / 2 - 0.02), wallBaseY + bodyH / 2, sz * (bodyD / 2 - 0.02));
      p.castShadow = true;
      p.receiveShadow = true;
      p.userData.interactive = "house";
      group.add(p);
    }
  }
  // Upper fascia timber beam wrapping front & back
  const topBeamFront = addMesh(new THREE.BoxGeometry(bodyW + 0.08, 0.1, 0.09), timberMat);
  topBeamFront.position.set(0, wallBaseY + bodyH - 0.02, bodyD / 2 + 0.01);
  group.add(topBeamFront);

  const topBeamBack = addMesh(new THREE.BoxGeometry(bodyW + 0.08, 0.1, 0.09), timberMat);
  topBeamBack.position.set(0, wallBaseY + bodyH - 0.02, -bodyD / 2 - 0.01);
  group.add(topBeamBack);

  // Side timber trim beams on gable walls
  for (const sx of [-1, 1]) {
    const sideBeam = addMesh(new THREE.BoxGeometry(0.08, 0.1, bodyD + 0.06), timberMat);
    sideBeam.position.set(sx * (bodyW / 2 + 0.01), wallBaseY + bodyH - 0.02, 0);
    group.add(sideBeam);
  }

  // 4. Sculpted pitched terracotta shingle roof with generous overhanging eaves
  const slopeAngle = Math.atan2(roofRise, bodyD / 2);
  const slopeLen = Math.hypot(roofRise, bodyD / 2) + 0.42;
  const roofSpanX = bodyW + 0.56;
  const roofThickness = 0.12;

  const frontSlope = addMesh(new THREE.BoxGeometry(roofSpanX, roofThickness, slopeLen), roofMat);
  frontSlope.position.set(
    0,
    wallBaseY + bodyH + roofRise * 0.5 - 0.06,
    bodyD * 0.25 + 0.09
  );
  frontSlope.rotation.x = slopeAngle;
  group.add(frontSlope);

  const backSlope = addMesh(new THREE.BoxGeometry(roofSpanX, roofThickness, slopeLen), roofMat);
  backSlope.position.set(
    0,
    wallBaseY + bodyH + roofRise * 0.5 - 0.06,
    -(bodyD * 0.25 + 0.09)
  );
  backSlope.rotation.x = -slopeAngle;
  group.add(backSlope);

  // Ridge beam cap
  const ridgeCap = addMesh(new THREE.CylinderGeometry(0.09, 0.09, roofSpanX + 0.04, 6), timberMat);
  ridgeCap.rotation.z = Math.PI / 2;
  ridgeCap.position.set(0, wallBaseY + bodyH + roofRise + 0.05, 0);
  group.add(ridgeCap);

  // Decorative timber bargeboards on gable roof edges
  const bargeGeo = new THREE.BoxGeometry(0.07, 0.15, slopeLen + 0.04);
  disposables.push(bargeGeo);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const barge = new THREE.Mesh(bargeGeo, timberMat);
      barge.position.set(
        sx * (roofSpanX / 2 - 0.02),
        wallBaseY + bodyH + roofRise * 0.5 - 0.08,
        sz * (bodyD * 0.25 + 0.09)
      );
      barge.rotation.x = sz * slopeAngle;
      barge.castShadow = true;
      barge.userData.interactive = "house";
      group.add(barge);
    }
  }

  // 5. Charming roof dormer on front slope (+Z)
  const dormerGroup = new THREE.Group();
  dormerGroup.position.set(0.32, wallBaseY + bodyH + 0.32, bodyD * 0.26);
  const dormerBox = addMesh(new THREE.BoxGeometry(0.68, 0.58, 0.72), plasterMat);
  dormerGroup.add(dormerBox);

  const dRoofL = addMesh(new THREE.BoxGeometry(0.52, 0.07, 0.88), roofMat);
  dRoofL.position.set(-0.2, 0.37, 0.05);
  dRoofL.rotation.z = 0.56;
  dormerGroup.add(dRoofL);

  const dRoofR = addMesh(new THREE.BoxGeometry(0.52, 0.07, 0.88), roofMat);
  dRoofR.position.set(0.2, 0.37, 0.05);
  dRoofR.rotation.z = -0.56;
  dormerGroup.add(dRoofR);

  const dGlass = addMesh(new THREE.BoxGeometry(0.36, 0.34, 0.05), windowGlassMat, false, false);
  dGlass.position.set(0, 0.02, 0.35);
  dormerGroup.add(dGlass);

  const dFrame = addMesh(new THREE.BoxGeometry(0.44, 0.42, 0.04), timberMat, false, true);
  dFrame.position.set(0, 0.02, 0.33);
  dormerGroup.add(dFrame);

  // Dormer mullions
  const dMullionV = addMesh(new THREE.BoxGeometry(0.035, 0.36, 0.06), timberMat, false, false);
  dMullionV.position.set(0, 0.02, 0.36);
  dormerGroup.add(dMullionV);
  const dMullionH = addMesh(new THREE.BoxGeometry(0.38, 0.035, 0.06), timberMat, false, false);
  dMullionH.position.set(0, 0.02, 0.36);
  dormerGroup.add(dMullionH);

  group.add(dormerGroup);

  // 6. Stone chimney with corbeled crown & terracotta pot
  const chimneyX = -0.68;
  const chimneyZ = -0.32;
  const chimneyShaft = addMesh(new THREE.BoxGeometry(0.42, 1.55, 0.42), stoneMat);
  chimneyShaft.position.set(chimneyX, wallBaseY + bodyH + 0.65, chimneyZ);
  group.add(chimneyShaft);

  const chimneyCrown = addMesh(new THREE.BoxGeometry(0.52, 0.12, 0.52), stoneMat);
  chimneyCrown.position.set(chimneyX, wallBaseY + bodyH + 1.44, chimneyZ);
  group.add(chimneyCrown);

  const chimneyPot = addMesh(new THREE.CylinderGeometry(0.1, 0.12, 0.24, 8), roofMat);
  chimneyPot.position.set(chimneyX, wallBaseY + bodyH + 1.6, chimneyZ);
  group.add(chimneyPot);

  // 7. Front Door, Stone Steps, Porch Canopy & Hanging Porch Lantern (+Z front face)
  const doorX = -0.44;
  const frontZ = bodyD / 2;

  const doorFrame = addMesh(new THREE.BoxGeometry(0.64, 1.04, 0.1), timberMat);
  doorFrame.position.set(doorX, wallBaseY + 0.52, frontZ + 0.01);
  group.add(doorFrame);

  const doorLeaf = addMesh(new THREE.BoxGeometry(0.5, 0.94, 0.08), darkWoodMat);
  doorLeaf.position.set(doorX, wallBaseY + 0.48, frontZ + 0.04);
  group.add(doorLeaf);

  // Tiny door window pane
  const doorPane = addMesh(new THREE.BoxGeometry(0.18, 0.2, 0.04), windowGlassMat, false, false);
  doorPane.position.set(doorX, wallBaseY + 0.68, frontZ + 0.07);
  group.add(doorPane);

  // Brass doorknob
  const knob = addMesh(new THREE.SphereGeometry(0.032, 8, 8), brassMat, false, false);
  knob.position.set(doorX + 0.16, wallBaseY + 0.45, frontZ + 0.095);
  group.add(knob);

  // Stone doorstep landing
  const stepTop = addMesh(new THREE.BoxGeometry(0.92, 0.26, 0.54), stoneMat);
  stepTop.position.set(doorX, 0.13, frontZ + 0.25);
  group.add(stepTop);

  const stepLower = addMesh(new THREE.BoxGeometry(0.76, 0.14, 0.34), stoneMat);
  stepLower.position.set(doorX, 0.05, frontZ + 0.56);
  group.add(stepLower);

  // Pitched porch awning over the door
  const porchAwning = addMesh(new THREE.BoxGeometry(0.96, 0.08, 0.66), roofMat);
  porchAwning.position.set(doorX, wallBaseY + 1.15, frontZ + 0.28);
  porchAwning.rotation.x = 0.28;
  group.add(porchAwning);

  // Two slender porch posts
  const porchPostGeo = new THREE.BoxGeometry(0.075, 0.98, 0.075);
  disposables.push(porchPostGeo);
  for (const sx of [-0.38, 0.38]) {
    const pp = new THREE.Mesh(porchPostGeo, timberMat);
    pp.position.set(doorX + sx, wallBaseY + 0.49, frontZ + 0.46);
    pp.castShadow = true;
    pp.userData.interactive = "house";
    group.add(pp);
  }

  // Hanging porch lantern beside the front door
  const lanternGroup = new THREE.Group();
  lanternGroup.position.set(doorX + 0.42, wallBaseY + 0.94, frontZ + 0.18);
  const lanternCap = addMesh(new THREE.ConeGeometry(0.08, 0.08, 6), darkWoodMat, false, false);
  lanternCap.position.y = 0.08;
  lanternGroup.add(lanternCap);
  const lanternBulb = addMesh(new THREE.CylinderGeometry(0.052, 0.044, 0.12, 6), lanternGlassMat, false, false);
  lanternGroup.add(lanternBulb);
  group.add(lanternGroup);

  // 8. Helper to build a framed mullioned window with shutters and optional flower box
  const addWindow = (
    x: number,
    y: number,
    z: number,
    rotY: number,
    w: number,
    h: number,
    withFlowerBox: boolean
  ) => {
    const wg = new THREE.Group();
    wg.position.set(x, y, z);
    wg.rotation.y = rotY;

    const frame = addMesh(new THREE.BoxGeometry(w + 0.1, h + 0.1, 0.06), timberMat, false, true);
    wg.add(frame);

    const glass = addMesh(new THREE.BoxGeometry(w, h, 0.075), windowGlassMat, false, false);
    wg.add(glass);

    const mullV = addMesh(new THREE.BoxGeometry(0.036, h + 0.02, 0.09), timberMat, false, false);
    wg.add(mullV);
    const mullH = addMesh(new THREE.BoxGeometry(w + 0.02, 0.036, 0.09), timberMat, false, false);
    wg.add(mullH);

    // Hinged sage-teal wooden shutters
    const shutterW = w * 0.44;
    for (const side of [-1, 1]) {
      const sh = addMesh(new THREE.BoxGeometry(shutterW, h + 0.04, 0.04), shutterMat, true, true);
      sh.position.set(side * (w / 2 + shutterW / 2 + 0.06), 0, 0.03);
      sh.rotation.y = -side * 0.14;
      wg.add(sh);
    }

    // Window sill
    const sill = addMesh(new THREE.BoxGeometry(w + 0.18, 0.06, 0.14), timberMat, true, true);
    sill.position.set(0, -h / 2 - 0.05, 0.05);
    wg.add(sill);

    if (withFlowerBox) {
      const box = addMesh(new THREE.BoxGeometry(w + 0.1, 0.12, 0.16), darkWoodMat, true, true);
      box.position.set(0, -h / 2 - 0.12, 0.08);
      wg.add(box);
      const foliage = addMesh(new THREE.BoxGeometry(w + 0.02, 0.07, 0.12), shutterMat, false, false);
      foliage.position.set(0, -h / 2 - 0.04, 0.08);
      wg.add(foliage);
      for (let b = -1; b <= 1; b++) {
        const dot = addMesh(new THREE.SphereGeometry(0.04, 6, 6), bloomMat, false, false);
        dot.position.set(b * (w * 0.28), -h / 2 + 0.01, 0.1);
        wg.add(dot);
      }
    }

    group.add(wg);
  };

  // Front main window (right of door)
  addWindow(0.48, wallBaseY + 0.72, frontZ + 0.01, 0, 0.54, 0.56, true);
  // Right gable side window (facing pond & windmill!)
  addWindow(bodyW / 2 + 0.01, wallBaseY + 0.72, 0.05, Math.PI / 2, 0.62, 0.54, true);
  // Upper right gable attic round-ish window
  addWindow(bodyW / 2 + 0.01, wallBaseY + bodyH + 0.42, 0, Math.PI / 2, 0.34, 0.34, false);
  // Left gable side window
  addWindow(-(bodyW / 2 + 0.01), wallBaseY + 0.72, -0.08, -Math.PI / 2, 0.54, 0.52, false);
  // Back window
  addWindow(-0.15, wallBaseY + 0.72, -(frontZ + 0.01), Math.PI, 0.56, 0.52, false);

  // 9. Warm amber PointLight spilling around porch & yard when house lights are ON
  const porchLight = new THREE.PointLight(0xffb452, 0, 8.2, 1.55);
  porchLight.position.set(0.35, wallBaseY + 1.05, frontZ + 0.85);
  group.add(porchLight);

  const sideLight = new THREE.PointLight(0xffa947, 0, 6.2, 1.7);
  sideLight.position.set(bodyW / 2 + 0.75, wallBaseY + 0.9, 0.15);
  group.add(sideLight);

  // Subtle soft glow halo sprite at the porch lantern (additive, non-obtrusive)
  const haloMat = new THREE.SpriteMaterial({
    map: textures.softGlowMap,
    color: 0xffc66b,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  disposables.push(haloMat);
  const lanternHalo = new THREE.Sprite(haloMat);
  lanternHalo.position.set(doorX + 0.42, wallBaseY + 0.94, frontZ + 0.25);
  lanternHalo.scale.set(0.85, 0.85, 1);
  group.add(lanternHalo);

  // 10. Pooled chimney smoke puffs rising gently and curling with the shared wind
  const smokeGroup = new THREE.Group();
  smokeGroup.position.set(chimneyX, wallBaseY + bodyH + 1.76, chimneyZ);
  group.add(smokeGroup);

  const puffGeo = new THREE.IcosahedronGeometry(0.16, 1);
  disposables.push(puffGeo);
  const puffs: SmokePuff[] = [];
  const PUFF_COUNT = 8;
  for (let i = 0; i < PUFF_COUNT; i++) {
    const puffMat = new THREE.MeshStandardMaterial({
      color: 0xeae5dc,
      roughness: 1.0,
      metalness: 0.0,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    disposables.push(puffMat);
    const mesh = new THREE.Mesh(puffGeo, puffMat);
    smokeGroup.add(mesh);
    puffs.push({
      mesh,
      age: (i / PUFF_COUNT) * 4.5,
      life: 4.5,
      offsetPhase: i * 1.37,
    });
  }

  // 11. Dedicated simplified invisible hit volume so clicks anywhere on the cottage register effortlessly
  const hitBoxGeo = new THREE.BoxGeometry(2.85, 3.2, 2.65);
  const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
  disposables.push(hitBoxGeo, hitBoxMat);
  const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
  hitBox.position.set(0, 1.45, 0.1);
  hitBox.userData.interactive = "house";
  group.add(hitBox);
  hitTargets.push(hitBox);

  // Precompute inverse cottage rotation to transform world wind into local smoke coordinates
  const invCos = Math.cos(-LANDMARKS.house.rotationY);
  const invSin = Math.sin(-LANDMARKS.house.rotationY);

  let currentLightLevel = 0;
  let currentHoverBoost = 0;
  let hovered = false;

  return {
    group,
    hitTargets,
    setHovered: (isHovered: boolean) => {
      hovered = isHovered;
    },
    update: (dt, elapsed, lightsOn, atmosphere, wind, reducedMotion) => {
      const targetLight = lightsOn ? 1 : 0;
      const alpha = 1 - Math.exp(-7.5 * dt);
      currentLightLevel += (targetLight - currentLightLevel) * alpha;
      const targetHover = hovered ? 1 : 0;
      currentHoverBoost += (targetHover - currentHoverBoost) * (1 - Math.exp(-10 * dt));

      // Subtle living hearth flicker when lights are on (disabled in reduced-motion)
      const flicker = reducedMotion
        ? 1
        : 1 + Math.sin(elapsed * 5.2) * 0.035 + Math.cos(elapsed * 8.7) * 0.02;

      const effectiveGlow = currentLightLevel * atmosphere.windowProminence * flicker;

      // Window glass transitions smoothly from cool reflective blue-slate to inviting warm amber
      windowGlassMat.color.setRGB(
        0.32 + currentLightLevel * 0.65,
        0.42 + currentLightLevel * 0.42,
        0.48 - currentLightLevel * 0.16
      );
      windowGlassMat.emissiveIntensity =
        effectiveGlow * 1.95 + currentHoverBoost * (lightsOn ? 0.25 : 0.16);
      lanternGlassMat.emissiveIntensity = effectiveGlow * 2.4;

      // Spill warm cozy light onto porch, doorstep, and surrounding grass
      const lightStrength = currentLightLevel * (1.2 + atmosphere.nightFactor * 2.1 + atmosphere.twilight * 0.85) * flicker;
      porchLight.intensity = lightStrength * 3.1;
      sideLight.intensity = lightStrength * 1.9;
      haloMat.opacity = clamp(currentLightLevel * (0.28 + atmosphere.nightFactor * 0.48), 0, 0.78);

      // Update pooled chimney smoke puffs (gentle hearth wisps; stronger when lights are on)
      const localWindX = wind.dirX * invCos - wind.dirZ * invSin;
      const localWindZ = wind.dirX * invSin + wind.dirZ * invCos;
      const windPush = wind.strength * 1.45;
      const smokePresence = clamp(0.28 + currentLightLevel * 0.65, 0, 0.9);

      for (const puff of puffs) {
        if (!reducedMotion) {
          puff.age += dt;
          if (puff.age >= puff.life) {
            puff.age -= puff.life;
          }
        }
        const t = puff.age / puff.life;
        const rise = t * 1.95;
        const drift = Math.pow(t, 1.35) * (0.18 + windPush);
        const curl = Math.sin(t * 4.5 + puff.offsetPhase) * 0.09 * t;

        puff.mesh.position.set(
          localWindX * drift + curl,
          rise,
          localWindZ * drift - curl * 0.6
        );
        const scale = 0.55 + t * 1.45;
        puff.mesh.scale.setScalar(scale);

        const fadeIn = Math.min(1, t / 0.18);
        const fadeOut = 1 - Math.max(0, (t - 0.45) / 0.55);
        const mat = puff.mesh.material as THREE.MeshStandardMaterial;
        mat.opacity = fadeIn * fadeOut * 0.34 * smokePresence;
        mat.color.setRGB(
          atmosphere.cloudColor.r * 0.95,
          atmosphere.cloudColor.g * 0.94,
          atmosphere.cloudColor.b * 0.92
        );
        puff.mesh.visible = !reducedMotion && mat.opacity > 0.01;
      }
    },
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
