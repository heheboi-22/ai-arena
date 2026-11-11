import * as THREE from 'three';

export interface TreeRig {
  pivot: THREE.Group;
  phase: number;
  flex: number;
}

export interface CloudRig {
  group: THREE.Group;
  speed: number;
}

interface SmokePuff {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  offset: number;
}

export interface World {
  root: THREE.Group;
  house: THREE.Group;
  houseTargets: THREE.Object3D[];
  windows: THREE.MeshStandardMaterial;
  porchLight: THREE.PointLight;
  windmillRotor: THREE.Group;
  trees: TreeRig[];
  clouds: CloudRig[];
  cloudMaterial: THREE.MeshStandardMaterial;
  waterMaterial: THREE.MeshPhysicalMaterial;
  update: (dt: number, elapsed: number, wind: number, lightLevel: number, night: number, reducedMotion: boolean) => void;
}

const GRASS_Y = 0.18;
const WINDOW_OFF = new THREE.Color('#668083');
const WINDOW_ON = new THREE.Color('#ffd68a');
const random = mulberry32(41027);

function mulberry32(seed: number): () => number {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function material(color: THREE.ColorRepresentation, roughness = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}

function shadows(object: THREE.Object3D, cast = true, receive = true): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
}

function mesh(geometry: THREE.BufferGeometry, mat: THREE.Material, position?: [number, number, number]): THREE.Mesh {
  const result = new THREE.Mesh(geometry, mat);
  if (position) result.position.set(...position);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function makeSpeckleTexture(base: string, fleck: string, count: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d')!;
  context.fillStyle = base;
  context.fillRect(0, 0, 128, 128);
  context.fillStyle = fleck;
  for (let i = 0; i < count; i += 1) {
    context.globalAlpha = 0.08 + random() * 0.15;
    const size = 0.5 + random() * 1.8;
    context.fillRect(random() * 128, random() * 128, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

function islandRadius(angle: number): number {
  return 1 + Math.sin(angle * 3 + 0.7) * 0.045 + Math.sin(angle * 5 - 0.8) * 0.035 + Math.cos(angle * 9) * 0.018;
}

function createIsland(): THREE.Group {
  const group = new THREE.Group();
  const segments = 72;

  const topPositions: number[] = [0, GRASS_Y, 0];
  const topUVs: number[] = [0.5, 0.5];
  const topIndices: number[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const radius = islandRadius(angle);
    const x = Math.cos(angle) * 5.15 * radius;
    const z = Math.sin(angle) * 3.9 * radius;
    topPositions.push(x, GRASS_Y + Math.sin(angle * 4) * 0.025, z);
    topUVs.push(x / 10.3 + 0.5, z / 7.8 + 0.5);
    if (i < segments) topIndices.push(0, i + 2, i + 1);
  }
  const topGeometry = new THREE.BufferGeometry();
  topGeometry.setAttribute('position', new THREE.Float32BufferAttribute(topPositions, 3));
  topGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(topUVs, 2));
  topGeometry.setIndex(topIndices);
  topGeometry.computeVertexNormals();
  const grass = new THREE.MeshStandardMaterial({
    map: makeSpeckleTexture('#8da762', '#435f38', 850),
    roughness: 0.96,
    color: '#f3f1d8',
  });
  const top = mesh(topGeometry, grass);
  top.castShadow = false;
  group.add(top);

  const ringFactors = [1, 0.98, 0.83, 0.62, 0.37, 0.09];
  const ringHeights = [0.15, -0.34, -1.12, -2.08, -3.02, -3.63];
  const rings: THREE.Vector3[][] = [];
  for (let ring = 0; ring < ringFactors.length; ring += 1) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const irregular = islandRadius(angle) * (1 + (random() - 0.5) * (ring === 0 ? 0 : 0.065));
      const factor = ringFactors[ring];
      points.push(new THREE.Vector3(
        Math.cos(angle) * 5.12 * factor * irregular,
        ringHeights[ring] + (ring === 0 ? 0 : (random() - 0.5) * 0.28),
        Math.sin(angle) * 3.87 * factor * irregular,
      ));
    }
    rings.push(points);
  }

  const rockPositions: number[] = [];
  const rockColors: number[] = [];
  const palettes = ['#80725d', '#918069', '#756a58', '#9a876c', '#6c6254', '#aa9272'];
  const addTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color) => {
    rockPositions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i += 1) rockColors.push(color.r, color.g, color.b);
  };
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let i = 0; i < segments; i += 1) {
      const next = (i + 1) % segments;
      const baseColor = new THREE.Color(ring === 0 ? '#756448' : palettes[Math.floor(random() * palettes.length)]);
      baseColor.offsetHSL(0, 0, (random() - 0.5) * 0.045);
      addTriangle(rings[ring][i], rings[ring + 1][next], rings[ring + 1][i], baseColor);
      addTriangle(rings[ring][i], rings[ring][next], rings[ring + 1][next], baseColor);
    }
  }
  const bottom = new THREE.Vector3(0.18, -3.93, -0.08);
  for (let i = 0; i < segments; i += 1) {
    addTriangle(rings.at(-1)![i], rings.at(-1)![(i + 1) % segments], bottom, new THREE.Color('#665d51'));
  }
  const rockGeometry = new THREE.BufferGeometry();
  rockGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rockPositions, 3));
  rockGeometry.setAttribute('color', new THREE.Float32BufferAttribute(rockColors, 3));
  rockGeometry.computeVertexNormals();
  group.add(mesh(rockGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })));

  const lipGeometry = new THREE.DodecahedronGeometry(0.22, 0);
  const lipMaterial = material('#829858');
  for (let i = 0; i < 31; i += 1) {
    const angle = (i / 31) * Math.PI * 2;
    const radius = islandRadius(angle);
    const clump = mesh(lipGeometry, lipMaterial);
    clump.position.set(Math.cos(angle) * 5.03 * radius, 0.08, Math.sin(angle) * 3.8 * radius);
    clump.scale.set(1.2 + random(), 0.45 + random() * 0.35, 1 + random() * 0.7);
    clump.rotation.set(random(), random(), random());
    group.add(clump);
  }

  const rootMaterial = material('#66533d');
  const rootGeometry = new THREE.CylinderGeometry(0.025, 0.055, 1, 5);
  for (let i = 0; i < 9; i += 1) {
    const angle = random() * Math.PI * 2;
    const root = mesh(rootGeometry, rootMaterial);
    root.position.set(Math.cos(angle) * 3.75, -0.65 - random() * 0.5, Math.sin(angle) * 2.8);
    root.scale.y = 0.55 + random() * 0.75;
    root.rotation.z = (random() - 0.5) * 0.35;
    group.add(root);
  }
  return group;
}

