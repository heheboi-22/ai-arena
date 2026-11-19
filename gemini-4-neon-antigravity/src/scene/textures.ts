import * as THREE from 'three';

/** Deterministic Mulberry32 PRNG so procedural textures are cohesive and reproducible. */
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to acquire 2D canvas context for procedural texture.');
  }
  return { canvas, ctx };
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  repeatX = 1,
  repeatY = 1,
  srgb = true,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  if (srgb) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  texture.needsUpdate = true;
  return texture;
}

export interface ProceduralTextures {
  grass: THREE.CanvasTexture;
  plaster: THREE.CanvasTexture;
  roofShingles: THREE.CanvasTexture;
  wood: THREE.CanvasTexture;
  stone: THREE.CanvasTexture;
  linen: THREE.CanvasTexture;
  ripple: THREE.CanvasTexture;
  softGlow: THREE.CanvasTexture;
  waterBump: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(): ProceduralTextures {
  const grass = createGrassTexture();
  const plaster = createPlasterTexture();
  const roofShingles = createRoofShingleTexture();
  const wood = createWoodTexture();
  const stone = createStoneTexture();
  const linen = createLinenTexture();
  const ripple = createRippleTexture();
  const softGlow = createSoftGlowTexture();
  const waterBump = createWaterBumpTexture();

  const all = [grass, plaster, roofShingles, wood, stone, linen, ripple, softGlow, waterBump];
  return {
    grass,
    plaster,
    roofShingles,
    wood,
    stone,
    linen,
    ripple,
    softGlow,
    waterBump,
    dispose: () => {
      for (const tex of all) {
        tex.dispose();
      }
    },
  };
}

function createGrassTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rng = createRng(1042);

  // Neutral-light mottled base so vertex colors tint smoothly
  ctx.fillStyle = '#e7ebd8';
  ctx.fillRect(0, 0, 256, 256);

