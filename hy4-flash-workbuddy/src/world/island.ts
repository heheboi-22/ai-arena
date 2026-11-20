import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three'
import type { Materials } from './materials'
import { mulberry32, TAU } from '../util/math'

const SEGMENTS = 112
const rng = mulberry32(20261120)

/** Irregular hand-drawn coastline, shared by the geometry and the rain recycling. */
export function coastRadius(theta: number): number {
  return (
    7.55 +
    0.58 * Math.sin(3 * theta + 0.45) +
    0.34 * Math.sin(5 * theta - 1.15) +
    0.19 * Math.sin(9 * theta + 2.1) +
    0.12 * Math.cos(13 * theta - 0.7)
  )
}

const POND_CENTER = { x: 1.45, z: 2.15 }

function grassColor(x: number, z: number, edge: number): Color {
  const n = Math.sin(x * 1.9 + z * 0.8) * Math.cos(z * 2.3 - x * 0.6)
  const color = new Color(0x76a457)
  color.multiplyScalar(0.94 + n * 0.09)
  const pondDistance = Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z)
  if (pondDistance < 3.05) {
    const t = Math.max(0, Math.min(1, (3.05 - pondDistance) / 1.05))
    color.lerp(new Color(0xc7b587), t * 0.92)
  }
  color.lerp(new Color(0x5f8449), edge * 0.35)
  return color
}

function pushColor(target: number[], color: Color): void {
  target.push(color.r, color.g, color.b)
}

export interface IslandHandle {
  group: Group
  islandRadiusAt: (theta: number) => number
}