function createWindow(windows: THREE.MeshStandardMaterial, frame: THREE.Material, width = 0.48, height = 0.57): THREE.Group {
  const group = new THREE.Group();
  group.add(mesh(new THREE.BoxGeometry(width + 0.13, height + 0.13, 0.07), frame));
  group.add(mesh(new THREE.BoxGeometry(width, height, 0.085), windows, [0, 0, 0.015]));
  group.add(mesh(new THREE.BoxGeometry(0.045, height, 0.04), frame, [0, 0, 0.065]));
  group.add(mesh(new THREE.BoxGeometry(width, 0.045, 0.04), frame, [0, 0, 0.065]));
  const sill = mesh(new THREE.BoxGeometry(width + 0.22, 0.09, 0.18), frame, [0, -height / 2 - 0.08, 0.045]);
  group.add(sill);
  return group;
}

function createHouse(): { house: THREE.Group; windows: THREE.MeshStandardMaterial; porchLight: THREE.PointLight; smoke: SmokePuff[] } {
  const house = new THREE.Group();
  house.position.set(-1.0, GRASS_Y, 0.25);
  const plaster = new THREE.MeshStandardMaterial({ map: makeSpeckleTexture('#eadbb8', '#a99675', 380), roughness: 0.96 });
  const timber = material('#66513d');
  const darkWood = material('#4b4035');
  const roof = material('#a85f49', 0.9);
  const roofEdge = material('#814738');
  const stone = material('#938b76');
  const windows = new THREE.MeshStandardMaterial({ color: '#668083', roughness: 0.32, emissive: '#ffb64f', emissiveIntensity: 0 });

  house.add(mesh(new THREE.BoxGeometry(2.28, 0.22, 1.9), stone, [0, 0.11, 0]));
  house.add(mesh(new THREE.BoxGeometry(2.18, 1.48, 1.8), plaster, [0, 0.91, 0]));

  for (const x of [-1.09, 1.09]) {
    for (const z of [-0.9, 0.9]) house.add(mesh(new THREE.BoxGeometry(0.09, 1.55, 0.09), timber, [x, 0.92, z]));
  }
  house.add(mesh(new THREE.BoxGeometry(2.26, 0.09, 0.09), timber, [0, 1.57, 0.91]));

  const gableGeometry = new THREE.BufferGeometry();
  gableGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -1.09, 1.62, 0, 1.09, 1.62, 0, 0, 2.32, 0,
  ], 3));
  gableGeometry.computeVertexNormals();
  for (const z of [-0.905, 0.905]) {
    const gable = mesh(gableGeometry, new THREE.MeshStandardMaterial({ color: '#e7d7b2', roughness: 0.95, side: THREE.DoubleSide }), [0, 0, z]);
    house.add(gable);
  }

  const roofAngle = Math.atan2(0.78, 1.28);
  const slope = Math.hypot(0.78, 1.28);
  for (const side of [-1, 1]) {
    const slab = mesh(new THREE.BoxGeometry(slope + 0.08, 0.12, 2.16), roof, [side * 0.64, 1.96, 0]);
    slab.rotation.z = -side * roofAngle;
    house.add(slab);
    for (const z of [-0.88, -0.44, 0, 0.44, 0.88]) {
      const seam = mesh(new THREE.BoxGeometry(slope, 0.025, 0.026), roofEdge, [side * 0.64, 2.027, z]);
      seam.rotation.z = -side * roofAngle;
      house.add(seam);
    }
  }
  const ridge = mesh(new THREE.CylinderGeometry(0.085, 0.085, 2.22, 8), roofEdge, [0, 2.35, 0]);
  ridge.rotation.x = Math.PI / 2;
  house.add(ridge);

  house.add(mesh(new THREE.BoxGeometry(0.4, 0.93, 0.43), material('#9a7258'), [0.66, 2.24, -0.38]));
  house.add(mesh(new THREE.BoxGeometry(0.49, 0.12, 0.52), darkWood, [0.66, 2.73, -0.38]));
  for (const y of [2.02, 2.27, 2.5]) house.add(mesh(new THREE.BoxGeometry(0.415, 0.025, 0.445), material('#c19a79'), [0.66, y, -0.38]));

  const door = new THREE.Group();
  door.position.set(-0.46, 0.66, 0.935);
  door.add(mesh(new THREE.BoxGeometry(0.59, 1.15, 0.09), darkWood));
  door.add(mesh(new THREE.BoxGeometry(0.49, 1.05, 0.10), material('#796247'), [0, 0, 0.015]));
  for (const y of [-0.25, 0.25]) door.add(mesh(new THREE.BoxGeometry(0.34, 0.32, 0.025), timber, [0, y, 0.075]));
  const knob = mesh(new THREE.SphereGeometry(0.045, 10, 8), material('#c5a45f', 0.35), [0.17, -0.02, 0.11]);
  door.add(knob);
  house.add(door);
  house.add(mesh(new THREE.BoxGeometry(0.83, 0.13, 0.44), stone, [-0.46, 0.10, 1.08]));
  house.add(mesh(new THREE.BoxGeometry(0.66, 0.10, 0.30), stone, [-0.46, 0.22, 0.99]));

  const frontWindow = createWindow(windows, timber, 0.49, 0.57);
  frontWindow.position.set(0.52, 1.03, 0.94);
  house.add(frontWindow);
  const sideWindow = createWindow(windows, timber, 0.50, 0.58);
  sideWindow.position.set(1.115, 1.04, -0.05);
  sideWindow.rotation.y = Math.PI / 2;
  house.add(sideWindow);
  const atticWindow = createWindow(windows, timber, 0.28, 0.32);
  atticWindow.position.set(0, 1.88, 0.94);
  house.add(atticWindow);

  const planter = new THREE.Group();
  planter.position.set(0.52, 0.64, 1.08);
  planter.add(mesh(new THREE.BoxGeometry(0.72, 0.18, 0.24), material('#856344')));
  const blossomGeometry = new THREE.IcosahedronGeometry(0.075, 0);
  const blossomMaterials = [material('#d8a39a'), material('#eee0a5'), material('#b7c982')];
  for (let i = 0; i < 7; i += 1) {
    planter.add(mesh(blossomGeometry, blossomMaterials[i % 3], [-0.28 + i * 0.095, 0.13 + random() * 0.08, (random() - 0.5) * 0.12]));
  }
  house.add(planter);

  const lanternMat = new THREE.MeshStandardMaterial({ color: '#9b8254', emissive: '#ffb347', emissiveIntensity: 0, roughness: 0.5 });
  const lantern = mesh(new THREE.BoxGeometry(0.15, 0.23, 0.14), lanternMat, [-0.91, 1.12, 1.02]);
  house.add(lantern);
  const porchLight = new THREE.PointLight('#ffb35c', 0, 4.5, 2);
  porchLight.position.set(-0.75, 1.05, 1.4);
  house.add(porchLight);

  const smoke: SmokePuff[] = [];
  for (let i = 0; i < 4; i += 1) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.13 + i * 0.025, 10, 8),
      new THREE.MeshBasicMaterial({ color: '#e9e5d8', transparent: true, opacity: 0.2, depthWrite: false }),
    );
    puff.position.set(0.66, 2.9 + i * 0.27, -0.38);
    house.add(puff);
    smoke.push({ mesh: puff, offset: i / 4 });
  }
  house.userData.smoke = smoke;
  house.userData.lanternMaterial = lanternMat;
  shadows(house);
  return { house, windows, porchLight, smoke };
}

