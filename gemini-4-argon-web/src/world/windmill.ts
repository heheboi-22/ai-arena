import * as THREE from 'three';
import { getIslandSurfaceHeight } from '../state';
import { ProceduralTextureSet } from './textures';

export interface WindmillSystem {
  group: THREE.Group;
  rotorGroup: THREE.Group;
  update: (dt: number, windFactor: number, houseLightsFactor: number, nightness: number) => void;
}

export function createWindmill(textures: ProceduralTextureSet): WindmillSystem {
  const group = new THREE.Group();
  group.name = 'Windmill';

  const wx = 2.85;
  const wz = -2.25;
  const wy = getIslandSurfaceHeight(wx, wz) ?? 1.1;
  group.position.set(wx, wy, wz);
  // Face the rotor blades toward the camera's front-left three-quarter view
  group.rotation.y = -0.42;

  // Contact shadow disc
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.1, 3.1),
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  const stoneMat = new THREE.MeshStandardMaterial({
    color: '#b8afa0',
    map: textures.stoneColor,
    bumpMap: textures.stoneBump,
    bumpScale: 0.04,
    roughness: 0.86,
  });

  const towerMat = new THREE.MeshStandardMaterial({
    color: '#f2e8d5',
    bumpMap: textures.stoneBump,
    bumpScale: 0.015,
    roughness: 0.8,
  });

  const timberMat = new THREE.MeshStandardMaterial({
    color: '#5c3c26',
    map: textures.woodColor,
    bumpMap: textures.woodBump,
    bumpScale: 0.03,
    roughness: 0.76,
  });

  const capMat = new THREE.MeshStandardMaterial({
    color: '#b55239',
    map: textures.roofColor,
    bumpMap: textures.roofBump,
    bumpScale: 0.04,
    roughness: 0.72,
  });

  const sailMat = new THREE.MeshStandardMaterial({
    color: '#fbf4e4',
    roughness: 0.82,
    side: THREE.DoubleSide,
  });

  const slitWindowMat = new THREE.MeshStandardMaterial({
    color: '#34495e',
    emissive: new THREE.Color('#ffaa38'),
    emissiveIntensity: 0,
    roughness: 0.25,
  });

  // 1. Octagonal Stone Base Plinth
  const baseTower = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.98, 0.85, 8), stoneMat);
  baseTower.position.y = 0.42;
  baseTower.castShadow = true;
  baseTower.receiveShadow = true;
  group.add(baseTower);

  // 2. Wooden Observation Deck / Balcony
  const deckFloor = new THREE.Mesh(new THREE.CylinderGeometry(1.06, 1.04, 0.08, 8), timberMat);
  deckFloor.position.y = 0.86;
  deckFloor.castShadow = true;
  deckFloor.receiveShadow = true;
  group.add(deckFloor);

  const railRing = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.03, 6, 8), timberMat);
  railRing.rotation.x = Math.PI / 2;
  railRing.position.y = 1.12;
  railRing.rotation.z = Math.PI / 8;
  group.add(railRing);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.28, 6), timberMat);
    post.position.set(Math.cos(a) * 0.96, 1.0, Math.sin(a) * 0.96);
    post.castShadow = true;
    group.add(post);
  }

  // 3. Tapered Upper Tower
  const midTower = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.82, 1.75, 8), towerMat);
  midTower.position.y = 0.85 + 0.875;
  midTower.castShadow = true;
  midTower.receiveShadow = true;
  group.add(midTower);

  // Small tower window on front face
  const towerWinFrame = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 0.08), timberMat);
  towerWinFrame.position.set(0, 1.65, 0.72);
  group.add(towerWinFrame);

  const towerWinGlass = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.06), slitWindowMat);
  towerWinGlass.position.set(0, 1.65, 0.74);
  group.add(towerWinGlass);

  // 4. Conical Shingled Cap & Tail Vane
  const capY = 2.6;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.74, 0.72, 8), capMat);
  cap.position.y = capY + 0.32;
  cap.castShadow = true;
  cap.receiveShadow = true;
  group.add(cap);

  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), timberMat);
  finial.position.y = capY + 0.7;
  group.add(finial);

  // Rear tail pole
  const tailPole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.85, 6), timberMat);
  tailPole.rotation.x = Math.PI / 3;
  tailPole.position.set(0, capY - 0.05, -0.78);
  group.add(tailPole);

  // 5. Rotating 4-Blade Rotor Hub & Sails
  const rotorGroup = new THREE.Group();
  rotorGroup.name = 'WindmillRotor';
  rotorGroup.position.set(0, capY + 0.06, 0.68);
  group.add(rotorGroup);

  const axle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.36, 10),
    timberMat,
  );
  axle.rotation.x = Math.PI / 2;
  axle.position.z = -0.06;
  axle.castShadow = true;
  rotorGroup.add(axle);

  const hubNose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.18, 8), timberMat);
  hubNose.rotation.x = Math.PI / 2;
  hubNose.position.z = 0.14;
  rotorGroup.add(hubNose);

  // Build 4 detailed wooden lattice + canvas sail blades
  const bladeLength = 1.72;
  for (let i = 0; i < 4; i++) {
    const bladePivot = new THREE.Group();
    bladePivot.rotation.z = (i * Math.PI) / 2 + 0.28;

    const bladeInner = new THREE.Group();
    // Slight aerodynamic pitch so blades catch light and show depth
    bladeInner.rotation.y = 0.22;

    // Main wooden spar
    const spar = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, bladeLength, 0.065),
      timberMat,
    );
    spar.position.y = bladeLength / 2 + 0.08;
    spar.castShadow = true;
    bladeInner.add(spar);

    // Canvas sail cloth offset to one side of the spar
    const sailW = 0.34;
    const sailH = bladeLength - 0.32;
    const sail = new THREE.Mesh(
      new THREE.BoxGeometry(sailW, sailH, 0.02),
      sailMat,
    );
    sail.position.set(sailW / 2 + 0.03, bladeLength / 2 + 0.18, 0.01);
    sail.castShadow = true;
    sail.receiveShadow = true;
    bladeInner.add(sail);

    // Lattice crossbars across each sail
    for (let r = 0; r < 5; r++) {
      const rungY = 0.42 + r * 0.31;
      const rung = new THREE.Mesh(
        new THREE.BoxGeometry(sailW + 0.08, 0.032, 0.035),
        timberMat,
      );
      rung.position.set(sailW / 2 + 0.02, rungY, 0.015);
      bladeInner.add(rung);
    }

    bladePivot.add(bladeInner);
    rotorGroup.add(bladePivot);
  }

  return {
    group,
    rotorGroup,
    update: (dt: number, windFactor: number, houseLightsFactor: number, nightness: number) => {
      // Windmill rotation speed directly driven by shared windFactor (stops at 0% wind)
      if (windFactor > 0.002) {
        const angularSpeed = windFactor * 3.8;
        rotorGroup.rotation.z -= angularSpeed * dt;
      }

      // Subtle warm glow in the tower window when house lights are active
      slitWindowMat.emissiveIntensity = houseLightsFactor * (1.4 + nightness * 1.2);
      slitWindowMat.color.setHex(houseLightsFactor > 0.15 ? 0xffcf70 : 0x34495e);
    },
  };
}
