import * as THREE from 'three';
import { createRng } from './math';

export interface ProceduralTextures {
  meadow: THREE.CanvasTexture;
  plaster: THREE.CanvasTexture;
  shingles: THREE.CanvasTexture;
  wood: THREE.CanvasTexture;
  stone: THREE.CanvasTexture;
  windowUnlit: THREE.CanvasTexture;
  windowEmissive: THREE.CanvasTexture;
  softGlow: THREE.CanvasTexture;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize 2D canvas context for procedural textures.');
  }
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  repeatX = 1,
  repeatY = 1,
  srgb = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (srgb) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

/** Subtle painterly miniature flock texture (neutral-warm base so vertex colors shine) */
function createMeadowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  const rng = createRng(1047);

  ctx.fillStyle = '#f5f4eb';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 4200; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    const r = 0.8 + rng() * 2.4;
    const shade = rng();
    if (shade < 0.38) {
      ctx.fillStyle = 'rgba(228, 232, 214, 0.34)';
    } else if (shade < 0.75) {
      ctx.fillStyle = 'rgba(255, 255, 246, 0.32)';
    } else {
      ctx.fillStyle = 'rgba(212, 218, 198, 0.26)';
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return finalizeTexture(canvas, 3, 3, true);
}

/** Warm cream lime-plaster cottage stucco */
function createPlasterTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  const rng = createRng(2089);

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#f7efe0');
  grad.addColorStop(0.82, '#efe3cc');
  grad.addColorStop(1, '#dfd0b5');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 2400; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    const w = 2 + rng() * 9;
    const h = 1 + rng() * 4;
    ctx.fillStyle =
      rng() > 0.5 ? 'rgba(255, 252, 245, 0.18)' : 'rgba(182, 162, 134, 0.14)';
    ctx.fillRect(x, y, w, h);
  }

  return finalizeTexture(canvas, 2, 2, true);
}

/** Overlapping warm terracotta / cedar roof shingles */
function createShingleTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  const rng = createRng(3319);

  ctx.fillStyle = '#9c4b37';
  ctx.fillRect(0, 0, 256, 256);

  const rows = 8;
  const cols = 8;
  const rowH = 256 / rows;
  const colW = 256 / cols;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (colW * 0.5);
    const y = r * rowH;

    for (let c = -1; c <= cols; c++) {
      const x = c * colW + offset;
      const hueShift = (rng() - 0.5) * 18;
      const lumShift = (rng() - 0.5) * 14;
      const red = Math.round(182 + hueShift + lumShift);
      const green = Math.round(92 + lumShift * 0.7);
      const blue = Math.round(69 + lumShift * 0.5);

      ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, colW - 2, rowH - 2, [0, 0, 5, 5]);
      ctx.fill();

      // Subtle highlight along shingle face
      ctx.fillStyle = 'rgba(255, 218, 190, 0.12)';
      ctx.fillRect(x + 2, y + 3, colW - 4, rowH * 0.38);
    }

    // Course overlap shadow
    ctx.fillStyle = 'rgba(58, 24, 18, 0.34)';
    ctx.fillRect(0, y + rowH - 3, 256, 3);
  }

  return finalizeTexture(canvas, 3, 3, true);
}

/** Natural warm timber plank texture */
function createWoodTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  const rng = createRng(4491);

  ctx.fillStyle = '#8b5e3c';
  ctx.fillRect(0, 0, 256, 256);

  const planks = 6;
  const plankW = 256 / planks;

  for (let p = 0; p < planks; p++) {
    const x = p * plankW;
    const delta = Math.round((rng() - 0.5) * 18);
    ctx.fillStyle = `rgb(${138 + delta}, ${94 + Math.round(delta * 0.7)}, ${61 + Math.round(delta * 0.5)})`;
    ctx.fillRect(x, 0, plankW, 256);

    // Fine wood grain streaks
    for (let g = 0; g < 26; g++) {
      const gx = x + rng() * plankW;
      ctx.strokeStyle =
        rng() > 0.45 ? 'rgba(72, 44, 25, 0.18)' : 'rgba(214, 172, 126, 0.14)';
      ctx.lineWidth = 0.8 + rng() * 1.4;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(
        gx + (rng() - 0.5) * 6,
        85,
        gx + (rng() - 0.5) * 6,
        170,
        gx,
        256
      );
      ctx.stroke();
    }

    // Plank seam
    ctx.fillStyle = 'rgba(46, 27, 15, 0.42)';
    ctx.fillRect(x, 0, 1.5, 256);
  }

  return finalizeTexture(canvas, 2, 2, true);
}

