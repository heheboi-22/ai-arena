import {
  BufferGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
  Scene,
} from 'three'
import { coastRadius } from '../world/island'
import { mulberry32, TAU } from '../util/math'

interface Drop {
  x: number
  y: number
  z: number
  speed: number
}

export interface RainHandle {
  update(dt: number, rain: number, wind: number): void
  count: number
}

export function createRain(scene: Scene, lowPower: boolean): RainHandle {
  const count = lowPower ? 420 : 900
  const rng = mulberry32(31415)
  const drops: Drop[] = []
  const positions = new Float32Array(count * 6)
  const recycle = (drop: Drop, initial: boolean) => {
    const theta = rng() * TAU
    const radius = Math.sqrt(rng()) * 13.5
    drop.x = Math.cos(theta) * radius
    drop.z = Math.sin(theta) * radius
    drop.y = initial ? -5 + rng() * 20 : 10 + rng() * 6
    drop.speed = 9 + rng() * 7
  }
  for (let i = 0; i < count; i++) {
    const drop = { x: 0, y: 0, z: 0, speed: 0 }
    recycle(drop, true)
    drops.push(drop)
  }

  const geometry = new BufferGeometry()
  const attribute = new Float32BufferAttribute(positions, 3)
  attribute.setUsage(DynamicDrawUsage)
  geometry.setAttribute('position', attribute)
  const material = new LineBasicMaterial({ color: 0xc4dce9, transparent: true, opacity: 0, depthWrite: false })
  const rain = new LineSegments(geometry, material)
  rain.frustumCulled = false
  rain.visible = false
  rain.name = 'rain'
  scene.add(rain)

  return {
    count,
    update(dt, intensity, wind) {
      material.opacity = intensity * 0.46
      rain.visible = intensity > 0.015
      if (!rain.visible) return

      const slantX = wind * 0.42
      const slantZ = wind * 0.1
      for (let i = 0; i < count; i++) {
        const drop = drops[i]
        drop.y -= drop.speed * dt
        drop.x += slantX * drop.speed * dt
        drop.z += slantZ * drop.speed * dt

        // Recycle on impact with the island rather than letting streaks pass
        // through the miniature forever.
        const theta = Math.atan2(drop.z, drop.x)
        const overIsland = Math.hypot(drop.x, drop.z) < coastRadius(theta)
        if ((overIsland && drop.y < 0.1) || drop.y < -5.5 || Math.abs(drop.x) > 17 || Math.abs(drop.z) > 17) {
          recycle(drop, false)
        }

        const offset = i * 6
        positions[offset] = drop.x
        positions[offset + 1] = drop.y
        positions[offset + 2] = drop.z
        positions[offset + 3] = drop.x - slantX * 0.52
        positions[offset + 4] = drop.y + 0.52
        positions[offset + 5] = drop.z - slantZ * 0.52
      }
      attribute.needsUpdate = true
    },
  }
}