export function createIsland(materials: Materials, lowPower: boolean): IslandHandle {
  const group = new Group()
  group.name = 'island'
  const segments = lowPower ? 80 : SEGMENTS

  // ---- Grassy top -------------------------------------------------------
  const rings = [0, 0.17, 0.35, 0.54, 0.71, 0.85, 0.94, 1]
  const positions: number[] = [0, 0, 0]
  const colors: number[] = []
  const uvs: number[] = [0.5, 0.5]
  const indices: number[] = []
  pushColor(colors, grassColor(0, 0, 0))

  for (const fraction of rings.slice(1)) {
    for (let i = 0; i < segments; i++) {
      const theta = (i / segments) * TAU
      const radius = coastRadius(theta) * fraction
      const x = Math.cos(theta) * radius
      const z = Math.sin(theta) * radius
      const y = 0.035 * Math.sin(theta * 4 + fraction * 3) * fraction
      positions.push(x, y, z)
      uvs.push(x / 18 + 0.5, z / 18 + 0.5)
      pushColor(colors, grassColor(x, z, fraction))
    }
  }
  const ringStart = (ring: number) => 1 + (ring - 1) * segments
  for (let i = 0; i < segments; i++) indices.push(0, ringStart(1) + ((i + 1) % segments), ringStart(1) + i)
  for (let r = 1; r < rings.length - 1; r++) {
    const inner = ringStart(r)
    const outer = ringStart(r + 1)
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments
      indices.push(inner + i, outer + next, outer + i)
      indices.push(inner + i, inner + next, outer + next)
    }
  }
  const topGeometry = new BufferGeometry()
  topGeometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  topGeometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  topGeometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  topGeometry.setIndex(indices)
  topGeometry.computeVertexNormals()
  const top = new Mesh(topGeometry, materials.grass)
  top.receiveShadow = true
  top.name = 'grass-top'
  group.add(top)

  // ---- Green lip just below the grass -----------------------------------
  const lipColors: number[] = []
  const lipTop: number[] = []
  const lipBottom: number[] = []
  const bottomY = -0.42
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * TAU
    const radius = coastRadius(theta)
    lipTop.push(Math.cos(theta) * radius, 0.01, Math.sin(theta) * radius)
    lipBottom.push(Math.cos(theta) * radius * 0.997, bottomY, Math.sin(theta) * radius * 0.997)
  }
  const lipIndices: number[] = []
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments
    lipIndices.push(i, segments + next, segments + i)
    lipIndices.push(i, next, segments + next)
  }
  const lipGeometry = new BufferGeometry()
  lipGeometry.setAttribute('position', new BufferAttribute(new Float32Array([...lipTop, ...lipBottom]), 3))
  for (let i = 0; i < segments * 2; i++) pushColor(lipColors, new Color(i < segments ? 0x648d4a : 0x4f6b3c))
  lipGeometry.setAttribute('color', new BufferAttribute(new Float32Array(lipColors), 3))
  lipGeometry.setIndex(lipIndices)
  lipGeometry.computeVertexNormals()
  const lip = new Mesh(lipGeometry, new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95, flatShading: true }))
  lip.castShadow = true
  lip.receiveShadow = true
  group.add(lip)

  // ---- Faceted, stratified underside ------------------------------------
  const strata = [
    { y: -0.4, scale: 1.0, color: 0x6a5c41 },
    { y: -0.95, scale: 0.975, color: 0x8a6c4d },
    { y: -1.55, scale: 0.895, color: 0x745741 },
    { y: -2.15, scale: 0.77, color: 0x8b6849 },
    { y: -2.8, scale: 0.6, color: 0x6c4e3b },
    { y: -3.45, scale: 0.4, color: 0x574034 },
    { y: -4.05, scale: 0.19, color: 0x49382f },
  ]
  const cliffPositions: number[] = []
  const cliffColors: number[] = []
  const ringVerts: number[][] = []

  for (let r = 0; r < strata.length; r++) {
    const verts: number[] = []
    const layer = strata[r]
    for (let i = 0; i < segments; i++) {
      const theta = (i / segments) * TAU
      const jag =
        1 +
        0.055 * Math.sin(7 * theta + r * 1.4) +
        0.035 * Math.sin(13 * theta - r * 0.8) +
        (rng() - 0.5) * 0.018
      const radius = coastRadius(theta) * layer.scale * jag
      verts.push(Math.cos(theta) * radius, layer.y + (rng() - 0.5) * 0.12, Math.sin(theta) * radius)
    }
    ringVerts.push(verts)
  }

  for (let r = 0; r < strata.length - 1; r++) {
    const upper = ringVerts[r]
    const lower = ringVerts[r + 1]
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments
      const a = upper.slice(i * 3, i * 3 + 3)
      const b = upper.slice(next * 3, next * 3 + 3)
      const c = lower.slice(i * 3, i * 3 + 3)
      const d = lower.slice(next * 3, next * 3 + 3)
      cliffPositions.push(...a, ...d, ...c, ...a, ...b, ...d)
      const base = new Color(strata[r].color)
      base.multiplyScalar(0.84 + rng() * 0.32)
      const baseNext = new Color(strata[r].color)
      baseNext.multiplyScalar(0.84 + rng() * 0.32)
      pushColor(cliffColors, baseNext)
      pushColor(cliffColors, baseNext)
      pushColor(cliffColors, base)
      pushColor(cliffColors, base)
      pushColor(cliffColors, baseNext)
      pushColor(cliffColors, baseNext)
    }
  }
  // Close the tip.
  const tip = new Vector3(0.2, -4.6, -0.15)
  const last = ringVerts[ringVerts.length - 1]
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments
    const a = last.slice(i * 3, i * 3 + 3)
    const b = last.slice(next * 3, next * 3 + 3)
    cliffPositions.push(...a, ...b, tip.x, tip.y, tip.z)
    const color = new Color(0x43342c).multiplyScalar(0.85 + rng() * 0.3)
    pushColor(cliffColors, color)
    pushColor(cliffColors, color)
    pushColor(cliffColors, color)
  }
  const cliffGeometry = new BufferGeometry()
  cliffGeometry.setAttribute('position', new BufferAttribute(new Float32Array(cliffPositions), 3))
  cliffGeometry.setAttribute('color', new BufferAttribute(new Float32Array(cliffColors), 3))
  cliffGeometry.computeVertexNormals()
  const cliff = new Mesh(cliffGeometry, materials.cliff)
  cliff.castShadow = true
  cliff.receiveShadow = true
  cliff.name = 'cliff'
  group.add(cliff)

  // ---- Hanging stones and a few drifting pebbles -------------------------
  const rockGeometries = [new IcosahedronGeometry(1, 0), new IcosahedronGeometry(0.8, 0)]
  for (let i = 0; i < 14; i++) {
    const angle = rng() * TAU
    const radius = 1.2 + rng() * 4.2
    const mesh = new Mesh(rockGeometries[i % 2], i % 3 === 0 ? materials.soil : materials.stone)
    mesh.position.set(Math.cos(angle) * radius, -2.1 - rng() * 2.3, Math.sin(angle) * radius)
    const scale = 0.3 + rng() * 0.55
    mesh.scale.set(scale * (0.8 + rng() * 0.6), scale * (1.1 + rng() * 0.9), scale * (0.8 + rng() * 0.5))
    mesh.rotation.set(rng() * 3, rng() * 3, rng() * 3)
    mesh.castShadow = true
    group.add(mesh)
  }
  for (let i = 0; i < 9; i++) {
    const angle = rng() * TAU
    const radius = 8.8 + rng() * 3.2
    const mesh = new Mesh(rockGeometries[i % 2], materials.stone)
    mesh.position.set(Math.cos(angle) * radius, -3.4 - rng() * 3.2, Math.sin(angle) * radius)
    const scale = 0.1 + rng() * 0.22
    mesh.scale.set(scale, scale * (0.7 + rng()), scale)
    mesh.rotation.set(rng() * 3, rng() * 3, rng() * 3)
    group.add(mesh)
  }

  return { group, islandRadiusAt: coastRadius }
}
