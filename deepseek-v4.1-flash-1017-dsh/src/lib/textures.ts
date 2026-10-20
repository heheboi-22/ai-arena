import {
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from 'three';
import { mulberry32, valueNoise2 } from './noise';

function canvas(size = 256): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const element = document.createElement('canvas');
  element.width = size;
  element.height = size;
  const ctx = element.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable.');
  return { canvas: element, ctx };
}

function finish(canvasElement: HTMLCanvasElement, repeatX = 1, repeatY = 1): CanvasTexture {
  const texture = new CanvasTexture(canvasElement);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function speckle(
  ctx: CanvasRenderingContext2D,
  size: number,
  count: number,
  palette: string[],
  radius: [number, number],
  seed: number,
): void {
  const random = mulberry32(seed);
  for (let i = 0; i < count; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const r = radius[0] + random() * (radius[1] - radius[0]);
    ctx.fillStyle = palette[Math.floor(random() * palette.length)];
    ctx.globalAlpha = 0.18 + random() * 0.5;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.4 + random() * 0.8), random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function createGrassTexture(): Texture {
  const { canvas: element, ctx } = canvas(256);
  ctx.fillStyle = '#8ca976';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 1900, ['#7d9967', '#9bb385', '#6f8c5c', '#a8bd92', '#859f6f'], [0.5, 2.6], 11);
  // A few short blade marks give the ground a drawn texture at close zoom.
  for (let i = 0; i < 120; i += 1) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(70,94,55,.22)' : 'rgba(196,212,169,.22)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 3, y - 3 - Math.random() * 4);
    ctx.stroke();
  }
  return finish(element, 5, 5);
}

