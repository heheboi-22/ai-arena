import * as T from 'three'
import {
  bake,
  box,
  colored,
  cyl,
  faceGeometry,
  ground,
  mesh,
  pole,
  random,
  stone,
  TAU,
  v,
} from './model'

const rand = random(1703)
export const pond = { x: 2.47, z: 1.62, rx: 1.72, rz: 1.05, y: ground - 0.077 }
export const pondShape = (a: number) =>
  1 + 0.11 * Math.sin(3 * a + 0.2) + 0.055 * Math.cos(5 * a + 0.6)
export function inPond(x: number, z: number, margin = 1) {
  const u = (x - pond.x) / pond.rx,
    w = (z - pond.z) / pond.rz
  return Math.hypot(u, w) < margin * pondShape(Math.atan2(w, u))
}
export function radiusAt(a: number) {
  return (
    1 + 0.046 * Math.cos(3 * a + 0.3) + 0.037 * Math.sin(5 * a - 1) + 0.026 * Math.sin(9 * a + 0.7)
  )
}
export function insideIsland(x: number, z: number, margin = 1) {
  return Math.hypot(x / 5.58, z / 3.65) < margin * radiusAt(Math.atan2(z / 3.65, x / 5.58))
}
export function buildTerrain() {
  const land = new T.Group()
  const n = 38
  const phases = Array.from({ length: n }, (_, i) => ((i + (rand() - 0.5) * 0.34) / n) * TAU)
  const outer = phases.map(
    (a) => new T.Vector2(Math.cos(a) * 5.58 * radiusAt(a), Math.sin(a) * 3.65 * radiusAt(a)),
  )
  const coast = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * TAU,
      r = pondShape(a)
    return new T.Vector2(pond.x + Math.cos(a) * pond.rx * r, pond.z + Math.sin(a) * pond.rz * r)
  })
  const pos: number[] = [],
    cols: number[] = []
  function tri(a: T.Vector3, b: T.Vector3, c: T.Vector3, hex: string, shade = 0.025) {
    const color = new T.Color(hex).multiplyScalar(1 + (rand() - 0.5) * shade)
    for (const p of [a, b, c]) {
      pos.push(p.x, p.y, p.z)
      cols.push(color.r, color.g, color.b)
    }
  }
  const contour = [...outer, ...coast]
  for (const [a, b, c] of T.ShapeUtils.triangulateShape(outer, [coast])) {
    const coords = [a, b, c].map((i) => v(contour[i].x, ground, contour[i].y))
    tri(coords[2], coords[1], coords[0], '#9dbb6d', 0.045)
  }
  let last = outer.map((p) => v(p.x, ground, p.y))
  const cliffPalette = ['#85918a', '#92948e', '#78847e', '#9a9d94', '#93928b', '#788280', '#8f9188']
  const strata = [
    { r: 1.012, y: 0.32, j: 0.08, shift: 0, color: '#819e58' },
    { r: 0.995, y: 0.075, j: 0.15, shift: 0.013, color: '#788b53' },
    { r: 0.973, y: -0.1, j: 0.14, shift: -0.012, color: '#927b5d' },
    { r: 0.996, y: -0.5, j: 0.3, shift: 0.015, color: '' },
    { r: 0.919, y: -0.91, j: 0.37, shift: -0.023, color: '' },
    { r: 0.86, y: -1.06, j: 0.29, shift: 0.018, color: '#696e61' },
    { r: 0.82, y: -1.46, j: 0.32, shift: 0.033, color: '' },
    { r: 0.64, y: -1.95, j: 0.44, shift: 0.055, color: '' },
    { r: 0.48, y: -2.36, j: 0.45, shift: 0.01, color: '' },
    { r: 0.28, y: -2.68, j: 0.38, shift: 0.06, color: '' },
    { r: 0.07, y: -2.88, j: 0.22, shift: 0.07, color: '#686e64' },
  ]
  for (const [k, l] of strata.entries()) {
    const ring = phases.map((a) => {
      const r = l.r * radiusAt(a) * (1 + (rand() - 0.5) * (k > 2 ? 0.095 : 0.018))
      return v(
        Math.cos(a + l.shift) * 5.58 * r - (1 - l.r) * 0.83,
        l.y + (rand() - 0.5) * l.j,
        Math.sin(a + l.shift) * 3.65 * r + (1 - l.r) * 0.18,
      )
    })
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n,
        col = l.color || cliffPalette[Math.floor(rand() * cliffPalette.length)]
      tri(last[i], last[j], ring[j], col, 0.1)
      tri(last[i], ring[j], ring[i], col, 0.1)
    }
    last = ring
  }
  for (let i = 1; i < n - 1; i++) tri(last[0], last[i], last[i + 1], '#667065')
  const waterPts: number[] = []
  for (let i = 0; i < coast.length; i++) {
    const p = coast[i],
      q = coast[(i + 1) % coast.length]
    const inner = (u: T.Vector2, f: number, y: number) =>
      v(pond.x + (u.x - pond.x) * f, y, pond.z + (u.y - pond.z) * f)
    const a = inner(p, 1, ground),
      b = inner(q, 1, ground),
      c = inner(q, 0.941, pond.y - 0.012),
      d = inner(p, 0.941, pond.y - 0.012)
    tri(a, b, c, '#b2ab80')
    tri(a, c, d, '#b2ac83')
    waterPts.push(
      pond.x,
      pond.y,
      pond.z,
      ...inner(q, 0.956, pond.y).toArray(),
      ...inner(p, 0.956, pond.y).toArray(),
    )
  }
  mesh(land, faceGeometry(pos, cols), colored)
  const ivyGreen = ['#758c50', '#819b57', '#8da35d', '#718956']
  for (const [index, phase] of [
    -2.54, -1.94, -0.43, 0.18, 0.77, 1.04, 1.73, 2.32, 2.79,
  ].entries()) {
    const reach = 0.4 + rand() * 0.55
    for (let shoot = 0; shoot < 3; shoot++) {
      const a = phase + (shoot - 1) * 0.034,
        length = reach * (0.56 + rand() * 0.5)
      const steps = Math.ceil(length / 0.077)
      for (let j = 0; j < steps; j++) {
        const t = j / steps,
          y = ground + 0.023 - t * length
        const dir = a + 0.018 * Math.sin(t * 6 + shoot),
          r = radiusAt(dir) * (1.004 + 0.015 * Math.sin(t * 2))
        const x = 5.58 * r * Math.cos(dir),
          z = 3.65 * r * Math.sin(dir)
        const size = (0.105 + rand() * 0.035) * (1 - t * 0.5)
        const leaf = stone(
          land,
          x,
          y,
          z,
          size,
          size * 1.06,
          size * 0.79,
          ivyGreen[(j + index) % 4],
          rand() * TAU,
        )
        leaf.rotation.z = ((j % 2) - 0.5) * 0.65
      }
    }
  }
  for (const [x, y, z, s] of [
    [-3.73, -2.04, 1.79, 0.23],
    [-3.43, -2.51, 1.84, 0.1],
    [3.44, -1.99, 0.74, 0.29],
    [3.2, -2.35, 0.87, 0.12],
    [-0.47, -3.08, 0.49, 0.18],
  ]) {
    stone(land, x, y, z, s * 0.95, s * 1.05, s * 0.85, '#83928a', rand() * TAU)
  }
  const water = new T.MeshStandardMaterial({
    color: '#5d9e9e',
    roughness: 0.38,
    metalness: 0.15,
    flatShading: true,
    side: T.DoubleSide,
  })
  mesh(land, faceGeometry(waterPts), water)
  // A worn footpath arcs from the doorstep toward the landing.
  const route = new T.CatmullRomCurve3([
    v(-1.57, 0, 0.65),
    v(-1.38, 0, 1.47),
    v(-1.55, 0, 2.17),
    v(-0.76, 0, 2.54),
    v(0.05, 0, 2.38),
    v(0.85, 0, 1.86),
  ])
  const pathPts: number[] = []
  let prev: T.Vector3[] = []
  for (let i = 0; i <= 28; i++) {
    const t = i / 28,
      p = route.getPoint(t),
      d = route.getTangent(t),
      width = 0.26 + 0.07 * rand()
    const edges = [-1, 1].map((s) =>
      v(p.x + s * d.z * width, ground + 0.011, p.z - s * d.x * width),
    )
    if (i)
      for (const k of [prev[0], edges[0], prev[1], edges[0], edges[1], prev[1]])
        pathPts.push(...k.toArray())
    prev = edges
  }
  mesh(land, faceGeometry(pathPts), '#c3b18b').material.side = T.DoubleSide
  for (let i = 0; i < 13; i++) {
    const t = rand(),
      p = route.getPoint(t)
    stone(
      land,
      p.x + (rand() - 0.5) * 0.24,
      ground + 0.025,
      p.z,
      0.088 + rand() * 0.075,
      0.021,
      0.065,
      '#ada486',
      rand() * 6,
    )
  }
  // Short timber landing and pegged posts.
  for (let i = 0; i < 8; i++) {
    const plank = box(
      land,
      0.73 + i * 0.124,
      ground + 0.075,
      1.88,
      0.114,
      0.072,
      0.64 + (rand() - 0.5) * 0.05,
      i % 3 === 0 ? '#96714a' : '#ac8456',
    )
    plank.rotation.y = (rand() - 0.5) * 0.02
  }
  for (const x of [0.83, 1.52])
    for (const z of [1.59, 2.15]) cyl(land, x, ground - 0.02, z, 0.052, 0.062, 0.37, '#725c43', 8)
  for (let i = 0; i < 39; i++) {
    const a = rand() * TAU,
      r = pondShape(a) * (0.98 + rand() * 0.035)
    const s = 0.048 + rand() ** 2 * 0.2
    stone(
      land,
      pond.x + pond.rx * r * Math.cos(a),
      ground - 0.021,
      pond.z + pond.rz * r * Math.sin(a),
      s * 1.35,
      s * 0.69,
      s,
      '#a4aa91',
      rand() * 6,
    )
  }
  for (const [lx, lz] of [
    [2.95, 2.1],
    [3.43, 1.48],
    [2.73, 2.25],
    [1.87, 0.96],
  ]) {
    const r = 0.09 + rand() * 0.07
    const pad = mesh(
      land,
      new T.CircleGeometry(r, 11, 0, TAU - 0.33),
      '#778c54',
      lx,
      pond.y + 0.009,
      lz,
    )
    pad.rotation.x = -Math.PI / 2
    pad.rotation.z = rand() * 6
  }
  for (let i = 0; i < 30; i++) {
    const a = rand() * TAU,
      rad = 0.32 + 0.53 * rand()
    const x = pond.x + pond.rx * rad * Math.cos(a),
      z = pond.z + pond.rz * rad * Math.sin(a)
    const streak = stone(
      land,
      x,
      pond.y + 0.004,
      z,
      0.05 + rand() * 0.13,
      0.004,
      0.011 + rand() * 0.007,
      i % 2 ? '#93b9ae' : '#78aba7',
      0,
    )
    streak.rotation.set(0, 0.12, 0)
  }
  function fence(points: number[][]) {
    for (const [i, [x, z]] of points.entries()) {
      box(land, x, ground + 0.24, z, 0.105, 0.49 + (i % 2) * 0.025, 0.105, '#927749')
      const cap = mesh(
        land,
        new T.ConeGeometry(0.077, 0.08, 4),
        '#ab905e',
        x,
        ground + 0.508 + (i % 2) * 0.013,
        z,
      )
      cap.rotation.y = Math.PI / 4
      if (!i) continue
      const [px, pz] = points[i - 1]
      for (const dy of [0.15, 0.33])
        pole(land, v(px, ground + dy, pz), v(x, ground + dy + 0.012, z), 0.05, 0.07, '#ac9361')
    }
  }
  fence([
    [-3.8, 1.27],
    [-3.46, 1.77],
    [-2.92, 2.15],
    [-2.39, 2.42],
  ])
  fence([
    [2.64, -2.28],
    [3.36, -2.03],
    [3.9, -1.65],
    [4.26, -1.11],
  ])
  bake(land)
  return { land, water, route }
}
