import * as THREE from 'three';

/**
 * Generates a subtle procedural noise texture on an HTMLCanvasElement
 * for tactile, handmade miniature surface variation without external assets.
 */
export function createNoiseTexture(
  baseHex: string,
  accentHex: string,
  size = 128,
  scale = 4
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  const baseColor = new THREE.Color(baseHex);
  const accentColor = new THREE.Color(accentHex);
  const tempColor = new THREE.Color();

  // Deterministic pseudo-random generator for consistent visual appearance
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const cell = Math.max(2, Math.floor(size / (32 * scale)));
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const t = rand() * 0.45;
      tempColor.copy(baseColor).lerp(accentColor, t);
      ctx.fillStyle = `#${tempColor.getHexString()}`;
      ctx.fillRect(x, y, cell, cell);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Generates a warm roof shingle procedural texture.
 */
export function createShingleTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#c45b3b';
  ctx.fillRect(0, 0, size, size);

  const rows = 8;
  const cols = 6;
  const rowH = size / rows;
  const colW = size / cols;

  let seed = 4201;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * colW + offset;
      const y = r * rowH;
      const shade = Math.floor((rand() - 0.5) * 18);
      const rCol = Math.min(255, Math.max(0, 196 + shade));
      const gCol = Math.min(255, Math.max(0, 91 + Math.floor(shade * 0.6)));
      const bCol = Math.min(255, Math.max(0, 59 + Math.floor(shade * 0.4)));
      ctx.fillStyle = `rgb(${rCol}, ${gCol}, ${bCol})`;
      ctx.fillRect(x + 1, y + 1, colW - 2, rowH - 2);

      ctx.fillStyle = 'rgba(65, 22, 12, 0.28)';
      ctx.fillRect(x, y + rowH - 2, colW, 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Generates a soft radial glow texture for warm window/lantern halos or sun glow.
 */
export function createGlowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    2,
    size / 2,
    size / 2,
    size / 2
  );
  grad.addColorStop(0, 'rgba(255, 220, 140, 1)');
  grad.addColorStop(0.35, 'rgba(255, 185, 85, 0.48)');
  grad.addColorStop(0.7, 'rgba(255, 150, 50, 0.12)');
  grad.addColorStop(1, 'rgba(255, 140, 40, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

