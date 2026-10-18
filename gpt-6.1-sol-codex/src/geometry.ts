import * as THREE from 'three';

export const ground = 0.24;
export const palette = {
  grass: 0x92ab62, grassDark: 0x6e894e, leaf: 0x7b9854,
  pine: 0x4d7661, wood: 0x73503a, woodLight: 0xb59367,
  cream: 0xf1e5c6, roof: 0xa55d42, rock: 0x8c8d78,
  sand: 0xc6be91, water: 0x6fa9ae, amber: 0xffbe60,
};

const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const sphereGeometry = new THREE.IcosahedronGeometry(1, 1);
const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);

export function material(color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
}

export function mesh(geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D,
  position: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]) {
  const item = new THREE.Mesh(geometry, mat);
  item.position.set(...position);
  item.scale.set(...scale);
  item.castShadow = true;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}

export function box(parent: THREE.Object3D, mat: THREE.Material, position: [number, number, number], scale: [number, number, number]) {
  return mesh(boxGeometry, mat, parent, position, scale);
}

export function pebble(parent: THREE.Object3D, mat: THREE.Material, position: [number, number, number], scale: [number, number, number]) {
  return mesh(sphereGeometry, mat, parent, position, scale);
}

export function post(parent: THREE.Object3D, mat: THREE.Material, position: [number, number, number], radius: number, height: number) {
  return mesh(cylinderGeometry, mat, parent, position, [radius, height, radius]);
}

export function beam(parent: THREE.Object3D, mat: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, width: number) {
  const center = a.clone().add(b).multiplyScalar(0.5);
  const item = box(parent, mat, [center.x, center.y, center.z], [width, a.distanceTo(b), width]);
  item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return item;
}

export function random(seed = 73) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function islandRadius(angle: number) {
  return 1 + 0.055 * Math.sin(angle * 3 + 0.8) + 0.04 * Math.cos(angle * 5 - 0.5) + 0.023 * Math.sin(angle * 9);
}

export function onIsland(x: number, z: number, margin = 0) {
  const angle = Math.atan2(z / 4.35, x / 5.3);
  return Math.hypot(x / 5.3, z / 4.35) < islandRadius(angle) - margin;
}

export const pondCenter = new THREE.Vector2(1.65, 1.8);
export function pondPoint(angle: number, scale = 1) {
  const irregular = 1 + 0.065 * Math.sin(angle * 3) + 0.03 * Math.cos(angle * 5);
  const x = 1.72 * Math.cos(angle) * irregular * scale;
  const z = 1.04 * Math.sin(angle) * irregular * scale;
  return new THREE.Vector2(pondCenter.x + x * 0.98 + z * 0.2, pondCenter.y - x * 0.2 + z * 0.98);
}

export function inPond(x: number, z: number) {
  const dx = x - pondCenter.x, dz = z - pondCenter.y;
  return Math.hypot((dx * 0.98 - dz * 0.2) / 1.67, (dx * 0.2 + dz * 0.98) / 0.99) < 1;
}

export function horizontalShape(points: THREE.Vector2[]) {
  const shape = new THREE.Shape();
  points.forEach((p, i) => i ? shape.lineTo(p.x, -p.y) : shape.moveTo(p.x, -p.y));
  shape.closePath();
  return shape;
}
