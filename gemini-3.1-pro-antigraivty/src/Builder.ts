import * as THREE from 'three';

export interface SceneObjects {
  root: THREE.Group;
  windmillBlades: THREE.Group;
  trees: THREE.Group[];
  clouds: THREE.Group[];
  houseWindows: THREE.Mesh[];
  pond: THREE.Mesh;
}

// Materials
const matGrass = new THREE.MeshStandardMaterial({ color: 0x8ab95e, roughness: 0.8, flatShading: true });
const matRock = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.9, flatShading: true });
const matWood = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.7, flatShading: true });
const matWall = new THREE.MeshStandardMaterial({ color: 0xf5f5dc, roughness: 1.0, flatShading: true });
const matRoof = new THREE.MeshStandardMaterial({ color: 0xb2564b, roughness: 0.8, flatShading: true });
const matWindowOff = new THREE.MeshStandardMaterial({ color: 0x4a6a8a, roughness: 0.2, metalness: 0.5 });
const matDoor = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 });
const matLeaves = new THREE.MeshStandardMaterial({ color: 0x6ca34e, roughness: 0.8, flatShading: true });
const matCloud = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0, flatShading: true });
const matWater = new THREE.MeshStandardMaterial({ color: 0x5dade2, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.9, flatShading: true });
const matPath = new THREE.MeshStandardMaterial({ color: 0xb5a68b, roughness: 1.0, flatShading: true });

