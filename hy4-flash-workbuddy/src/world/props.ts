import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three'
import type { Materials } from './materials'
import { glowTexture } from './textures'
import { clamp, mulberry32, TAU } from '../util/math'

const rng = mulberry32(1337)

export interface PropsHandle {
  group: Group
  update(night: number, lights: number, rain: number): void
}

export function createProps(materials: Materials): PropsHandle {
  const group = new Group()
  group.name = 'props'

  // Curving stepping-stone path from the cottage door to the footbridge.
  const path = new Group()
  group.add(path)
  const start = new Vector3(-3.05, 0, -0.15)
  const control = new Vector3(-1.75, 0, 0.05)
  const end = new Vector3(-0.1, 0, 2.05)
  for (let i = 0; i < 17; i++) {
    const t = i / 16
    const x = (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x
    const z = (1 - t) ** 2 * start.z + 2 * (1 - t) * t * control.z + t ** 2 * end.z
    const stone = new Mesh(new CylinderGeometry(0.24 + rng() * 0.08, 0.27 + rng() * 0.08, 0.06, 7), materials.stone)
    stone.position.set(x + (rng() - 0.5) * 0.17, 0.045, z + (rng() - 0.5) * 0.17)
    stone.rotation.y = rng() * TAU
    stone.scale.z = 0.8 + rng() * 0.35
    stone.receiveShadow = true
    path.add(stone)
  }

  // Two short fence runs frame the front of the island without boxing it in.
  const addFence = (x1: number, z1: number, x2: number, z2: number, posts: number) => {
    const fence = new Group()
    const dx = x2 - x1
    const dz = z2 - z1
    const length = Math.hypot(dx, dz)
    fence.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2)
    fence.rotation.y = Math.atan2(dx, dz)
    for (let i = 0; i < posts; i++) {
      const t = i / (posts - 1)
      const post = new Mesh(new BoxGeometry(0.1, 0.62, 0.1), materials.woodDark)
      post.position.set(0, 0.31, -length / 2 + t * length)
      post.castShadow = true
      fence.add(post)
      const cap = new Mesh(new CylinderGeometry(0.075, 0.075, 0.06, 6), materials.wood)
      cap.position.set(0, 0.64, post.position.z)
      fence.add(cap)
    }
    for (const y of [0.27, 0.5]) {
      const rail = new Mesh(new BoxGeometry(0.055, 0.07, length), materials.wood)
      rail.position.set(0, y, 0)
      rail.castShadow = true
      fence.add(rail)
    }
    group.add(fence)
  }
  addFence(-5.55, 2.15, -3.45, 3.9, 6)
  addFence(4.05, 3.55, 5.75, 1.85, 5)

  // Scattered pebbles and a small woodpile by the cottage.
  const pebbleGeometry = new IcosahedronGeometry(0.3, 0)
  for (let i = 0; i < 30; i++) {
    const theta = rng() * TAU
    const radius = 2.5 + rng() * 4.2
    const x = Math.cos(theta) * radius
    const z = Math.sin(theta) * radius
    if (Math.hypot(x - 1.45, z - 2.15) < 2.7) continue
    if (x > -4.8 && x < -0.4 && z > -3.3 && z < 0.5) continue
    const stone = new Mesh(pebbleGeometry, i % 4 === 0 ? materials.soil : materials.stone)
    stone.position.set(x, 0.09, z)
    const scale = 0.22 + rng() * 0.42
    stone.scale.set(scale, scale * (0.45 + rng() * 0.4), scale * (0.8 + rng() * 0.5))
    stone.rotation.set(rng() * 3, rng() * 3, rng() * 3)
    stone.castShadow = true
    group.add(stone)
  }
  const woodpile = new Group()
  woodpile.position.set(-4.5, 0, -0.85)
  woodpile.rotation.y = 0.3
  group.add(woodpile)
  const logGeometry = new CylinderGeometry(0.12, 0.12, 0.72, 7)
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 3 - row; i++) {
      const log = new Mesh(logGeometry, materials.woodDark)
      log.rotation.z = Math.PI / 2
      log.position.set(0, 0.13 + row * 0.22, -0.25 + i * 0.25 + row * 0.12)
      log.castShadow = true
      woodpile.add(log)
    }
  }

  // A hand-painted signpost near the path.
  const sign = new Group()
  sign.position.set(-2.05, 0, 1.25)
  sign.rotation.y = -0.35
  group.add(sign)
  const signPost = new Mesh(new CylinderGeometry(0.055, 0.07, 1.2, 7), materials.woodDark)
  signPost.position.y = 0.6
  signPost.castShadow = true
  sign.add(signPost)
  const board = new Mesh(new BoxGeometry(0.8, 0.36, 0.07), materials.wood)
  board.position.set(0.18, 1.0, 0)
  board.rotation.z = -0.05
  board.castShadow = true
  sign.add(board)
  const chevron = new Mesh(new BoxGeometry(0.26, 0.045, 0.03), materials.woodDark)
  chevron.position.set(0.25, 1.0, 0.05)
  chevron.rotation.z = 0.6
  sign.add(chevron)
  const chevron2 = chevron.clone()
  chevron2.position.y = 0.91
  chevron2.rotation.z = -0.6
  sign.add(chevron2)

  // Path lanterns glow automatically at dusk and brighten with the house.
  const lanternBulbs: MeshStandardMaterial[] = []
  const lanternGlows: SpriteMaterial[] = []
  const lanternMap = glowTexture()
  for (const [x, z] of [[-2.4, 0.5], [0.2, 1.35], [3.9, 2.9]] as Array<[number, number]>) {
    const lantern = new Group()
    lantern.position.set(x, 0, z)
    group.add(lantern)
    const post = new Mesh(new CylinderGeometry(0.045, 0.06, 1.15, 6), materials.woodDark)
    post.position.y = 0.58
    post.castShadow = true
    lantern.add(post)
    const arm = new Mesh(new BoxGeometry(0.32, 0.05, 0.05), materials.woodDark)
    arm.position.set(0.14, 1.13, 0)
    lantern.add(arm)
    const bulbMaterial = new MeshStandardMaterial({ color: 0xffe2a8, emissive: new Color(0xffb45c), emissiveIntensity: 0 })
    const bulb = new Mesh(new BoxGeometry(0.2, 0.26, 0.2), bulbMaterial)
    bulb.position.set(0.28, 0.95, 0)
    lantern.add(bulb)
    lanternBulbs.push(bulbMaterial)
    const glowMaterial = new SpriteMaterial({ map: lanternMap, color: new Color(0xffc477), transparent: true, opacity: 0, depthWrite: false })
    const glow = new Sprite(glowMaterial)
    glow.scale.setScalar(1.5)
    glow.position.copy(bulb.position)
    glow.raycast = () => {}
    lantern.add(glow)
    lanternGlows.push(glowMaterial)
  }

  return {
    group,
    update(night, lights, rain) {
      const level = clamp(night * 0.8 + lights * 0.25, 0, 1) * (1 - rain * 0.15)
      for (const material of lanternBulbs) material.emissiveIntensity = level * 1.8
      for (const material of lanternGlows) material.opacity = level * 0.42
    },
  }
}
