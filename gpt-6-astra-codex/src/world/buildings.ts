import * as THREE from 'three';
import { batchMeshes, box, material, mesh, palette } from './primitives';

export function createHouse(parent: THREE.Group) {
  const house = new THREE.Group();
  house.name = 'house';
  house.position.set(-0.45, 0.3, -0.65);
  house.rotation.y = -0.08;
  parent.add(house);
  const wall = material(palette.cream), trim = material('#f9f0d9');
  const wood = material(palette.wood), darkWood = material('#586a56');
  const tile = material(palette.roof), seam = material('#8e4936');
  const tileAccents = [material('#c26b49'), material('#bc6444')];
  const fascia = material('#d78d60'), brickSeam = material('#b29a7c'), shutterSlat = material('#849174');
  const glass = material('#334a48', { emissive: '#ffbc58', emissiveIntensity: 0, roughness: 0.35 });
  box(house, material('#acaa8c'), [2.25, 0.18, 1.86], [0, 0.09, 0]);
  box(house, wall, [2.1, 1.65, 1.65], [0, 0.95, 0]);
  const gable = new THREE.Shape();
  gable.moveTo(-1.05, 1.76); gable.lineTo(0, 2.66); gable.lineTo(1.05, 1.76); gable.closePath();
  mesh(new THREE.ExtrudeGeometry(gable, { depth: 1.65, bevelEnabled: false }), wall, house, 0, 0, -0.825);

  for (const side of [-1, 1]) {
    const roof = new THREE.Group();
    roof.position.set(side * 0.63, 2.24, 0);
    roof.rotation.z = side * -Math.atan2(0.93, 1.26);
    house.add(roof);
    box(roof, tile, [1.66, 0.15, 2.12]);
    box(roof, wood, [0.12, 0.17, 2.18], [side * 0.81, -0.035, 0]);
    for (let row = 0; row < 8; row++) {
      box(roof, seam, [1.65, 0.015, 0.018], [0, 0.079, -0.92 + row * 0.27]);
      for (let col = 0; col < 3; col++) {
        box(roof, tileAccents[row % 3 === 0 ? 0 : 1], [0.016, 0.018, 0.25],
          [-0.56 + col * 0.51 + (row % 2) * 0.16, 0.079, -0.79 + row * 0.27]);
      }
    }
    for (const z of [-1.07, 1.07]) box(roof, fascia, [1.72, 0.19, 0.085], [0, 0, z]);
  }
  for (let i = 0; i < 9; i++) {
    const ridge = mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.235, 8), tile, house, 0, 2.74, -0.95 + i * 0.235);
    ridge.rotation.x = Math.PI / 2;
  }
  const chimneyMat = material('#c7b595');
  box(house, chimneyMat, [0.38, 1.15, 0.4], [0.6, 2.65, -0.43]);
  box(house, material('#8b7963'), [0.49, 0.13, 0.5], [0.6, 3.23, -0.43]);
  box(house, material('#3d4039'), [0.26, 0.015, 0.28], [0.6, 3.302, -0.43]);
  for (let i = 0; i < 5; i++) box(house, brickSeam, [0.385, 0.025, 0.405], [0.6, 2.32 + i * 0.18, -0.43]);

  box(house, trim, [0.69, 1.28, 0.1], [-0.38, 0.77, 0.86]);
  box(house, darkWood, [0.52, 1.16, 0.13], [-0.38, 0.7, 0.92]);
  for (let i = 0; i < 4; i++) box(house, wood, [0.012, 0.99, 0.015], [-0.57 + i * 0.125, 0.65, 0.99]);
  box(house, glass, [0.31, 0.27, 0.016], [-0.38, 1.05, 0.996]);
  mesh(new THREE.SphereGeometry(0.034, 8, 6), material('#dbc383', { metalness: 0.6 }), house, -0.2, 0.65, 1.018);
  box(house, material('#baa88c'), [0.88, 0.12, 0.46], [-0.38, 0.06, 1.06]);
  box(house, material('#c7b79a'), [1.02, 0.07, 0.32], [-0.38, -0.01, 1.38]);

  function windowAt(x: number, y: number, z: number, rotation: number) {
    const frame = new THREE.Group(); house.add(frame); frame.position.set(x, y, z); frame.rotation.y = rotation;
    box(frame, wood, [0.64, 0.74, 0.055]);
    box(frame, glass, [0.51, 0.59, 0.067]);
    box(frame, trim, [0.038, 0.67, 0.086]);
    box(frame, trim, [0.59, 0.04, 0.086]);
    box(frame, trim, [0.75, 0.08, 0.2], [0, -0.4, 0]);
    for (const side of [-1, 1]) {
      box(frame, darkWood, [0.17, 0.71, 0.085], [side * 0.44, 0, 0]);
      for (let i = 0; i < 4; i++) box(frame, shutterSlat, [0.16, 0.025, 0.014], [side * 0.44, -0.24 + i * 0.16, 0.05]);
    }
  }
  windowAt(0.62, 1.05, 0.86, 0);
  windowAt(1.075, 1.04, -0.15, Math.PI / 2);
  windowAt(-1.075, 1.04, -0.15, -Math.PI / 2);
  windowAt(0.1, 1.04, -0.855, Math.PI);
  mesh(new THREE.CircleGeometry(0.205, 24), glass, house, 0, 2.08, 0.84);
  mesh(new THREE.TorusGeometry(0.222, 0.045, 6, 24), trim, house, 0, 2.08, 0.86);
  box(house, trim, [0.032, 0.4, 0.08], [0, 2.08, 0.865]);
  box(house, trim, [0.4, 0.032, 0.08], [0, 2.08, 0.865]);
  box(house, wood, [0.8, 0.2, 0.24], [0.62, 0.48, 1.0]);
  for (let i = 0; i < 7; i++) {
    mesh(new THREE.IcosahedronGeometry(0.07, 0), material(i % 2 ? '#d69571' : '#e5d899'), house, 0.3 + i * 0.105, 0.64, 1.02);
  }
  const porchLight = new THREE.PointLight('#ffb75e', 0, 5, 2);
  porchLight.position.set(0.2, 1.35, 1.65); house.add(porchLight);
  const sideLight = new THREE.PointLight('#ffc16f', 0, 3, 2);
  sideLight.position.set(1.3, 1.3, -0.1); house.add(sideLight);
  batchMeshes(house);
  return { house, glass, porchLight, sideLight };
}

