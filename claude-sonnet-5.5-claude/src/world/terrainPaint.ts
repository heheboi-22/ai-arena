import * as THREE from 'three';
import { mulberry32 } from '../util/math';
import {
  FLOWER_PATCHES,
  HOUSE,
  ROCKS,
  TREES,
  WINDMILL,
  computePathStones,
  houseToWorld,
  pondPoint,
  rimRadius,
  treeShadeRadius,
} from './layout';

/** World half-extent covered by the painted ground map. */
export const GROUND_HALF = 6.6;

/**
 * Paints the whole top of the island once, as if seen from above: meadow,
 * stepping-stone dirt, the pond's sandy shore and bed, and soft contact
 * shadows under everything that stands on the grass. The terrain mesh samples
 * this with planar UVs, which gives far finer detail than its vertices could.
 */
export function paintGround(size: number, anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  const rng = mulberry32(2024);

  const unit = size / (GROUND_HALF * 2);
  const px = (x: number): number => (x + GROUND_HALF) * unit;
  const py = (z: number): number => (z + GROUND_HALF) * unit;

  const blob = (x: number, z: number, r: number, color: string, alpha: number): void => {
    const cx = px(x);
    const cy = py(z);
    const rr = r * unit;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
    g.addColorStop(0, withAlpha(color, alpha));
    g.addColorStop(0.55, withAlpha(color, alpha * 0.55));
    g.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  };

  // --- Meadow -------------------------------------------------------------
  ctx.fillStyle = '#8bbf69';
  ctx.fillRect(0, 0, size, size);

  const patchColors = ['#9fcb74', '#7db460', '#abcc72', '#78ad62', '#92c57a'];
  for (let i = 0; i < 110; i++) {
    const a = rng() * Math.PI * 2;
    const d = Math.sqrt(rng()) * 6.2;
    blob(Math.cos(a) * d, Math.sin(a) * d, 0.45 + rng() * 1.0, patchColors[Math.floor(rng() * patchColors.length)], 0.18 + rng() * 0.14);
  }

  const strokes = Math.floor((size * size) / 190);
  for (let i = 0; i < strokes; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const len = (4 + rng() * 9) * (size / 1024);
    const ang = -Math.PI / 2 + (rng() - 0.5) * 1.5;
    const t = rng();
    ctx.strokeStyle =
      t < 0.4 ? `rgba(70,128,70,${0.16 + rng() * 0.2})` : t < 0.8 ? `rgba(176,214,124,${0.14 + rng() * 0.2})` : `rgba(210,222,138,${0.1 + rng() * 0.14})`;
    ctx.lineWidth = (0.9 + rng() * 1.2) * (size / 1024);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }

  // Tiny meadow flowers, painted rather than modelled.
  for (let i = 0; i < 520; i++) {
    const a = rng() * Math.PI * 2;
    const d = Math.sqrt(rng()) * 5.2;
    const t = rng();
    ctx.fillStyle = t < 0.45 ? 'rgba(255,250,236,0.9)' : t < 0.8 ? 'rgba(255,224,120,0.9)' : 'rgba(248,176,196,0.85)';
    ctx.beginPath();
    ctx.arc(px(Math.cos(a) * d), py(Math.sin(a) * d), (1.1 + rng() * 1.1) * (size / 1024), 0, Math.PI * 2);
    ctx.fill();
  }

  // Darker, deeper-green turf near the rim: fill everything outside the rim and
  // let the shadow blur bleed that colour a little way inside.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, size, size);
  for (let j = 0; j <= 240; j++) {
    const th = (j / 240) * Math.PI * 2;
    const r = rimRadius(th) * 0.995;
    const x = px(Math.cos(th) * r);
    const y = py(Math.sin(th) * r);
    if (j === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.shadowColor = 'rgba(52,104,66,0.8)';
  ctx.shadowBlur = unit * 0.5;
  ctx.fillStyle = '#4f8f5a';
  ctx.fill('evenodd');
  ctx.restore();

  // --- Pond shore and bed ---------------------------------------------------
  // Grass -> damp grass -> sand -> wet sand -> mud -> the bed, sampled finely so no bands show.
  const shoreStops: Array<[number, string, number]> = [
    [2.0, '#6aa05c', 0],
    [1.7, '#6aa05c', 0.3],
    [1.46, '#a6b178', 0.78],
    [1.3, '#cdc08f', 1],
    [1.14, '#c9ba8a', 1],
    [1.0, '#a39a72', 1],
    [0.88, '#85906a', 1],
    [0.6, '#58795c', 1],
    [0.25, '#3f6154', 1],
  ];
  const stopAt = (scale: number): { color: string; alpha: number } => {
    for (let i = 0; i < shoreStops.length - 1; i++) {
      const [s0, c0, a0] = shoreStops[i];
      const [s1, c1, a1] = shoreStops[i + 1];
      if (scale <= s0 && scale >= s1) {
        const t = (s0 - scale) / (s0 - s1);
        return { color: mixHex(c0, c1, t), alpha: a0 + (a1 - a0) * t };
      }
    }
    const last = shoreStops[shoreStops.length - 1];
    return { color: last[1], alpha: last[2] };
  };
  for (let scale = 2.0; scale >= 0.25; scale -= 0.025) {
    const { color, alpha } = stopAt(scale);
    ctx.beginPath();
    for (let j = 0; j <= 160; j++) {
      const phi = (j / 160) * Math.PI * 2;
      const p = pondPoint(phi, scale);
      if (j === 0) ctx.moveTo(px(p.x), py(p.z));
      else ctx.lineTo(px(p.x), py(p.z));
    }
    ctx.closePath();
    ctx.fillStyle = withAlpha(color, alpha * 0.55 + 0.45 * alpha * alpha);
    ctx.fill();
  }
  // Scatter a few pebbles on the sand.
  for (let i = 0; i < 90; i++) {
    const phi = rng() * Math.PI * 2;
    const p = pondPoint(phi, 1.05 + rng() * 0.38);
    ctx.fillStyle = rng() < 0.5 ? 'rgba(120,110,96,0.55)' : 'rgba(236,228,206,0.6)';
    ctx.beginPath();
    ctx.arc(px(p.x), py(p.z), (1 + rng() * 1.8) * (size / 1024), 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Contact shadows (soft ambient occlusion) -----------------------------
  const shadow = 'rgba(30,58,40,1)';
  const house = houseToWorld(0, 0);
  ctx.save();
  ctx.translate(px(house.x), py(house.z));
  ctx.rotate(-HOUSE.yaw);
  const hw = (HOUSE.width / 2 + 0.34) * unit;
  const hd = (HOUSE.depth / 2 + 0.34) * unit;
  const hg = ctx.createRadialGradient(0, 0, Math.min(hw, hd) * 0.55, 0, 0, Math.max(hw, hd) * 1.1);
  hg.addColorStop(0, withAlpha(shadow, 0.62));
  hg.addColorStop(0.7, withAlpha(shadow, 0.34));
  hg.addColorStop(1, withAlpha(shadow, 0));
  ctx.scale(1, hd / hw);
  ctx.fillStyle = hg;
  ctx.fillRect(-hw * 1.3, -hw * 1.3, hw * 2.6, hw * 2.6);
  ctx.restore();

  blob(WINDMILL.x, WINDMILL.z, 1.15, shadow, 0.5);
  for (const t of TREES) blob(t.x, t.z, treeShadeRadius(t) * 1.25, shadow, 0.48);
  for (const r of ROCKS) blob(r.x, r.z, r.size * 2.3, shadow, 0.5);

  // --- Flower beds ------------------------------------------------------------
  for (const f of FLOWER_PATCHES) blob(f.x, f.z, f.radius * 1.15, '#79a65a', 0.55);

  // --- Dirt under the stepping stones ---------------------------------------
  const door = houseToWorld(0, HOUSE.depth / 2 + 0.55);
  blob(door.x, door.z, 0.78, '#bda677', 0.85);
  blob(door.x, door.z, 0.5, '#c9b384', 0.8);
  for (const s of computePathStones()) {
    blob(s.x, s.z, s.r * 3.3, '#bba577', 0.58);
    blob(s.x, s.z, s.r * 2.1, '#c8b283', 0.5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number): number => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** Adds an alpha to a `#rrggbb` or `rgba(r,g,b,a)` colour, keeping it in sRGB for the canvas. */
function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }
  const [r, g, b] = color.match(/[\d.]+/g)!.map(Number);
  return `rgba(${r},${g},${b},${alpha})`;
}
