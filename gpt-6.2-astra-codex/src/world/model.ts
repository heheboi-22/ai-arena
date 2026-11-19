import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export const TAU = Math.PI * 2
export const ground = 0.48
export const v = (x: number, y: number, z: number) => new T.Vector3(x, y, z)
export function random(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}
const materials = new Map<string, T.MeshStandardMaterial>()
export function paint(color: string) {
  if (!materials.has(color))
    materials.set(color, new T.MeshStandardMaterial({ color, roughness: 0.94, flatShading: true }))
  return materials.get(color)!
}
const cube = new T.BoxGeometry(1, 1, 1)
const nugget = new T.IcosahedronGeometry(1, 0)
export function mesh(
  parent: T.Object3D,
  geo: T.BufferGeometry,
  material: T.Material | string,
  x = 0,
  y = 0,
  z = 0,
) {
  const m = new T.Mesh(geo, typeof material === 'string' ? paint(material) : material)
  m.position.set(x, y, z)
  m.castShadow = m.receiveShadow = true
  parent.add(m)
  return m
}
export function box(
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: T.Material | string,
) {
  const m = mesh(parent, cube, color, x, y, z)
  m.scale.set(w, h, d)
  return m
}
export function stone(
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: string,
  turn = 0,
) {
  const m = mesh(parent, nugget, color, x, y, z)
  m.scale.set(w, h, d)
  m.rotation.set(0.13, turn, 0.09)
  return m
}
export function pole(
  parent: T.Object3D,
  a: T.Vector3,
  b: T.Vector3,
  width: number,
  depth: number,
  color: string,
) {
  const middle = a.clone().add(b).multiplyScalar(0.5)
  const m = box(parent, middle.x, middle.y, middle.z, width, a.distanceTo(b), depth, color)
  m.quaternion.setFromUnitVectors(v(0, 1, 0), b.clone().sub(a).normalize())
  return m
}
export function cyl(
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
  top: number,
  bottom: number,
  height: number,
  color: string | T.Material,
  sides = 9,
) {
  return mesh(parent, new T.CylinderGeometry(top, bottom, height, sides), color, x, y, z)
}
export function faceGeometry(points: number[], colors?: number[]) {
  const geo = new T.BufferGeometry()
  geo.setAttribute('position', new T.Float32BufferAttribute(points, 3))
  if (colors) geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  return geo
}
export const colored = new T.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.94,
  flatShading: true,
  side: T.DoubleSide,
})

// Bake rigid miniatures in their own coordinate space so animated pivots stay independent.
export function bake(group: T.Group) {
  group.updateWorldMatrix(true, true)
  const inverse = group.matrixWorld.clone().invert()
  const piles = new Map<T.Material, T.BufferGeometry[]>()
  const opaquePaint = new Set(materials.values())
  group.traverse((node) => {
    if (!(node instanceof T.Mesh) || Array.isArray(node.material)) return
    const material = node.material as T.MeshStandardMaterial
    const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone()
    geometry.applyMatrix4(inverse.clone().multiply(node.matrixWorld))
    for (const key of Object.keys(geometry.attributes)) {
      if (!['color', 'normal', 'position'].includes(key)) geometry.deleteAttribute(key)
    }
    let target: T.Material = material
    if (material === colored || opaquePaint.has(material)) {
      target = colored
      if (!geometry.hasAttribute('color')) {
        const n = geometry.getAttribute('position').count
        const cols = new Float32Array(n * 3)
        for (let i = 0; i < n; i++) material.color.toArray(cols, 3 * i)
        geometry.setAttribute('color', new T.BufferAttribute(cols, 3))
      }
    }
    if (!piles.has(target)) piles.set(target, [])
    piles.get(target)!.push(geometry)
  })
  group.clear()
  for (const [material, geos] of piles) {
    const combined = mergeGeometries(geos)!
    mesh(group, combined, material)
    for (const geo of geos) geo.dispose()
  }
}
