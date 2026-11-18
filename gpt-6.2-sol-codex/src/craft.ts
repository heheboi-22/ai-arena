import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const tau = Math.PI * 2;

export function random(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export const clay = (color: T.ColorRepresentation, extra: T.MeshStandardMaterialParameters = {}) =>
  new T.MeshStandardMaterial({ color, roughness: 0.92, ...extra });

export function place(
  parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material,
  x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1,
) {
  const mesh = new T.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

const cube = new T.BoxGeometry(1, 1, 1);
export const box = (
  parent: T.Object3D, material: T.Material, x: number, y: number, z: number,
  width: number, height: number, depth: number,
) => place(parent, cube, material, x, y, z, width, height, depth);

export function beam(
  parent: T.Object3D, material: T.Material,
  from: T.Vector3, to: T.Vector3, width: number,
) {
  const mid = from.clone().lerp(to, 0.5);
  const mesh = box(parent, material, mid.x, mid.y, mid.z, width, from.distanceTo(to), width);
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  return mesh;
}

export function bake(group: T.Group) {
  const sets = new Map<T.Material, T.BufferGeometry[]>();
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert();
  group.traverse(child => {
    if (!(child instanceof T.Mesh) || Array.isArray(child.material)) return;
    const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    geometry.applyMatrix4(inverse.clone().multiply(child.matrixWorld));
    const parts = sets.get(child.material) ?? [];
    parts.push(geometry);
    sets.set(child.material, parts);
  });
  group.clear();
  for (const [material, parts] of sets) {
    const merged = mergeGeometries(parts);
    parts.forEach(part => part.dispose());
    place(group, merged, material);
  }
}

export function pebbleGeometry(seed: number, detail = 0) {
  const rng = random(seed);
  const geometry = new T.IcosahedronGeometry(1, detail);
  const position = geometry.attributes.position;
  const vertex = new T.Vector3();
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const warp = 1 + 0.16 * Math.sin(vertex.x * 8 + vertex.z * 5 + rngSeed(seed)) +
      0.08 * Math.cos(vertex.y * 8 - vertex.z * 7 + seed);
    vertex.multiplyScalar(warp);
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  geometry.rotateY(rng() * tau);
  geometry.computeVertexNormals();
  return geometry;
}

function rngSeed(seed: number) {
  return (seed * 1.619) % tau;
}