function createPond(): { group: THREE.Group; waterMaterial: THREE.MeshPhysicalMaterial } {
  const group = new THREE.Group();
  group.position.set(2.1, GRASS_Y + 0.012, 1.25);
  const shoreShape = new THREE.Shape();
  shoreShape.absellipse(0, 0, 1.76, 1.18, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, 1.48, 0.92, 0, Math.PI * 2, true, 0);
  shoreShape.holes.push(hole);
  const shore = mesh(new THREE.ShapeGeometry(shoreShape, 64), material('#c1b589'), [0, 0, 0]);
  shore.rotation.x = -Math.PI / 2;
  shore.castShadow = false;
  group.add(shore);

  const waterMaterial = new THREE.MeshPhysicalMaterial({
    color: '#629da3', roughness: 0.24, metalness: 0.08, transparent: true, opacity: 0.91,
    clearcoat: 0.7, clearcoatRoughness: 0.2, side: THREE.DoubleSide,
  });
  const water = mesh(new THREE.CircleGeometry(1, 64), waterMaterial, [0, 0.018, 0]);
  water.rotation.x = -Math.PI / 2;
  water.scale.set(1.49, 0.93, 1);
  water.castShadow = false;
  group.add(water);

  const rockGeometry = new THREE.DodecahedronGeometry(0.16, 0);
  const rockMaterials = [material('#8c8d78'), material('#a5a18a'), material('#777e70')];
  for (let i = 0; i < 17; i += 1) {
    const angle = (i / 17) * Math.PI * 2 + random() * 0.15;
    const rock = mesh(rockGeometry, rockMaterials[i % 3]);
    rock.position.set(Math.cos(angle) * 1.61, 0.07, Math.sin(angle) * 1.04);
    rock.scale.set(0.65 + random(), 0.45 + random() * 0.45, 0.65 + random());
    rock.rotation.set(random(), random(), random());
    group.add(rock);
  }
  const reedMaterial = material('#6f8351');
  for (const [x, z] of [[-1.25, -0.45], [1.1, 0.55], [0.8, -0.75]] as const) {
    for (let i = 0; i < 4; i += 1) {
      const reed = mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.45 + random() * 0.25, 5), reedMaterial, [x + i * 0.055, 0.28, z + random() * 0.1]);
      reed.rotation.z = (random() - 0.5) * 0.16;
      group.add(reed);
    }
  }
  return { group, waterMaterial };
}

