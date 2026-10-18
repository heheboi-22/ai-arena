import * as THREE from 'three';

export interface HouseRefs {
  group: THREE.Group;
  chimney: THREE.Object3D;
  windowMat: THREE.MeshStandardMaterial;
  lanternMat: THREE.MeshStandardMaterial;
  houseLight: THREE.PointLight;
}

export interface WindmillRefs {
  group: THREE.Group;
  blades: THREE.Group;
}

/** Triangular prism — the gable of the house roof. */
function createPrismGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  const hw = width / 2;
  const hd = depth / 2;
  // 6 corners: front triangle (z=+hd), back triangle (z=-hd)
  const v = [
    -hw, 0, hd,  hw, 0, hd,  0, height, hd, // front: 0,1,2
    -hw, 0, -hd, 0, height, -hd, hw, 0, -hd, // back: 3,4,5
  ];
  const indices = [
    0, 1, 2, // front gable
    5, 4, 3, // back gable
    0, 2, 4, 0, 4, 3, // left slope
    1, 5, 2, 2, 5, 4, // right slope
    3, 0, 5, 5, 0, 1, // bottom
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const CREAM = '#f2e8d5';
const TERRACOTTA = '#b5542f';
const TERRACOTTA_DARK = '#9a4526';
const WOOD = '#8a5a36';
const STONE = '#9a938a';
const FRAME = '#faf6ec';

export function buildHouse(): HouseRefs {
  const group = new THREE.Group();

  const wallMat = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.9 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: STONE, roughness: 1, flatShading: true });
  const woodMat = new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: TERRACOTTA, roughness: 0.8, flatShading: true });

  // Foundation + walls
  const foundation = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.2, 1.3), stoneMat);
  foundation.position.y = 0.1;
  const walls = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.05, 1.15), wallMat);
  walls.position.y = 0.2 + 0.525;
  walls.castShadow = true;
  walls.receiveShadow = true;
  foundation.receiveShadow = true;
  group.add(foundation, walls);

  // Gable (cream) + two terracotta roof slabs + ridge cap
  const wallTop = 1.25;
  const roofH = 0.6;
  const roofW = 1.78;
  const roofD = 1.42;
  const gable = new THREE.Mesh(createPrismGeometry(roofW, roofH, roofD), wallMat);
  gable.position.y = wallTop;
  gable.castShadow = true;
  group.add(gable);

  const slopeAngle = Math.atan2(roofH, roofW / 2);
  const slabGeo = new THREE.BoxGeometry(roofW / 2 + 0.1, 0.07, roofD + 0.12);
  const leftSlope = new THREE.Mesh(slabGeo, roofMat);
  leftSlope.position.set(-roofW / 4, wallTop + roofH / 2 + 0.01, 0);
  leftSlope.rotation.z = slopeAngle;
  leftSlope.castShadow = true;
  const rightSlope = new THREE.Mesh(slabGeo, roofMat);
  rightSlope.position.set(roofW / 4, wallTop + roofH / 2 + 0.01, 0);
  rightSlope.rotation.z = -slopeAngle;
  rightSlope.castShadow = true;
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, roofD + 0.14), new THREE.MeshStandardMaterial({ color: TERRACOTTA_DARK, roughness: 0.8 }));
  ridge.position.set(0, wallTop + roofH + 0.02, 0);
  group.add(leftSlope, rightSlope, ridge);

  // Door (front, +z)
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.56, 0.06), woodMat);
  door.position.set(-0.3, 0.2 + 0.28, 0.575 + 0.02);
  door.castShadow = true;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), new THREE.MeshStandardMaterial({ color: '#e8c56a', roughness: 0.4, metalness: 0.6 }));
  knob.position.set(-0.3 + 0.1, 0.48, 0.575 + 0.06);
  group.add(door, knob);

  // Windows: cream frame + glass pane that glows when lit.
  const windowMat = new THREE.MeshStandardMaterial({
    color: '#3a4a5a',
    roughness: 0.25,
    metalness: 0.1,
    emissive: new THREE.Color('#ffc06a'),
    emissiveIntensity: 0.05,
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: FRAME, roughness: 0.85 });

  const addWindow = (x: number, y: number, z: number, rotY: number) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.04), frameMat);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05), windowMat);
    const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.055), frameMat);
    const mullionH = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.055), frameMat);
    frame.position.set(x, y, z);
    glass.position.set(x, y, z + Math.sign(z) * 0.004);
    mullionV.position.copy(glass.position);
    mullionH.position.copy(glass.position);
    for (const m of [frame, glass, mullionV, mullionH]) {
      m.rotation.y = rotY;
      group.add(m);
    }
  };

  addWindow(0.34, 0.8, 0.575, 0); // front, right of door
  addWindow(0, 0.8, -0.575, 0); // back
  addWindow(0.75, 0.8, 0, Math.PI / 2); // east side
  addWindow(-0.75, 0.8, 0, Math.PI / 2); // west side

  // Chimney + cap
  const brickMat = new THREE.MeshStandardMaterial({ color: '#9a5a44', roughness: 0.95 });
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.55, 0.24), brickMat);
  chimney.position.set(0.32, 1.78, 0.25);
  chimney.castShadow = true;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.32), stoneMat);
  cap.position.set(0.32, 2.08, 0.25);
  group.add(chimney, cap);

  // Lantern beside the door — glows with the house lights.
  const lanternMat = new THREE.MeshStandardMaterial({
    color: '#5a4a3a',
    emissive: new THREE.Color('#ffb45e'),
    emissiveIntensity: 0.05,
    roughness: 0.6,
  });
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), lanternMat);
  lantern.position.set(-0.62, 0.78, 0.6);
  const lanternArm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.1), woodMat);
  lanternArm.position.set(-0.62, 0.85, 0.585);
  group.add(lantern, lanternArm);

  // Warm light that fades in when the house lights are on.
  const houseLight = new THREE.PointLight(0xffb45e, 0, 6, 2);
  houseLight.position.set(0, 1.1, 0.9);
  group.add(houseLight);

  // Step stone in front of the door
  const step = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.07, 8), stoneMat);
  step.position.set(-0.3, 0.035, 0.85);
  step.receiveShadow = true;
  step.castShadow = true;
  group.add(step);

  // Position: south-west of center, door angled toward the island heart.
  group.position.set(-2.5, 0, -1.2);
  group.rotation.y = 0.55;

  return { group, chimney, windowMat, lanternMat, houseLight };
}

