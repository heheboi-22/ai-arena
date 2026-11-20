import { Color, Group, IcosahedronGeometry, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { mulberry32, smoothstep, TAU } from '../util/math'

const rng = mulberry32(909)

export interface CloudsHandle {
  group: Group
  update(dt: number, elapsed: number, wind: number, rain: number, reducedMotion: boolean, cameraPosition: Vector3): void
}

interface Cloud {
  group: Group
  speed: number
  bob: number
  baseY: number
  baseScale: number
  materials: MeshStandardMaterial[]
}

export function createClouds(lowPower: boolean): CloudsHandle {
  const group = new Group()
  group.name = 'clouds'
  const template = new MeshStandardMaterial({ color: 0xfbf7ee, roughness: 1, flatShading: true, transparent: true, opacity: 0.94, depthWrite: false })
  const shadeTemplate = new MeshStandardMaterial({ color: 0xe6e5df, roughness: 1, flatShading: true, transparent: true, opacity: 0.9, depthWrite: false })
  const geometry = new IcosahedronGeometry(1, 0)
  const clouds: Cloud[] = []

  const count = lowPower ? 5 : 8
  for (let i = 0; i < count; i++) {
    const cloud = new Group()
    const angle = (i / count) * TAU + rng() * 0.5
    const radius = 13 + rng() * 12
    const baseY = 8.2 + rng() * 3.2
    cloud.position.set(Math.cos(angle) * radius, baseY, Math.sin(angle) * radius)
    const materials = [template.clone(), shadeTemplate.clone()]
    const pieces = 3 + Math.floor(rng() * 3)
    for (let j = 0; j < pieces; j++) {
      const mesh = new Mesh(geometry, materials[j === 0 ? 1 : 0])
      mesh.position.set((j - pieces / 2) * 0.72 + (rng() - 0.5) * 0.4, (rng() - 0.5) * 0.5, (rng() - 0.5) * 0.7)
      mesh.scale.set(0.7 + rng() * 0.55, 0.38 + rng() * 0.3, 0.6 + rng() * 0.45)
      mesh.rotation.set(rng(), rng() * TAU, rng())
      cloud.add(mesh)
    }
    const scale = 0.55 + rng() * 0.45
    cloud.scale.setScalar(scale)
    group.add(cloud)
    clouds.push({ group: cloud, speed: 0.35 + rng() * 0.3, bob: rng() * TAU, baseY, baseScale: scale, materials })
  }

  const clearTop = new Color(0xfbf7ee)
  const clearShade = new Color(0xe6e5df)
  const stormTop = new Color(0x8a979f)
  const stormShade = new Color(0x6c7881)

  return {
    group,
    update(dt, elapsed, wind, rain, reducedMotion, cameraPosition) {
      const drift = reducedMotion ? 0.12 : 1
      const velocity = wind * 1.9 * drift
      for (const cloud of clouds) {
        cloud.group.position.x += velocity * cloud.speed * dt
        cloud.group.position.z += velocity * cloud.speed * 0.22 * dt
        if (cloud.group.position.x > 27) cloud.group.position.x = -27
        if (cloud.group.position.x < -27) cloud.group.position.x = 27
        if (cloud.group.position.z > 27) cloud.group.position.z = -27
        if (cloud.group.position.z < -27) cloud.group.position.z = 27
        cloud.group.position.y = cloud.baseY - rain * 0.7 + (reducedMotion ? 0 : Math.sin(elapsed * 0.35 + cloud.bob) * 0.12)
        cloud.group.scale.setScalar(cloud.baseScale * (1 + rain * 0.1))

        // Fade clouds that drift close to the camera so they never smother the
        // miniature, no matter where the viewer orbits.
        const distance = cloud.group.position.distanceTo(cameraPosition)
        const visibility = smoothstep(7, 13, distance)
        cloud.materials[0].opacity = (0.94 - rain * 0.06) * visibility
        cloud.materials[1].opacity = (0.9 - rain * 0.08) * visibility
        cloud.materials[0].color.copy(clearTop).lerp(stormTop, rain * 0.9)
        cloud.materials[1].color.copy(clearShade).lerp(stormShade, rain * 0.92)
      }
    },
  }
}
