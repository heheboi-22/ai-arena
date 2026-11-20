import { BufferGeometry, Group, InstancedMesh, Material, Matrix4, Mesh, Object3D } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

interface Bucket {
  material: Material
  geometries: BufferGeometry[]
  castShadow: boolean
  receiveShadow: boolean
}

/** Collapses static meshes sharing a material into one draw call. Objects marked
 *  with `userData.noMerge` (and their descendants) are left alone so animated
 *  parts keep their own transforms. */
export function mergeStatic(root: Group): number {
  root.updateMatrixWorld(true)
  const inverse = root.matrixWorld.clone().invert()
  const buckets = new Map<string, Bucket>()
  const originals: Mesh[] = []

  const visit = (object: Object3D) => {
    if (object.userData.noMerge) return
    if (object instanceof InstancedMesh) return
    if (object instanceof Mesh && !Array.isArray(object.material)) {
      const geometry = object.geometry
      const signature = Object.keys(geometry.attributes).sort().join('|')
      const key = `${object.material.uuid}:${signature}`
      let bucket = buckets.get(key)
      if (!bucket) {
        bucket = { material: object.material, geometries: [], castShadow: false, receiveShadow: false }
        buckets.set(key, bucket)
      }
      const clone = geometry.index ? geometry.toNonIndexed() : geometry.clone()
      clone.applyMatrix4(new Matrix4().multiplyMatrices(inverse, object.matrixWorld))
      bucket.geometries.push(clone)
      bucket.castShadow ||= object.castShadow
      bucket.receiveShadow ||= object.receiveShadow
      originals.push(object)
    }
    for (const child of [...object.children]) visit(child)
  }
  visit(root)

  for (const original of originals) original.parent?.remove(original)
  let created = 0
  for (const bucket of buckets.values()) {
    const merged = mergeGeometries(bucket.geometries, false)
    for (const geometry of bucket.geometries) geometry.dispose()
    if (!merged) continue
    const mesh = new Mesh(merged, bucket.material)
    mesh.castShadow = bucket.castShadow
    mesh.receiveShadow = bucket.receiveShadow
    root.add(mesh)
    created++
  }
  return created
}