export function createWindmill(parent: THREE.Group) {
  const mill = new THREE.Group();
  mill.position.set(-3.0, 0.3, -1.42); mill.rotation.y = 0.18; parent.add(mill);
  const wood = material(palette.wood), cream = material('#e4d9b7');
  mesh(new THREE.CylinderGeometry(0.4, 0.63, 2.23, 10), cream, mill, 0, 1.12, 0);
  mesh(new THREE.CylinderGeometry(0.65, 0.7, 0.22, 10), material('#a1977c'), mill, 0, 0.1, 0);
  mesh(new THREE.ConeGeometry(0.6, 0.73, 10), material('#806a51'), mill, 0, 2.53, 0);
  box(mill, wood, [0.29, 0.55, 0.09], [0, 0.39, 0.6]);
  box(mill, material('#4b625b'), [0.19, 0.27, 0.04], [0, 1.62, 0.475]);
  const rotor = new THREE.Group(); rotor.position.set(0, 2.22, 0.64); mill.add(rotor);
  const canvasMat = material('#efe8ce', { side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Group(); blade.rotation.z = i * Math.PI / 2 + Math.PI / 4; rotor.add(blade);
    box(blade, wood, [0.07, 1.64, 0.06], [0, 0.77, 0]);
    box(blade, canvasMat, [0.36, 0.92, 0.024], [0.18, 1.1, -0.005]);
    box(blade, wood, [0.033, 0.97, 0.055], [0.36, 1.1, 0.015]);
    for (let j = 0; j < 5; j++) box(blade, wood, [0.41, 0.028, 0.055], [0.175, 0.64 + j * 0.23, 0.015]);
  }
  const hub = mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.23, 10), wood, rotor, 0, 0, 0.08);
  hub.rotation.x = Math.PI / 2;
  batchMeshes(rotor);
  return rotor;
}