export function buildScene(): SceneObjects {
  const root = new THREE.Group();
  
  const ctx: SceneObjects = {
    root,
    windmillBlades: new THREE.Group(),
    trees: [],
    clouds: [],
    houseWindows: [],
    pond: new THREE.Mesh(),
  };

  // 1. Island Base
  const baseGeom = new THREE.CylinderGeometry(8, 6, 4, 12, 1);
  const base = new THREE.Mesh(baseGeom, matRock);
  base.position.y = -2;
  base.castShadow = true;
  base.receiveShadow = true;
  
  // Randomize vertices for a rocky look
  const pos = baseGeom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < 0) { // perturb bottom more
      pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 1.5);
      pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * 1.5);
      pos.setY(i, pos.getY(i) + (Math.random() - 0.5) * 1.5);
    } else {
      pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 0.5);
      pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * 0.5);
    }
  }
  baseGeom.computeVertexNormals();
  root.add(base);

  // Grass top
  const grassGeom = new THREE.CylinderGeometry(7.8, 8.2, 0.5, 12);
  const grass = new THREE.Mesh(grassGeom, matGrass);
  const gPos = grassGeom.attributes.position;
  for (let i = 0; i < gPos.count; i++) {
      gPos.setX(i, gPos.getX(i) + (Math.random() - 0.5) * 0.4);
      gPos.setZ(i, gPos.getZ(i) + (Math.random() - 0.5) * 0.4);
  }
  grassGeom.computeVertexNormals();
  grass.position.y = 0.25;
  grass.receiveShadow = true;
  grass.castShadow = true;
  root.add(grass);

  // 2. House
  const houseGroup = new THREE.Group();
  houseGroup.position.set(-2, 0.5, -1);
  houseGroup.rotation.y = Math.PI / 6;

  // Body
  const houseBody = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 2.5), matWall);
  houseBody.position.y = 1.25;
  houseBody.castShadow = true;
  houseBody.receiveShadow = true;
  houseGroup.add(houseBody);

  // Roof
  const roofGeom = new THREE.ConeGeometry(2.5, 2, 4);
  roofGeom.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(roofGeom, matRoof);
  roof.position.y = 3.5;
  roof.castShadow = true;
  roof.receiveShadow = true;
  houseGroup.add(roof);

  // Door
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.1), matDoor);
  door.position.set(0, 0.7, 1.26);
  houseGroup.add(door);

  // Windows
  const winGeom = new THREE.PlaneGeometry(0.6, 0.6);
  const w1 = new THREE.Mesh(winGeom, matWindowOff);
  w1.position.set(-0.8, 1.2, 1.26);
  houseGroup.add(w1);
  const w2 = new THREE.Mesh(winGeom, matWindowOff);
  w2.position.set(0.8, 1.2, 1.26);
  houseGroup.add(w2);
  const w3 = new THREE.Mesh(winGeom, matWindowOff);
  w3.position.set(1.51, 1.2, 0);
  w3.rotation.y = Math.PI / 2;
  houseGroup.add(w3);
  
  ctx.houseWindows.push(w1, w2, w3);

  // Chimney
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), matWall);
  chimney.position.set(-1, 3, -0.5);
  chimney.castShadow = true;
  houseGroup.add(chimney);

  root.add(houseGroup);

  // Invisible clicking bounds for house
  const houseRay = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 4), new THREE.MeshBasicMaterial({visible: false}));
  houseRay.position.copy(houseGroup.position);
  houseRay.position.y = 2.5;
  houseRay.userData.isHouse = true;
  root.add(houseRay);

  // 3. Pond
  const pondGeom = new THREE.CylinderGeometry(2, 2.2, 0.2, 10);
  ctx.pond = new THREE.Mesh(pondGeom, matWater);
  ctx.pond.position.set(3, 0.4, 3);
  ctx.pond.receiveShadow = true;
  root.add(ctx.pond);
  // Optional sand rim
  const sandGeom = new THREE.CylinderGeometry(2.4, 2.5, 0.1, 10);
  const sand = new THREE.Mesh(sandGeom, matPath);
  sand.position.set(3, 0.45, 3);
  sand.receiveShadow = true;
  root.add(sand);

  // 4. Windmill
  const windmillBase = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 3, 6), matWall);
  windmillBase.position.set(3, 2, -3);
  windmillBase.castShadow = true;
  windmillBase.receiveShadow = true;
  root.add(windmillBase);

  const windmillRoof = new THREE.Mesh(new THREE.ConeGeometry(1, 1.5, 6), matRoof);
  windmillRoof.position.set(3, 4.25, -3);
  windmillRoof.castShadow = true;
  root.add(windmillRoof);

  ctx.windmillBlades.position.set(3, 3.5, -2.1);
  const hub = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), matWood);
  ctx.windmillBlades.add(hub);

  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 0.4), matWood);
    blade.position.y = 1.25;
    const pivot = new THREE.Group();
    pivot.rotation.z = (Math.PI / 2) * i;
    pivot.add(blade);
    ctx.windmillBlades.add(pivot);
    blade.castShadow = true;
  }
  root.add(ctx.windmillBlades);

  // 5. Trees
  const treePositions = [
    {x: -4, z: 2, scale: 1},
    {x: -5, z: -2, scale: 0.8},
    {x: 0, z: -5, scale: 1.2},
    {x: -1, z: 4, scale: 0.9}
  ];

  treePositions.forEach(pos => {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(pos.x, 0.5, pos.z);
    treeGroup.scale.set(pos.scale, pos.scale, pos.scale);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.5), matWood);
    trunk.position.y = 0.75;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    const leaves1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2), matLeaves);
    leaves1.position.set(0, 2, 0);
    leaves1.castShadow = true;
    treeGroup.add(leaves1);
    
    if (Math.random() > 0.5) {
      const leaves2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8), matLeaves);
      leaves2.position.set(0.6, 1.5, -0.4);
      leaves2.castShadow = true;
      treeGroup.add(leaves2);
    }

    // Wrap in another group for bottom-centered rotation (wind sway)
    const treeSwayRoot = new THREE.Group();
    treeSwayRoot.position.set(pos.x, 0.5, pos.z);
    treeGroup.position.set(0, 0, 0);
    treeSwayRoot.add(treeGroup);
    
    root.add(treeSwayRoot);
    ctx.trees.push(treeSwayRoot);
  });

  // 6. Path
  const path = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 1), matPath);
  path.position.set(0, 0.52, 1.5);
  path.rotation.y = Math.PI / 4;
  path.receiveShadow = true;
  root.add(path);

  // 7. Clouds
  for (let i = 0; i < 4; i++) {
    const cloudGeom = new THREE.Group();
    for (let c = 0; c < 3; c++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1 + Math.random() * 0.5, 7, 7), matCloud);
      puff.position.set(
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 1.5
      );
      cloudGeom.add(puff);
    }
    cloudGeom.position.set(
      (Math.random() - 0.5) * 20,
      8 + Math.random() * 3,
      (Math.random() - 0.5) * 20
    );
    root.add(cloudGeom);
    ctx.clouds.push(cloudGeom);
  }

  // 8. Minor Details (Rocks, Flowers)
  for (let i = 0; i < 8; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(Math.random() * 0.3 + 0.1), matRock);
    rock.position.set(
      (Math.random() - 0.5) * 12,
      0.5,
      (Math.random() - 0.5) * 12
    );
    // keep rocks mostly inside island
    if (rock.position.length() < 7.5) {
      rock.castShadow = true;
      root.add(rock);
    }
  }

  return ctx;
}
