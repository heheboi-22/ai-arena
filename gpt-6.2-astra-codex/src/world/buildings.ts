import * as T from 'three'
import { bake, box, cyl, faceGeometry, ground, mesh, pole, random, stone, TAU, v } from './model'

const rand = random(2717)
const wood = '#70503a',
  timber = '#594835',
  cream = '#eadbb5'
const tiles = ['#ae6140', '#ae6544', '#b66e4a', '#c07850', '#b56c4b', '#9e593d', '#ba714d']

// Roof courses overlap, with a clipped toe and a raised ridge on each clay tile.
const tileShape = new T.Shape()
tileShape.moveTo(-0.5, -0.5)
tileShape.lineTo(0.5, -0.5)
tileShape.lineTo(0.5, 0.31)
tileShape.quadraticCurveTo(0.5, 0.46, 0.32, 0.5)
tileShape.lineTo(-0.33, 0.5)
tileShape.quadraticCurveTo(-0.5, 0.47, -0.5, 0.31)
tileShape.closePath()
const tileGeo = new T.ExtrudeGeometry(tileShape, {
  depth: 1,
  bevelEnabled: false,
  curveSegments: 2,
})
tileGeo.rotateX(Math.PI / 2)
function roof(
  g: T.Group,
  w: number,
  depth: number,
  eave: number,
  rise: number,
  rows: number,
  columns: number,
) {
  const slope = Math.atan2(rise, depth / 2),
    length = Math.hypot(rise, depth / 2)
  for (const side of [-1, 1]) {
    const base = box(g, 0, eave + rise / 2, (side * depth) / 4, w, 0.105, length, '#805039')
    base.rotation.x = side * slope
    for (let row = 0; row < rows; row++) {
      const t = (row + 0.44) / rows
      for (let col = 0; col <= columns; col++) {
        const offset = row % 2 === 0 ? 0 : 0.5
        const lo = Math.max(0, col - offset),
          hi = Math.min(columns, col + 1 - offset)
        if (hi - lo < 0.01) continue
        const x = ((lo + hi) / 2 / columns - 0.5) * w
        const tile = mesh(
          g,
          tileGeo,
          tiles[Math.floor(rand() * tiles.length)],
          x,
          eave + rise * (1 - t) + 0.1 + (1 - t) * 0.035,
          side * ((t * depth) / 2),
        )
        tile.scale.set((((hi - lo) * w) / columns) * 0.985, 0.037, (length / rows) * 1.16)
        tile.rotation.x = side * slope
        if (side === -1) tile.rotateY(Math.PI)
      }
    }
  }
  for (let i = 0; i < columns; i++) {
    const ridge = cyl(
      g,
      (-0.5 + (i + 0.5) / columns) * w,
      eave + rise + 0.09,
      0,
      0.075,
      0.077,
      (w / columns) * 0.99,
      '#b66e48',
      9,
    )
    ridge.rotation.z = Math.PI / 2
  }
  for (const x of [-w / 2, w / 2])
    for (const side of [-1, 1]) {
      pole(g, v(x, eave - 0.015, (side * depth) / 2), v(x, eave + rise, 0), 0.083, 0.1, wood)
    }
}
function gable(g: T.Group, w: number, d: number, eave: number, rise: number, color: string) {
  const p: number[] = []
  for (const x of [-w / 2, w / 2]) {
    p.push(x, eave, -d / 2, x, eave, d / 2, x, eave + rise, 0)
  }
  mesh(g, faceGeometry(p), color)
}
function windowBox(
  parent: T.Group,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  rotation: number,
  glass: T.Material,
  shutters = true,
) {
  const g = new T.Group()
  g.position.set(x, y, z)
  g.rotation.y = rotation
  parent.add(g)
  box(g, 0, 0, 0, w + 0.1, h + 0.1, 0.09, timber)
  box(g, 0, 0, 0.054, w - 0.025, h - 0.025, 0.024, glass)
  box(g, 0, 0, 0.079, 0.037, h, 0.029, wood)
  box(g, 0, 0.015, 0.08, w, 0.036, 0.029, wood)
  box(g, 0, -h / 2 - 0.044, 0.053, w + 0.18, 0.074, 0.16, '#927857')
  if (shutters)
    for (const side of [-1, 1]) {
      const xx = side * (w * 0.72 + 0.047)
      box(g, xx, 0, 0.009, w * 0.35, h + 0.03, 0.04, '#6c8065')
      for (let i = 0; i < 4; i++)
        box(g, xx, (i - 1.5) * h * 0.21, 0.037, w * 0.29, 0.026, 0.029, '#536e5c')
    }
}
export function buildHouse() {
  const house = new T.Group()
  house.position.set(-1.26, ground + 0.014, -0.15)
  house.rotation.y = -0.1
  const glass = new T.MeshStandardMaterial({
    color: '#94aaa0',
    emissive: '#ffc06b',
    emissiveIntensity: 0,
    roughness: 0.32,
  })
  const w = 2.48,
    d = 1.72,
    h = 1.42
  box(house, 0, 0.13, 0, w + 0.11, 0.26, d + 0.09, '#989181')
  box(house, 0, (h + 0.2) / 2, 0, w, h - 0.2, d, cream)
  gable(house, w, d, h, 1.03, cream)
  for (const x of [-w / 2 + 0.032, w / 2 - 0.032]) {
    for (const z of [-d / 2, d / 2]) box(house, x, 0.82, z, 0.087, 1.25, 0.07, wood)
  }
  for (const z of [-d / 2, d / 2]) {
    box(house, 0, 0.36, z, w + 0.045, 0.07, 0.06, '#94765b')
    box(house, 0, 1.36, z, w + 0.07, 0.095, 0.1, wood)
  }
  roof(house, w + 0.43, d + 0.45, h + 0.005, 1.09, 6, 12)
  // Tapered gable timbers frame a window on the east side.
  for (const side of [-1, 1]) {
    const x = side * (w / 2 + 0.018)
    box(house, x, h, 0, 0.06, 0.095, d, wood)
    box(house, x, h + 0.44, 0, 0.06, 0.85, 0.055, wood)
    for (const zz of [-0.57, 0.57])
      pole(house, v(x, h, zz * 0.4), v(x, h + 0.43, zz), 0.055, 0.055, wood)
    windowBox(house, x, 0.89, 0, 0.52, 0.59, (side * Math.PI) / 2, glass)
  }
  windowBox(house, 0.59, 0.9, d / 2 + 0.017, 0.58, 0.61, 0, glass)
  // A planted window box gives the front elevation some depth.
  const sillZ = d / 2 + 0.16
  box(house, 0.59, 0.5, sillZ, 0.81, 0.16, 0.22, '#9b7651')
  box(house, 0.59, 0.581, sillZ + 0.1, 0.85, 0.037, 0.039, '#b19266')
  for (let i = 0; i < 16; i++) {
    const x = 0.25 + rand() * 0.68,
      z = sillZ + (rand() - 0.5) * 0.14,
      y = 0.59 + rand() * 0.065
    stone(house, x, y, z, 0.074, 0.07, 0.065, i % 2 ? '#708655' : '#8b9e5e', rand() * 6)
    if (i % 3 !== 0)
      stone(house, x, y + 0.053, z, 0.035, 0.029, 0.03, i % 2 ? '#d49b72' : '#e4c284', rand() * 6)
  }
  windowBox(house, -0.82, 0.94, -d / 2 - 0.015, 0.42, 0.54, Math.PI, glass, false)
  const doorX = -0.48,
    front = d / 2 + 0.008
  box(house, doorX, 0.67, front, 0.7, 1.23, 0.11, timber)
  for (let i = 0; i < 5; i++)
    box(
      house,
      doorX + (i - 2) * 0.115,
      0.657,
      front + 0.067,
      0.112,
      1.095,
      0.038,
      i % 2 ? '#9e7551' : '#a98058',
    )
  box(house, doorX, 0.96, front + 0.1, 0.32, 0.29, 0.035, timber)
  box(house, doorX, 0.96, front + 0.12, 0.25, 0.22, 0.019, glass)
  box(house, doorX, 0.96, front + 0.134, 0.03, 0.22, 0.018, wood)
  stone(house, doorX + 0.2, 0.62, front + 0.115, 0.034, 0.034, 0.034, '#d2ad68')
  for (let i = 0; i < 2; i++)
    box(
      house,
      doorX,
      0.065 + i * 0.09,
      front + 0.36 - i * 0.14,
      0.86 - i * 0.05,
      0.13,
      0.29,
      '#b4a892',
    )
  const hood = box(house, doorX, 1.34, front + 0.17, 0.94, 0.067, 0.42, '#886347')
  hood.rotation.x = 0.18
  for (const side of [-1, 1])
    pole(
      house,
      v(doorX + side * 0.39, 1.09, front + 0.04),
      v(doorX + side * 0.39, 1.28, front + 0.3),
      0.045,
      0.05,
      wood,
    )
  for (let i = 0; i < 11; i++)
    box(
      house,
      -1.12 + i * 0.22,
      0.15,
      front - 0.005,
      0.207,
      0.11,
      0.078,
      i % 3 ? '#a5a08b' : '#94917f',
    )
  const dormer = new T.Group()
  dormer.position.set(-0.58, 0, 0.49)
  dormer.rotation.y = -Math.PI / 2
  house.add(dormer)
  box(dormer, 0, 1.97, 0, 0.65, 0.49, 0.63, cream)
  gable(dormer, 0.65, 0.63, 2.17, 0.32, cream)
  roof(dormer, 0.83, 0.83, 2.13, 0.4, 3, 4)
  windowBox(dormer, 0.34, 2.04, 0, 0.29, 0.31, Math.PI / 2, glass, false)
  // Brick chimney with a lip, dark flue and scattered exposed bricks.
  const cx = 0.65,
    cz = -0.35
  box(house, cx, 2.51, cz, 0.36, 1.1, 0.34, '#b6a28a')
  for (let row = 0; row < 6; row++)
    for (let i = 0; i < 2; i++) {
      if (rand() > 0.73) continue
      box(
        house,
        cx + (i - 0.5) * 0.16,
        2.02 + row * 0.165,
        cz + 0.173,
        0.144,
        0.074,
        0.018,
        rand() > 0.5 ? '#a07356' : '#966c53',
      )
    }
  box(house, cx, 3.05, cz, 0.45, 0.12, 0.43, '#886a54')
  box(house, cx, 3.121, cz, 0.31, 0.035, 0.28, '#534c40')
  for (const x of [-0.99, 0.99]) {
    cyl(house, x, 0.16, 1.02, 0.135, 0.098, 0.28, '#ae7453', 9)
    for (let i = 0; i < 6; i++)
      stone(
        house,
        x + (rand() - 0.5) * 0.16,
        0.32 + rand() * 0.11,
        1.02 + (rand() - 0.5) * 0.13,
        0.1,
        0.1,
        0.08,
        i % 2 ? '#799057' : '#728351',
        rand() * 6,
      )
  }
  const lanternX = doorX + 0.47
  box(house, lanternX, 1.08, front + 0.1, 0.115, 0.195, 0.1, glass)
  box(house, lanternX, 1.193, front + 0.1, 0.155, 0.05, 0.15, timber)
  box(house, lanternX, 0.96, front + 0.1, 0.14, 0.03, 0.14, timber)
  bake(house)
  const glow = new T.PointLight('#ffac58', 0, 4.4, 1.6)
  glow.position.set(0, 1, 1.42)
  house.add(glow)
  return { house, glass, glow }
}

