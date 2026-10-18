import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const palette = {
  grass: '#9caf75', grassLight: '#b3bf84', grassDark: '#738e60',
  wood: '#795743', woodLight: '#b49166', cream: '#f3e8ca',
  roof: '#b75f42', roofLight: '#cc7952', stone: '#aaa18a',
  leaf: '#708e58', leafLight: '#9aab67', leafDark: '#456b52',
};
export const material = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.86, ...extra });
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
export const pebbleGeometry = new THREE.IcosahedronGeometry(1, 0);
export const leafGeometry = new THREE.IcosahedronGeometry(1, 1);

export function mesh(geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D,
  x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, mat);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}
export function box(parent: THREE.Object3D, mat: THREE.Material, size: [number, number, number],
  position: [number, number, number] = [0, 0, 0]) {
  const object = mesh(boxGeometry, mat, parent, ...position);
  object.scale.set(...size);
  return object;
}
export function beam(parent: THREE.Object3D, mat: THREE.Material, from: THREE.Vector3, to: THREE.Vector3, radius: number) {
  const object = mesh(new THREE.CylinderGeometry(radius * 0.75, radius, from.distanceTo(to), 6), mat, parent);
  object.position.copy(from).add(to).multiplyScalar(0.5);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  return object;
}
export function random(seed = 73) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function shapeFrom(points: THREE.Vector2[]) {
  return new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, -p.y)));
}
export function flatShape(points: THREE.Vector2[], mat: THREE.Material, parent: THREE.Object3D, height: number) {
  const geometry = new THREE.ShapeGeometry(shapeFrom(points));
  geometry.rotateX(-Math.PI / 2);
  return mesh(geometry, mat, parent, 0, height, 0);
}
export const damp = (current: number, target: number, rate: number, dt: number) =>
  THREE.MathUtils.lerp(current, target, 1 - Math.exp(-rate * dt));

export function batchMeshes(root: THREE.Group) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const batches = new Map<THREE.Material, { geometries: THREE.BufferGeometry[]; objects: THREE.Mesh[] }>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    const batch = batches.get(object.material) ?? { geometries: [], objects: [] };
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
    batch.geometries.push(geometry); batch.objects.push(object); batches.set(object.material, batch);
  });
  for (const [mat, batch] of batches) {
    const geometry = mergeGeometries(batch.geometries);
    batch.geometries.forEach(g => g.dispose());
    if (!geometry) continue;
    const combined = mesh(geometry, mat, root);
    combined.castShadow = batch.objects[0].castShadow;
    combined.receiveShadow = batch.objects[0].receiveShadow;
    batch.objects.forEach(object => object.removeFromParent());
  }
}
