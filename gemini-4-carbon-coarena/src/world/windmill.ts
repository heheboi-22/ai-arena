import * as THREE from 'three';
import { lerp } from '../utils/math';
import { getProceduralTextures } from '../utils/textures';
import { LANDMARKS } from './terrainMath';

export interface WindmillRig {
  group: THREE.Group;
  update: (
    dt: number,
    wind: number,
    rainAmount: number,
    reducedMotion: boolean
  ) => void;
}

export function createWindmill(): WindmillRig {
  const textures = getProceduralTextures();
  const group = new THREE.Group();
  group.name = 'WindmillGroup';
  group.position.set(LANDMARKS.windmill.x, LANDMARKS.windmill.plateauY, LANDMARKS.windmill.z);
  group.rotation.y = LANDMARKS.windmill.rotY;

  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stone,
    color: 0xd5ccc0,
    roughness: 0.9,
    metalness: 0.03,
  });

  const plasterMat = new THREE.MeshStandardMaterial({
    map: textures.plaster,
    color: 0xf4ead8,
    roughness: 0.86,
    metalness: 0.02,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    color: 0x8a5b3b,
    roughness: 0.84,
    metalness: 0.03,
  });

  const darkTimberMat = new THREE.MeshStandardMaterial({
    color: 0x543622,
    roughness: 0.84,
    metalness: 0.05,
  });

  const capMat = new THREE.MeshStandardMaterial({
    map: textures.shingles,
    color: 0xb55943,
    roughness: 0.8,
    metalness: 0.04,
  });

  const sailCanvasMat = new THREE.MeshStandardMaterial({
    color: 0xfbf4e4,
    roughness: 0.9,
    metalness: 0.01,
    side: THREE.DoubleSide,
  });

  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x3b3c42,
    roughness: 0.44,
    metalness: 0.72,
  });

  // 1. Grounded Octagonal Stone Base (extends -0.26 into knoll so slopes have zero gap)
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 0.84, 8), stoneMat);
  plinth.position.y = 0.16; // spans -0.26 .. +0.58
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  // Stone entry step at +Z front
  const step = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.24), stoneMat);
  step.position.set(0, 0.03, 0.74);
  step.castShadow = true;
  step.receiveShadow = true;
  group.add(step);

  // 2. Tapered Octagonal Plaster Tower Shaft
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.65, 1.56, 8), plasterMat);
  shaft.position.y = 1.36; // spans 0.58 .. 2.14
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  group.add(shaft);

  // Timber belt rings
  for (const ry of [0.58, 2.12]) {
    const r = ry < 1 ? 0.67 : 0.5;
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.07, 8), darkTimberMat);
    belt.position.y = ry;
    belt.castShadow = true;
    group.add(belt);
  }

  // 3. Wooden Mid-Tower Gallery Balcony & Handrail
  const galleryY = 1.02;
  const galleryDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.82, 0.055, 8), woodMat);
  galleryDeck.position.y = galleryY;
  galleryDeck.castShadow = true;
  galleryDeck.receiveShadow = true;
  group.add(galleryDeck);

  // Diagonal support struts under gallery
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.34, 0.045), darkTimberMat);
    strut.position.set(Math.cos(ang) * 0.68, galleryY - 0.14, Math.sin(ang) * 0.68);
    strut.rotation.y = -ang + Math.PI * 0.5;
    strut.rotation.x = -0.52;
    group.add(strut);

    // Balcony handrail posts (leave slight front opening below sails? Actually full octagonal rail looks charming and sails clear it in Z!)
    const railPost = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.24, 0.036), darkTimberMat);
    railPost.position.set(Math.cos(ang) * 0.78, galleryY + 0.13, Math.sin(ang) * 0.78);
    group.add(railPost);
  }

  const railRing = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.022, 6, 8), woodMat);
  railRing.rotation.x = Math.PI * 0.5;
  railRing.rotation.z = Math.PI / 8;
  railRing.position.y = galleryY + 0.24;
  group.add(railRing);

  // 4. Mill Door & Small Slit Windows
  const millDoorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.56, 0.08), darkTimberMat);
  millDoorFrame.position.set(0, 0.34, 0.68);
  group.add(millDoorFrame);

  const millDoor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.06), woodMat);
  millDoor.position.set(0, 0.32, 0.7);
  group.add(millDoor);

  const slitMat = new THREE.MeshStandardMaterial({ color: 0x2d3a46, roughness: 0.4 });
  for (const [wx, wy, wz, wr] of [
    [0, 1.56, 0.54, 0],
    [0.54, 1.44, 0, Math.PI * 0.5],
    [-0.54, 1.44, 0, -Math.PI * 0.5],
  ] as const) {
    const winFrame = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.05), darkTimberMat);
    winFrame.position.set(wx, wy, wz);
    winFrame.rotation.y = wr;
    group.add(winFrame);

    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.21, 0.056), slitMat);
    pane.position.set(wx, wy, wz);
    pane.rotation.y = wr;
    group.add(pane);
  }

  // 5. Shingled Conical Cap, Tailpole & Brass Finial
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.72, 8), capMat);
  cap.position.y = 2.48;
  cap.castShadow = true;
  cap.receiveShadow = true;
  group.add(cap);

  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), ironMat);
  finial.position.y = 2.86;
  group.add(finial);

  const finialSpire = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.18, 6), ironMat);
  finialSpire.position.y = 2.96;
  group.add(finialSpire);

  // Traditional rear tailpole brace
  const tailPole = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.034, 1.38, 6), darkTimberMat);
  tailPole.position.set(0, 1.72, -0.74);
  tailPole.rotation.x = 0.46;
  tailPole.castShadow = true;
  group.add(tailPole);

  // 6. Rotor Axle & 4-Blade Lattice Sail Assembly
  // Position rotor forward (+Z = 0.88) so blades clear the octagonal tower & gallery cleanly
  const axleHousing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.46), darkTimberMat);
  axleHousing.position.set(0, 2.34, 0.56);
  axleHousing.castShadow = true;
  group.add(axleHousing);

  const rotorGroup = new THREE.Group();
  rotorGroup.name = 'WindmillRotor';
  rotorGroup.position.set(0, 2.34, 0.9);
  // Slight upward tilt like real historic smock windmills
  rotorGroup.rotation.x = -0.06;

  const hubShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.34, 8), ironMat);
  hubShaft.rotation.x = Math.PI * 0.5;
  hubShaft.position.z = -0.1;
  rotorGroup.add(hubShaft);

  const hubCap = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), darkTimberMat);
  hubCap.position.z = 0.06;
  hubCap.castShadow = true;
  rotorGroup.add(hubCap);

  // Build 4 crisp, recognizable sails
  const bladeLen = 1.44;
  for (let b = 0; b < 4; b++) {
    const armWrapper = new THREE.Group();
    armWrapper.rotation.z = (b * Math.PI) / 2 + 0.32;

    // Aerodynamic sail pitch (~15 deg)
    const pitchedArm = new THREE.Group();
    pitchedArm.rotation.y = 0.26;

    // Main timber whip/spar
    const spar = new THREE.Mesh(new THREE.BoxGeometry(0.055, bladeLen, 0.055), darkTimberMat);
    spar.position.y = bladeLen * 0.5;
    spar.castShadow = true;
    pitchedArm.add(spar);

    // Lattice frame & cream canvas sail starting slightly out from hub
    const sailStart = 0.28;
    const sailH = bladeLen - sailStart - 0.04;
    const sailW = 0.32;
    const sailOffsetX = sailW * 0.5 + 0.022;

    // Outer hemlock rail
    const outerRail = new THREE.Mesh(new THREE.BoxGeometry(0.026, sailH, 0.026), woodMat);
    outerRail.position.set(sailW + 0.03, sailStart + sailH * 0.5, 0);
    outerRail.castShadow = true;
    pitchedArm.add(outerRail);

    // Cross rungs along lattice
    const rungs = 6;
    for (let r = 0; r <= rungs; r++) {
      const ry = sailStart + (r / rungs) * sailH;
      const rung = new THREE.Mesh(new THREE.BoxGeometry(sailW + 0.04, 0.022, 0.024), woodMat);
      rung.position.set(sailOffsetX - 0.008, ry, 0);
      pitchedArm.add(rung);
    }

    // Warm cream canvas cloth panel tucked inside lattice
    const canvasPanel = new THREE.Mesh(new THREE.PlaneGeometry(sailW - 0.02, sailH - 0.03), sailCanvasMat);
    canvasPanel.position.set(sailOffsetX, sailStart + sailH * 0.5, -0.008);
    canvasPanel.castShadow = true;
    canvasPanel.receiveShadow = true;
    pitchedArm.add(canvasPanel);

    armWrapper.add(pitchedArm);
    rotorGroup.add(armWrapper);
  }

  group.add(rotorGroup);

  // Max angular speed ~3.1 rad/s at 100% wind; 0 rad/s at 0% wind
  const MAX_ANGULAR_SPEED = 3.15;

  return {
    group,
    update(dt, wind, rainAmount, reducedMotion) {
      stoneMat.roughness = lerp(0.9, 0.62, rainAmount);
      capMat.roughness = lerp(0.8, 0.54, rainAmount);

      // Directly proportional to shared wind state: stops completely when wind === 0
      const motionFactor = reducedMotion ? 0.42 : 1.0;
      const angularSpeed = wind * MAX_ANGULAR_SPEED * motionFactor;
      rotorGroup.rotation.z -= angularSpeed * dt;
    },
  };
}