export function buildMill() {
  const mill = new T.Group()
  mill.position.set(1.76, ground, -1.58)
  mill.rotation.y = 0.14
  const rotor = new T.Group()
  cyl(mill, 0, 0.12, 0, 0.65, 0.71, 0.24, '#918e78', 12)
  cyl(mill, 0, 1.24, 0, 0.395, 0.595, 2.27, '#d9c8a0', 12)
  for (let i = 0; i < 26; i++) {
    const y = 0.25 + rand() * 1.69,
      theta = rand() * TAU,
      r = 0.592 - (y - 0.1) * 0.09
    const brick = box(
      mill,
      Math.sin(theta) * r,
      y,
      Math.cos(theta) * r,
      0.1 + rand() * 0.13,
      0.055,
      0.026,
      i % 2 ? '#b3a88f' : '#c0b598',
    )
    brick.rotation.y = theta
  }
  box(mill, 0, 0.47, 0.57, 0.31, 0.69, 0.1, wood)
  box(mill, 0, 0.47, 0.637, 0.21, 0.56, 0.04, '#997754')
  windowBox(
    mill,
    0.015,
    1.4,
    0.5,
    0.21,
    0.27,
    0,
    new T.MeshStandardMaterial({ color: '#657b76' }),
    false,
  )
  cyl(mill, 0, 1.88, 0, 0.66, 0.62, 0.095, '#876c4c', 12)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU,
      b = ((i + 1) / 12) * TAU
    const x = 0.61 * Math.sin(a),
      z = 0.61 * Math.cos(a)
    box(mill, x, 2.03, z, 0.038, 0.22, 0.038, wood)
    pole(mill, v(x, 2.14, z), v(0.61 * Math.sin(b), 2.14, 0.61 * Math.cos(b)), 0.035, 0.035, wood)
    if (i % 2 === 0)
      pole(
        mill,
        v(0.47 * Math.sin(a), 1.55, 0.47 * Math.cos(a)),
        v(x, 1.87, z),
        0.042,
        0.042,
        '#927854',
      )
  }
  cyl(mill, 0, 2.33, 0, 0.45, 0.43, 0.39, '#b5a083', 10)
  cyl(mill, 0, 2.7, 0, 0.18, 0.58, 0.42, '#596f69', 10)
  cyl(mill, 0, 2.97, 0, 0.028, 0.23, 0.16, '#53655f', 10)
  cyl(mill, 0, 3.11, 0, 0.028, 0.035, 0.2, '#b7a776', 8)
  rotor.position.set(0, 2.43, 0.693)
  rotor.rotation.z = 0.55
  const axle = cyl(mill, 0, 2.43, 0.55, 0.13, 0.13, 0.4, wood, 10)
  axle.rotation.x = Math.PI / 2
  for (let i = 0; i < 4; i++) {
    const wing = new T.Group()
    wing.rotation.z = (i * Math.PI) / 2
    rotor.add(wing)
    box(wing, 0, 0.87, 0.025, 0.065, 1.74, 0.067, '#725638')
    box(wing, 0.29, 1.14, 0.02, 0.039, 1.13, 0.042, '#98774d')
    const cloth = faceGeometry([
      0.043, 0.64, 0, 0.27, 0.69, -0.02, 0.27, 1.68, -0.02, 0.043, 0.64, 0, 0.27, 1.68, -0.02,
      0.043, 1.65, 0,
    ])
    mesh(wing, cloth, '#eee3bc')
    for (let j = 0; j < 7; j++)
      box(wing, 0.152, 0.62 + j * 0.177, 0.04, 0.34, 0.028, 0.032, '#a8875c')
  }
  const hub = cyl(rotor, 0, 0, 0.105, 0.155, 0.17, 0.18, '#8c6744', 10)
  hub.rotation.x = Math.PI / 2
  const pin = cyl(rotor, 0, 0, 0.215, 0.06, 0.06, 0.06, '#c4a775', 8)
  pin.rotation.x = Math.PI / 2
  bake(mill)
  bake(rotor)
  mill.add(rotor)
  return { mill, rotor }
}
