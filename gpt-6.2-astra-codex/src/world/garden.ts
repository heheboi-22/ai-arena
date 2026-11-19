import * as T from 'three'
import {
  bake,
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
import { insideIsland, inPond, pond, pondShape } from './terrain'

const rand = random(155)
function pine(height: number, tint: number) {
  const tree = new T.Group()
  cyl(tree, 0, height * 0.29, 0, 0.076 * height, 0.058 * height, height * 0.58, '#816b49', 8)
  const shades = [
    ['#456c57', '#608568', '#6e936f', '#7d9f77'],
    ['#526e52', '#63865b', '#749564', '#89a671'],
    ['#476b5b', '#5a8070', '#6b917b', '#7e9e82'],
  ][tint % 3]
  const points: number[] = [],
    colors: number[] = []
  for (let k = 0; k < 4; k++) {
    const base = height * (0.18 + k * 0.174),
      h = height * (0.37 - k * 0.028),
      r = height * (0.26 - k * 0.047)
    const count = 10,
      phase = rand() * 0.4,
      dx = (rand() - 0.5) * 0.08,
      dz = (rand() - 0.5) * 0.075
    const tip = v(dx, base + h, dz),
      center = v(dx, base + 0.035, dz)
    const ring = Array.from({ length: count }, (_, i) => {
      const a = (i / count) * TAU + phase,
        rr = r * (0.86 + rand() * 0.2)
      return v(dx + rr * Math.cos(a), base + rand() * height * 0.063, dz + rr * Math.sin(a))
    })
    const middle = ring.map((p) =>
      v((p.x - dx) * 0.57 + dx, base + h * 0.48 + (rand() - 0.5) * 0.045, (p.z - dz) * 0.57 + dz),
    )
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count
      for (const [a, b, c, shade] of [
        [ring[i], middle[i], middle[j], 1],
        [ring[i], middle[j], ring[j], 0.95],
        [middle[i], tip, middle[j], 1.04],
        [center, ring[i], ring[j], 0.69],
      ] as const) {
        const color = new T.Color(shades[k]).multiplyScalar(shade * (0.94 + rand() * 0.1))
        for (const p of [a, b, c]) {
          points.push(...p.toArray())
          colors.push(color.r, color.g, color.b)
        }
      }
    }
  }
  mesh(tree, faceGeometry(points, colors), colored)
  bake(tree)
  return tree
}
const leafGeo = new T.IcosahedronGeometry(1, 1)
function broadleaf(height: number, tint: number) {
  const tree = new T.Group(),
    s = height / 2.6
  const bark = '#826c50',
    shades = tint
      ? ['#8fa866', '#9ab16d', '#809c64', '#a7b877']
      : ['#98aa65', '#adb975', '#879d61', '#bac37d']
  cyl(tree, 0, 0.56 * s, 0, 0.11 * s, 0.145 * s, 1.12 * s, bark, 8)
  const lobes = [
    [-0.45, 1.49, 0.12, 0.64],
    [0.44, 1.58, 0.08, 0.63],
    [-0.26, 1.99, -0.22, 0.68],
    [0.17, 2.16, 0.06, 0.63],
    [-0.12, 1.83, 0.39, 0.55],
    [0.43, 1.94, -0.22, 0.48],
  ]
  for (const [i, [x, y, z, r]] of lobes.entries()) {
    pole(tree, v(0, 0.72 * s, 0), v(x * s, (y - 0.2) * s, z * s), 0.1 * s, 0.11 * s, bark)
    const leaf = mesh(tree, leafGeo, shades[i % shades.length], x * s, y * s, z * s)
    leaf.scale.set(r * s * 1.12, r * s * 0.91, r * s)
    leaf.rotation.set(rand(), rand() * 4, rand())
  }
  bake(tree)
  return tree
}
export function buildGarden(route: T.CatmullRomCurve3) {
  const garden = new T.Group(),
    trees: T.Group[] = []
  const positions = [
    [-4.1, -0.77, 2.23, 0],
    [-3.58, -1.75, 2.95, 1],
    [-2.65, -2.33, 2.18, 2],
    [-1.36, -2.68, 2.49, 0],
    [-0.48, -2.56, 1.79, 2],
    [3.03, -1.88, 2.16, 0],
    [4.04, -0.75, 2.27, 1],
    [4.55, 0.02, 1.48, 2],
    [-4.18, 0.77, 1.27, 2],
    [-3.72, 0.4, 2.06, 3],
    [3.65, -0.06, 1.85, 4],
  ]
  for (const [x, z, h, kind] of positions) {
    const tree = kind < 3 ? pine(h, kind) : broadleaf(h, kind - 3)
    tree.position.set(x, ground, z)
    tree.rotation.y = rand() * TAU
    trees.push(tree)
  }
  const routeSamples = route.getPoints(36)
  const clear = (x: number, z: number) => {
    if (!insideIsland(x, z, 0.94) || inPond(x, z, 1.09)) return false
    if (x > -2.66 && x < 0.2 && z > -1.22 && z < 1.01) return false
    if (Math.hypot(x - 1.76, z + 1.58) < 0.8) return false
    return !routeSamples.some((p) => (x - p.x) ** 2 + (z - p.z) ** 2 < 0.103)
  }
  function clump(x: number, z: number, s: number) {
    for (let j = 0; j < 5; j++) {
      const a = rand() * TAU,
        r = j ? s * 0.55 : 0,
        sz = s * (0.55 + rand() * 0.27)
      const leaf = mesh(
        garden,
        leafGeo,
        ['#77945d', '#7f9d5e', '#8da463', '#91aa65'][j % 4],
        x + Math.cos(a) * r,
        ground + 0.25 * sz,
        z + Math.sin(a) * r,
      )
      leaf.scale.set(sz, sz * 0.66, sz)
      leaf.rotation.y = rand() * TAU
    }
  }
  for (const [x, z, s] of [
    [-3.18, -0.26, 0.31],
    [-2.74, 0.4, 0.25],
    [0.37, -1.37, 0.26],
    [0.14, -0.72, 0.26],
    [3.32, 0.47, 0.18],
    [4.39, -1.05, 0.22],
    [-3.83, 1.4, 0.23],
    [-0.42, -2.07, 0.23],
    [-2.89, 1.48, 0.24],
  ])
    clump(x, z, s)
  const rocks = [
    [-4.68, -0.39, 0.37],
    [-4.45, -0.08, 0.19],
    [-3.75, 2.02, 0.24],
    [-2.79, 2.59, 0.31],
    [-2.47, 2.69, 0.15],
    [0.14, 3.1, 0.21],
    [3.95, 1.85, 0.4],
    [4.18, 1.56, 0.24],
    [3.87, 2.21, 0.15],
    [3.51, -2.02, 0.23],
    [-1.95, -2.97, 0.24],
    [1.06, 2.96, 0.19],
  ]
  for (const [i, [x, z, s]] of rocks.entries())
    stone(
      garden,
      x,
      ground + s * 0.25,
      z,
      s * 1.5,
      s * 0.91,
      s,
      i % 2 ? '#929b86' : '#9ba18b',
      rand() * TAU,
    )
  const blades: number[] = [],
    bladeCols: number[] = []
  function blade(
    x: number,
    z: number,
    h: number,
    w: number,
    dx: number,
    dz: number,
    color: string,
    bottom = ground + 0.008,
  ) {
    const a = rand() * TAU,
      c = new T.Color(color),
      sx = Math.cos(a) * w,
      sz = Math.sin(a) * w
    blades.push(x - sx, bottom, z - sz, x + sx, bottom, z + sz, x + dx, bottom + h, z + dz)
    for (let i = 0; i < 3; i++) bladeCols.push(c.r, c.g, c.b)
  }
  for (let i = 0; i < 1270; i++) {
    const x = (rand() - 0.5) * 11.4,
      z = (rand() - 0.5) * 7.3
    if (!clear(x, z)) continue
    for (let j = 0; j < 3; j++)
      blade(
        x + rand() * 0.051,
        z + rand() * 0.04,
        0.048 + rand() * 0.09,
        0.016 + rand() * 0.013,
        (rand() - 0.5) * 0.075,
        (rand() - 0.5) * 0.052,
        ['#7a9956', '#95af64', '#a8bb74'][j],
      )
  }
  for (const [cx, cz] of [
    [-2.68, 1.55],
    [-2.15, 2.73],
    [-0.1, 1.61],
    [0.44, 2.84],
    [3.53, 2.43],
    [-3.12, -0.08],
    [2.42, -0.41],
    [4.32, 0.63],
    [-0.54, -1.57],
  ]) {
    for (let j = 0; j < 12; j++) {
      const x = cx + (rand() - 0.5) * 0.65,
        z = cz + (rand() - 0.5) * 0.5
      if (!clear(x, z)) continue
      const h = 0.083 + rand() * 0.093
      blade(x, z, h, 0.015, 0.02, 0, '#6b894b')
      if (j % 3 === 0)
        stone(garden, x + 0.02, ground + h, z, 0.038, 0.041, 0.035, '#dbb65c', rand() * 6)
      else {
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2
          stone(
            garden,
            x + 0.016 + Math.cos(a) * 0.023,
            ground + h,
            z + Math.sin(a) * 0.023,
            0.025,
            0.018,
            0.022,
            '#f2e8c3',
            a,
          )
        }
        stone(garden, x + 0.016, ground + h + 0.013, z, 0.019, 0.015, 0.019, '#d6ac48')
      }
    }
  }
  for (const a of [0.14, 1.01, 3.84, 4.05, 5.14, 5.87]) {
    const rad = pondShape(a)
    const xx = pond.x + Math.cos(a) * rad * pond.rx * 0.97,
      zz = pond.z + Math.sin(a) * rad * pond.rz * 0.97
    for (let j = 0; j < 12; j++) {
      const x = xx + (rand() - 0.5) * 0.17,
        z = zz + (rand() - 0.5) * 0.17,
        h = 0.2 + rand() * 0.24
      blade(x, z, h, 0.026, (rand() - 0.5) * 0.18, (rand() - 0.5) * 0.15, '#7c925a', pond.y)
      if (j % 4 === 0) {
        cyl(garden, x, pond.y + h / 2, z, 0.011, 0.012, h, '#8a9463', 5)
        cyl(garden, x, pond.y + h, z, 0.025, 0.027, 0.1, '#8c704c', 6)
      }
    }
  }
  mesh(garden, faceGeometry(blades, bladeCols), colored)
  bake(garden)
  return { garden, trees }
}