function createBroadleafTree(x: number, z: number, scale: number, hue = 0): TreeRig {
  const pivot = new THREE.Group();
  pivot.position.set(x, GRASS_Y, z);
  pivot.scale.setScalar(scale);
  const trunkMaterial = material('#6c563d');
  const trunk = mesh(new THREE.CylinderGeometry(0.12, 0.21, 1.6, 7), trunkMaterial, [0, 0.8, 0]);
  pivot.add(trunk);
  const leafMaterials = [material('#647f48'), material('#7e9654'), material('#93a961')];
  if (hue === 1) leafMaterials.forEach((mat) => mat.color.offsetHSL(0.025, -0.03, 0.025));
  const canopyGeometry = new THREE.IcosahedronGeometry(0.72, 1);
  const clumps: [number, number, number, number][] = [
    [0, 1.85, 0, 1.05], [-0.45, 1.65, 0.1, 0.82], [0.43, 1.7, 0.08, 0.86],
    [0.05, 1.7, -0.43, 0.83], [0.02, 2.27, -0.04, 0.72],
  ];
  clumps.forEach(([cx, cy, cz, size], index) => {
    const crown = mesh(canopyGeometry, leafMaterials[index % 3], [cx, cy, cz]);
    crown.scale.set(size, size * 0.88, size);
    crown.rotation.set(random(), random(), random());
    pivot.add(crown);
  });
  shadows(pivot);
  return { pivot, phase: random() * Math.PI * 2, flex: 0.75 + random() * 0.4 };
}