export function buildWindmill(): WindmillRefs {
  const group = new THREE.Group();

  const creamMat = new THREE.MeshStandardMaterial({ color: '#eee2c8', roughness: 0.9, flatShading: true });
  const stoneMat = new THREE.MeshStandardMaterial({ color: STONE, roughness: 1, flatShading: true });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#7d5233', roughness: 0.85 });
  const sailMat = new THREE.MeshStandardMaterial({ color: '#e8d9b8', roughness: 0.9, side: THREE.DoubleSide });
  const armMat = new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.85 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.02, 0.35, 12), stoneMat);
  base.position.y = 0.175;
  base.castShadow = true;
  base.receiveShadow = true;

  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 2.5, 12), creamMat);
  tower.position.y = 0.35 + 1.25;
  tower.castShadow = true;
  tower.receiveShadow = true;

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.5, 12), woodMat);
  cap.position.y = 2.85 + 0.25;
  cap.castShadow = true;

  // Door + window on the tower front (+z)
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.07), woodMat);
  door.position.set(0, 0.6, 0.76);
  const winFrame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.05), new THREE.MeshStandardMaterial({ color: FRAME, roughness: 0.85 }));
  winFrame.position.set(0, 1.75, 0.62);
  const winGlass = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.16, 0.06),
    new THREE.MeshStandardMaterial({ color: '#4a5a6a', roughness: 0.3, emissive: new THREE.Color('#ffc06a'), emissiveIntensity: 0.04 }),
  );
  winGlass.position.set(0, 1.75, 0.63);

  // Hub + four classic slatted blades.
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 10), woodMat);
  hub.rotation.x = Math.PI / 2;
  hub.position.set(0, 2.72, 0.55);
  hub.castShadow = true;

  const blades = new THREE.Group();
  blades.position.set(0, 2.72, 0.68);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.0, 0.035), armMat);
    arm.position.y = 0.6;
    arm.castShadow = true;
    const sail = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.62, 0.02), sailMat);
    sail.position.set(0, 0.92, 0.01);
    sail.castShadow = true;
    blade.add(arm, sail);
    blade.rotation.z = (i * Math.PI) / 2;
    blades.add(blade);
  }

  group.add(base, tower, cap, door, winFrame, winGlass, hub, blades);

  // North-east of the pond, face the open sky so the blades read clearly.
  group.position.set(2.1, 0, 2.9);
  group.rotation.y = Math.atan2(2.1, 2.9);

  return { group, blades };
}
