import * as THREE from 'three';
import type { WorldMaterials } from './materials';
import { HOUSE_ANCHOR, getTerrainHeight } from './terrainMath';

export interface HouseBundle {
  group: THREE.Group;
  hitRoot: THREE.Group;
  update: (
    dt: number,
    lightsAmount: number,
    nightFactor: number,
    sunsetFactor: number,
    windStrength: number,
    windDirX: number,
    windDirZ: number,
    reducedMotion: boolean,
  ) => void;
  dispose: () => void;
}

interface SmokePuff {
  mesh: THREE.Mesh;
  age: number;
  lifetime: number;
  baseScale: number;
  driftJitterX: number;
  driftJitterZ: number;
}

export function createHouse(materials: WorldMaterials): HouseBundle {
  const group = new THREE.Group();
  group.name = 'cottage-house';

  const baseY = getTerrainHeight(HOUSE_ANCHOR.x, HOUSE_ANCHOR.z);
  group.position.set(HOUSE_ANCHOR.x, baseY, HOUSE_ANCHOR.z);
  group.rotation.y = HOUSE_ANCHOR.rotationY;

  const geometries: THREE.BufferGeometry[] = [];
  const disposableMaterials: THREE.Material[] = [];

  const registerGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };

  // --- Stone foundation plinth (sunk deep enough so sloped grass never reveals a gap) ---
  const plinthGeo = registerGeo(new THREE.BoxGeometry(2.12, 0.72, 1.72));
  const plinth = new THREE.Mesh(plinthGeo, materials.stoneMasonry);
  plinth.position.set(0, -0.06, 0);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  // --- Main cream plaster cottage walls ---
  const wallW = 1.94;
  const wallH = 1.16;
  const wallD = 1.54;
  const wallBaseY = 0.28;
  const wallGeo = registerGeo(new THREE.BoxGeometry(wallW, wallH, wallD));
  const walls = new THREE.Mesh(wallGeo, materials.cottageWall);
  walls.position.set(0, wallBaseY + wallH * 0.5, 0);
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // --- Triangular plaster gable ends (front & back on X sides -> ridge runs along X) ---
  const gablePeakH = 0.96;
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-wallD * 0.5, 0);
  gableShape.lineTo(wallD * 0.5, 0);
  gableShape.lineTo(0, gablePeakH);
  gableShape.closePath();

  const gableGeo = registerGeo(
    new THREE.ExtrudeGeometry(gableShape, { depth: wallW, bevelEnabled: false }),
  );
  // Rotate so extrusion spans along X (-wallW/2 .. +wallW/2) and triangle spans Z
  gableGeo.rotateY(Math.PI / 2);
  gableGeo.translate(-wallW * 0.5, wallBaseY + wallH, 0);
  const gableMesh = new THREE.Mesh(gableGeo, materials.cottageWall);
  gableMesh.castShadow = true;
  gableMesh.receiveShadow = true;
  group.add(gableMesh);

  // --- Handcrafted half-timber framing beams ---
  const postGeo = registerGeo(new THREE.BoxGeometry(0.11, wallH + 0.04, 0.11));
  const corners: Array<[number, number]> = [
    [-wallW * 0.5, -wallD * 0.5],
    [wallW * 0.5, -wallD * 0.5],
    [-wallW * 0.5, wallD * 0.5],
    [wallW * 0.5, wallD * 0.5],
  ];
  for (const [cx, cz] of corners) {
    const post = new THREE.Mesh(postGeo, materials.darkWood);
    post.position.set(cx, wallBaseY + wallH * 0.5, cz);
    post.castShadow = true;
    group.add(post);
  }

  // Horizontal eaves timber belt beams
  const beamFrontGeo = registerGeo(new THREE.BoxGeometry(wallW + 0.12, 0.09, 0.08));
  for (const zSign of [-1, 1]) {
    const beam = new THREE.Mesh(beamFrontGeo, materials.darkWood);
    beam.position.set(0, wallBaseY + wallH - 0.02, zSign * (wallD * 0.5 + 0.01));
    group.add(beam);
  }
  const beamSideGeo = registerGeo(new THREE.BoxGeometry(0.08, 0.09, wallD + 0.12));
  for (const xSign of [-1, 1]) {
    const beam = new THREE.Mesh(beamSideGeo, materials.darkWood);
    beam.position.set(xSign * (wallW * 0.5 + 0.01), wallBaseY + wallH - 0.02, 0);
    group.add(beam);
  }

  // --- Pitched overhanging tiled gable roof ---
  const roofOverhangX = 0.24;
  const roofOverhangZ = 0.24;
  const halfSpanZ = wallD * 0.5 + roofOverhangZ;
  const roofPitch = Math.atan2(gablePeakH, wallD * 0.5);
  const slopeLen = Math.hypot(halfSpanZ, halfSpanZ * Math.tan(roofPitch));
  const roofThickness = 0.12;
  const roofWidth = wallW + roofOverhangX * 2;
  const peakY = wallBaseY + wallH + gablePeakH + 0.05;

  const slopeGeo = registerGeo(new THREE.BoxGeometry(roofWidth, roofThickness, slopeLen));

  // Front roof slope (+Z)
  const frontRoof = new THREE.Mesh(slopeGeo, materials.roofTile);
  frontRoof.rotation.x = roofPitch;
  frontRoof.position.set(
    0,
    peakY - Math.sin(roofPitch) * (slopeLen * 0.5),
    Math.cos(roofPitch) * (slopeLen * 0.5),
  );
  frontRoof.castShadow = true;
  frontRoof.receiveShadow = true;
  group.add(frontRoof);

  // Back roof slope (-Z)
  const backRoof = new THREE.Mesh(slopeGeo, materials.roofTile);
  backRoof.rotation.x = -roofPitch;
  backRoof.position.set(
    0,
    peakY - Math.sin(roofPitch) * (slopeLen * 0.5),
    -Math.cos(roofPitch) * (slopeLen * 0.5),
  );
  backRoof.castShadow = true;
  backRoof.receiveShadow = true;
  group.add(backRoof);

  // Roof ridge cap beam
  const ridgeGeo = registerGeo(new THREE.BoxGeometry(roofWidth + 0.06, 0.13, 0.14));
  const ridge = new THREE.Mesh(ridgeGeo, materials.darkWood);
  ridge.position.set(0, peakY + 0.02, 0);
  ridge.castShadow = true;
  group.add(ridge);

  // Gable trim bargeboards on left & right eaves
  const bargeGeo = registerGeo(new THREE.BoxGeometry(0.08, 0.1, slopeLen + 0.04));
  for (const xSign of [-1, 1]) {
    for (const zSign of [-1, 1]) {
      const barge = new THREE.Mesh(bargeGeo, materials.darkWood);
      barge.rotation.x = zSign * roofPitch;
      barge.position.set(
        xSign * (roofWidth * 0.5 - 0.02),
        peakY - Math.sin(roofPitch) * (slopeLen * 0.5) - 0.04,
        zSign * Math.cos(roofPitch) * (slopeLen * 0.5),
      );
      group.add(barge);
    }
  }

  // --- Cozy front roof dormer window (+Z roof slope) ---
  const dormer = new THREE.Group();
  dormer.position.set(-0.36, wallBaseY + wallH + 0.34, wallD * 0.32);
  const dormerBody = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(0.52, 0.44, 0.52)),
    materials.cottageWall,
  );
  dormerBody.castShadow = true;
  dormer.add(dormerBody);

  const dormerCapGeo = registerGeo(new THREE.BoxGeometry(0.36, 0.07, 0.62));
  for (const xSign of [-1, 1]) {
    const cap = new THREE.Mesh(dormerCapGeo, materials.roofTile);
    cap.rotation.z = -xSign * 0.58;
    cap.position.set(xSign * 0.14, 0.27, 0.02);
    cap.castShadow = true;
    dormer.add(cap);
  }
  addFramedWindow(dormer, materials, registerGeo, {
    width: 0.3,
    height: 0.28,
    position: new THREE.Vector3(0, 0.01, 0.265),
    rotationY: 0,
    withShutters: false,
  });
  group.add(dormer);

  // --- Arched wooden front door + porch awning + stone steps ---
  const doorX = -0.34;
  const frontZ = wallD * 0.5;

  const doorFrame = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(0.56, 0.84, 0.08)),
    materials.darkWood,
  );
  doorFrame.position.set(doorX, wallBaseY + 0.42, frontZ + 0.02);
  group.add(doorFrame);

  const doorPanel = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(0.44, 0.76, 0.07)),
    materials.warmWood,
  );
  doorPanel.position.set(doorX, wallBaseY + 0.39, frontZ + 0.04);
  doorPanel.castShadow = true;
  group.add(doorPanel);

  // Tiny recessed window in top of wooden door
  const doorGlass = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(0.18, 0.16, 0.03)),
    materials.windowGlass,
  );
  doorGlass.position.set(doorX, wallBaseY + 0.58, frontZ + 0.072);
  group.add(doorGlass);

  // Brass door handle
  const knob = new THREE.Mesh(
    registerGeo(new THREE.SphereGeometry(0.032, 8, 8)),
    materials.brassAccent,
  );
  knob.position.set(doorX + 0.15, wallBaseY + 0.36, frontZ + 0.09);
  group.add(knob);

  // Porch awning overhang + timber support brackets
  const awning = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(0.84, 0.07, 0.46)),
    materials.roofTile,
  );
  awning.position.set(doorX, wallBaseY + 0.94, frontZ + 0.22);
  awning.rotation.x = 0.26;
  awning.castShadow = true;
  group.add(awning);

  const bracketGeo = registerGeo(new THREE.BoxGeometry(0.06, 0.28, 0.06));
  for (const dx of [-0.34, 0.34]) {
    const bracket = new THREE.Mesh(bracketGeo, materials.darkWood);
    bracket.position.set(doorX + dx, wallBaseY + 0.78, frontZ + 0.16);
    bracket.rotation.x = 0.65;
    group.add(bracket);
  }

  // Stone threshold step in front of the door
  const step1 = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(0.84, 0.16, 0.42)),
    materials.stoneMasonry,
  );
  step1.position.set(doorX, wallBaseY - 0.07, frontZ + 0.24);
  step1.receiveShadow = true;
  step1.castShadow = true;
  group.add(step1);

  const step2 = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(0.68, 0.14, 0.3)),
    materials.steppingStone,
  );
  step2.position.set(doorX, wallBaseY - 0.21, frontZ + 0.48);
  step2.receiveShadow = true;
  group.add(step2);

  // --- Hanging warm porch lantern ---
  const lanternX = doorX + 0.42;
  const lanternY = wallBaseY + 0.72;
  const lanternZ = frontZ + 0.16;

  const lanternArm = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(0.04, 0.04, 0.18)),
    materials.darkWood,
  );
  lanternArm.position.set(lanternX, lanternY + 0.08, frontZ + 0.08);
  group.add(lanternArm);

  const lanternCap = new THREE.Mesh(
    registerGeo(new THREE.ConeGeometry(0.075, 0.08, 6)),
    materials.brassAccent,
  );
  lanternCap.position.set(lanternX, lanternY + 0.03, lanternZ);
  group.add(lanternCap);

  const lanternGlass = new THREE.Mesh(
    registerGeo(new THREE.CylinderGeometry(0.05, 0.042, 0.11, 6)),
    materials.windowGlass,
  );
  lanternGlass.position.set(lanternX, lanternY - 0.05, lanternZ);
  group.add(lanternGlass);

  // Soft warm glow sprite around the hanging lantern (visible when lights are ON)
  const glowMat = new THREE.SpriteMaterial({
    map: materials.textures.softGlow,
    color: 0xffb95c,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  disposableMaterials.push(glowMat);
  const lanternGlow = new THREE.Sprite(glowMat);
  lanternGlow.position.set(lanternX, lanternY - 0.04, lanternZ + 0.03);
  lanternGlow.scale.set(0.68, 0.68, 1);
  group.add(lanternGlow);

  // --- Windows around all sides + charming flower box under front window ---
  // Front right window
  addFramedWindow(group, materials, registerGeo, {
    width: 0.48,
    height: 0.46,
    position: new THREE.Vector3(0.42, wallBaseY + 0.56, frontZ + 0.025),
    rotationY: 0,
    withShutters: true,
  });

  // Miniature window flower box under the front window
  const flowerBox = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(0.56, 0.13, 0.16)),
    materials.warmWood,
  );
  flowerBox.position.set(0.42, wallBaseY + 0.25, frontZ + 0.09);
  flowerBox.castShadow = true;
  group.add(flowerBox);

  const flowerFoliageGeo = registerGeo(new THREE.DodecahedronGeometry(0.075, 0));
  const tinyBloomGeo = registerGeo(new THREE.SphereGeometry(0.035, 6, 6));
  const bloomMats = [materials.flowerCoral, materials.flowerButter, materials.flowerCream];
  for (let i = 0; i < 4; i++) {
    const fx = 0.23 + i * 0.125;
    const tuft = new THREE.Mesh(flowerFoliageGeo, materials.leafOlive);
    tuft.position.set(fx, wallBaseY + 0.34, frontZ + 0.1);
    group.add(tuft);
    const bloom = new THREE.Mesh(tinyBloomGeo, bloomMats[i % bloomMats.length]);
    bloom.position.set(fx, wallBaseY + 0.4, frontZ + 0.12);
    group.add(bloom);
  }

  // Right side window (pond-facing) + upper gable round window
  addFramedWindow(group, materials, registerGeo, {
    width: 0.5,
    height: 0.46,
    position: new THREE.Vector3(wallW * 0.5 + 0.025, wallBaseY + 0.58, 0.06),
    rotationY: Math.PI / 2,
    withShutters: true,
  });
  addRoundGableWindow(
    group,
    materials,
    registerGeo,
    new THREE.Vector3(wallW * 0.5 + 0.025, wallBaseY + wallH + 0.38, 0),
    Math.PI / 2,
  );

  // Left side cozy window + upper gable round window
  addFramedWindow(group, materials, registerGeo, {
    width: 0.46,
    height: 0.44,
    position: new THREE.Vector3(-wallW * 0.5 - 0.025, wallBaseY + 0.58, 0.0),
    rotationY: -Math.PI / 2,
    withShutters: true,
  });
  addRoundGableWindow(
    group,
    materials,
    registerGeo,
    new THREE.Vector3(-wallW * 0.5 - 0.025, wallBaseY + wallH + 0.38, 0),
    -Math.PI / 2,
  );

  // Rear window so orbiting behind the cottage still glows warmly
  addFramedWindow(group, materials, registerGeo, {
    width: 0.48,
    height: 0.44,
    position: new THREE.Vector3(-0.18, wallBaseY + 0.58, -frontZ - 0.025),
    rotationY: Math.PI,
    withShutters: false,
  });

  // --- Tapered Stone Chimney + Terracotta Chimney Pot ---
  const chimneyX = 0.58;
  const chimneyZ = -0.34;
  const chimneyBaseY = wallBaseY + wallH + 0.15;
  const chimneyShaft = new THREE.Mesh(
    registerGeo(new THREE.CylinderGeometry(0.18, 0.24, 1.05, 4)),
    materials.stoneMasonry,
  );
  chimneyShaft.rotation.y = Math.PI / 4;
  chimneyShaft.position.set(chimneyX, chimneyBaseY + 0.48, chimneyZ);
  chimneyShaft.castShadow = true;
  chimneyShaft.receiveShadow = true;
  group.add(chimneyShaft);

  const chimneyLip = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(0.36, 0.09, 0.36)),
    materials.stoneMasonry,
  );
  chimneyLip.position.set(chimneyX, chimneyBaseY + 1.02, chimneyZ);
  chimneyLip.castShadow = true;
  group.add(chimneyLip);

  const chimneyPot = new THREE.Mesh(
    registerGeo(new THREE.CylinderGeometry(0.085, 0.1, 0.22, 8)),
    materials.chimneyTerracotta,
  );
  chimneyPot.position.set(chimneyX, chimneyBaseY + 1.16, chimneyZ);
  chimneyPot.castShadow = true;
  group.add(chimneyPot);

  // --- Pooled rising chimney smoke wisps (world-space positioned in a child group) ---
  const chimneyTopLocal = new THREE.Vector3(chimneyX, chimneyBaseY + 1.32, chimneyZ);
  const smokeGroup = new THREE.Group();
  group.add(smokeGroup);
  const smokeGeo = registerGeo(new THREE.IcosahedronGeometry(0.11, 1));
  const smokePuffs: SmokePuff[] = [];
  const PUFF_COUNT = 7;

  for (let i = 0; i < PUFF_COUNT; i++) {
    const puffMat = materials.smoke.clone();
    disposableMaterials.push(puffMat);
    const mesh = new THREE.Mesh(smokeGeo, puffMat);
    const lifetime = 3.6 + (i % 3) * 0.45;
    smokeGroup.add(mesh);
    smokePuffs.push({
      mesh,
      age: (i / PUFF_COUNT) * lifetime,
      lifetime,
      baseScale: 0.65 + (i % 3) * 0.15,
      driftJitterX: ((i * 37) % 10 - 4.5) * 0.015,
      driftJitterZ: ((i * 53) % 10 - 4.5) * 0.015,
    });
  }

  // --- Warm local lights spilling from cottage windows & porch when lit ---
  const frontPorchLight = new THREE.PointLight(0xffac4b, 0, 6.4, 1.85);
  frontPorchLight.position.set(0.15, wallBaseY + 0.72, frontZ + 0.65);
  group.add(frontPorchLight);

  const sideGardenLight = new THREE.PointLight(0xffa443, 0, 5.0, 1.9);
  sideGardenLight.position.set(wallW * 0.5 + 0.55, wallBaseY + 0.65, 0.1);
  group.add(sideGardenLight);

  // Reusable color temporaries (zero per-frame allocations)
  const dayGlassOff = new THREE.Color(0x4c6578);
  const nightGlassOff = new THREE.Color(0x212f42);
  const litGlassColor = new THREE.Color(0xffd78e);
  const litEmissive = new THREE.Color(0xff9f38);
  const currentGlassColor = new THREE.Color();

  // Transform world wind vector into house-local space for chimney smoke drift
  const cosNeg = Math.cos(-HOUSE_ANCHOR.rotationY);
  const sinNeg = Math.sin(-HOUSE_ANCHOR.rotationY);

  const update: HouseBundle['update'] = (
    dt,
    lightsAmount,
    nightFactor,
    sunsetFactor,
    windStrength,
    windDirX,
    windDirZ,
    reducedMotion,
  ) => {
    // Window material transitions cleanly between reflective glass and warm amber glow
    currentGlassColor.copy(dayGlassOff).lerp(nightGlassOff, nightFactor);
    currentGlassColor.lerp(litGlassColor, lightsAmount);
    materials.windowGlass.color.copy(currentGlassColor);
    materials.windowGlass.emissive.copy(litEmissive);

    // Clear visible change in daytime AND dramatic cozy prominence at sunset/night
    const ambientContrastBoost = 1.0 + sunsetFactor * 0.45 + nightFactor * 1.15;
    materials.windowGlass.emissiveIntensity = lightsAmount * 1.25 * ambientContrastBoost;

    // Warm point light spill around porch and garden
    const nightSpill = 0.28 + sunsetFactor * 0.45 + nightFactor * 1.15;
    frontPorchLight.intensity = lightsAmount * 2.6 * nightSpill;
    sideGardenLight.intensity = lightsAmount * 1.65 * nightSpill;

    // Subtle porch lantern halo
    glowMat.opacity = lightsAmount * (0.28 + sunsetFactor * 0.25 + nightFactor * 0.45);
    const glowSize = 0.55 + lightsAmount * (0.25 + nightFactor * 0.28);
    lanternGlow.scale.set(glowSize, glowSize, 1);

    // Chimney smoke wisps (nonessential decorative motion -> hidden/minimized in reducedMotion)
    const localWindX = windDirX * cosNeg - windDirZ * sinNeg;
    const localWindZ = windDirX * sinNeg + windDirZ * cosNeg;

    for (const puff of smokePuffs) {
      if (reducedMotion) {
        puff.mesh.visible = false;
        continue;
      }
      puff.mesh.visible = true;
      puff.age += dt;
      if (puff.age >= puff.lifetime) {
        puff.age %= puff.lifetime;
      }
      const progress = puff.age / puff.lifetime;
      const rise = progress * (1.55 - windStrength * 0.35);
      const driftDist = Math.pow(progress, 1.35) * (0.18 + windStrength * 1.65);

      puff.mesh.position.set(
        chimneyTopLocal.x + localWindX * driftDist + puff.driftJitterX * progress * 6,
        chimneyTopLocal.y + rise,
        chimneyTopLocal.z + localWindZ * driftDist + puff.driftJitterZ * progress * 6,
      );

      const scale = puff.baseScale * (0.55 + progress * 1.45);
      puff.mesh.scale.setScalar(scale);

      const mat = puff.mesh.material as THREE.MeshStandardMaterial;
      const fadeIn = Math.min(1, progress * 4.5);
      const fadeOut = Math.pow(1 - progress, 1.4);
      // Slightly warmer & fuller cozy smoke when house lights are on
      mat.opacity = fadeIn * fadeOut * (0.24 + lightsAmount * 0.16);
    }
  };

  return {
    group,
    hitRoot: group,
    update,
    dispose: () => {
      for (const geo of geometries) {
        geo.dispose();
      }
      for (const mat of disposableMaterials) {
        mat.dispose();
      }
    },
  };
}