function createPineTree(x: number, z: number, scale: number): TreeRig {
  const pivot = new THREE.Group();
  pivot.position.set(x, GRASS_Y, z);
  pivot.scale.setScalar(scale);
  pivot.add(mesh(new THREE.CylinderGeometry(0.09, 0.17, 1.55, 7), material('#68523c'), [0, 0.77, 0]));
  const greens = [material('#3f6751'), material('#4d7557'), material('#5e805b')];
  for (let i = 0; i < 3; i += 1) {
    const cone = mesh(new THREE.ConeGeometry(0.78 - i * 0.14, 1.15, 8), greens[i], [0, 1.15 + i * 0.52, 0]);
    cone.rotation.y = i * 0.35;
    pivot.add(cone);
  }
  shadows(pivot);
  return { pivot, phase: random() * Math.PI * 2, flex: 0.45 };
}

function createWindmill(): { group: THREE.Group; rotor: THREE.Group } {
  const group = new THREE.Group();
  group.position.set(1.0, GRASS_Y, -2.12);
  const cream = material('#d9cda9');
  const wood = material('#6d543c');
  const sail = new THREE.MeshStandardMaterial({ color: '#eee2bd', roughness: 0.9, side: THREE.DoubleSide });
  group.add(mesh(new THREE.CylinderGeometry(0.43, 0.66, 1.75, 10), cream, [0, 0.88, 0]));
  group.add(mesh(new THREE.ConeGeometry(0.62, 0.63, 10), material('#84604a'), [0, 2.02, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.29, 0.53, 0.05), wood, [0, 0.37, 0.59]));
  group.add(mesh(new THREE.BoxGeometry(0.20, 0.27, 0.05), material('#77908a'), [0, 1.18, 0.48]));
  for (const y of [0.52, 1.1, 1.55]) {
    const band = mesh(new THREE.TorusGeometry(0.56 - y * 0.07, 0.025, 5, 10), wood, [0, y, 0]);
    band.rotation.x = Math.PI / 2;
    group.add(band);
  }

  const rotor = new THREE.Group();
  rotor.position.set(0, 1.55, 0.56);
  for (let i = 0; i < 4; i += 1) {
    const blade = new THREE.Group();
    blade.rotation.z = i * Math.PI / 2 + Math.PI / 4;
    blade.add(mesh(new THREE.BoxGeometry(0.065, 1.65, 0.07), wood, [0, 0.76, 0]));
    blade.add(mesh(new THREE.BoxGeometry(0.34, 1.04, 0.035), sail, [0.15, 0.95, 0.01]));
    for (const y of [0.46, 0.73, 1.0, 1.27, 1.46]) {
      blade.add(mesh(new THREE.BoxGeometry(0.40, 0.035, 0.055), wood, [0.13, y, 0.035]));
    }
    rotor.add(blade);
  }
  const hub = mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.25, 10), wood, [0, 0, 0.08]);
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);
  group.add(rotor);
  shadows(group);
  return { group, rotor };
}

