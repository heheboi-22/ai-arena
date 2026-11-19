import * as THREE from "three";
import { AtmosphereSnapshot, WindDerived } from "../state/worldState";
import { LANDMARKS, getIslandTopHeight } from "./terrainMath";
import { ProceduralTextures } from "./textures";

export interface WindmillSystem {
  group: THREE.Group;
  update: (
    dt: number,
    wind: WindDerived,
    atmosphere: AtmosphereSnapshot,
    lightsOn: boolean,
    reducedMotion: boolean
  ) => void;
  dispose: () => void;
}

export function createWindmill(textures: ProceduralTextures): WindmillSystem {
  const group = new THREE.Group();
  group.name = "Windmill";

  const groundY = getIslandTopHeight(LANDMARKS.windmill.x, LANDMARKS.windmill.z);
  group.position.set(LANDMARKS.windmill.x, groundY, LANDMARKS.windmill.z);
  group.rotation.y = LANDMARKS.windmill.rotationY;

  const disposables: Array<{ dispose: () => void }> = [];

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.stoneMap,
    bumpMap: textures.stoneBump,
    bumpScale: 0.045,
    roughness: 0.9,
    metalness: 0.03,
  });

  const plasterMat = new THREE.MeshStandardMaterial({
    color: 0xf7efe0,
    map: textures.plasterMap,
    bumpMap: textures.plasterBump,
    bumpScale: 0.025,
    roughness: 0.85,
    metalness: 0.0,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x875c3b,
    map: textures.woodMap,
    bumpMap: textures.woodBump,
    bumpScale: 0.025,
    roughness: 0.78,
    metalness: 0.02,
  });

  const darkWoodMat = new THREE.MeshStandardMaterial({
    color: 0x5f3d26,
    roughness: 0.8,
    metalness: 0.04,
  });

  const capRoofMat = new THREE.MeshStandardMaterial({
    color: 0x9b533e,
    map: textures.shingleMap,
    bumpMap: textures.shingleBump,
    bumpScale: 0.035,
    roughness: 0.72,
    metalness: 0.08,
  });

  const sailMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.sailMap,
    roughness: 0.88,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xcba15a,
    roughness: 0.32,
    metalness: 0.8,
  });

  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x4b6270,
    roughness: 0.25,
    metalness: 0.15,
    emissive: new THREE.Color(0xffb14a),
    emissiveIntensity: 0,
  });

  disposables.push(stoneMat, plasterMat, woodMat, darkWoodMat, capRoofMat, sailMat, brassMat, windowMat);

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, cast = true, receive = true) => {
    disposables.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
  };

  // 1. Grounded octagonal stone base (sinks -0.35 below terrain so zero gap on knoll)
  const baseTower = add(new THREE.CylinderGeometry(0.92, 1.18, 1.65, 8), stoneMat);
  baseTower.position.y = 0.52;
  group.add(baseTower);

  // 2. Tapered octagonal plaster upper tower
  const upperTower = add(new THREE.CylinderGeometry(0.68, 0.92, 2.25, 8), plasterMat);
  upperTower.position.y = 2.42;
  group.add(upperTower);

  // Timber collar trim bands
  const collarLow = add(new THREE.TorusGeometry(0.92, 0.045, 6, 16), woodMat);
  collarLow.rotation.x = Math.PI / 2;
  collarLow.position.y = 1.35;
  group.add(collarLow);

  const collarHigh = add(new THREE.TorusGeometry(0.7, 0.045, 6, 16), woodMat);
  collarHigh.rotation.x = Math.PI / 2;
  collarHigh.position.y = 3.52;
  group.add(collarHigh);

  // 3. Wooden balcony gallery walkway around mid-tower
  const galleryY = 1.62;
  const deckGeo = new THREE.RingGeometry(0.84, 1.24, 16);
  deckGeo.rotateX(-Math.PI / 2);
  const deck = add(deckGeo, woodMat);
  deck.position.y = galleryY;
  group.add(deck);

  const deckRim = add(new THREE.TorusGeometry(1.23, 0.04, 6, 20), woodMat);
  deckRim.rotation.x = Math.PI / 2;
  deckRim.position.y = galleryY;
  group.add(deckRim);

  const railRing = add(new THREE.TorusGeometry(1.22, 0.028, 6, 20), woodMat);
  railRing.rotation.x = Math.PI / 2;
  railRing.position.y = galleryY + 0.36;
  group.add(railRing);

  const postGeo = new THREE.CylinderGeometry(0.024, 0.026, 0.38, 6);
  const braceGeo = new THREE.BoxGeometry(0.05, 0.36, 0.06);
  disposables.push(postGeo, braceGeo);
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const px = Math.cos(ang) * 1.2;
    const pz = Math.sin(ang) * 1.2;
    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.set(px, galleryY + 0.18, pz);
    post.castShadow = true;
    group.add(post);

    const brace = new THREE.Mesh(braceGeo, darkWoodMat);
    brace.position.set(Math.cos(ang) * 1.0, galleryY - 0.14, Math.sin(ang) * 1.0);
    brace.rotation.y = -ang;
    brace.rotation.z = 0.55;
    group.add(brace);
  }

  // 4. Sculpted curved conical cap roof (LatheGeometry) + brass finial
  const capPoints = [
    new THREE.Vector2(0.01, 1.12),
    new THREE.Vector2(0.24, 0.85),
    new THREE.Vector2(0.54, 0.48),
    new THREE.Vector2(0.84, 0.12),
    new THREE.Vector2(0.9, 0.0),
    new THREE.Vector2(0.68, 0.0),
  ];
  const capMesh = add(new THREE.LatheGeometry(capPoints, 12), capRoofMat);
  capMesh.position.y = 3.52;
  group.add(capMesh);

  const finial = add(new THREE.CylinderGeometry(0.018, 0.042, 0.34, 6), brassMat);
  finial.position.y = 4.78;
  group.add(finial);
  const finialOrb = add(new THREE.SphereGeometry(0.055, 8, 8), brassMat, false, false);
  finialOrb.position.y = 4.96;
  group.add(finialOrb);

  // 5. Entrance wooden door & small upper window
  const doorFrame = add(new THREE.BoxGeometry(0.56, 0.9, 0.12), woodMat);
  doorFrame.position.set(0, 0.45, 1.06);
  group.add(doorFrame);
  const doorLeaf = add(new THREE.BoxGeometry(0.42, 0.82, 0.1), darkWoodMat);
  doorLeaf.position.set(0, 0.42, 1.1);
  group.add(doorLeaf);

  const winFrame = add(new THREE.BoxGeometry(0.36, 0.44, 0.09), woodMat);
  winFrame.position.set(0, 2.38, 0.81);
  group.add(winFrame);
  const winGlass = add(new THREE.BoxGeometry(0.26, 0.34, 0.1), windowMat, false, false);
  winGlass.position.set(0, 2.38, 0.82);
  group.add(winGlass);

  // 6. Nacelle axle & rotating 4-blade lattice-and-canvas sails (facing +Z toward front-left viewer)
  const hubY = 3.62;
  const hubZ = 0.74;

  const shaftHousing = add(new THREE.CylinderGeometry(0.16, 0.18, 0.56, 8), darkWoodMat);
  shaftHousing.rotation.x = Math.PI / 2;
  shaftHousing.position.set(0, hubY, hubZ - 0.1);
  group.add(shaftHousing);

  const rotorGroup = new THREE.Group();
  rotorGroup.name = "WindmillRotor";
  rotorGroup.position.set(0, hubY, hubZ + 0.24);
  group.add(rotorGroup);

  // Central hub cap
  const hubCap = add(new THREE.CylinderGeometry(0.16, 0.2, 0.24, 10), woodMat);
  hubCap.rotation.x = Math.PI / 2;
  rotorGroup.add(hubCap);

  const hubBrass = add(new THREE.SphereGeometry(0.11, 10, 8), brassMat, false, false);
  hubBrass.position.z = 0.12;
  rotorGroup.add(hubBrass);

  // Build 4 articulated lattice-and-canvas windmill blades
  const sparGeo = new THREE.BoxGeometry(0.085, 2.38, 0.07);
  const sideRailGeo = new THREE.BoxGeometry(0.042, 1.88, 0.036);
  const rungGeo = new THREE.BoxGeometry(0.56, 0.036, 0.03);
  const canvasGeo = new THREE.PlaneGeometry(0.48, 1.82);
  disposables.push(sparGeo, sideRailGeo, rungGeo, canvasGeo);

  for (let i = 0; i < 4; i++) {
    const bladeRoot = new THREE.Group();
    bladeRoot.rotation.z = (i * Math.PI) / 2 + 0.35;

    // Main central wooden spar
    const spar = new THREE.Mesh(sparGeo, woodMat);
    spar.position.set(0, 1.24, 0);
    spar.castShadow = true;
    bladeRoot.add(spar);

    // Pitched sail assembly (aerodynamic twist so blades catch light beautifully)
    const sailAssembly = new THREE.Group();
    sailAssembly.position.set(0.24, 1.44, 0.03);
    sailAssembly.rotation.y = 0.22;

    const outerRail = new THREE.Mesh(sideRailGeo, woodMat);
    outerRail.position.set(0.24, 0, 0);
    outerRail.castShadow = true;
    sailAssembly.add(outerRail);

    // 7 wooden cross-rungs
    for (let r = 0; r < 7; r++) {
      const rung = new THREE.Mesh(rungGeo, woodMat);
      rung.position.set(-0.02, -0.88 + (r / 6) * 1.76, -0.01);
      rung.castShadow = true;
      sailAssembly.add(rung);
    }

    // Woven cream canvas cloth sail
    const cloth = new THREE.Mesh(canvasGeo, sailMat);
    cloth.position.set(-0.01, 0, 0.015);
    cloth.castShadow = true;
    cloth.receiveShadow = true;
    sailAssembly.add(cloth);

    bladeRoot.add(sailAssembly);
    rotorGroup.add(bladeRoot);
  }

  let currentSpin = 0;
  let currentWinGlow = 0;

  return {
    group,
    update: (dt, wind, atmosphere, lightsOn, reducedMotion) => {
      // Smoothly ease blade angular speed to shared wind target (halts cleanly at wind === 0)
      const targetSpin = reducedMotion ? wind.windmillRadPerSec * 0.25 : wind.windmillRadPerSec;
      const damp = 1 - Math.exp(-3.4 * dt);
      currentSpin += (targetSpin - currentSpin) * damp;
      if (wind.windmillRadPerSec === 0 && currentSpin < 0.01) {
        currentSpin = 0;
      }
      rotorGroup.rotation.z -= currentSpin * dt;

      // Subtle warm glow on windmill upper slit at night when house lights are on
      const targetGlow = lightsOn ? 0.55 * atmosphere.windowProminence : 0;
      currentWinGlow += (targetGlow - currentWinGlow) * (1 - Math.exp(-5 * dt));
      windowMat.emissiveIntensity = currentWinGlow;
    },
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