interface FramedWindowOptions {
  width: number;
  height: number;
  position: THREE.Vector3;
  rotationY: number;
  withShutters: boolean;
}

function addFramedWindow(
  parent: THREE.Group,
  materials: WorldMaterials,
  registerGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  opts: FramedWindowOptions,
): void {
  const win = new THREE.Group();
  win.position.copy(opts.position);
  win.rotation.y = opts.rotationY;

  // Outer timber casing
  const frame = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(opts.width + 0.08, opts.height + 0.08, 0.06)),
    materials.darkWood,
  );
  win.add(frame);

  // Recessed emissive window pane
  const pane = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(opts.width, opts.height, 0.072)),
    materials.windowGlass,
  );
  win.add(pane);

  // Crisp cross muntin bars
  const vBar = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(0.032, opts.height + 0.02, 0.086)),
    materials.darkWood,
  );
  win.add(vBar);
  const hBar = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(opts.width + 0.02, 0.032, 0.086)),
    materials.darkWood,
  );
  win.add(hBar);

  // Projecting windowsill
  const sill = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(opts.width + 0.16, 0.055, 0.12)),
    materials.lightWood,
  );
  sill.position.set(0, -(opts.height * 0.5 + 0.04), 0.03);
  win.add(sill);

  // Miniature hinged wooden shutters
  if (opts.withShutters) {
    const shutterGeo = registerGeo(
      new THREE.BoxGeometry(opts.width * 0.44, opts.height + 0.04, 0.04),
    );
    for (const side of [-1, 1]) {
      const shutter = new THREE.Mesh(shutterGeo, materials.warmWood);
      shutter.position.set(side * (opts.width * 0.5 + opts.width * 0.24 + 0.04), 0, 0.025);
      shutter.rotation.y = -side * 0.14;
      win.add(shutter);
    }
  }

  parent.add(win);
}

function addRoundGableWindow(
  parent: THREE.Group,
  materials: WorldMaterials,
  registerGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  position: THREE.Vector3,
  rotationY: number,
): void {
  const win = new THREE.Group();
  win.position.copy(position);
  win.rotation.y = rotationY;

  const ring = new THREE.Mesh(
    registerGeo(new THREE.TorusGeometry(0.15, 0.032, 8, 16)),
    materials.darkWood,
  );
  ring.position.z = 0.02;
  win.add(ring);

  const glass = new THREE.Mesh(
    registerGeo(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 14)),
    materials.windowGlass,
  );
  glass.rotation.x = Math.PI / 2;
  glass.position.z = 0.01;
  win.add(glass);

  const barV = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(0.026, 0.28, 0.065)),
    materials.darkWood,
  );
  barV.position.z = 0.02;
  win.add(barV);

  const barH = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(0.28, 0.026, 0.065)),
    materials.darkWood,
  );
  barH.position.z = 0.02;
  win.add(barH);

  parent.add(win);
}