/** Fitted warm cobblestone texture for foundations, chimney, and windmill tower */
function createStoneTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  const rng = createRng(5521);

  ctx.fillStyle = '#9d9589';
  ctx.fillRect(0, 0, 256, 256);

  const rows = 7;
  const rowH = 256 / rows;

  for (let r = 0; r < rows; r++) {
    let x = -((r % 2) * 18);
    const y = r * rowH;
    while (x < 256) {
      const w = 34 + rng() * 26;
      const tone = Math.round(166 + (rng() - 0.5) * 32);
      const warm = Math.round((rng() - 0.5) * 12);
      ctx.fillStyle = `rgb(${tone + warm}, ${tone}, ${tone - 8})`;
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, w - 4, rowH - 4, 5);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 250, 240, 0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
      x += w;
    }
  }

  return finalizeTexture(canvas, 2, 2, true);
}

/** Cottage glass window texture (unlit dusty-sky tint + warm emissive hearth map) */
function createWindowTextures(): {
  unlit: THREE.CanvasTexture;
  emissive: THREE.CanvasTexture;
} {
  const [unlitCanvas, uCtx] = makeCanvas(128, 128);
  const uGrad = uCtx.createLinearGradient(0, 0, 128, 128);
  uGrad.addColorStop(0, '#5a768a');
  uGrad.addColorStop(0.55, '#3b5163');
  uGrad.addColorStop(1, '#2b3b4a');
  uCtx.fillStyle = uGrad;
  uCtx.fillRect(0, 0, 128, 128);

  // Subtle diagonal glass reflection
  uCtx.fillStyle = 'rgba(220, 240, 255, 0.18)';
  uCtx.beginPath();
  uCtx.moveTo(14, 0);
  uCtx.lineTo(44, 0);
  uCtx.lineTo(0, 58);
  uCtx.lineTo(0, 24);
  uCtx.closePath();
  uCtx.fill();

  const [emCanvas, eCtx] = makeCanvas(128, 128);
  const eGrad = eCtx.createRadialGradient(64, 78, 8, 64, 64, 76);
  eGrad.addColorStop(0, '#fff3c4');
  eGrad.addColorStop(0.45, '#ffc25c');
  eGrad.addColorStop(0.85, '#eb8c2d');
  eGrad.addColorStop(1, '#b85d18');
  eCtx.fillStyle = eGrad;
  eCtx.fillRect(0, 0, 128, 128);

  // Soft interior curtain drape hint at top corners
  eCtx.fillStyle = 'rgba(110, 48, 14, 0.26)';
  eCtx.beginPath();
  eCtx.moveTo(0, 0);
  eCtx.quadraticCurveTo(36, 18, 16, 62);
  eCtx.lineTo(0, 62);
  eCtx.closePath();
  eCtx.fill();

  eCtx.beginPath();
  eCtx.moveTo(128, 0);
  eCtx.quadraticCurveTo(92, 18, 112, 62);
  eCtx.lineTo(128, 62);
  eCtx.closePath();
  eCtx.fill();

  const unlit = finalizeTexture(unlitCanvas, 1, 1, true);
  unlit.wrapS = THREE.ClampToEdgeWrapping;
  unlit.wrapT = THREE.ClampToEdgeWrapping;

  const emissive = finalizeTexture(emCanvas, 1, 1, true);
  emissive.wrapS = THREE.ClampToEdgeWrapping;
  emissive.wrapT = THREE.ClampToEdgeWrapping;

  return { unlit, emissive };
}

function createSoftGlowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 250, 232, 1.0)');
  grad.addColorStop(0.32, 'rgba(255, 224, 164, 0.58)');
  grad.addColorStop(0.68, 'rgba(255, 196, 120, 0.16)');
  grad.addColorStop(1, 'rgba(255, 180, 100, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

let cachedTextures: ProceduralTextures | null = null;

export function getProceduralTextures(): ProceduralTextures {
  if (cachedTextures) return cachedTextures;
  const win = createWindowTextures();
  cachedTextures = {
    meadow: createMeadowTexture(),
    plaster: createPlasterTexture(),
    shingles: createShingleTexture(),
    wood: createWoodTexture(),
    stone: createStoneTexture(),
    windowUnlit: win.unlit,
    windowEmissive: win.emissive,
    softGlow: createSoftGlowTexture(),
  };
  return cachedTextures;
}