export function createRockTexture(): Texture {
  const { canvas: element, ctx } = canvas(256);
  ctx.fillStyle = '#8a8175';
  ctx.fillRect(0, 0, 256, 256);
  const random = mulberry32(23);
  for (let y = 0; y < 256; y += 1) {
    const n = valueNoise2(y * 0.08, 1.7, 9);
    ctx.fillStyle = `rgba(${74 + n * 38}, ${70 + n * 34}, ${63 + n * 30}, .22)`;
    ctx.fillRect(0, y, 256, 1);
  }
  for (let band = 0; band < 9; band += 1) {
    const y = random() * 256;
    ctx.strokeStyle = random() > 0.4 ? 'rgba(66,60,52,.36)' : 'rgba(190,178,156,.22)';
    ctx.lineWidth = 1 + random() * 3;
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 8) {
      const yy = y + Math.sin(x * 0.035 + band) * 4 + (random() - 0.5) * 2;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  speckle(ctx, 256, 1000, ['#5f594f', '#a69b88', '#746c5f', '#c0b39b'], [0.4, 1.8], 31);
  return finish(element, 2, 2);
}

export function createWoodTexture(): Texture {
  const { canvas: element, ctx } = canvas(256);
  ctx.fillStyle = '#79563b';
  ctx.fillRect(0, 0, 256, 256);
  const random = mulberry32(101);
  for (let i = 0; i < 120; i += 1) {
    const x = random() * 256;
    ctx.strokeStyle = random() > 0.5 ? 'rgba(58,37,24,.32)' : 'rgba(196,158,112,.22)';
    ctx.lineWidth = 0.6 + random() * 2.2;
    ctx.beginPath();
    for (let y = 0; y <= 256; y += 10) {
      const xx = x + Math.sin(y * 0.028 + i) * 2.5 + (random() - 0.5) * 1.2;
      if (y === 0) ctx.moveTo(xx, y);
      else ctx.lineTo(xx, y);
    }
    ctx.stroke();
  }
  // Knots.
  for (let i = 0; i < 4; i += 1) {
    const x = random() * 256;
    const y = random() * 256;
    for (let ring = 0; ring < 3; ring += 1) {
      ctx.strokeStyle = 'rgba(54,34,20,.28)';
      ctx.beginPath();
      ctx.ellipse(x, y, 2 + ring * 2.2, 5 + ring * 4.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  return finish(element, 2, 2);
}

export function createPlasterTexture(): Texture {
  const { canvas: element, ctx } = canvas(256);
  ctx.fillStyle = '#e9dcc2';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 700, ['#d6c5a7', '#f4ead7', '#cbb998', '#efe3cb'], [0.6, 2.2], 5);
  return finish(element, 2, 2);
}

export function createRoofTexture(): Texture {
  const { canvas: element, ctx } = canvas(256);
  ctx.fillStyle = '#9c5745';
  ctx.fillRect(0, 0, 256, 256);
  const rowHeight = 32;
  const tileWidth = 42;
  for (let row = 0; row < 9; row += 1) {
    const y = row * rowHeight;
    const offset = row % 2 === 0 ? 0 : tileWidth / 2;
    for (let x = -tileWidth; x < 256 + tileWidth; x += tileWidth) {
      const xx = x + offset;
      const random = mulberry32(row * 97 + Math.round(xx) + 3);
      const shade = 0.84 + random() * 0.28;
      ctx.fillStyle = `rgb(${Math.round(150 * shade)}, ${Math.round(83 * shade)}, ${Math.round(66 * shade)})`;
      ctx.beginPath();
      ctx.moveTo(xx, y);
      ctx.lineTo(xx + tileWidth, y);
      ctx.lineTo(xx + tileWidth, y + rowHeight - 5);
      ctx.quadraticCurveTo(xx + tileWidth / 2, y + rowHeight + 4, xx, y + rowHeight - 5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(76,40,31,.25)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,214,182,.12)';
      ctx.moveTo(xx + 4, y + 3);
      ctx.lineTo(xx + tileWidth - 4, y + 3);
      ctx.stroke();
    }
  }
  speckle(ctx, 256, 500, ['#7a4234', '#b06c55', '#5f4036'], [0.5, 2.2], 67);
  return finish(element, 2, 2);
}

export function createSandTexture(): Texture {
  const { canvas: element, ctx } = canvas(256);
  ctx.fillStyle = '#c6ac80';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 1700, ['#b19468', '#d6bd93', '#9f845c', '#e0cba6'], [0.5, 2], 77);
  return finish(element, 3, 3);
}

export function createPathTexture(): Texture {
  const { canvas: element, ctx } = canvas(256);
  ctx.fillStyle = '#b49a72';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 1200, ['#9a805c', '#c7ae86', '#877058', '#d3bd97'], [0.7, 2.8], 91);
  for (let i = 0; i < 45; i += 1) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = 'rgba(96,79,58,.35)';
    ctx.beginPath();
    ctx.ellipse(x, y, 2 + Math.random() * 4, 1 + Math.random() * 2, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(element, 1, 2.5);
}

export function createMoonTexture(): Texture {
  const { canvas: element, ctx } = canvas(128);
  const glow = ctx.createRadialGradient(64, 64, 30, 64, 64, 62);
  glow.addColorStop(0, 'rgba(242,236,214,.28)');
  glow.addColorStop(0.55, 'rgba(225,228,218,.12)');
  glow.addColorStop(1, 'rgba(225,228,218,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);

  const disc = ctx.createRadialGradient(55, 51, 4, 64, 64, 37);
  disc.addColorStop(0, '#fffaf0');
  disc.addColorStop(0.55, '#f0e7cf');
  disc.addColorStop(1, '#d8cfb8');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(64, 64, 35, 0, Math.PI * 2);
  ctx.fill();

  const craters = [
    [53, 53, 7],
    [72, 47, 4.5],
    [78, 68, 8],
    [52, 76, 5],
    [67, 82, 3.2],
    [43, 66, 3],
  ];
  for (const [x, y, r] of craters) {
    ctx.fillStyle = 'rgba(186,177,155,.34)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,250,234,.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x - 1, y - 1, r, Math.PI * 0.9, Math.PI * 1.8);
    ctx.stroke();
  }

  return finish(element);
}

export function createSoftDotTexture(): Texture {
  const { canvas: element, ctx } = canvas(64);
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,.65)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return finish(element);
}

export interface TextureSet {
  grass: Texture;
  rock: Texture;
  wood: Texture;
  plaster: Texture;
  roof: Texture;
  sand: Texture;
  path: Texture;
  softDot: Texture;
  moon: Texture;
}

export function createTextures(): TextureSet {
  return {
    grass: createGrassTexture(),
    rock: createRockTexture(),
    wood: createWoodTexture(),
    plaster: createPlasterTexture(),
    roof: createRoofTexture(),
    sand: createSandTexture(),
    path: createPathTexture(),
    softDot: createSoftDotTexture(),
    moon: createMoonTexture(),
  };
}
