import * as T from 'three'
import { faceGeometry, ground, mesh, random, TAU, v } from './model'
import { insideIsland, inPond, pond } from './terrain'
import type { WorldState } from '../state'

const rand = random(962)
const smooth = (a: number, b: number, n: number) => T.MathUtils.smoothstep(n, a, b)
export function makeAtmosphere(scene: T.Scene, compact: boolean) {
  const sun = new T.DirectionalLight('#ffead1', 2.35)
  sun.castShadow = true
  const shadow = compact ? 1024 : 2048
  sun.shadow.mapSize.set(shadow, shadow)
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.1, far: 45 })
  sun.shadow.normalBias = 0.018
  sun.shadow.bias = -0.00035
  sun.shadow.radius = 2
  scene.add(sun, sun.target)
  const hemi = new T.HemisphereLight('#f3f2da', '#809b91', 1.55)
  const rim = new T.DirectionalLight('#e4efe4', 0.75)
  rim.position.set(3.5, 6, -6)
  scene.add(hemi, rim)
  const puffMat = new T.MeshStandardMaterial({ color: '#c2cebf', roughness: 1, side: T.DoubleSide })
  // Sample a single scalloped envelope to join the cloud lobes into a soft silhouette.
  const cloudPoints: number[] = []
  const lobes = [
    [-0.77, 0.15, 0.45, 0.22],
    [-0.42, 0.22, 0.45, 0.32],
    [0.04, 0.3, 0.53, 0.44],
    [0.49, 0.22, 0.42, 0.31],
    [0.83, 0.12, 0.39, 0.18],
  ]
  let previous: T.Vector3[] = []
  for (let i = 0; i <= 32; i++) {
    const x = -1.219 + (i * 2.438) / 32
    const ring = Array.from({ length: 14 }, (_, j) => {
      const a = (j / 14) * TAU,
        dy = Math.sin(a),
        dz = Math.cos(a)
      let best = 0.001
      for (const [cx, cy, rx, ry] of lobes) {
        const ay = dy / ry,
          az = dz / (ry * 1.25),
          oy = (0.12 - cy) / ry
        const A = ay * ay + az * az,
          B = 2 * oy * ay,
          C = ((x - cx) / rx) ** 2 + oy * oy - 1,
          disc = B * B - 4 * A * C
        if (disc > 0) best = Math.max(best, (-B + Math.sqrt(disc)) / (2 * A))
      }
      return v(x, 0.12 + dy * best * (dy < 0 ? 0.58 : 1), dz * best)
    })
    if (i)
      for (let j = 0; j < 14; j++) {
        const k = (j + 1) % 14
        for (const p of [previous[j], ring[k], ring[j], previous[j], previous[k], ring[k]])
          cloudPoints.push(p.x, p.y, p.z)
      }
    previous = ring
  }
  const cloudGeometry = faceGeometry(cloudPoints)
  function cloud(x: number, y: number, z: number, size: number) {
    const group = new T.Group()
    mesh(group, cloudGeometry, puffMat)
    group.scale.setScalar(size)
    group.position.set(x, y, z)
    group.rotation.y = (rand() - 0.5) * 0.36
    for (const m of group.children) {
      m.castShadow = false
      m.receiveShadow = false
    }
    scene.add(group)
    return { group, x, y, z, phase: rand() * TAU }
  }
  const clouds = [
    cloud(-5.64, 1.49, 0.25, 0.78),
    cloud(4.05, 2.98, -2.45, 0.89),
    cloud(5.63, -0.94, 0.61, 0.53),
  ]
  clouds.forEach((cloud, i) => (cloud.group.name = 'Cloud ' + (i + 1)))
  // Fixed-size buffers keep weather changes interruptible without allocating particles.
  const count = compact ? 230 : 400
  const drops = new Float32Array(count * 6)
  function respawn(i: number, initial: boolean) {
    const offset = i * 6
    drops[offset] = (rand() - 0.5) * 11.7
    drops[offset + 1] = initial ? 1 + rand() * 6.25 : 4.7 + rand() * 2.6
    drops[offset + 2] = (rand() - 0.5) * 7.8
  }
  for (let i = 0; i < count; i++) respawn(i, true)
  const rainGeo = new T.BufferGeometry(),
    rainAttr = new T.BufferAttribute(drops, 3).setUsage(T.DynamicDrawUsage)
  rainGeo.setAttribute('position', rainAttr)
  const rainMat = new T.LineBasicMaterial({
    color: '#c3dcdf',
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  const rain = new T.LineSegments(rainGeo, rainMat)
  rain.frustumCulled = false
  scene.add(rain)
  rain.name = 'Rain'
  const ringGeo = new T.RingGeometry(0.91, 1, 24)
  ringGeo.rotateX(-Math.PI / 2)
  const rippleMat = new T.MeshBasicMaterial({
    color: '#bcd7c8',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: T.DoubleSide,
  })
  const rippleCount = compact ? 14 : 23
  const ripples = new T.InstancedMesh(ringGeo, rippleMat, rippleCount)
  ripples.name = 'Pond ripples'
  const ripplesAt = Array.from({ length: rippleCount }, () => {
    let x = 0,
      z = 0
    do {
      x = pond.x + (rand() - 0.5) * pond.rx * 2
      z = pond.z + (rand() - 0.5) * pond.rz * 2
    } while (!inPond(x, z, 0.76))
    return { x, z, t: rand(), speed: 0.6 + rand() * 0.75 }
  })
  const dummy = new T.Object3D()
  ripples.frustumCulled = false
  scene.add(ripples)
  const skyDust: number[] = []
  for (let i = 0; i < 200; i++)
    skyDust.push((rand() - 0.5) * 38, (rand() - 0.45) * 20, -7 - rand() * 8)
  const starGeo = new T.BufferGeometry()
  starGeo.setAttribute('position', new T.Float32BufferAttribute(skyDust, 3))
  const starMat = new T.PointsMaterial({
    color: '#d3caa2',
    size: 0.025,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  })
  scene.add(new T.Points(starGeo, starMat))
  // Fine engraved arcs below the floating shelf.
  const orbitPoints: T.Vector3[] = []
  for (let i = 0; i <= 200; i++) {
    const a = (i / 200) * TAU
    orbitPoints.push(v(Math.cos(a) * 5.92, -3.0, Math.sin(a) * 3.99))
  }
  const orbitGeo = new T.BufferGeometry().setFromPoints(orbitPoints)
  const orbit = new T.Line(
    orbitGeo,
    new T.LineDashedMaterial({
      color: '#a9b89b',
      transparent: true,
      opacity: 0.32,
      dashSize: 0.05,
      gapSize: 0.11,
      depthWrite: false,
    }),
  )
  orbit.computeLineDistances()
  scene.add(orbit)
  // Soft contact beneath the model makes its suspension legible without a ground plane.
  const texCanvas = document.createElement('canvas')
  texCanvas.width = texCanvas.height = 128
  const ctx = texCanvas.getContext('2d')!,
    gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(4,18,20,0.7)')
  gradient.addColorStop(0.55, 'rgba(5,19,20,.4)')
  gradient.addColorStop(1, 'rgba(9,22,22,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  const tex = new T.CanvasTexture(texCanvas)
  tex.colorSpace = T.SRGBColorSpace
  const shade = new T.Mesh(
    new T.PlaneGeometry(11.1, 7.7),
    new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.64 }),
  )
  shade.rotation.x = -Math.PI / 2
  shade.position.y = -3.18
  scene.add(shade)
  let cloudPhase = 0
  const tint = new T.Color(),
    night = new T.Color(),
    warm = new T.Color(),
    rainColor = new T.Color()
  const sky = [new T.Color(), new T.Color(), new T.Color()]
  const app = document.getElementById('app')!
  const daySky = ['#10282c', '#21413e', '#345447'],
    nightSky = ['#0c1525', '#192f41', '#294555'],
    duskSky = ['#312c37', '#625052', '#9a7962'],
    rainSky = ['#172a32', '#2e454b', '#4e6565']
  let lastSky = ''
  return {
    update(
      dt: number,
      hour: number,
      wet: number,
      wind: number,
      reduced: boolean,
      state: WorldState,
    ) {
      const angle = ((hour - 6) / 24) * TAU,
        alt = Math.sin(angle)
      const day = smooth(-0.2, 0.27, alt),
        dusk = (1 - smooth(0.0, 0.44, Math.abs(alt))) * 0.93
      // Keep a cool directional fill at night, with a moving warm key during the day.
      sun.position.set(
        9 * Math.cos(angle),
        4 + Math.max(0, alt) * 9,
        5.8 + Math.cos(angle + 0.8) * 2.4,
      )
      sun.intensity = (T.MathUtils.lerp(0.73, 2.52, day) + dusk * 0.95) * (1 - wet * 0.65)
      sun.color.copy(
        tint.set('#abc9f6').lerp(night.set('#fbe9c9'), day).lerp(warm.set('#ffb07a'), dusk),
      )
      hemi.intensity = (T.MathUtils.lerp(0.82, 1.63, day) + dusk * 0.22) * (1 - wet * 0.12)
      hemi.color.copy(
        tint
          .set('#e9f0dd')
          .lerp(night.set('#a6bfe1'), 1 - day)
          .lerp(warm.set('#f6cfb2'), dusk * 0.76)
          .lerp(rainColor.set('#d0dde3'), wet * 0.4),
      )
      hemi.groundColor.set('#9a9e86').lerp(night.set('#637d97'), 1 - day)
      rim.intensity = 0.4 + 0.44 * day
      puffMat.color
        .set('#c5d2c4')
        .lerp(night.set('#687f90'), 1 - day)
        .lerp(warm.set('#dfb9a6'), dusk * 0.9)
        .lerp(rainColor.set('#6e8083'), wet * 0.84)
      for (let k = 0; k < 3; k++)
        sky[k]
          .set(nightSky[k])
          .lerp(tint.set(daySky[k]), day)
          .lerp(warm.set(duskSky[k]), dusk * 0.89)
          .lerp(rainColor.set(rainSky[k]).multiplyScalar(0.42 + 0.58 * day), wet * 0.69)
      const colors = sky.map((c) => c.getHexString()),
        key = colors.join('')
      if (key !== lastSky) {
        ;['--sky-edge', '--sky-mid', '--sky-glow'].forEach((prop, i) =>
          app.style.setProperty(prop, '#' + colors[i]),
        )
        lastSky = key
      }
      cloudPhase += dt * wind * (reduced ? 0.13 : 1) * 0.27
      for (const c of clouds) {
        c.group.position.set(
          c.x + Math.sin(cloudPhase + c.phase) * 0.43,
          c.y + Math.sin(cloudPhase * 0.65 + c.phase) * 0.075,
          c.z + Math.cos(cloudPhase + c.phase) * 0.18,
        )
      }
      starMat.opacity = (0.28 + (1 - day) * 0.46) * (1 - wet * 0.85)
      rain.visible = ripples.visible = wet > 0.005
      if (rain.visible) {
        const fall = reduced ? 3.8 : 5.3,
          vx = wind * 2.8,
          draw = Math.max(1, Math.floor(count * wet * (reduced ? 0.6 : 1)))
        rainGeo.setDrawRange(0, draw * 2)
        rainMat.opacity = wet * (0.29 + 0.12 * (1 - day))
        for (let i = 0; i < draw; i++) {
          const k = i * 6
          drops[k] += dt * vx
          drops[k + 1] -= dt * fall
          const x = drops[k],
            y = drops[k + 1],
            z = drops[k + 2]
          let floor = insideIsland(x, z, 1.03) ? ground + 0.07 : -2.7
          if (Math.abs(x + 1.26) < 1.46 && Math.abs(z + 0.15) < 1.07)
            floor = ground + 1.5 + 1.08 * (1 - Math.abs(z + 0.15) / 1.07)
          if (Math.hypot(x - 1.76, z + 1.58) < 0.6) floor = ground + 2.9
          if (y <= floor) respawn(i, false)
          drops[k + 3] = drops[k] - vx * 0.035
          drops[k + 4] = drops[k + 1] + fall * 0.035
          drops[k + 5] = drops[k + 2]
        }
        rainAttr.needsUpdate = true
        rippleMat.opacity = 0.57 * wet
        ripplesAt.forEach((p, i) => {
          p.t = (p.t + dt * p.speed * (reduced ? 0.7 : 1)) % 1
          dummy.position.set(p.x, pond.y + 0.012, p.z)
          const s = 0.023 + p.t * 0.2
          dummy.scale.set(s, 1, s)
          dummy.updateMatrix()
          ripples.setMatrixAt(i, dummy.matrix)
          tint.setScalar(0.23 + 0.7 * Math.sin(Math.PI * p.t))
          ripples.setColorAt(i, tint)
        })
        ripples.instanceMatrix.needsUpdate = true
        if (ripples.instanceColor) ripples.instanceColor.needsUpdate = true
      }
      return { day, lightTarget: state.lights ? 1 : 0 }
    },
  }
}
