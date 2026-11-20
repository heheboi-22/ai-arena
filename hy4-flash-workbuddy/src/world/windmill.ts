import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three'
import type { Materials } from './materials'
import { clamp, TAU } from '../util/math'

function box(w: number, h: number, d: number, material: MeshStandardMaterial, x = 0, y = 0, z = 0): Mesh {
  const mesh = new Mesh(new BoxGeometry(w, h, d), material)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export interface WindmillHandle {
  group: Group
  update(dt: number, wind: number, reducedMotion: boolean): void
}

export function createWindmill(materials: Materials): WindmillHandle {
  const group = new Group()
  group.name = 'windmill'
  group.position.set(3.55, 0, -1.55)
  group.rotation.y = -0.18

  group.add(new Mesh(new CylinderGeometry(1.02, 1.12, 0.28, 10), materials.stone))
  group.children[0].position.y = 0.14
  group.children[0].castShadow = true

  const towerGeometry = new CylinderGeometry(0.56, 0.86, 3.45, 9, 1)
  const tower = new Mesh(towerGeometry, materials.cream)
  tower.position.y = 1.98
  tower.castShadow = true
  tower.receiveShadow = true
  group.add(tower)

  for (const y of [0.62, 2.05, 3.42]) {
    const band = new Mesh(new CylinderGeometry(y === 3.42 ? 0.6 : 0.79, y === 3.42 ? 0.63 : 0.82, 0.1, 9), materials.woodDark)
    band.position.y = y
    band.castShadow = true
    group.add(band)
  }

  const roof = new Mesh(new ConeGeometry(0.92, 0.92, 9), materials.roof)
  roof.position.y = 4.12
  roof.castShadow = true
  group.add(roof)
  const finial = new Mesh(new SphereGeometry(0.09, 10, 8), new MeshStandardMaterial({ color: 0xd7ae62, roughness: 0.5, metalness: 0.4 }))
  finial.position.y = 4.65
  group.add(finial)

  // A little door and a round window facing the path.
  group.add(box(0.46, 0.9, 0.08, materials.woodDark, 0, 0.72, 0.79))
  const window = new Mesh(new CylinderGeometry(0.15, 0.15, 0.07, 12), materials.glass)
  window.rotation.x = Math.PI / 2
  window.position.set(0, 2.65, 0.62)
  group.add(window)
  const windowRing = new Mesh(new CylinderGeometry(0.21, 0.21, 0.06, 12), materials.woodDark)
  windowRing.rotation.x = Math.PI / 2
  windowRing.position.set(0, 2.65, 0.59)
  group.add(windowRing)

  // Sail assembly, angled to read clearly from the opening camera view.
  const sailMount = new Group()
  sailMount.position.set(0, 2.85, 0.78)
  sailMount.rotation.y = 0.58
  group.add(sailMount)

  const hub = new Mesh(new CylinderGeometry(0.2, 0.2, 0.34, 10), materials.woodDark)
  hub.rotation.x = Math.PI / 2
  hub.castShadow = true
  sailMount.add(hub)

  const blades = new Group()
  blades.userData.noMerge = true
  sailMount.add(blades)
  for (let i = 0; i < 4; i++) {
    const blade = new Group()
    blade.rotation.z = (i / 4) * TAU
    blades.add(blade)
    blade.add(box(0.1, 2.65, 0.11, materials.woodDark, 0, 1.33, 0))
    blade.add(box(0.66, 1.95, 0.035, materials.sail, 0.36, 1.52, 0.04))
    for (let slat = 0; slat < 5; slat++) {
      blade.add(box(0.68, 0.035, 0.055, materials.wood, 0.36, 0.65 + slat * 0.42, 0.06))
    }
    blade.add(box(0.1, 0.42, 0.1, materials.wood, 0.36, 2.58, 0.06))
  }

  let angle = 0.6
  return {
    group,
    update(dt, wind, reducedMotion) {
      const speed = clamp(wind, 0, 1) * (reducedMotion ? 0.9 : 2.15) + 0.008
      angle = (angle + speed * dt) % TAU
      blades.rotation.z = angle
    },
  }
}
