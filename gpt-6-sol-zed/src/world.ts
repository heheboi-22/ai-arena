import * as THREE from 'three';

export interface PocketWorld {
  root: THREE.Group;
  house: THREE.Group;
  windows: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[];
  porchLight: THREE.PointLight;
  porchBulb: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  rotor: THREE.Group;
  trees: { sway: THREE.Group; phase: number }[];
  clouds: THREE.Group[];
  pond: {
    x: number;
    y: number;
    z: number;
    radiusX: number;
    radiusZ: number;
    surface: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  };
}

const TAU = Math.PI * 2;

function edge(angle: number): number {
  return 1 + 0.035 * Math.sin(5 * angle + 0.6)
    + 0.023 * Math.sin(9 * angle - 0.8)
    + 0.012 * Math.sin(17 * angle + 1);
}

function addBox(
  parent: THREE.Object3D,
  material: THREE.MeshStandardMaterial,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addOval(
  parent: THREE.Object3D,
  material: THREE.MeshStandardMaterial,
  geometry: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeGrass(): THREE.BufferGeometry {
  const segments = 72;
  const rings = [0.24, 0.50, 0.74, 0.90, 1];
  const positions: number[] = [0, 0.077, 0];
  const colors: number[] = [];
  const indices: number[] = [];
  const shades = ['#86a96c', '#83a568', '#82a565', '#80a261', '#99b679'];
  const centerColor = new THREE.Color('#86a96c');
  colors.push(centerColor.r, centerColor.g, centerColor.b);

  for (let ring = 0; ring < rings.length; ring++) {
    const t = rings[ring];
    for (let i = 0; i < segments; i++) {
      const a = i * TAU / segments;
      const radius = 3.15 * t * edge(a);
      const y = 0.077 - 0.020 * t * t * t + 0.008 * t * t * Math.sin(4 * a);
      positions.push(radius * Math.cos(a), y, radius * Math.sin(a));
      const tint = new THREE.Color(shades[ring]).multiplyScalar(
        0.97 + 0.035 * Math.sin(i * 2.3 + ring * 4.7),
      );
      colors.push(tint.r, tint.g, tint.b);
      const next = (i + 1) % segments;
      if (ring === 0) {
        indices.push(0, 1 + next, 1 + i);
      } else {
        const inner = 1 + (ring - 1) * segments;
        const outer = 1 + ring * segments;
        indices.push(inner + i, outer + next, outer + i);
        indices.push(inner + i, inner + next, outer + next);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeCliff(
  rings: { radius: number; y: number }[],
  palette: string[],
  grassRim: boolean,
): THREE.BufferGeometry {
  const segments = 72;
  const positions: number[] = [];
  const colors: number[] = [];
  const paletteColors = palette.map((color) => new THREE.Color(color));
  const point = (ring: number, i: number): [number, number, number] => {
    const a = i * TAU / segments;
    const level = rings[ring];
    const wobble = grassRim && ring === 0 ? 1 : 1 + 0.014 * Math.sin(13 * a + ring * 1.7);
    const radius = level.radius * edge(a) * wobble;
    const y = level.y + (level.radius === 0 ? 0 : grassRim && ring === 0
      ? 0.008 * Math.sin(4 * a)
      : 0.025 * Math.sin(7 * a + ring * 1.3) * (ring > 1 ? 1 : 0));
    return [radius * Math.cos(a), y, radius * Math.sin(a)];
  };
  const triangle = (a: number[], b: number[], c: number[], color: THREE.Color): void => {
    positions.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k++) colors.push(color.r, color.g, color.b);
  };

  for (let ring = 0; ring < rings.length - 1; ring++) {
    for (let i = 0; i < segments; i++) {
      const upper = point(ring, i);
      const upperNext = point(ring, i + 1);
      const lower = point(ring + 1, i);
      const lowerNext = point(ring + 1, i + 1);
      const shade = paletteColors[Math.min(ring, paletteColors.length - 1)].clone()
        .multiplyScalar(0.91 + 0.13 * (0.5 + 0.5 * Math.sin(i * 8.3 + ring * 13.7)));
      triangle(upper, upperNext, lower, shade);
      triangle(upperNext, lowerNext, lower, shade);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function shoreline(angle: number): number {
  return 1 + 0.028 * Math.sin(5 * angle + 0.3)
    + 0.018 * Math.sin(9 * angle - 1.1)
    + 0.015 * Math.cos(13 * angle + 0.8);
}

function pondDisk(x: number, z: number, rx: number, rz: number, y: number): THREE.BufferGeometry {
  const segments = 64;
  const positions: number[] = [x, y, z];
  const indices: number[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = i * TAU / segments;
    const r = shoreline(angle);
    positions.push(x + rx * r * Math.cos(angle), y, z + rz * r * Math.sin(angle));
    indices.push(0, 1 + (i + 1) % segments, 1 + i);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function pondRing(
  x: number, z: number, rx: number, rz: number,
  inner: number, outer: number, innerY: number, outerY: number,
): THREE.BufferGeometry {
  const segments = 64;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = i * TAU / segments;
    const r = shoreline(angle);
    positions.push(x + rx * inner * r * Math.cos(angle), innerY, z + rz * inner * r * Math.sin(angle));
    positions.push(x + rx * outer * r * Math.cos(angle), outerY, z + rz * outer * r * Math.sin(angle));
  }
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    indices.push(2 * i, 2 * next + 1, 2 * i + 1);
    indices.push(2 * i, 2 * next, 2 * next + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function createWorld(): PocketWorld {
  const root = new THREE.Group();
  root.name = 'Pocket world';
  const grassMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, side: THREE.DoubleSide });
  const rockMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  const meadow = new THREE.Mesh(makeGrass(), grassMaterial);
  meadow.receiveShadow = true;
  root.add(meadow);
  const turf = new THREE.Mesh(
    makeCliff(
      [{ radius: 3.15, y: 0.057 }, { radius: 3.11, y: -0.09 }, { radius: 2.99, y: -0.20 }],
      ['#698e52', '#596e44'], true,
    ),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
  );
  turf.castShadow = true;
  turf.receiveShadow = true;
  root.add(turf);
  const cliff = new THREE.Mesh(
    makeCliff(
      [
        { radius: 2.97, y: -0.18 }, { radius: 3.04, y: -0.35 },
        { radius: 2.85, y: -0.59 }, { radius: 2.53, y: -0.94 },
        { radius: 2.03, y: -1.34 }, { radius: 1.44, y: -1.67 },
        { radius: 0.87, y: -1.90 }, { radius: 0.28, y: -2.04 },
        { radius: 0, y: -2.10 },
      ],
      ['#8a725b', '#97816b', '#91816f', '#857e72', '#807a70', '#777268', '#716b61'], false,
    ),
    rockMaterial,
  );
  cliff.castShadow = true;
  cliff.receiveShadow = true;
  root.add(cliff);

  const stone = new THREE.MeshStandardMaterial({ color: '#b6a68c', roughness: 1 });
  const darkWood = new THREE.MeshStandardMaterial({ color: '#60483b', roughness: 0.92 });
  const wood = new THREE.MeshStandardMaterial({ color: '#816046', roughness: 0.93 });
  const paleWood = new THREE.MeshStandardMaterial({ color: '#ad8159', roughness: 0.93 });
  const plaster = new THREE.MeshStandardMaterial({ color: '#f0dfbb', roughness: 0.95, side: THREE.DoubleSide });
  const roofClay = new THREE.MeshStandardMaterial({ color: '#ad6750', roughness: 0.92 });
  const roofTile = [
    new THREE.MeshStandardMaterial({ color: '#c47b5b', roughness: 0.96 }),
    new THREE.MeshStandardMaterial({ color: '#b06e56', roughness: 0.96 }),
    new THREE.MeshStandardMaterial({ color: '#955b4a', roughness: 0.96 }),
  ];

  const house = new THREE.Group();
  house.name = 'Cottage';
  house.position.set(-0.85, 0, -0.35);
  root.add(house);
  addBox(house, stone, 1.66, 0.19, 1.40, 0, 0.14, 0);
  addBox(house, plaster, 1.46, 1.28, 1.16, 0, 0.85, 0);
  addBox(house, darkWood, 1.52, 0.10, 1.23, 0, 0.29, 0);
  for (const x of [-0.72, 0.72]) {
    for (const z of [-0.58, 0.58]) addBox(house, wood, 0.075, 1.30, 0.075, x, 0.88, z);
  }
  for (const z of [-0.59, 0.59]) addBox(house, paleWood, 1.49, 0.07, 0.08, 0, 1.46, z);
  for (const x of [-0.73, 0.73]) addBox(house, paleWood, 0.08, 0.07, 1.17, x, 1.46, 0);

  const gable = new THREE.Shape();
  gable.moveTo(-0.72, 1.49);
  gable.lineTo(0.72, 1.49);
  gable.lineTo(0, 2.055);
  gable.closePath();
  const gableGeometry = new THREE.ShapeGeometry(gable);
  for (const z of [-0.597, 0.597]) {
    const face = new THREE.Mesh(gableGeometry, plaster);
    face.position.z = z;
    face.castShadow = true;
    face.receiveShadow = true;
    house.add(face);
  }

  const pitch = Math.atan2(0.68, 0.91);
  const slopeLength = Math.hypot(0.91, 0.68);
  for (const side of [-1, 1]) {
    const roof = new THREE.Group();
    roof.position.set(side * 0.455, 1.82, 0);
    roof.rotation.z = -side * pitch;
    house.add(roof);
    addBox(roof, roofClay, slopeLength + 0.06, 0.085, 1.62, 0, 0, 0);
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 4; column++) {
        const tile = addBox(
          roof, roofTile[(row + column * 2 + (side + 1) / 2) % roofTile.length],
          0.275, 0.018, 0.37,
          -0.425 + row * 0.283, 0.055, -0.59 + column * 0.39,
        );
        tile.castShadow = false;
      }
    }
    const fascia = addBox(house, darkWood, slopeLength + 0.11, 0.095, 0.10, side * 0.455, 1.82, 0.81);
    fascia.rotation.z = -side * pitch;
    addBox(house, darkWood, 0.10, 0.13, 1.69, side * 0.92, 1.475, 0);
  }
  addBox(house, darkWood, 0.12, 0.12, 1.72, 0, 2.16, 0);

  addBox(house, roofClay, 0.31, 0.45, 0.31, -0.34, 2.16, -0.34);
  addBox(house, darkWood, 0.38, 0.075, 0.38, -0.34, 2.42, -0.34);
  addBox(house, new THREE.MeshStandardMaterial({ color: '#342f2b', roughness: 1 }), 0.21, 0.008, 0.21, -0.34, 2.462, -0.34);

  const windows: PocketWorld['windows'] = [];
  const addWindow = (x: number, y: number, z: number, rotation: number): void => {
    const frame = new THREE.Group();
    frame.position.set(x, y, z);
    frame.rotation.y = rotation;
    house.add(frame);
    addBox(frame, darkWood, 0.46, 0.51, 0.065, 0, 0, 0.025);
    const glass = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>(
      new THREE.BoxGeometry(0.335, 0.385, 0.022),
      new THREE.MeshStandardMaterial({
        color: '#617d87', emissive: '#bd8050', emissiveIntensity: 0.22,
        roughness: 0.28, metalness: 0.04,
      }),
    );
    glass.position.z = 0.074;
    glass.castShadow = false;
    glass.receiveShadow = true;
    frame.add(glass);
    windows.push(glass);
    addBox(frame, paleWood, 0.025, 0.42, 0.03, 0, 0, 0.092);
    addBox(frame, paleWood, 0.37, 0.025, 0.03, 0, 0, 0.092);
    addBox(frame, stone, 0.52, 0.055, 0.13, 0, -0.285, 0.06);
  };
  addWindow(-0.46, 0.99, 0.602, 0);
  addWindow(0.742, 0.99, -0.29, Math.PI / 2);
  addWindow(0.742, 0.99, 0.30, Math.PI / 2);
  addWindow(-0.38, 0.99, -0.602, Math.PI);

  addBox(house, darkWood, 0.48, 0.90, 0.07, 0.24, 0.69, 0.625);
  addBox(house, wood, 0.37, 0.79, 0.045, 0.24, 0.66, 0.68);
  addBox(house, paleWood, 0.26, 0.055, 0.025, 0.24, 0.94, 0.709);
  addOval(house, stone, new THREE.SphereGeometry(1, 8, 6), 0.39, 0.68, 0.72, 0.024, 0.024, 0.023);
  addBox(house, stone, 0.89, 0.125, 0.58, 0.22, 0.155, 0.83);
  addBox(house, stone, 0.70, 0.075, 0.28, 0.22, 0.095, 1.21);

  addBox(house, darkWood, 0.055, 0.055, 0.23, 0.58, 1.39, 0.69);
  const lanternMetal = new THREE.MeshStandardMaterial({ color: '#615047', metalness: 0.3, roughness: 0.7 });
  const lanternGlow = new THREE.MeshStandardMaterial({
    color: '#ffe2a6', emissive: '#ffbb6c', emissiveIntensity: 1.7, roughness: 0.4,
  });
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.13, 8), lanternMetal);
  shade.position.set(0.58, 1.34, 0.82);
  shade.castShadow = true;
  house.add(shade);
  const porchBulb = addOval(house, lanternGlow, new THREE.SphereGeometry(1, 10, 8), 0.58, 1.245, 0.82, 0.068, 0.085, 0.068);
  const porchLight = new THREE.PointLight('#ffc98b', 1.55, 2.7, 2);
  porchLight.position.set(0.58, 1.23, 0.84);
  house.add(porchLight);

  const pondX = 1.10;
  const pondZ = 0.77;
  const radiusX = 0.78;
  const radiusZ = 0.56;
  const pondY = 0.137;
  const bankDark = new THREE.MeshStandardMaterial({ color: '#68805f', roughness: 1, side: THREE.DoubleSide });
  const bankSand = new THREE.MeshStandardMaterial({ color: '#c2af83', roughness: 1, side: THREE.DoubleSide });
  const bankLight = new THREE.MeshStandardMaterial({ color: '#92a576', roughness: 1, side: THREE.DoubleSide });
  const underBank = new THREE.Mesh(pondDisk(pondX, pondZ, radiusX * 1.43, radiusZ * 1.48, 0.094), bankDark);
  underBank.receiveShadow = true;
  root.add(underBank);
  const shore = new THREE.Mesh(
    pondRing(pondX, pondZ, radiusX, radiusZ, 0.97, 1.31, 0.143, 0.105), bankSand,
  );
  shore.receiveShadow = true;
  root.add(shore);
  const grassLip = new THREE.Mesh(
    pondRing(pondX, pondZ, radiusX, radiusZ, 1.31, 1.43, 0.105, 0.097), bankLight,
  );
  grassLip.receiveShadow = true;
  root.add(grassLip);
  const surface = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>(
    pondDisk(0, 0, radiusX, radiusZ, 0),
    new THREE.MeshStandardMaterial({ color: '#54aebc', emissive: '#175867', emissiveIntensity: 0.16, metalness: 0.08, roughness: 0.24 }),
  );
  surface.position.set(pondX, pondY, pondZ);
  surface.receiveShadow = true;
  root.add(surface);
  const rippleMat = new THREE.MeshStandardMaterial({ color: '#abdee0', transparent: true, opacity: 0.60, roughness: 0.25 });
  for (const [x, z, sx] of [[0.82, 0.62, 0.18], [1.40, 0.88, 0.12]] as const) {
    const ripple = new THREE.Mesh(new THREE.TorusGeometry(sx, 0.009, 4, 28), rippleMat);
    ripple.rotation.x = -Math.PI / 2;
    ripple.scale.y = 0.7;
    ripple.position.set(x, pondY + 0.008, z);
    root.add(ripple);
  }
  const lily = new THREE.MeshStandardMaterial({ color: '#568d71', roughness: 0.78, side: THREE.DoubleSide });
  for (const [x, z, scale] of [[1.34, 0.55, 0.13], [0.96, 0.98, 0.095]] as const) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(scale, 10, 0.27, TAU - 0.45), lily);
    pad.rotation.x = -Math.PI / 2;
    pad.rotation.z = x;
    pad.position.set(x, pondY + 0.009, z);
    root.add(pad);
  }
  const reed = new THREE.MeshStandardMaterial({ color: '#617f56', roughness: 1 });
  const reedTip = new THREE.MeshStandardMaterial({ color: '#ad8e54', roughness: 1 });
  for (const [x, z] of [[0.21, 0.43], [1.80, 0.35], [1.77, 1.16]] as const) {
    for (let i = 0; i < 3; i++) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.013, 0.21 + i * 0.045, 5), reed);
      stem.position.set(x + i * 0.055, 0.17 + i * 0.022, z + (i % 2) * 0.06);
      stem.rotation.z = (i - 1) * 0.16;
      root.add(stem);
      addOval(root, reedTip, new THREE.SphereGeometry(1, 6, 5), stem.position.x, stem.position.y + 0.11 + i * 0.022, stem.position.z, 0.019, 0.045, 0.019);
    }
  }

  const pathStone = new THREE.MeshStandardMaterial({ color: '#c6b49a', roughness: 1 });
  const pebbleGeometry = new THREE.IcosahedronGeometry(1, 0);
  const steps: [number, number, number, number][] = [
    [-0.62, 0.94, 0.25, 0.19], [-0.70, 1.22, 0.29, 0.21],
    [-0.59, 1.52, 0.33, 0.20], [-0.42, 1.83, 0.31, 0.22],
    [-0.29, 2.13, 0.34, 0.21], [-0.14, 2.46, 0.27, 0.19],
  ];
  for (let i = 0; i < steps.length; i++) {
    const [x, z, rx, rz] = steps[i];
    const step = addOval(root, pathStone, pebbleGeometry, x, 0.084, z, rx, 0.045, rz);
    step.rotation.y = i * 0.43;
  }

  const mill = new THREE.Group();
  mill.name = 'Windmill';
  mill.position.set(1.65, 0.01, -1.25);
  root.add(mill);
  const millWall = new THREE.MeshStandardMaterial({ color: '#e1cba4', roughness: 0.94, flatShading: true });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.38, 1.23, 8), millWall);
  tower.position.y = 0.685;
  tower.castShadow = true;
  tower.receiveShadow = true;
  mill.add(tower);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.43, 0.47, 8), roofClay);
  cap.position.y = 1.51;
  cap.rotation.y = Math.PI / 8;
  cap.castShadow = true;
  cap.receiveShadow = true;
  mill.add(cap);
  addBox(mill, darkWood, 0.31, 0.60, 0.06, 0, 0.39, 0.383);
  addBox(mill, wood, 0.235, 0.51, 0.065, 0, 0.37, 0.423);
  addOval(mill, stone, new THREE.SphereGeometry(1, 7, 5), 0.083, 0.39, 0.472, 0.019, 0.019, 0.019);
  for (const side of [-1, 1]) {
    addBox(mill, darkWood, 0.052, 0.84, 0.055, side * 0.26, 0.84, 0.18);
  }
  const rotor = new THREE.Group();
  rotor.name = 'Windmill sails';
  rotor.position.set(0, 1.17, 0.52);
  mill.add(rotor);
  const sailShape = new THREE.Shape();
  sailShape.moveTo(-0.038, 0.30);
  sailShape.lineTo(-0.265, 0.39);
  sailShape.lineTo(-0.225, 0.80);
  sailShape.lineTo(-0.035, 0.83);
  sailShape.closePath();
  const sailGeometry = new THREE.ShapeGeometry(sailShape);
  const canvas = new THREE.MeshStandardMaterial({ color: '#f5e8c6', roughness: 1, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Group();
    blade.rotation.z = i * Math.PI / 2;
    rotor.add(blade);
    addBox(blade, darkWood, 0.045, 0.85, 0.055, 0, 0.435, 0);
    const sail = new THREE.Mesh(sailGeometry, canvas);
    sail.position.z = 0.039;
    sail.castShadow = true;
    sail.receiveShadow = true;
    blade.add(sail);
    addBox(blade, paleWood, 0.255, 0.024, 0.024, -0.14, 0.44, 0.06);
    addBox(blade, paleWood, 0.195, 0.024, 0.024, -0.13, 0.72, 0.06);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.17, 12), darkWood);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.08;
  hub.castShadow = true;
  rotor.add(hub);
  addOval(rotor, stone, new THREE.SphereGeometry(1, 10, 7), 0, 0, 0.18, 0.058, 0.058, 0.036);

  const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#765744', roughness: 1 });
  const foliage = ['#648b66', '#729c6a', '#547c61', '#86a574', '#75917a']
    .map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.96, flatShading: true }));
  const crownGeometry = new THREE.IcosahedronGeometry(1, 1);
  const trees: PocketWorld['trees'] = [];
  const treeLocations: [number, number, number, number][] = [
    [-2.27, -1.08, 0.90, 0], [-2.48, 0.49, 0.72, 1],
    [0.38, -1.92, 0.80, 2], [2.52, -0.25, 0.76, 3],
    [-1.97, 1.34, 0.66, 4], [2.42, 1.44, 0.57, 1],
  ];
  const foliagePatches: [number, number][] = [[0, 0.31], [-0.31, 0.04], [0.28, 0.10], [-0.13, -0.31], [0.22, -0.26]];
  for (let i = 0; i < treeLocations.length; i++) {
    const [x, z, size, colorIndex] = treeLocations[i];
    const sway = new THREE.Group();
    sway.position.set(x, 0.079, z);
    root.add(sway);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.075 * size, 0.12 * size, 0.88 * size, 6), trunkMaterial);
    trunk.position.y = 0.44 * size;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    sway.add(trunk);
    for (let n = 0; n < foliagePatches.length; n++) {
      const [dx, dz] = foliagePatches[n];
      const crown = addOval(
        sway, foliage[(colorIndex + n) % foliage.length], crownGeometry,
        dx * size, (1.18 + (n === 0 ? 0.10 : -0.05)) * size, dz * size,
        (n === 0 ? 0.55 : 0.41) * size,
        (n === 0 ? 0.48 : 0.36) * size,
        (n === 0 ? 0.54 : 0.42) * size,
      );
      crown.rotation.y = i + n * 0.47;
    }
    trees.push({ sway, phase: i * 1.37 + 0.4 });
  }

  // Fence arcs sit inside the lip, leaving the path and the pond's near edge open.
  const fences: [number, number][] = [[143, 179], [191, 237], [303, 345], [26, 44]];
  for (const [start, end] of fences) {
    const count = Math.ceil((end - start) / 11);
    let previous: THREE.Vector3 | null = null;
    for (let i = 0; i <= count; i++) {
      const a = (start + (end - start) * i / count) * Math.PI / 180;
      const r = 2.80 * edge(a);
      const p = new THREE.Vector3(r * Math.cos(a), 0, r * Math.sin(a));
      addBox(root, wood, 0.07, 0.40, 0.075, p.x, 0.26, p.z);
      addBox(root, paleWood, 0.105, 0.045, 0.105, p.x, 0.475, p.z);
      if (previous) {
        const distance = previous.distanceTo(p);
        const middle = previous.clone().add(p).multiplyScalar(0.5);
        for (const y of [0.25, 0.39]) {
          const rail = addBox(root, paleWood, distance + 0.05, 0.043, 0.045, middle.x, y, middle.z);
          rail.rotation.y = -Math.atan2(p.z - previous.z, p.x - previous.x);
        }
      }
      previous = p;
    }
  }

  const rand = random(4117);
  const flowerSites: { x: number; z: number; height: number; color: THREE.Color }[] = [];
  const flowerColors = ['#f6d87b', '#fff1d6', '#df938b', '#c5afd2', '#f4bf8c'];
  for (let attempt = 0; attempt < 550 && flowerSites.length < 64; attempt++) {
    const x = (rand() * 2 - 1) * 2.75;
    const z = (rand() * 2 - 1) * 2.75;
    if (Math.hypot(x, z) > 2.72 || Math.hypot(x, z) < 0.08) continue;
    if (x > -1.78 && x < 0.05 && z > -1.12 && z < 0.55) continue;
    if (((x - pondX) / 1.27) ** 2 + ((z - pondZ) / 0.94) ** 2 < 1) continue;
    if (Math.hypot(x - 1.65, z + 1.25) < 0.65) continue;
    if (z > 0.5 && z < 2.7 && Math.abs(x - (-0.76 + 0.29 * (z - 0.6))) < 0.40) continue;
    if (treeLocations.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 0.51)) continue;
    flowerSites.push({ x, z, height: 0.13 + rand() * 0.10, color: new THREE.Color(flowerColors[Math.floor(rand() * flowerColors.length)]) });
  }
  const stems = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.010, 0.014, 1, 5),
    new THREE.MeshStandardMaterial({ color: '#658c59', roughness: 1 }),
    flowerSites.length,
  );
  const blossoms = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true }),
    flowerSites.length,
  );
  const instance = new THREE.Object3D();
  flowerSites.forEach((site, i) => {
    instance.position.set(site.x, 0.082 + site.height / 2, site.z);
    instance.scale.set(1, site.height, 1);
    instance.updateMatrix();
    stems.setMatrixAt(i, instance.matrix);
    instance.position.y = 0.082 + site.height;
    instance.scale.set(0.055, 0.045, 0.055);
    instance.updateMatrix();
    blossoms.setMatrixAt(i, instance.matrix);
    blossoms.setColorAt(i, site.color);
  });
  stems.instanceMatrix.needsUpdate = true;
  blossoms.instanceMatrix.needsUpdate = true;
  if (blossoms.instanceColor) blossoms.instanceColor.needsUpdate = true;
  root.add(stems, blossoms);

  const pebbles = new THREE.InstancedMesh(
    pebbleGeometry,
    new THREE.MeshStandardMaterial({ color: '#d4c4a5', roughness: 1, flatShading: true }),
    26,
  );
  for (let i = 0; i < 26; i++) {
    let x: number;
    let z: number;
    if (i < 15) {
      const a = (i + rand() * 0.5) * TAU / 15;
      const r = 1.32 + rand() * 0.16;
      x = pondX + Math.cos(a) * radiusX * r;
      z = pondZ + Math.sin(a) * radiusZ * r;
    } else {
      z = 1.0 + rand() * 1.56;
      x = -0.77 + 0.29 * (z - 0.6) + (rand() > 0.5 ? 1 : -1) * (0.36 + rand() * 0.12);
    }
    const size = 0.055 + rand() * 0.058;
    instance.position.set(x, 0.103, z);
    instance.rotation.set(rand() * 0.3, rand() * TAU, rand() * 0.22);
    instance.scale.set(size * 1.3, size * 0.49, size);
    instance.updateMatrix();
    pebbles.setMatrixAt(i, instance.matrix);
    pebbles.setColorAt(i, new THREE.Color(i % 3 === 0 ? '#b5a58f' : '#eee0bd'));
  }
  pebbles.instanceMatrix.needsUpdate = true;
  if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true;
  pebbles.castShadow = true;
  pebbles.receiveShadow = true;
  root.add(pebbles);

  const clouds: THREE.Group[] = [];
  const cloudGeometry = new THREE.SphereGeometry(1, 12, 8);
  const cloudMaterials = [
    new THREE.MeshStandardMaterial({ color: '#fff4df', roughness: 1, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: '#ecebdf', roughness: 1, flatShading: true }),
  ];
  for (const [x, y, z, scale] of [
    [-3.90, 3.65, -3.25, 0.78], [0.0, 4.30, -4.1, 0.61], [3.65, 3.65, -3.65, 0.70],
  ] as const) {
    const cloud = new THREE.Group();
    cloud.position.set(x, y, z);
    for (const [dx, dy, dz, sx, sy, sz, color] of [
      [0, 0, 0, 0.56, 0.32, 0.35, 0],
      [-0.37, -0.09, 0.02, 0.42, 0.24, 0.29, 1],
      [0.40, -0.07, 0, 0.42, 0.26, 0.31, 0],
      [-0.11, 0.16, -0.03, 0.32, 0.32, 0.30, 0],
    ] as const) {
      const puff = addOval(cloud, cloudMaterials[color], cloudGeometry, dx * scale, dy * scale, dz * scale, sx * scale, sy * scale, sz * scale);
      puff.castShadow = false;
      puff.receiveShadow = false;
    }
    root.add(cloud);
    clouds.push(cloud);
  }

  return {
    root, house, windows, porchLight, porchBulb, rotor, trees, clouds,
    pond: { x: pondX, y: pondY, z: pondZ, radiusX, radiusZ, surface },
  };
}
