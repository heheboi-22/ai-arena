import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import { mulberry32, TAU } from '../util/math'

function canvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement('canvas')
  element.width = size
  element.height = size
  const ctx = element.getContext('2d')
  if (!ctx) throw new Error('2D canvas is not available')
  return [element, ctx]
}

function finish(element: HTMLCanvasElement, repeat: [number, number] = [1, 1]): CanvasTexture {
  const texture = new CanvasTexture(element)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(repeat[0], repeat[1])
  texture.anisotropy = 4
  return texture
}

export function shingleTexture(): CanvasTexture {
  const [element, ctx] = canvas()
  const rng = mulberry32(71)
  ctx.fillStyle = '#704033'
  ctx.fillRect(0, 0, 256, 256)
  const tileW = 34
  const tileH = 23
  for (let row = 0; row < 12; row++) {
    const y = row * tileH
    const offset = row % 2 === 0 ? 0 : tileW / 2
    for (let col = -1; col < 9; col++) {
      const x = col * tileW + offset
      const shade = 0.86 + rng() * 0.26
      const r = Math.floor(168 * shade)
      const g = Math.floor(89 * shade)
      const b = Math.floor(66 * shade)
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.beginPath()
      ctx.roundRect(x + 1, y + 1, tileW - 2, tileH - 2, 3)
      ctx.fill()
      ctx.fillStyle = `rgba(255,217,180,${0.05 + rng() * 0.07})`
      ctx.fillRect(x + 3, y + 2, tileW - 6, 2)
      ctx.fillStyle = `rgba(60,30,24,${0.08 + rng() * 0.1})`
      ctx.fillRect(x + 2, y + tileH - 5, tileW - 4, 2)
    }
  }
  return finish(element, [2, 2])
}

export function woodTexture(): CanvasTexture {
  const [element, ctx] = canvas()
  const rng = mulberry32(23)
  ctx.fillStyle = '#9b6c43'
  ctx.fillRect(0, 0, 256, 256)
  for (let plank = 0; plank < 6; plank++) {
    const y = plank * 43
    const shade = 0.9 + rng() * 0.2
    ctx.fillStyle = `rgb(${Math.floor(150 * shade)},${Math.floor(103 * shade)},${Math.floor(64 * shade)})`
    ctx.fillRect(0, y + 1, 256, 40)
    ctx.fillStyle = 'rgba(63,39,23,0.34)'
    ctx.fillRect(0, y, 256, 2)
    ctx.fillStyle = 'rgba(255,226,182,0.13)'
    ctx.fillRect(0, y + 3, 256, 1)
    for (let line = 0; line < 9; line++) {
      const gy = y + 5 + rng() * 32
      ctx.strokeStyle = `rgba(74,45,26,${0.05 + rng() * 0.1})`
      ctx.lineWidth = 0.6 + rng() * 1.4
      ctx.beginPath()
      ctx.moveTo(rng() * 120, gy)
      ctx.bezierCurveTo(100 + rng() * 40, gy - 3, 150 + rng() * 50, gy + 3, 256, gy)
      ctx.stroke()
    }
  }
  return finish(element, [1, 1])
}

export function plasterTexture(): CanvasTexture {
  const [element, ctx] = canvas(128)
  const rng = mulberry32(9)
  ctx.fillStyle = '#f3e5cc'
  ctx.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 2400; i++) {
    const x = rng() * 128
    const y = rng() * 128
    ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,247,0.17)' : 'rgba(139,113,79,0.09)'
    ctx.fillRect(x, y, 1 + rng() * 1.6, 1 + rng() * 1.6)
  }
  return finish(element, [2, 2])
}

export function grassTexture(): CanvasTexture {
  const [element, ctx] = canvas(128)
  const rng = mulberry32(41)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 3000; i++) {
    const x = rng() * 128
    const y = rng() * 128
    const bright = rng() > 0.5
    ctx.fillStyle = bright ? `rgba(255,255,255,${0.1 + rng() * 0.18})` : `rgba(58,86,44,${0.05 + rng() * 0.1})`
    ctx.fillRect(x, y, 1 + rng() * 2, 1 + rng() * 3)
  }
  return finish(element, [10, 10])
}

export function sailTexture(): CanvasTexture {
  const [element, ctx] = canvas(128)
  ctx.fillStyle = '#efe0c3'
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = 'rgba(131,105,68,0.16)'
  ctx.lineWidth = 1
  for (let i = 0; i < 128; i += 7) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, 128)
    ctx.moveTo(0, i)
    ctx.lineTo(128, i)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(111,83,49,0.35)'
  ctx.lineWidth = 3
  ctx.strokeRect(2, 2, 124, 124)
  return finish(element)
}

export function glowTexture(): CanvasTexture {
  const [element, ctx] = canvas(128)
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.18, 'rgba(255,255,255,0.72)')
  gradient.addColorStop(0.42, 'rgba(255,255,255,0.22)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  const texture = new CanvasTexture(element)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export function moonTexture(): CanvasTexture {
  const [element, ctx] = canvas(128)
  const glow = ctx.createRadialGradient(64, 64, 20, 64, 64, 63)
  glow.addColorStop(0, 'rgba(255,255,255,1)')
  glow.addColorStop(0.74, 'rgba(255,255,255,0.96)')
  glow.addColorStop(0.86, 'rgba(226,238,255,0.35)')
  glow.addColorStop(1, 'rgba(226,238,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 128, 128)
  ctx.save()
  ctx.beginPath()
  ctx.arc(64, 64, 45, 0, TAU)
  ctx.clip()
  const rng = mulberry32(17)
  for (let i = 0; i < 13; i++) {
    const x = 30 + rng() * 68
    const y = 30 + rng() * 68
    const r = 2 + rng() * 7
    ctx.fillStyle = `rgba(164,182,207,${0.08 + rng() * 0.12})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
  const texture = new CanvasTexture(element)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export function dotTexture(): CanvasTexture {
  const [element, ctx] = canvas(32)
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.9)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 32, 32)
  return new CanvasTexture(element)
}
