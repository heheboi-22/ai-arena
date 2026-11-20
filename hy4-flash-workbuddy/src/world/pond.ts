import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import type { Materials } from './materials'
import { clamp, mulberry32, TAU } from '../util/math'

const rng = mulberry32(4004)
const CENTER = { x: 1.45, z: 2.15 }
const WATER_RADIUS = 2.18

export function pondRadius(theta: number): number {
  return WATER_RADIUS * (1 + 0.075 * Math.sin(3 * theta + 0.6) + 0.04 * Math.sin(7 * theta - 1.2))
}

function discGeometry(radiusFn: (theta: number) => number, segments: number, y: number): BufferGeometry {
  const positions = [0, y, 0]
  const uvs = [0.5, 0.5]
  const indices: number[] = []
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * TAU
    const radius = radiusFn(theta)
    const x = Math.cos(theta) * radius
    const z = Math.sin(theta) * radius
    positions.push(x, y, z)
    uvs.push(x / 5 + 0.5, z / 5 + 0.5)
  }
  for (let i = 0; i < segments; i++) indices.push(0, 1 + ((i + 1) % segments), 1 + i)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export interface PondHandle {
  group: Group
  update(dt: number, elapsed: number, rain: number, wind: number, sunDirection: Vector3, night: number, reducedMotion: boolean): void
  contains(x: number, z: number): boolean
}

