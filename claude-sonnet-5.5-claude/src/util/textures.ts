import * as THREE from 'three';
import { mulberry32 } from './math';

/**
 * Procedural textures, all drawn with the 2D canvas API at start-up. No image
 * files are loaded anywhere in the project.
 */

type Ctx = CanvasRenderingContext2D;

function makeCanvas(width: number, height = width): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  return { canvas, ctx };
}

function finish(
  canvas: HTMLCanvasElement,
  opts: { repeat?: boolean; srgb?: boolean; anisotropy?: number; mipmaps?: boolean } = {},
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (opts.repeat !== false) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.anisotropy = opts.anisotropy ?? 8;
  tex.generateMipmaps = opts.mipmaps !== false;
  tex.minFilter = tex.generateMipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Calls `draw` at the nine neighbouring offsets so shapes wrap and the tile repeats without a seam. */
function tiled(size: number, draw: (ox: number, oy: number) => void): void {
  for (let oy = -size; oy <= size; oy += size) {
    for (let ox = -size; ox <= size; ox += size) draw(ox, oy);
  }
}

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString(THREE.SRGBColorSpace)}`;
}

/** Cream plaster: soft trowel marks and a few stains. */
export function plasterTexture(): THREE.CanvasTexture {
  const N = 256;
  const { canvas, ctx } = makeCanvas(N);
  const rng = mulberry32(101);
  ctx.fillStyle = '#f3e9d3';
  ctx.fillRect(0, 0, N, N);

  for (let i = 0; i < 70; i++) {
    const x = rng() * N;
    const y = rng() * N;
    const r = 18 + rng() * 46;
    const dark = rng() < 0.5;
    tiled(N, (ox, oy) => {
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, dark ? 'rgba(206,184,148,0.20)' : 'rgba(255,252,240,0.30)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    });
  }
  for (let i = 0; i < 900; i++) {
    const x = rng() * N;
    const y = rng() * N;
    const a = 0.03 + rng() * 0.07;
    ctx.fillStyle = rng() < 0.5 ? `rgba(150,125,90,${a})` : `rgba(255,255,255,${a * 2})`;
    const s = 0.8 + rng() * 2.2;
    tiled(N, (ox, oy) => ctx.fillRect(x + ox, y + oy, s, s));
  }
  return finish(canvas);
}

/** Terracotta roof shingles, 8 rows by 6 columns per tile. */
export function shingleTexture(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const N = 256;
  const rows = 8;
  const cols = 6;
  const rowH = N / rows;
  const colW = N / cols;
  const rng = mulberry32(202);

  const color = makeCanvas(N);
  const height = makeCanvas(N);
  color.ctx.fillStyle = '#7a3a2a';
  color.ctx.fillRect(0, 0, N, N);
  height.ctx.fillStyle = '#202020';
  height.ctx.fillRect(0, 0, N, N);

  const palette = ['#c26a4a', '#cf7752', '#b95f42', '#d68359', '#c06d4f', '#a85840'];

  // Every shingle, copied to the eight neighbouring tiles so the pattern wraps,
  // then painted from the lowest on the roof up: each row overlaps the one
  // beneath it, including across the tile seam.
  interface Shingle {
    x: number;
    y: number;
    base: string;
    jitter: number;
  }
  const shingles: Shingle[] = [];
  for (let r = 0; r < rows; r++) {
    const shift = (r % 2) * (colW / 2);
    for (let c = -1; c <= cols; c++) {
      const base = palette[Math.floor(rng() * palette.length)];
      const jitter = (rng() - 0.5) * 0.04;
      for (let oy = -N; oy <= N; oy += N) {
        for (let ox = -N; ox <= N; ox += N) {
          shingles.push({ x: c * colW + shift + ox, y: r * rowH + oy, base, jitter });
        }
      }
    }
  }
  shingles.sort((p, q) => q.y - p.y);

  const w = colW - 0.5;
  const h = rowH * 1.5;
  for (const sh of shingles) {
    for (const layer of [color, height] as const) {
      const ctx = layer.ctx;
      const isColor = layer === color;
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(sh.x + w, sh.y);
      ctx.lineTo(sh.x + w, sh.y + h - w * 0.4);
      ctx.quadraticCurveTo(sh.x + w, sh.y + h, sh.x + w * 0.5, sh.y + h);
      ctx.quadraticCurveTo(sh.x, sh.y + h, sh.x, sh.y + h - w * 0.4);
      ctx.closePath();
      if (isColor) {
        const g = ctx.createLinearGradient(0, sh.y, 0, sh.y + h);
        g.addColorStop(0, shade(sh.base, -0.07 + sh.jitter));
        g.addColorStop(0.55, shade(sh.base, sh.jitter));
        g.addColorStop(1, shade(sh.base, 0.03 + sh.jitter));
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(70,28,20,0.55)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      } else {
        const g = ctx.createLinearGradient(0, sh.y, 0, sh.y + h);
        g.addColorStop(0, '#7a7a7a');
        g.addColorStop(1, '#f2f2f2');
        ctx.fillStyle = g;
        ctx.fill();
      }
    }
  }
  for (let i = 0; i < 700; i++) {
    const x = rng() * N;
    const y = rng() * N;
    color.ctx.fillStyle = rng() < 0.5 ? 'rgba(60,24,16,0.10)' : 'rgba(255,214,170,0.08)';
    color.ctx.fillRect(x, y, 1.6, 1.6);
  }
  return {
    map: finish(color.canvas),
    bump: finish(height.canvas, { srgb: false }),
  };
}

/** Vertical wooden planks with grain and the odd knot. */
export function woodTexture(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const N = 256;
  const planks = 4;
  const pw = N / planks;
  const rng = mulberry32(303);
  const color = makeCanvas(N);
  const height = makeCanvas(N);
  const tones = ['#caa078', '#bd946b', '#d3ae86', '#b48c66'];
  height.ctx.fillStyle = '#9a9a9a';
  height.ctx.fillRect(0, 0, N, N);

  for (let p = 0; p < planks; p++) {
    const x0 = p * pw;
    color.ctx.fillStyle = tones[p % tones.length];
    color.ctx.fillRect(x0, 0, pw, N);
    for (let i = 0; i < 16; i++) {
      const gx = x0 + 3 + rng() * (pw - 6);
      const alpha = 0.06 + rng() * 0.16;
      const wob = 1 + rng() * 2.5;
      const phase = rng() * Math.PI * 2;
      for (const layer of [color, height] as const) {
        const ctx = layer.ctx;
        ctx.beginPath();
        for (let y = 0; y <= N; y += 8) {
          const x = gx + Math.sin(y * 0.045 + phase) * wob;
          if (y === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = layer === color ? `rgba(60,34,18,${alpha})` : `rgba(0,0,0,${alpha})`;
        ctx.lineWidth = 0.8 + rng() * 1.2;
        ctx.stroke();
      }
    }
    if (rng() < 0.7) {
      const kx = x0 + pw * (0.3 + rng() * 0.4);
      const ky = rng() * N;
      for (let ring = 3; ring >= 1; ring--) {
        color.ctx.beginPath();
        color.ctx.ellipse(kx, ky, ring * 2.2, ring * 4.2, 0, 0, Math.PI * 2);
        color.ctx.strokeStyle = `rgba(58,32,16,${0.25 + ring * 0.08})`;
        color.ctx.lineWidth = 1;
        color.ctx.stroke();
      }
    }
    // Gaps between planks.
    for (const layer of [color, height] as const) {
      layer.ctx.fillStyle = layer === color ? 'rgba(42,24,12,0.7)' : '#000000';
      layer.ctx.fillRect(x0, 0, 2, N);
    }
  }
  return { map: finish(color.canvas), bump: finish(height.canvas, { srgb: false }) };
}

/** Rubble masonry: staggered courses of rounded stones with dark mortar. */
export function stoneTexture(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const N = 256;
  const courses = 5;
  const ch = N / courses;
  const rng = mulberry32(404);
  const color = makeCanvas(N);
  const height = makeCanvas(N);
  color.ctx.fillStyle = '#6f6a62';
  color.ctx.fillRect(0, 0, N, N);
  height.ctx.fillStyle = '#101010';
  height.ctx.fillRect(0, 0, N, N);
  const tones = ['#b9b2a4', '#a9a294', '#c4bcab', '#9f9a8f', '#b4a999'];

  for (let r = 0; r < courses; r++) {
    let x = -rng() * 20;
    while (x < N) {
      const w = 32 + rng() * 42;
      const y0 = r * ch + 2;
      const h = ch - 4;
      const base = tones[Math.floor(rng() * tones.length)];
      const j = (rng() - 0.5) * 0.05;
      tiled(N, (ox, oy) => {
        for (const layer of [color, height] as const) {
          const ctx = layer.ctx;
          ctx.beginPath();
          ctx.roundRect(x + 1.5 + ox, y0 + oy, w - 3, h, 9);
          if (layer === color) {
            const g = ctx.createLinearGradient(0, y0 + oy, 0, y0 + h + oy);
            g.addColorStop(0, shade(base, 0.05 + j));
            g.addColorStop(1, shade(base, -0.06 + j));
            ctx.fillStyle = g;
          } else {
            ctx.fillStyle = '#d8d8d8';
          }
          ctx.fill();
        }
      });
      x += w;
    }
  }
  for (let i = 0; i < 500; i++) {
    color.ctx.fillStyle = rng() < 0.5 ? 'rgba(40,36,30,0.12)' : 'rgba(255,255,255,0.10)';
    color.ctx.fillRect(rng() * N, rng() * N, 1.5, 1.5);
  }
  return { map: finish(color.canvas), bump: finish(height.canvas, { srgb: false }) };
}

/** Soft round glow, white in the middle, used by sprites and light pools. */
export function glowTexture(): THREE.CanvasTexture {
  const N = 128;
  const { canvas, ctx } = makeCanvas(N);
  const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, N, N);
  return finish(canvas, { repeat: false });
}

/** A lumpy cotton puff for chimney smoke. */
export function puffTexture(): THREE.CanvasTexture {
  const N = 128;
  const { canvas, ctx } = makeCanvas(N);
  const rng = mulberry32(505);
  for (let i = 0; i < 9; i++) {
    const a = rng() * Math.PI * 2;
    const d = rng() * 20;
    const x = N / 2 + Math.cos(a) * d;
    const y = N / 2 + Math.sin(a) * d;
    const r = 22 + rng() * 18;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, N, N);
  }
  return finish(canvas, { repeat: false });
}

/** A small crisp dot with a soft rim: rain splashes and fireflies. */
export function dotTexture(): THREE.CanvasTexture {
  const N = 64;
  const { canvas, ctx } = makeCanvas(N);
  const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, N, N);
  return finish(canvas, { repeat: false });
}

/** The moon: a pale disc with a few darker seas and a soft halo. */
export function moonTexture(): THREE.CanvasTexture {
  const N = 256;
  const { canvas, ctx } = makeCanvas(N);
  const c = N / 2;
  const halo = ctx.createRadialGradient(c, c, N * 0.18, c, c, c);
  halo.addColorStop(0, 'rgba(210,225,255,0.45)');
  halo.addColorStop(1, 'rgba(210,225,255,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, N, N);

  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, N * 0.2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#f4f1e6';
  ctx.fillRect(0, 0, N, N);
  const seas: Array<[number, number, number]> = [
    [-0.06, -0.05, 0.075],
    [0.05, 0.02, 0.06],
    [-0.02, 0.07, 0.05],
    [0.08, -0.08, 0.04],
  ];
  for (const [dx, dy, r] of seas) {
    const g = ctx.createRadialGradient(c + dx * N, c + dy * N, 0, c + dx * N, c + dy * N, r * N);
    g.addColorStop(0, 'rgba(176,176,190,0.55)');
    g.addColorStop(1, 'rgba(176,176,190,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, N, N);
  }
  ctx.restore();
  return finish(canvas, { repeat: false });
}