  // Soft watercolor blotches
  for (let i = 0; i < 160; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    const r = 10 + rng() * 26;
    const shade = 218 + Math.floor(rng() * 34);
    ctx.fillStyle = `rgba(${shade - 6}, ${shade + 2}, ${shade - 12}, 0.14)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tiny handmade turf speckles
  for (let i = 0; i < 650; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    const w = 1 + rng() * 2;
    const h = 3 + rng() * 5;
    const bright = rng() > 0.5;
    ctx.fillStyle = bright ? 'rgba(255, 255, 240, 0.18)' : 'rgba(130, 152, 112, 0.16)';
    ctx.fillRect(x, y, w, h);
  }

  return finalizeTexture(canvas, 3, 3, true);
}

function createPlasterTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rng = createRng(2087);

  ctx.fillStyle = '#f4ebda';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle warm plaster trowel patches
  for (let i = 0; i < 180; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    const r = 8 + rng() * 24;
    const warm = rng() > 0.45;
    ctx.fillStyle = warm ? 'rgba(227, 210, 186, 0.16)' : 'rgba(255, 252, 246, 0.18)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine mineral grain
  for (let i = 0; i < 700; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    ctx.fillStyle = rng() > 0.5 ? 'rgba(176, 158, 134, 0.11)' : 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(x, y, 2, 2);
  }

  return finalizeTexture(canvas, 1, 1, true);
}

function createRoofShingleTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rng = createRng(3319);

  ctx.fillStyle = '#9c523c';
  ctx.fillRect(0, 0, 256, 256);

  const rows = 8;
  const cols = 8;
  const rowH = 256 / rows;
  const colW = 256 / cols;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (colW * 0.5);
    const y = r * rowH;

    // Soft cast shadow under previous row
    ctx.fillStyle = 'rgba(52, 24, 16, 0.25)';
    ctx.fillRect(0, y, 256, 5);

    for (let c = -1; c <= cols; c++) {
      const x = c * colW + offset;
      const hueShift = Math.floor((rng() - 0.5) * 26);
      const red = Math.min(210, Math.max(138, 178 + hueShift));
      const green = Math.min(126, Math.max(74, 98 + Math.floor(hueShift * 0.6)));
      const blue = Math.min(98, Math.max(54, 72 + Math.floor(hueShift * 0.45)));

      ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
      ctx.beginPath();
      ctx.roundRect(x + 1.5, y + 2, colW - 3, rowH - 2.5, [2, 2, 8, 8]);
      ctx.fill();

      // Subtle sunlit edge highlight
      ctx.strokeStyle = 'rgba(244, 198, 164, 0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  return finalizeTexture(canvas, 2, 2, true);
}

function createWoodTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rng = createRng(4111);

  ctx.fillStyle = '#8b6142';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 3) {
    const alpha = 0.08 + rng() * 0.14;
    const darker = rng() > 0.38;
    ctx.strokeStyle = darker
      ? `rgba(68, 42, 24, ${alpha})`
      : `rgba(182, 140, 102, ${alpha * 0.85})`;
    ctx.lineWidth = 1 + rng() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    const wave = (rng() - 0.5) * 5;
    ctx.bezierCurveTo(85, y + wave, 170, y - wave, 256, y);
    ctx.stroke();
  }

  return finalizeTexture(canvas, 1, 1, true);
}

function createStoneTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rng = createRng(5521);

  // Warm mortar base
  ctx.fillStyle = '#978d80';
  ctx.fillRect(0, 0, 256, 256);

  const rows = 6;
  const rowH = 256 / rows;
  for (let r = 0; r < rows; r++) {
    let x = -(rng() * 18);
    const y = r * rowH;
    while (x < 256) {
      const w = 32 + rng() * 34;
      const h = rowH - 4;
      const tone = 166 + Math.floor((rng() - 0.5) * 44);
      const warm = Math.floor(rng() * 14);
      ctx.fillStyle = `rgb(${tone + warm}, ${tone + Math.floor(warm * 0.5)}, ${tone - 6})`;
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, w - 4, h, 7);
      ctx.fill();

      ctx.strokeStyle = 'rgba(78, 70, 62, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      x += w;
    }
  }

  return finalizeTexture(canvas, 2, 1.5, true);
}

function createLinenTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(128, 128);
  const rng = createRng(6203);

  ctx.fillStyle = '#f2e8d6';
  ctx.fillRect(0, 0, 128, 128);

  for (let i = 0; i < 128; i += 4) {
    ctx.fillStyle = `rgba(182, 164, 138, ${0.06 + rng() * 0.08})`;
    ctx.fillRect(i, 0, 1, 128);
    ctx.fillRect(0, i, 128, 1);
  }

  return finalizeTexture(canvas, 1, 1, true);
}

function createRippleTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(128, 128);
  const cx = 64;
  const cy = 64;
  ctx.clearRect(0, 0, 128, 128);

  const grad = ctx.createRadialGradient(cx, cy, 30, cx, cy, 60);
  grad.addColorStop(0, 'rgba(240, 250, 255, 0)');
  grad.addColorStop(0.42, 'rgba(240, 250, 255, 0.96)');
  grad.addColorStop(0.72, 'rgba(225, 242, 252, 0.7)');
  grad.addColorStop(1, 'rgba(225, 242, 252, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 60, 0, Math.PI * 2);
  ctx.fill();

  // Crisp inner secondary ring
  ctx.strokeStyle = 'rgba(245, 252, 255, 0.52)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 30, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createSoftGlowTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255, 214, 138, 0.92)');
  grad.addColorStop(0.32, 'rgba(255, 178, 86, 0.42)');
  grad.addColorStop(0.7, 'rgba(255, 148, 54, 0.11)');
  grad.addColorStop(1, 'rgba(255, 140, 48, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createWaterBumpTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rng = createRng(7741);

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 140; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    const rx = 14 + rng() * 26;
    const ry = 5 + rng() * 12;
    const val = rng() > 0.5 ? 168 : 96;
    ctx.fillStyle = `rgba(${val}, ${val}, ${val}, 0.14)`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  return finalizeTexture(canvas, 2, 2, false);
}
