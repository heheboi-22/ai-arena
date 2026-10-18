import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ground, palette, material, mesh, box, post, pebble, beam, random, onIsland, inPond } from './geometry';

export interface Tree { pivot: THREE.Group; phase: number; }

export function buildObjects(parent: THREE.Group) {
  const wood = material(palette.wood), lightWood = material(palette.woodLight);
  const plaster = material(palette.cream), roof = material(palette.roof);
  const darkRoof = material(0x814d38), stone = material(0xa6a38e);
  const windowMaterial = material(0x6e8582, { roughness: 0.28, emissive: palette.amber, emissiveIntensity: 0 });
  const house = new THREE.Group();
  house.position.set(-1.45, ground, -0.7);
  parent.add(house);
  mesh(new RoundedBoxGeometry(2.12, 1.52, 1.7, 2, 0.055), plaster, house, [0, 0.82, 0]);
  box(house, stone, [0, 0.06, 0], [2.3, 0.17, 1.85]);
  const gableShape = new THREE.Shape().moveTo(-1.06, 1.55).lineTo(0, 2.47).lineTo(1.06, 1.55).closePath();
  const gable = new THREE.ExtrudeGeometry(gableShape, { depth: 1.7, bevelEnabled: false });
  mesh(gable, plaster, house, [0, 0, -0.85]);

  const pitch = Math.atan2(1, 1.28);
  for (const side of [-1, 1]) {
    const panel = box(house, darkRoof, [side * 0.64, 2.01, 0], [1.7, 0.12, 2.15]);
    panel.rotation.z = -side * pitch;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 7; col++) {
        const x = side * (0.12 + row * 0.25);
        const tile = box(house, (row + col) % 4 === 0 ? darkRoof : roof,
          [x, 2.57 - Math.abs(x) * 0.78, -0.93 + col * 0.305], [0.35, 0.065, 0.29]);
        tile.rotation.z = -side * pitch;
      }
    }
    beam(house, wood, new THREE.Vector3(0, 2.58, 1.08), new THREE.Vector3(side * 1.33, 1.55, 1.08), 0.09);
  }
  box(house, roof, [0, 2.58, 0], [0.17, 0.12, 2.22]);
  box(house, wood, [0, 1.53, 0.885], [2.12, 0.075, 0.07]);
  box(house, wood, [0, 1.95, 0.885], [0.07, 0.85, 0.07]);
  for (const x of [-1.02, 1.02]) box(house, wood, [x, 0.85, 0.872], [0.09, 1.4, 0.075]);

  const door = box(house, wood, [-0.35, 0.47, 0.89], [0.49, 0.83, 0.09]);
  for (let i = 0; i < 4; i++) box(house, lightWood, [-0.53 + i * 0.12, 0.47, 0.945], [0.016, 0.75, 0.013]);
  pebble(house, material(0xc8ab62, { metalness: 0.7 }), [-0.2, 0.48, 0.956], [0.032, 0.032, 0.025]);
  box(house, stone, [-0.35, 0.06, 1.08], [0.72, 0.14, 0.46]);
  box(house, stone, [-0.35, -0.025, 1.26], [0.85, 0.09, 0.36]);

  function frontWindow(x: number, y: number, width = 0.52, height = 0.55) {
    box(house, wood, [x, y, 0.9], [width + 0.1, height + 0.1, 0.09]);
    box(house, windowMaterial, [x, y, 0.952], [width, height, 0.02]);
    box(house, plaster, [x, y, 0.97], [0.035, height, 0.025]);
    box(house, plaster, [x, y, 0.97], [width, 0.035, 0.025]);
    box(house, lightWood, [x, y - height / 2 - 0.06, 1], [width + 0.19, 0.08, 0.21]);
  }
  frontWindow(0.53, 1.02);
  frontWindow(0, 1.95, 0.3, 0.34);
  for (const side of [-1, 1]) {
    box(house, wood, [side * 1.075, 0.99, 0], [0.07, 0.65, 0.7]);
    box(house, windowMaterial, [side * 1.117, 0.99, 0], [0.025, 0.54, 0.57]);
    box(house, plaster, [side * 1.135, 0.99, 0], [0.025, 0.54, 0.034]);
    box(house, plaster, [side * 1.135, 0.99, 0], [0.025, 0.034, 0.57]);
  }
  const chimney = material(0xbfad91);
  box(house, chimney, [0.67, 2.52, -0.45], [0.36, 1.06, 0.38]);
  box(house, stone, [0.67, 3.02, -0.45], [0.46, 0.14, 0.48]);
  box(house, material(0x574c40), [0.67, 3.096, -0.45], [0.28, 0.01, 0.3]);
  for (let i = 0; i < 4; i++) box(house, wood, [0.67, 2.22 + i * 0.2, -0.65], [0.35, 0.013, 0.012]);
  const flowerbox = box(house, wood, [0.53, 0.67, 1.02], [0.75, 0.17, 0.28]);
  const flowerColor = material(0xe4c780);
  for (let i = 0; i < 5; i++) {
    post(house, material(palette.leaf), [0.24 + i * 0.14, 0.83, 1.02], 0.018, 0.18);
    pebble(house, flowerColor, [0.24 + i * 0.14, 0.93, 1.02], [0.065, 0.045, 0.06]);
  }
  const houseLight = new THREE.PointLight(palette.amber, 0, 5, 2);
  houseLight.position.set(0, 1.2, 1.5);
  house.add(houseLight);
  house.userData.pickable = true;
  door.name = 'cottage-door';
  flowerbox.name = 'window-box';

  const mill = new THREE.Group();
  mill.position.set(2.25, ground, -1.65);
  parent.add(mill);
  const tower = new THREE.CylinderGeometry(0.38, 0.65, 2, 12);
  mesh(tower, plaster, mill, [0, 1, 0]);
  mesh(new THREE.ConeGeometry(0.62, 0.73, 12), darkRoof, mill, [0, 2.27, 0]);
  box(mill, wood, [0, 0.4, 0.59], [0.27, 0.65, 0.065]);
  box(mill, wood, [-0.32, 1.13, 0.4], [0.22, 0.3, 0.075]).rotation.y = -0.5;
  const rotor = new THREE.Group();
  rotor.position.set(0, 1.86, 0.59);
  rotor.rotation.z = Math.PI / 8;
  mill.add(rotor);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Group();
    blade.rotation.z = i * Math.PI / 2;
    rotor.add(blade);
    box(blade, wood, [0, 0.72, 0], [0.06, 1.58, 0.065]);
    box(blade, material(0xebe0bf), [0.12, 1.02, 0.025], [0.32, 0.8, 0.035]);
    for (let j = 0; j < 5; j++) box(blade, lightWood, [0.12, 0.64 + j * 0.19, 0.05], [0.37, 0.035, 0.035]);
    box(blade, wood, [0.3, 1.02, 0.045], [0.035, 0.86, 0.04]);
  }
  pebble(rotor, wood, [0, 0, 0.07], [0.16, 0.16, 0.1]);

  const trees: Tree[] = [];
  const leafyMaterials = [material(0x91aa62, { flatShading: true }), material(0x7b9955, { flatShading: true }), material(0xa0b873, { flatShading: true })];
  const pineMaterials = [material(palette.pine, { flatShading: true }), material(0x60836b, { flatShading: true })];
  const pineGeometry = new THREE.ConeGeometry(1, 1, 7);
  const treeLocations = [
    [-3.5, -1.7, 1.15, 0], [-3.1, 0.6, 0.92, 0], [-2.7, -2.65, 0.8, 1],
    [-0.35, -2.8, 1.04, 1], [1.1, -3.03, 0.82, 1],
    [3.95, -2.65, 0.9, 0], [4.35, 0.3, 0.62, 0], [-3.95, 1.83, 0.64, 1],
  ];
  treeLocations.forEach(([x, z, size, pine], index) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, ground, z);
    pivot.scale.setScalar(size);
    parent.add(pivot);
    post(pivot, wood, [0, 0.64, 0], 0.1, 1.3);
    if (pine) {
      for (let layer = 0; layer < 3; layer++) {
        const radius = 0.82 - layer * 0.21;
        mesh(pineGeometry, pineMaterials[layer % 2], pivot, [0, 1.13 + layer * 0.47, 0], [radius, 1.12, radius]);
      }
    } else {
      beam(pivot, wood, new THREE.Vector3(0, 0.7, 0), new THREE.Vector3(-0.36, 1.25, 0.1), 0.07);
      const parts = [[0, 1.95, 0, 0.77], [-0.5, 1.58, 0.04, 0.64], [0.45, 1.65, -0.12, 0.62], [0.07, 1.55, 0.44, 0.61], [0.05, 1.68, -0.4, 0.58]];
      parts.forEach(([px, py, pz, r], j) => {
        const foliage = pebble(pivot, leafyMaterials[(j + index) % 3], [px, py, pz], [r, r * 1.13, r]);
        foliage.rotation.set(j * 0.5, index * 0.7, j * 0.3);
      });
    }
    trees.push({ pivot, phase: index * 1.71 });
  });

  const rand = random(18);
  for (let i = 0; i < 12; i++) {
    const progress = i / 11;
    const x = -1.8 + progress * 1.5 + Math.sin(progress * Math.PI) * 0.45;
    const z = 0.63 + progress * 2.5;
    const stepping = pebble(parent, material(i % 3 === 0 ? 0xc8c3a5 : 0xd4cbb0), [x, ground + 0.015, z], [0.27, 0.065, 0.2]);
    stepping.rotation.y = rand() * 2;
  }
  for (let i = 0; i < 6; i++) {
    const x = -2.8 + i * 0.72, z = 2.95;
    post(parent, lightWood, [x, ground + 0.31, z], 0.055, 0.62);
    if (i < 5) {
      box(parent, lightWood, [x + 0.36, ground + 0.22, z], [0.75, 0.055, 0.055]);
      box(parent, lightWood, [x + 0.36, ground + 0.48, z], [0.75, 0.055, 0.055]);
    }
  }
  const bench = new THREE.Group();
  bench.position.set(0.15, ground, 0.95);
  bench.rotation.y = -0.35;
  parent.add(bench);
  for (const x of [-0.35, 0.35]) {
    box(bench, wood, [x, 0.16, 0], [0.07, 0.32, 0.3]);
    box(bench, wood, [x, 0.47, -0.15], [0.07, 0.6, 0.065]);
  }
  for (let i = 0; i < 3; i++) box(bench, lightWood, [0, 0.34, -0.12 + i * 0.11], [0.94, 0.055, 0.085]);
  for (let i = 0; i < 2; i++) box(bench, lightWood, [0, 0.52 + i * 0.13, -0.15], [0.94, 0.1, 0.05]);

  const reed = material(0x758b51), flower = material(0xf0dfad), grassDark = material(palette.grassDark);
  for (let i = 0; i < 34; i++) {
    const x = (rand() - 0.5) * 9, z = (rand() - 0.5) * 7.5;
    if (!onIsland(x, z, 0.11) || inPond(x, z) || (x > -2.8 && x < 3 && z < 1.1 && z > -2.4)) continue;
    if (i % 3 === 0) {
      post(parent, reed, [x, ground + 0.12, z], 0.015, 0.23);
      pebble(parent, flower, [x, ground + 0.24, z], [0.075, 0.042, 0.075]);
    } else {
      for (let blade = 0; blade < 3; blade++) {
        const stem = mesh(new THREE.ConeGeometry(0.028, 0.23, 3), grassDark, parent, [x + blade * 0.06, ground + 0.1, z], [1, 1, 1]);
        stem.rotation.z = (blade - 1) * 0.24;
      }
    }
  }
  for (const [x, z, size] of [[-4.3, -0.4, 0.5], [3.9, -2.2, 0.4], [2.8, 3.1, 0.3], [-2.6, 2, 0.22]]) {
    pebble(parent, stone, [x, ground + size * 0.25, z], [size, size * 0.6, size * 0.8]);
  }
  return { house, windowMaterial, houseLight, trees, rotor };
}