function createPathAndFence(): THREE.Group {
  const group = new THREE.Group();
  const stoneGeometry = new THREE.CylinderGeometry(0.28, 0.31, 0.055, 7);
  const stoneMaterials = [material('#b4ab8f'), material('#c3b99b'), material('#a89f86')];
  const points: [number, number, number][] = [
    [-1.46, 1.48, 0], [-1.40, 1.89, 0.2], [-1.15, 2.28, -0.12], [-0.77, 2.63, 0.1], [-0.30, 2.94, -0.2], [0.18, 3.18, 0.15],
  ];
  points.forEach(([x, z, rotation], index) => {
    const stone = mesh(stoneGeometry, stoneMaterials[index % 3], [x, GRASS_Y + 0.035, z]);
    stone.rotation.y = rotation;
    stone.scale.set(1.05, 1, 0.72);
    group.add(stone);
  });

  const fence = new THREE.Group();
  fence.position.set(-3.95, GRASS_Y, 0.10);
  fence.rotation.y = -0.15;
  const wood = material('#9a805a');
  for (let i = 0; i < 5; i += 1) {
    const post = mesh(new THREE.BoxGeometry(0.11, 0.72, 0.11), wood, [0, 0.34, -1.05 + i * 0.52]);
    post.rotation.z = (random() - 0.5) * 0.06;
    fence.add(post);
  }
  for (const y of [0.24, 0.52]) fence.add(mesh(new THREE.BoxGeometry(0.08, 0.09, 2.25), wood, [0, y, 0]));
  group.add(fence);
  return group;
}

function createDetails(): THREE.Group {
  const group = new THREE.Group();
  const rockGeometry = new THREE.DodecahedronGeometry(0.26, 0);
  const rockMaterials = [material('#8b8c78'), material('#9c9680')];
  const rockPositions: [number, number, number, number][] = [
    [-4.1, -1.7, 0.8, 0.8], [3.9, 2.0, 0.65, 1.1], [-2.8, 2.7, 0.5, 0.8], [4.3, -1.4, 0.45, 0.7], [0.0, -3.25, 0.55, 0.9],
  ];
  rockPositions.forEach(([x, z, scale, stretch], index) => {
    const rock = mesh(rockGeometry, rockMaterials[index % 2], [x, GRASS_Y + scale * 0.12, z]);
    rock.scale.set(scale * stretch, scale * 0.7, scale);
    rock.rotation.set(random(), random(), random());
    group.add(rock);
  });

  const stemGeometry = new THREE.CylinderGeometry(0.012, 0.016, 0.20, 5);
  const stemMaterial = material('#587144');
  const flowerGeometry = new THREE.IcosahedronGeometry(0.065, 0);
  const flowerMaterials = [material('#e7c783'), material('#d8988c'), material('#e7dfc2'), material('#a9b9d0')];
  const patches: [number, number][] = [[-2.55, 1.75], [-2.1, -1.2], [0.15, 2.25], [3.6, 0.3], [-0.3, -2.5]];
  patches.forEach(([px, pz], patch) => {
    for (let i = 0; i < 5; i += 1) {
      const x = px + (random() - 0.5) * 0.55;
      const z = pz + (random() - 0.5) * 0.5;
      const height = 0.16 + random() * 0.12;
      const stem = mesh(stemGeometry, stemMaterial, [x, GRASS_Y + height / 2, z]);
      stem.scale.y = height / 0.2;
      group.add(stem);
      group.add(mesh(flowerGeometry, flowerMaterials[(patch + i) % 4], [x, GRASS_Y + height + 0.035, z]));
    }
  });

  const tuftGeometry = new THREE.ConeGeometry(0.09, 0.29, 3);
  const tuftMaterial = material('#6f894c');
  for (let i = 0; i < 30; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 2.5 + random() * 1.8;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * 0.74;
    const tuft = mesh(tuftGeometry, tuftMaterial, [x, GRASS_Y + 0.12, z]);
    tuft.rotation.y = random() * Math.PI;
    tuft.scale.set(0.65 + random() * 0.7, 0.65 + random() * 0.6, 1);
    group.add(tuft);
  }
  shadows(group);
  return group;
}

