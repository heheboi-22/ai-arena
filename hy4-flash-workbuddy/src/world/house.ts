import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  Shape,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
} from 'three'
import type { Materials } from './materials'
import { glowTexture } from './textures'
import { mulberry32 } from '../util/math'

const rng = mulberry32(881)

function box(width: number, height: number, depth: number, material: MeshStandardMaterial, x = 0, y = 0, z = 0): Mesh {
  const mesh = new Mesh(new BoxGeometry(width, height, depth), material)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export interface HouseHandle {
  group: Group
  update(lights: number, night: number, elapsed: number, wind: number, reducedMotion: boolean): void
}

export function createHouse(materials: Materials): HouseHandle {
  const group = new Group()
  group.name = 'cottage'
  group.position.set(-2.65, 0, -1.65)
  group.rotation.y = 0.14

  // Foundation and warm plaster walls.
  group.add(box(3.45, 0.34, 2.85, materials.stone, 0, 0.17, 0))
  group.add(box(3.14, 2.3, 2.54, materials.cream, 0, 1.49, 0))

  // Half-timber framing.
  for (const x of [-1.52, 1.52]) {
    for (const z of [-1.23, 1.23]) group.add(box(0.14, 2.36, 0.14, materials.woodDark, x, 1.49, z))
  }
  for (const z of [-1.27, 1.27]) {
    group.add(box(3.12, 0.12, 0.1, materials.woodDark, 0, 2.55, z))
    group.add(box(3.12, 0.1, 0.1, materials.woodDark, 0, 0.62, z))
  }
  for (const x of [-1.58, 1.58]) {
    group.add(box(0.1, 0.12, 2.5, materials.woodDark, x, 2.55, 0))
    group.add(box(0.1, 0.1, 2.5, materials.woodDark, x, 0.62, 0))
  }
  // Decorative braces on the front gable.
  const braceLeft = box(0.09, 0.9, 0.09, materials.woodDark, -0.95, 2.95, 1.3)
  braceLeft.rotation.z = 0.72
  group.add(braceLeft)
  const braceRight = box(0.09, 0.9, 0.09, materials.woodDark, 0.95, 2.95, 1.3)
  braceRight.rotation.z = -0.72
  group.add(braceRight)

  // Gable ends and a shingled roof.
  const gableShape = new Shape()
  gableShape.moveTo(-1.6, 2.6)
  gableShape.lineTo(1.6, 2.6)
  gableShape.lineTo(0, 3.62)
  gableShape.closePath()
  const gableGeometry = new ExtrudeGeometry(gableShape, { depth: 0.12, bevelEnabled: false })
  const frontGable = new Mesh(gableGeometry, materials.cream)
  frontGable.position.z = 1.27
  frontGable.castShadow = true
  group.add(frontGable)
  const backGable = new Mesh(gableGeometry, materials.cream)
  backGable.position.z = -1.39
  backGable.castShadow = true
  group.add(backGable)

  const roofSlope = Math.atan2(1.05, 1.6)
  const slopeLength = Math.hypot(1.6, 1.05) + 0.22
  for (const side of [-1, 1]) {
    const plane = box(slopeLength, 0.13, 3.15, materials.roof, side * 0.8, 3.13, 0)
    plane.rotation.z = side * -roofSlope
    group.add(plane)
  }
  const ridge = new Mesh(new CylinderGeometry(0.095, 0.095, 3.2, 8), materials.woodDark)
  ridge.rotation.x = Math.PI / 2
  ridge.position.set(0, 3.66, 0)
  ridge.castShadow = true
  group.add(ridge)

  // Chimney with a cap and a warm brick band.
  const chimney = box(0.5, 1.15, 0.5, materials.stone, 0.88, 3.4, -0.55)
  group.add(chimney)
  group.add(box(0.66, 0.13, 0.66, materials.woodDark, 0.88, 4.01, -0.55))
  group.add(box(0.54, 0.12, 0.54, materials.roof, 0.88, 3.13, -0.55))

  // Front door, plank lines, knob and a little stone step.
  const door = box(0.88, 1.56, 0.1, materials.woodDark, -0.62, 1.1, 1.32)
  group.add(door)
  const doorTop = new Mesh(new CylinderGeometry(0.44, 0.44, 0.1, 16, 1, false, 0, Math.PI), materials.woodDark)
  doorTop.rotation.x = Math.PI / 2
  doorTop.position.set(-0.62, 1.88, 1.32)
  group.add(doorTop)
  for (let i = 0; i < 4; i++) group.add(box(0.015, 1.42, 0.012, materials.frame, -0.93 + i * 0.21, 1.1, 1.38))
  const knob = new Mesh(new SphereGeometry(0.055, 10, 8), new MeshStandardMaterial({ color: 0xd8ae61, roughness: 0.4, metalness: 0.55 }))
  knob.position.set(-0.32, 1.08, 1.4)
  group.add(knob)
  group.add(box(1.2, 0.12, 0.55, materials.stone, -0.62, 0.07, 1.55))

  // Porch awning and its two posts.
  const porch = box(1.5, 0.1, 0.85, materials.roof, -0.62, 2.12, 1.62)
  porch.rotation.x = -0.12
  group.add(porch)
  for (const x of [-1.22, -0.02]) group.add(box(0.09, 1.55, 0.09, materials.wood, x, 1.34, 1.95))

  // Windows: frames, amber glass, mullions, sills and flower boxes.
  const glowSprites: Sprite[] = []
  const glowMap = glowTexture()
  const addWindow = (x: number, y: number, z: number, rotationY: number, width = 0.76, height = 0.84) => {
    const windowGroup = new Group()
    windowGroup.position.set(x, y, z)
    windowGroup.rotation.y = rotationY
    windowGroup.add(box(width + 0.16, height + 0.16, 0.1, materials.woodDark, 0, 0, 0))
    const glass = new Mesh(new BoxGeometry(width, height, 0.03), materials.glass)
    glass.position.z = 0.068
    windowGroup.add(glass)
    windowGroup.add(box(0.045, height, 0.035, materials.frame, 0, 0, 0.086))
    windowGroup.add(box(width, 0.045, 0.035, materials.frame, 0, 0, 0.086))
    windowGroup.add(box(width + 0.26, 0.09, 0.22, materials.stone, 0, -height / 2 - 0.12, 0.06))
    // Tiny flower box.
    windowGroup.add(box(width + 0.1, 0.18, 0.18, materials.wood, 0, -height / 2 - 0.3, 0.12))
    const petalColors = [0xd9796f, 0xe9bd6c, 0xb58bc4, 0xf0e2c8]
    for (let i = 0; i < 5; i++) {
      const flower = new Mesh(
        new SphereGeometry(0.055, 6, 5),
        new MeshBasicMaterial({ color: petalColors[Math.floor(rng() * petalColors.length)] }),
      )
      flower.position.set(-width / 2 + 0.13 + i * (width - 0.25) / 4, -height / 2 - 0.16, 0.19)
      windowGroup.add(flower)
    }
    const glow = new Sprite(new SpriteMaterial({
      map: glowMap,
      color: new Color(0xffbb70),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }))
    glow.scale.set(2.1, 2.1, 1)
    glow.position.z = 0.16
    glow.raycast = () => {}
    windowGroup.add(glow)
    glowSprites.push(glow)
    group.add(windowGroup)
  }

  addWindow(0.78, 1.78, 1.3, 0)
  addWindow(1.59, 1.78, 0.2, Math.PI / 2, 0.7, 0.8)
  addWindow(-1.59, 1.78, 0.35, -Math.PI / 2, 0.7, 0.8)

  const lamp = new PointLight(0xffb36a, 0, 7, 2)
  lamp.position.set(-0.1, 1.7, 0.6)
  group.add(lamp)

  // Chimney smoke: pooled sprites that recycle instead of accumulating.
  const smokeMap = glowMap
  const smoke: Array<{ sprite: Sprite; seed: number }> = []
  for (let i = 0; i < 7; i++) {
    const sprite = new Sprite(new SpriteMaterial({
      map: smokeMap,
      color: new Color(0xe4ded2),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }))
    sprite.raycast = () => {}
    sprite.scale.setScalar(0.5)
    group.add(sprite)
    smoke.push({ sprite, seed: i / 7 })
  }

  return {
    group,
    update(lights, night, elapsed, wind, reducedMotion) {
      materials.glass.emissiveIntensity = 0.02 + lights * (0.7 + night * 1.5)
      lamp.intensity = lights * (0.35 + night * 1.5)
      for (const glow of glowSprites) {
        const material = glow.material as SpriteMaterial
        material.opacity = lights * (0.18 + night * 0.4)
      }
      const smokeSpeed = reducedMotion ? 0.16 : 0.32
      for (const puff of smoke) {
        const phase = (puff.seed + elapsed * smokeSpeed * (0.6 + wind * 0.9)) % 1
        const sway = Math.sin(phase * 5.5 + puff.seed * 8) * (reducedMotion ? 0.05 : 0.16)
        puff.sprite.position.set(
          0.88 + phase * (0.25 + wind * 1.1) + sway,
          4.08 + phase * 1.85,
          -0.55 + Math.cos(phase * 4 + puff.seed * 6) * 0.1,
        )
        const scale = 0.34 + phase * 0.95
        puff.sprite.scale.set(scale, scale, 1)
        ;(puff.sprite.material as SpriteMaterial).opacity = Math.sin(phase * Math.PI) * (0.14 + wind * 0.06)
      }
    },
  }
}
