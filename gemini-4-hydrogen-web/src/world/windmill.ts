import * as THREE from "three";
import { damp, groundHeightAt, WINDMILL_CENTER } from "../util/math";
import type { ProceduralTextures } from "./textures";

export interface WindmillRig {
  group: THREE.Group;
  update: (dt: number, elapsed: number, windStrength: number, reducedMotion: boolean) => void;
  dispose: () => void;
}

export function createWindmill(textures: ProceduralTextures): WindmillRig {
  const group = new THREE.Group();
  group.name = "Windmill";

  const baseY = groundHeightAt(WINDMILL_CENTER.x, WINDMILL_CENTER.z);
  group.position.set(WINDMILL_CENTER.x, baseY - 0.05, WINDMILL_CENTER.z);
  group.rotation.y = 0.46;

  const disposables: { dispose: () => void }[] = [];

  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stoneMap,
    color: "#8f8b82",
    roughness: 0.92,
    metalness: 0.05,
  });
  const towerMat = new THREE.MeshStandardMaterial({
    map: textures.stuccoMap,
    color: "#efe5d3",
    roughness: 0.85,
    metalness: 0.02,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.woodMap,
    color: "#775235",
    roughness: 0.78,
    metalness: 0.05,
  });
  const capMat = new THREE.MeshStandardMaterial({
    map: textures.shingleMap,
    color: "#98503c",
    roughness: 0.78,
    metalness: 0.06,
  });
  const clothMat = new THREE.MeshStandardMaterial({
    color: "#f6f0e4",
    roughness: 0.9,
    metalness: 0.01,
    side: THREE.DoubleSide,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: "#3f4448",
    roughness: 0.45,
    metalness: 0.78,
  });
  const windowMat = new THREE.MeshStandardMaterial({
    color: "#45586b",
    roughness: 0.25,
    metalness: 0.15,
  });

  disposables.push(stoneMat, towerMat, woodMat, capMat, clothMat, ironMat, windowMat);

  // 1. Octagonal Stone Foundation Plinth
  const plinthGeo = new THREE.CylinderGeometry(0.88, 0.98, 0.56, 8);
  const plinth = new THREE.Mesh(plinthGeo, stoneMat);
  plinth.position.y = 0.22;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);
  disposables.push(plinthGeo);

  // 2. Tapered Plaster Tower
  const towerGeo = new THREE.CylinderGeometry(0.56, 0.82, 2.25, 8);
  const tower = new THREE.Mesh(towerGeo, towerMat);
  tower.position.y = 1.6;
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);
  disposables.push(towerGeo);

  // Timber collar trim bands
  const bandGeo = new THREE.CylinderGeometry(0.71, 0.73, 0.08, 8);
  const band = new THREE.Mesh(bandGeo, woodMat);
  band.position.y = 1.65;
  group.add(band);
  disposables.push(bandGeo);

  // 3. Observation Balcony Deck & Railings
  const deckGeo = new THREE.CylinderGeometry(0.82, 0.76, 0.09, 8);
  const deck = new THREE.Mesh(deckGeo, woodMat);
  deck.position.y = 1.44;
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);
  disposables.push(deckGeo);

  const postGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.28, 6);
  const railGeo = new THREE.TorusGeometry(0.77, 0.02, 6, 8);
  railGeo.rotateX(Math.PI * 0.5);
  railGeo.rotateY(Math.PI / 8);
  const rail = new THREE.Mesh(railGeo, woodMat);
  rail.position.y = 1.72;
  group.add(rail);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.set(Math.cos(a) * 0.76, 1.6, Math.sin(a) * 0.76);
    group.add(post);
  }
  disposables.push(postGeo, railGeo);

  // 4. Small Door & Window
  const doorGeo = new THREE.BoxGeometry(0.36, 0.62, 0.12);
  const door = new THREE.Mesh(doorGeo, woodMat);
  door.position.set(0, 0.68, 0.77);
  group.add(door);

  const winGeo = new THREE.BoxGeometry(0.24, 0.28, 0.1);
  const win = new THREE.Mesh(winGeo, windowMat);
  win.position.set(0, 1.98, 0.6);
  group.add(win);
  disposables.push(doorGeo, winGeo);

  // 5. Conical Shingled Roof Cap + Finial
  const capGeo = new THREE.ConeGeometry(0.72, 0.92, 8);
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.y = 3.16;
  cap.castShadow = true;
  group.add(cap);

  const spireGeo = new THREE.CylinderGeometry(0.015, 0.025, 0.36, 6);
  const spire = new THREE.Mesh(spireGeo, ironMat);
  spire.position.y = 3.74;
  group.add(spire);
  disposables.push(capGeo, spireGeo);

  // 6. Rotating Hub & 4 Lattice Sails
  const rotor = new THREE.Group();
  rotor.position.set(0, 2.52, 0.7);
  group.add(rotor);

  const shaftGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.48, 10);
  shaftGeo.rotateX(Math.PI * 0.5);
  const shaft = new THREE.Mesh(shaftGeo, woodMat);
  shaft.position.z = -0.14;
  rotor.add(shaft);

  const hubGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.16, 12);
  hubGeo.rotateX(Math.PI * 0.5);
  const hub = new THREE.Mesh(hubGeo, ironMat);
  hub.castShadow = true;
  rotor.add(hub);
  disposables.push(shaftGeo, hubGeo);

  const sparGeo = new THREE.BoxGeometry(0.065, 1.66, 0.05);
  const railBarGeo = new THREE.BoxGeometry(0.42, 0.03, 0.025);
  const sailGeo = new THREE.PlaneGeometry(0.38, 1.24);
  disposables.push(sparGeo, railBarGeo, sailGeo);

  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Group();
    blade.rotation.z = (i * Math.PI) / 2 + 0.32;

    const spar = new THREE.Mesh(sparGeo, woodMat);
    spar.position.y = 0.86;
    spar.castShadow = true;
    blade.add(spar);

    // Cross lattice battens
    for (let b = 0; b < 5; b++) {
      const batten = new THREE.Mesh(railBarGeo, woodMat);
      batten.position.set(0.14, 0.48 + b * 0.28, 0.01);
      blade.add(batten);
    }

    // Linen sail cloth tilted slightly into the wind
    const sail = new THREE.Mesh(sailGeo, clothMat);
    sail.position.set(0.16, 1.04, 0.022);
    sail.rotation.y = 0.14;
    sail.castShadow = true;
    blade.add(sail);

    rotor.add(blade);
  }

  let currentSpinSpeed = 0.65;

  const update = (dt: number, _elapsed: number, windStrength: number, reducedMotion: boolean) => {
    const baseMaxSpeed = reducedMotion ? 0.8 : 2.95;
    // At 0% wind, windmill stops smoothly
    const targetSpeed = windStrength < 0.01 ? 0 : (0.12 + windStrength * 0.88) * baseMaxSpeed;
    currentSpinSpeed = damp(currentSpinSpeed, targetSpeed, 4.2, dt);
    rotor.rotation.z -= currentSpinSpeed * dt;
  };

  const dispose = () => {
    for (const d of disposables) d.dispose();
  };

  return {
    group,
    update,
    dispose,
  };
}