function createCloud(x: number, y: number, z: number, scale: number, mat: THREE.MeshStandardMaterial): CloudRig {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  const geometry = new THREE.SphereGeometry(0.65, 14, 10);
  const blobs: [number, number, number, number][] = [
    [-0.8, 0, 0, 0.85], [-0.25, 0.18, 0, 1.05], [0.4, 0.12, 0, 0.93], [0.92, -0.03, 0, 0.68], [0.05, -0.15, 0, 1.05],
  ];
  blobs.forEach(([bx, by, bz, size]) => {
    const puff = new THREE.Mesh(geometry, mat);
    puff.position.set(bx, by, bz);
    puff.scale.set(size, size * 0.7, size * 0.8);
    group.add(puff);
  });
  return { group, speed: 0.75 + random() * 0.55 };
}

export function createWorld(scene: THREE.Scene): World {
  const root = new THREE.Group();
  root.add(createIsland());
  const { house, windows, porchLight, smoke } = createHouse();
  root.add(house);
  const pond = createPond();
  root.add(pond.group);
  const windmill = createWindmill();
  root.add(windmill.group);
  const trees = [
    createPineTree(-3.25, -1.45, 1.05),
    createPineTree(-2.48, -2.32, 0.77),
    createBroadleafTree(3.20, -1.45, 1.04),
    createBroadleafTree(3.93, -0.37, 0.66, 1),
    createBroadleafTree(-3.35, 1.68, 0.69, 1),
  ];
  trees.forEach((tree) => root.add(tree.pivot));
  root.add(createPathAndFence(), createDetails());
  scene.add(root);

  const cloudMaterial = new THREE.MeshStandardMaterial({ color: '#f2eee1', roughness: 1, transparent: true, opacity: 0.88, depthWrite: false });
  const clouds = [
    createCloud(-4.6, 4.7, -3.8, 0.95, cloudMaterial),
    createCloud(4.5, 5.4, -4.5, 0.72, cloudMaterial),
    createCloud(5.8, 3.7, 1.0, 0.55, cloudMaterial),
    createCloud(-5.7, 3.5, 1.8, 0.48, cloudMaterial),
  ];
  clouds.forEach((cloud) => scene.add(cloud.group));

  const houseTargets: THREE.Object3D[] = [];
  house.traverse((child) => { if (child instanceof THREE.Mesh && !smoke.some((puff) => puff.mesh === child)) houseTargets.push(child); });

  let rotorAngle = 0;
  const update = (dt: number, elapsed: number, wind: number, lightLevel: number, night: number, reducedMotion: boolean) => {
    rotorAngle += dt * wind * 3.8;
    windmill.rotor.rotation.z = -rotorAngle;
    const motionScale = reducedMotion ? 0.25 : 1;
    trees.forEach((tree) => {
      const sway = Math.sin(elapsed * (0.75 + wind * 0.85) + tree.phase) * 0.034 * wind * tree.flex * motionScale;
      tree.pivot.rotation.z = sway + wind * 0.015 * tree.flex;
      tree.pivot.rotation.x = Math.cos(elapsed * 0.63 + tree.phase) * 0.014 * wind * motionScale;
    });
    clouds.forEach((cloud) => {
      cloud.group.position.x += dt * wind * cloud.speed * 0.34 * motionScale;
      if (cloud.group.position.x > 8.5) cloud.group.position.x = -8.5;
    });
    windows.emissiveIntensity = lightLevel * (1.6 + night * 2.0);
    windows.color.copy(WINDOW_OFF).lerp(WINDOW_ON, lightLevel);
    porchLight.intensity = lightLevel * (0.35 + night * 1.15);
    const lantern = house.userData.lanternMaterial as THREE.MeshStandardMaterial;
    lantern.emissiveIntensity = lightLevel * 2.2;
    smoke.forEach((puff, index) => {
      const cycle = reducedMotion ? puff.offset : (elapsed * 0.11 + puff.offset) % 1;
      puff.mesh.position.y = 2.83 + cycle * 1.25;
      puff.mesh.position.x = 0.66 + cycle * (0.22 + wind * 0.8);
      puff.mesh.position.z = -0.38;
      puff.mesh.scale.setScalar(0.7 + cycle * 0.9);
      puff.mesh.material.opacity = (1 - cycle) * 0.18 * (0.75 + night * 0.25);
      puff.mesh.visible = index === 0 || cycle > 0.05;
    });
  };

  return {
    root, house, houseTargets, windows, porchLight, windmillRotor: windmill.rotor,
    trees, clouds, cloudMaterial, waterMaterial: pond.waterMaterial, update,
  };
}
