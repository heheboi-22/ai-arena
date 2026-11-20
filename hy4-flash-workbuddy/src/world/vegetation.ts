import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
} from 'three'
import type { Materials } from './materials'
import { pondRadius } from './pond'
import { clamp, mulberry32, TAU } from '../util/math'

const rng = mulberry32(77713)

interface Swayer {
  object: Group
  phase: number
  strength: number
}

export interface VegetationHandle {
  group: Group
  update(elapsed: number, wind: number, reducedMotion: boolean): void
  stats: { grass: number; flowers: number; trees: number }
}

function isFree(x: number, z: number): boolean {
  if (Math.hypot(x, z) > 6.65) return false
  if (x > -4.9 && x < -0.35 && z > -3.4 && z < 0.45) return false
  if (Math.hypot(x - 3.55, z + 1.55) < 1.75) return false
  const dx = x - 1.45
  const dz = z - 2.15
  const theta = Math.atan2(dz, dx)
  if (Math.hypot(dx, dz) < pondRadius(theta) + 0.42) return false
  return true
}

export function createVegetation(materials: Materials, lowPower: boolean): VegetationHandle {
  const group = new Group()
  group.name = 'vegetation'
  const swayers: Swayer[] = []
  const trunkGeometry = new CylinderGeometry(0.13, 0.21, 1.45, 7)
  const branchGeometry = new CylinderGeometry(0.06, 0.1, 0.7, 6)
  const crownGeometry = new IcosahedronGeometry(0.62, 0)
  const pineGeometry = new ConeGeometry(0.75, 1.25, 7)
  const bushGeometry = new IcosahedronGeometry(0.42, 0)

  const addTree = (x: number, z: number, kind: 'oak' | 'pine' | 'blossom', scale: number) => {
    const tree = new Group()
    tree.position.set(x, 0, z)
    tree.scale.setScalar(scale)
    tree.rotation.y = rng() * TAU
    const crown = new Group()
    crown.userData.noMerge = true
    tree.add(crown)

    const trunk = new Mesh(trunkGeometry, materials.woodDark)
    trunk.position.y = 0.72
    trunk.castShadow = true
    tree.add(trunk)
    for (const side of [-1, 1]) {
      const branch = new Mesh(branchGeometry, materials.woodDark)
      branch.position.set(side * 0.19, 1.35, 0)
      branch.rotation.z = side * 0.65
      branch.castShadow = true
      crown.add(branch)
    }

    if (kind === 'pine') {
      for (let i = 0; i < 3; i++) {
        const layer = new Mesh(pineGeometry, i === 2 ? materials.leafDark : i === 1 ? materials.leafMid : materials.leafLight)
        layer.position.y = 1.5 + i * 0.66
        layer.scale.setScalar(1 - i * 0.22)
        layer.castShadow = true
        layer.receiveShadow = true
        crown.add(layer)
      }
    } else {
      const palette = kind === 'blossom'
        ? [materials.blossom, materials.blossom, materials.leafLight]
        : [materials.leafLight, materials.leafMid, materials.leafDark]
      const count = kind === 'blossom' ? 6 : 7
      for (let i = 0; i < count; i++) {
        const blob = new Mesh(crownGeometry, palette[i % palette.length])
        const angle = (i / count) * TAU + rng() * 0.4
        const spread = 0.42 + rng() * 0.36
        blob.position.set(Math.cos(angle) * spread, 1.75 + Math.sin(i * 2.1) * 0.28 + rng() * 0.25, Math.sin(angle) * spread)
        blob.scale.set(0.75 + rng() * 0.5, 0.7 + rng() * 0.45, 0.75 + rng() * 0.45)
        blob.rotation.set(rng() * TAU, rng() * TAU, rng() * TAU)
        blob.castShadow = true
        blob.receiveShadow = true
        crown.add(blob)
      }
    }
    group.add(tree)
    swayers.push({ object: crown, phase: rng() * TAU, strength: kind === 'pine' ? 0.028 : 0.052 })
  }

  // Deliberately composed silhouettes: tall oak behind the cottage, pines to
  // the right, a blossom tree at the left rim, and small trees by the water.
  addTree(-5.05, -2.55, 'oak', 1.25)
  addTree(-5.55, 0.75, 'blossom', 1.0)
  addTree(-3.95, 3.85, 'oak', 0.82)
  addTree(5.25, -0.1, 'pine', 1.12)
  addTree(5.85, -1.4, 'pine', 0.86)
  addTree(4.75, 1.95, 'oak', 0.74)
  addTree(0.15, -4.0, 'pine', 0.82)
  addTree(-1.35, -4.35, 'blossom', 0.72)
  if (!lowPower) addTree(2.75, 4.2, 'pine', 0.68)

  // Bushes and little mushroom clusters.
  for (let i = 0; i < (lowPower ? 12 : 20); i++) {
    let x = 0
    let z = 0
    for (let attempt = 0; attempt < 40; attempt++) {
      x = (rng() - 0.5) * 13
      z = (rng() - 0.5) * 13
      if (isFree(x, z)) break
    }
    if (!isFree(x, z)) continue
    const bush = new Group()
    bush.userData.noMerge = true
    bush.position.set(x, 0, z)
    const count = 2 + Math.floor(rng() * 3)
    for (let j = 0; j < count; j++) {
      const blob = new Mesh(bushGeometry, j % 2 === 0 ? materials.leafMid : materials.leafLight)
      blob.position.set((rng() - 0.5) * 0.4, 0.24 + rng() * 0.16, (rng() - 0.5) * 0.4)
      blob.scale.setScalar(0.55 + rng() * 0.5)
      blob.castShadow = true
      bush.add(blob)
    }
    group.add(bush)
    swayers.push({ object: bush, phase: rng() * TAU, strength: 0.03 })
  }

  const capGeometry = new SphereGeometry(0.09, 8, 5, 0, TAU, 0, Math.PI / 2)
  const stemGeometry = new CylinderGeometry(0.025, 0.032, 0.13, 6)
  const capMaterial = new MeshStandardMaterial({ color: 0xc86f5c, roughness: 0.9 })
  for (let i = 0; i < 10; i++) {
    const theta = rng() * TAU
    const radius = 3.5 + rng() * 2.5
    const x = Math.cos(theta) * radius - 2
    const z = Math.sin(theta) * radius - 1
    if (!isFree(x, z)) continue
    const cluster = new Group()
    cluster.position.set(x, 0, z)
    for (let j = 0; j < 3; j++) {
      const stem = new Mesh(stemGeometry, materials.cream)
      stem.position.set((rng() - 0.5) * 0.22, 0.065, (rng() - 0.5) * 0.22)
      cluster.add(stem)
      const cap = new Mesh(capGeometry, capMaterial)
      cap.position.set(stem.position.x, 0.13, stem.position.z)
      cap.scale.setScalar(0.7 + rng() * 0.6)
      cluster.add(cap)
    }
    group.add(cluster)
  }

  // Instanced grass and wildflowers keep the draw calls low.
  const grassCount = lowPower ? 340 : 760
  const bladeGeometry = new ConeGeometry(0.042, 0.3, 3)
  const grass = new InstancedMesh(bladeGeometry, materials.leafMid, grassCount)
  grass.castShadow = false
  grass.receiveShadow = true
  const dummy = new Object3D()
  const grassPalette = [0x76a457, 0x8bb568, 0x5b8a4c, 0x9cbe72]
  let placed = 0
  for (let attempt = 0; attempt < grassCount * 12 && placed < grassCount; attempt++) {
    const x = (rng() - 0.5) * 15.5
    const z = (rng() - 0.5) * 15.5
    if (!isFree(x, z)) continue
    dummy.position.set(x, 0.14, z)
    dummy.rotation.set((rng() - 0.5) * 0.2, rng() * TAU, (rng() - 0.5) * 0.3)
    const scale = 0.65 + rng() * 0.75
    dummy.scale.set(scale, scale * (0.7 + rng() * 0.6), scale)
    dummy.updateMatrix()
    grass.setMatrixAt(placed, dummy.matrix)
    grass.setColorAt(placed, new Color(grassPalette[Math.floor(rng() * grassPalette.length)]))
    placed++
  }
  grass.count = placed
  grass.instanceMatrix.needsUpdate = true
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true
  group.add(grass)

  const flowerCount = lowPower ? 55 : 130
  const stem = new InstancedMesh(new CylinderGeometry(0.008, 0.011, 0.2, 4), materials.leafDark, flowerCount)
  const heads = new InstancedMesh(new IcosahedronGeometry(0.065, 0), new MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }), flowerCount)
  const flowerColors = [0xf4d98a, 0xe6a0aa, 0xf5efe0, 0xb8a3d8, 0xe9b06f]
  let flowerPlaced = 0
  for (let attempt = 0; attempt < flowerCount * 16 && flowerPlaced < flowerCount; attempt++) {
    const x = (rng() - 0.5) * 15
    const z = (rng() - 0.5) * 15
    if (!isFree(x, z)) continue
    const height = 0.16 + rng() * 0.12
    dummy.position.set(x, height / 2, z)
    dummy.rotation.set(0, rng() * TAU, 0)
    dummy.scale.set(1, height / 0.2, 1)
    dummy.updateMatrix()
    stem.setMatrixAt(flowerPlaced, dummy.matrix)
    dummy.position.y = height + 0.04
    dummy.scale.setScalar(0.7 + rng() * 0.6)
    dummy.updateMatrix()
    heads.setMatrixAt(flowerPlaced, dummy.matrix)
    heads.setColorAt(flowerPlaced, new Color(flowerColors[Math.floor(rng() * flowerColors.length)]))
    flowerPlaced++
  }
  stem.count = flowerPlaced
  heads.count = flowerPlaced
  stem.instanceMatrix.needsUpdate = true
  heads.instanceMatrix.needsUpdate = true
  if (heads.instanceColor) heads.instanceColor.needsUpdate = true
  group.add(stem, heads)

  return {
    group,
    stats: { grass: placed, flowers: flowerPlaced, trees: swayers.length },
    update(elapsed, wind, reducedMotion) {
      const factor = reducedMotion ? 0.18 : 1
      for (const swayer of swayers) {
        const amount = clamp(wind, 0, 1) * swayer.strength * factor
        swayer.object.rotation.z = Math.sin(elapsed * 1.25 + swayer.phase) * amount
        swayer.object.rotation.x = Math.cos(elapsed * 0.95 + swayer.phase * 0.7) * amount * 0.6
      }
    },
  }
}