export function createPond(materials: Materials, lowPower: boolean): PondHandle {
  const group = new Group()
  group.name = 'pond'
  group.position.set(CENTER.x, 0, CENTER.z)
  const segments = lowPower ? 40 : 64

  // Sandy shoreline, wider on the grass side, blending into the island top.
  const shorePositions: number[] = []
  const shoreColors: number[] = []
  const shoreUVs: number[] = []
  const shoreIndices: number[] = []
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * TAU
    const inner = pondRadius(theta) * 0.99
    const outer = pondRadius(theta) + 0.48 + 0.1 * Math.sin(theta * 5)
    for (const [radius, color] of [
      [inner, new Color(0xcbb68a)],
      [outer, new Color(0x8ba965)],
    ] as Array<[number, Color]>) {
      shorePositions.push(Math.cos(theta) * radius, 0.045, Math.sin(theta) * radius)
      shoreColors.push(color.r, color.g, color.b)
      shoreUVs.push(Math.cos(theta) * radius / 5 + 0.5, Math.sin(theta) * radius / 5 + 0.5)
    }
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2
    const next = ((i + 1) % segments) * 2
    shoreIndices.push(a, next, a + 1)
    shoreIndices.push(a + 1, next, next + 1)
  }
  const shoreGeometry = new BufferGeometry()
  shoreGeometry.setAttribute('position', new BufferAttribute(new Float32Array(shorePositions), 3))
  shoreGeometry.setAttribute('color', new BufferAttribute(new Float32Array(shoreColors), 3))
  shoreGeometry.setAttribute('uv', new BufferAttribute(new Float32Array(shoreUVs), 2))
  shoreGeometry.setIndex(shoreIndices)
  shoreGeometry.computeVertexNormals()
  const shore = new Mesh(shoreGeometry, new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.96, side: DoubleSide }))
  shore.receiveShadow = true
  group.add(shore)

  // Water: a tiny procedural shader with wind ripples and rain chop.
  const waterMaterial = new ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uRain: { value: 0 },
      uWind: { value: 0.3 },
      uNight: { value: 0 },
      uSunDirection: { value: new Vector3(-0.5, 1, 0.5).normalize() },
      uDeep: { value: new Color(0x4d8ea3) },
      uShallow: { value: new Color(0x9accc9) },
      uSky: { value: new Color(0xdfe9e4) },
    },
    vertexShader: `
      varying vec2 vPond;
      varying vec3 vWorld;
      void main() {
        vPond = position.xz;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uRain;
      uniform float uWind;
      uniform float uNight;
      uniform vec3 uSunDirection;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSky;
      varying vec2 vPond;
      varying vec3 vWorld;
      void main() {
        float t = uTime;
        float chop = 1.0 + uRain * 1.6 + uWind * 0.5;
        float wave = sin(vPond.x * (4.2 + uRain * 2.0) + t * 1.25) * 0.5
                   + cos(vPond.y * 4.8 - t * 0.95) * 0.5;
        float fine = sin(length(vPond) * 11.0 - t * 3.4 + uWind * 2.0) * (0.1 + uRain * 0.22);
        vec3 normal = normalize(vec3(
          (cos(vPond.x * 4.2 + t * 1.25) * 0.12 + fine * 0.25) * chop,
          1.0,
          (-sin(vPond.y * 4.8 - t * 0.95) * 0.12 + fine * 0.25) * chop
        ));
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.5);
        vec3 color = mix(uDeep, uShallow, clamp(wave * 0.28 + 0.5 + fine, 0.0, 1.0));
        color = mix(color, uSky, fresnel * 0.42);
        float spec = pow(max(dot(reflect(-normalize(uSunDirection), normal), viewDir), 0.0), 30.0);
        color += vec3(1.0, 0.93, 0.78) * spec * (0.32 - uNight * 0.16) * (1.0 - uRain * 0.55);
        float glint = smoothstep(0.86, 1.0, sin(vPond.x * 8.0 + vPond.y * 5.0 + t * 1.9)) * (0.05 + uRain * 0.09);
        color += vec3(glint);
        gl_FragColor = vec4(color, 0.94);
      }
    `,
  })
  const water = new Mesh(discGeometry(pondRadius, segments, 0.075), waterMaterial)
  water.name = 'pond-water'
  group.add(water)

  // Lily pads with tiny blossoms.
  const padGeometry = new CircleGeometry(0.23, 14, 0.32, TAU - 0.64)
  const blossomGeometry = new SphereGeometry(0.07, 8, 6)
  const blossomMaterial = new MeshStandardMaterial({ color: 0xf0b6c0, roughness: 0.8 })
  for (let i = 0; i < 7; i++) {
    const theta = (i / 7) * TAU + 0.4 + rng() * 0.3
    const radius = 0.9 + rng() * 0.85
    const pad = new Mesh(padGeometry, i % 3 === 0 ? materials.leafLight : materials.leafDark)
    pad.rotation.x = -Math.PI / 2
    pad.rotation.z = rng() * TAU
    pad.position.set(Math.cos(theta) * radius, 0.086, Math.sin(theta) * radius)
    pad.receiveShadow = true
    group.add(pad)
    if (i % 2 === 0) {
      const blossom = new Mesh(blossomGeometry, blossomMaterial)
      blossom.position.set(pad.position.x + 0.06, 0.13, pad.position.z + 0.03)
      blossom.scale.set(1, 0.65, 1)
      group.add(blossom)
    }
  }

  // Reeds around the shore.
  for (let i = 0; i < 18; i++) {
    const theta = rng() * TAU
    const radius = pondRadius(theta) + 0.1 + rng() * 0.3
    const height = 0.32 + rng() * 0.42
    const reed = new Mesh(new CylinderGeometry(0.008, 0.021, height, 5), i % 3 === 0 ? materials.wood : materials.leafDark)
    reed.position.set(Math.cos(theta) * radius, 0.045 + height / 2, Math.sin(theta) * radius)
    reed.rotation.z = (rng() - 0.5) * 0.3
    group.add(reed)
    if (i % 4 === 0) {
      const tip = new Mesh(new CylinderGeometry(0.035, 0.025, 0.14, 6), materials.woodDark)
      tip.position.set(reed.position.x, 0.045 + height + 0.04, reed.position.z)
      group.add(tip)
    }
  }

  // A little footbridge across the middle of the pond.
  const bridge = new Group()
  bridge.position.set(-0.15, 0, 0.05)
  bridge.rotation.y = 0.12
  group.add(bridge)
  for (let i = 0; i < 11; i++) {
    const plank = new Mesh(new BoxGeometry(0.28, 0.075, 1.18), materials.wood)
    plank.position.set(-1.45 + i * 0.29, 0.34 + Math.sin(i * 0.9) * 0.012, 0)
    plank.castShadow = true
    plank.receiveShadow = true
    bridge.add(plank)
  }
  for (const z of [-0.56, 0.56]) {
    const rail = new Mesh(new BoxGeometry(3.35, 0.075, 0.075), materials.woodDark)
    rail.position.set(0, 0.68, z)
    rail.castShadow = true
    bridge.add(rail)
    for (const x of [-1.45, -0.5, 0.5, 1.45]) {
      const post = new Mesh(new BoxGeometry(0.075, 0.55, 0.075), materials.woodDark)
      post.position.set(x, 0.52, z)
      post.castShadow = true
      bridge.add(post)
    }
  }

  // A moored rowing boat.
  const boat = new Group()
  boat.userData.noMerge = true
  boat.position.set(0.85, 0.13, 1.05)
  boat.rotation.y = -0.55
  group.add(boat)
  const hull = new Mesh(new SphereGeometry(0.5, 14, 8), materials.wood)
  hull.scale.set(1.5, 0.32, 0.62)
  hull.castShadow = true
  boat.add(hull)
  const inner = new Mesh(new SphereGeometry(0.5, 14, 8), materials.woodDark)
  inner.scale.set(1.3, 0.22, 0.46)
  inner.position.y = 0.1
  boat.add(inner)
  const seat = new Mesh(new BoxGeometry(0.07, 0.06, 0.62), materials.wood)
  seat.position.y = 0.16
  boat.add(seat)
  const oar = new Mesh(new CylinderGeometry(0.022, 0.022, 1.2, 6), materials.woodDark)
  oar.rotation.z = 0.5
  oar.rotation.y = 0.35
  oar.position.set(0.25, 0.25, 0.2)
  boat.add(oar)

  // Pooled ripple rings: created once, recycled forever.
  const rippleCount = lowPower ? 12 : 22
  const ripples: Array<{ mesh: Mesh; age: number; life: number; active: boolean }> = []
  const rippleGeometry = new RingGeometry(0.34, 0.4, 28)
  for (let i = 0; i < rippleCount; i++) {
    const material = new MeshBasicMaterial({ color: 0xe8f6f2, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide })
    const mesh = new Mesh(rippleGeometry, material)
    mesh.rotation.x = -Math.PI / 2
    mesh.visible = false
    mesh.userData.noMerge = true
    mesh.position.y = 0.088
    group.add(mesh)
    ripples.push({ mesh, age: 0, life: 1, active: false })
  }
  let spawnTimer = 0

  return {
    group,
    contains(x, z) {
      const dx = x - CENTER.x
      const dz = z - CENTER.z
      const theta = Math.atan2(dz, dx)
      return Math.hypot(dx, dz) < pondRadius(theta) * 1.02
    },
    update(dt, elapsed, rain, wind, sunDirection, night, reducedMotion) {
      waterMaterial.uniforms.uTime.value = elapsed
      waterMaterial.uniforms.uRain.value = rain
      waterMaterial.uniforms.uWind.value = wind
      waterMaterial.uniforms.uNight.value = night
      ;(waterMaterial.uniforms.uSunDirection.value as Vector3).copy(sunDirection)
      ;(waterMaterial.uniforms.uDeep.value as Color).set(0x4d8ea3).lerp(new Color(0x263e5e), night * 0.65 + rain * 0.1)
      ;(waterMaterial.uniforms.uShallow.value as Color).set(0x9accc9).lerp(new Color(0x526b8d), night * 0.6 + rain * 0.15)
      ;(waterMaterial.uniforms.uSky.value as Color).set(0xdfe9e4).lerp(new Color(0x6c86a4), night * 0.65 + rain * 0.2)

      boat.position.y = 0.13 + Math.sin(elapsed * (reducedMotion ? 0.4 : 1.1)) * 0.018 * (1 + rain)
      boat.rotation.z = Math.sin(elapsed * 0.7) * 0.02 * (1 + wind)

      if (rain > 0.08 && !reducedMotion) {
        spawnTimer += dt * (2.2 + rain * 4.5)
        while (spawnTimer >= 1) {
          spawnTimer -= 1
          const ripple = ripples.find((candidate) => !candidate.active)
          if (!ripple) continue
          const theta = rng() * TAU
          const radius = Math.sqrt(rng()) * 1.65
          ripple.mesh.position.set(Math.cos(theta) * radius, 0.088, Math.sin(theta) * radius)
          ripple.mesh.visible = true
          ripple.age = 0
          ripple.life = 0.85 + rng() * 0.45
          ripple.active = true
        }
      } else {
        spawnTimer = 0
      }
      for (const ripple of ripples) {
        if (!ripple.active) continue
        ripple.age += dt
        const t = ripple.age / ripple.life
        if (t >= 1) {
          ripple.active = false
          ripple.mesh.visible = false
          ;(ripple.mesh.material as MeshBasicMaterial).opacity = 0
          continue
        }
        const scale = 0.25 + t * 1.55
        ripple.mesh.scale.set(scale, scale, 1)
        ;(ripple.mesh.material as MeshBasicMaterial).opacity = Math.sin(t * Math.PI) * 0.38 * rain
      }
    },
  }
}
