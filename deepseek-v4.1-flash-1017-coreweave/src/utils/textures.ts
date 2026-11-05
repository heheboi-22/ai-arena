import * as THREE from 'three';
import { seededRandom } from './math';

const makeCanvas = (width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');
  return [canvas, context];
};

const toTexture = (canvas: HTMLCanvasElement, srgb = true): THREE.CanvasTexture => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

export const makePlasterTexture = (): THREE.CanvasTexture => {
  const [canvas, context] = makeCanvas(256, 256);
  const random = seededRandom(21);
  const image = context.createImageData(256, 256);
  for (let i = 0; i < image.data.length; i += 4) {
    const grain = (random() - 0.5) * 9;
    image.data[i] = 235 + grain;
    image.data[i + 1] = 226 + grain;
    image.data[i + 2] = 209 + grain * 0.8;
    image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  context.globalAlpha = 0.07;
  for (let i = 0; i < 20; i += 1) {
    context.fillStyle = i % 2 === 0 ? '#ffffff' : '#8f8068';
    context.beginPath();
    context.ellipse(random() * 256, random() * 256, 20 + random() * 40, 8 + random() * 26, random() * 3, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 0.18;
  context.strokeStyle = '#a79781';
  context.lineWidth = 0.8;
  for (let i = 0; i < 5; i += 1) {
    context.beginPath();
    let x = random() * 256;
    let y = random() * 256;
    context.moveTo(x, y);
    for (let j = 0; j < 4; j += 1) {
      x += (random() - 0.5) * 18;
      y += random() * 12;
      context.lineTo(x, y);
    }
    context.stroke();
  }
  return toTexture(canvas);
};

export const makeWoodTexture = (): THREE.CanvasTexture => {
  const [canvas, context] = makeCanvas(256, 256);
  const random = seededRandom(8);
  context.fillStyle = '#a57a53';
  context.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i += 1) {
    const x = random() * 256;
    const width = 0.4 + random() * 1.7;
    context.globalAlpha = 0.08 + random() * 0.16;
    context.strokeStyle = random() > 0.45 ? '#5f422c' : '#d0a678';
    context.lineWidth = width;
    context.beginPath();
    for (let y = 0; y <= 256; y += 8) {
      const drift = Math.sin(y * 0.035 + x) * 2.4;
      if (y === 0) context.moveTo(x + drift, y);
      else context.lineTo(x + drift, y);
    }
    context.stroke();
  }
  context.globalAlpha = 0.25;
  for (let i = 0; i < 3; i += 1) {
    const x = random() * 256;
    const y = random() * 256;
    context.strokeStyle = '#533925';
    context.lineWidth = 1.4;
    context.beginPath();
    context.ellipse(x, y, 5 + random() * 4, 9 + random() * 7, 0, 0, Math.PI * 2);
    context.stroke();
  }
  context.globalAlpha = 0.12;
  context.fillStyle = '#3a2a1d';
  for (let i = 0; i < 7; i += 1) {
    context.fillRect(0, random() * 256, 256, 1);
  }
  return toTexture(canvas);
};

export const makeRoofTexture = (): THREE.CanvasTexture => {
  const [canvas, context] = makeCanvas(512, 256);
  const random = seededRandom(33);
  context.fillStyle = '#6f574a';
  context.fillRect(0, 0, 512, 256);
  const tileWidth = 64;
  const tileHeight = 32;
  for (let row = 0; row < 8; row += 1) {
    const offset = row % 2 === 0 ? 0 : tileWidth / 2;
    for (let col = -1; col < 9; col += 1) {
      const x = col * tileWidth + offset;
      const y = row * tileHeight;
      const shade = random();
      context.fillStyle = `rgb(${Math.round(126 + shade * 30)}, ${Math.round(94 + shade * 22)}, ${Math.round(77 + shade * 16)})`;
      context.beginPath();
      context.roundRect(x + 2, y + 1, tileWidth - 4, tileHeight - 2, 5);
      context.fill();
      context.fillStyle = 'rgba(235, 211, 184, 0.16)';
      context.fillRect(x + 4, y + 2, tileWidth - 9, 2);
      context.fillStyle = 'rgba(60, 35, 28, 0.28)';
      context.fillRect(x + 2, y + tileHeight - 4, tileWidth - 4, 3);
    }
  }
  context.globalAlpha = 0.1;
  context.fillStyle = '#d9c2a0';
  for (let i = 0; i < 80; i += 1) {
    context.beginPath();
    context.arc(random() * 512, random() * 256, 1 + random() * 3, 0, Math.PI * 2);
    context.fill();
  }
  return toTexture(canvas);
};

export const makeStoneTexture = (): THREE.CanvasTexture => {
  const [canvas, context] = makeCanvas(256, 256);
  const random = seededRandom(17);
  context.fillStyle = '#a39b8e';
  context.fillRect(0, 0, 256, 256);
  context.globalAlpha = 0.25;
  for (let i = 0; i < 70; i += 1) {
    const shade = 100 + Math.round(random() * 80);
    context.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 10})`;
    context.beginPath();
    context.ellipse(random() * 256, random() * 256, 4 + random() * 24, 3 + random() * 15, random() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 0.2;
  context.strokeStyle = '#5f584f';
  context.lineWidth = 1;
  for (let i = 0; i < 9; i += 1) {
    context.beginPath();
    let x = random() * 256;
    let y = random() * 256;
    context.moveTo(x, y);
    for (let j = 0; j < 3; j += 1) {
      x += (random() - 0.5) * 30;
      y += random() * 20;
      context.lineTo(x, y);
    }
    context.stroke();
  }
  return toTexture(canvas);
};

export const makeSoftTexture = (size = 128, hardness = 0.1): THREE.CanvasTexture => {
  const [canvas, context] = makeCanvas(size, size);
  const center = size / 2;
  const gradient = context.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(Math.min(0.9, hardness), 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(0.55, 'rgba(255, 255, 255, 0.28)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = toTexture(canvas, false);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
};

export const makeSunTexture = (): THREE.CanvasTexture => {
  const [canvas, context] = makeCanvas(256, 256);
  const center = 128;
  const gradient = context.createRadialGradient(center, center, 4, center, center, 126);
  gradient.addColorStop(0, 'rgba(255, 249, 227, 1)');
  gradient.addColorStop(0.12, 'rgba(255, 236, 191, 0.98)');
  gradient.addColorStop(0.23, 'rgba(255, 211, 148, 0.55)');
  gradient.addColorStop(0.5, 'rgba(255, 187, 118, 0.14)');
  gradient.addColorStop(1, 'rgba(255, 170, 100, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const texture = toTexture(canvas, false);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
};

export const makeMoonTexture = (): THREE.CanvasTexture => {
  const [canvas, context] = makeCanvas(256, 256);
  const center = 128;
  const halo = context.createRadialGradient(center, center, 8, center, center, 126);
  halo.addColorStop(0, 'rgba(203, 221, 244, 0.65)');
  halo.addColorStop(0.25, 'rgba(189, 209, 236, 0.25)');
  halo.addColorStop(1, 'rgba(167, 193, 226, 0)');
  context.fillStyle = halo;
  context.fillRect(0, 0, 256, 256);
  context.fillStyle = '#e9e5d3';
  context.beginPath();
  context.arc(center, center, 32, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(163, 164, 160, 0.32)';
  context.beginPath();
  context.arc(118, 116, 8, 0, Math.PI * 2);
  context.arc(141, 134, 5, 0, Math.PI * 2);
  context.arc(124, 144, 3.5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(255, 249, 226, 0.35)';
  context.beginPath();
  context.arc(center, center, 32, Math.PI * 1.05, Math.PI * 1.65);
  context.stroke();
  const texture = toTexture(canvas, false);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
};

export const makeMistTexture = (): THREE.CanvasTexture => {
  const [canvas, context] = makeCanvas(512, 512);
  const gradient = context.createRadialGradient(256, 256, 20, 256, 256, 252);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
  gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.24)');
  gradient.addColorStop(0.78, 'rgba(255, 255, 255, 0.07)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 512);
  const texture = toTexture(canvas, false);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
};

export const makeShadowTexture = (): THREE.CanvasTexture => {
  const [canvas, context] = makeCanvas(256, 256);
  const gradient = context.createRadialGradient(128, 128, 6, 128, 128, 124);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
  gradient.addColorStop(0.45, 'rgba(0, 0, 0, 0.2)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const texture = toTexture(canvas, false);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
};

export const makeStarTexture = (): THREE.CanvasTexture => {
  const [canvas, context] = makeCanvas(32, 32);
  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 15);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.32, 'rgba(247, 240, 214, 0.9)');
  gradient.addColorStop(1, 'rgba(230, 226, 204, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 32, 32);
  const texture = toTexture(canvas, false);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
};

export const makeSmokeTexture = (): THREE.CanvasTexture => {
  const [canvas, context] = makeCanvas(64, 64);
  const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.25)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = toTexture(canvas, false);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
};


const tileNoise = (x: number, y: number, size: number, seed: number): number => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const wrap = (value: number): number => ((value % size) + size) % size;
  const hash = (a: number, b: number): number => {
    const value = Math.sin(wrap(a) * 127.1 + wrap(b) * 311.7 + seed) * 43758.5453;
    return value - Math.floor(value);
  };
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
};

export const makeRockTexture = (): THREE.CanvasTexture => {
  const size = 512;
  const [canvas, context] = makeCanvas(size, size);
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x / size) * 8;
      const ny = (y / size) * 8;
      const n1 = tileNoise(nx, ny * 0.5, 8, 3.1);
      const n2 = tileNoise(nx * 2, ny * 1.3, 16, 7.7);
      const n3 = tileNoise(nx * 4, ny * 2.2, 32, 13.4);
      const strata = Math.sin(y * 0.11 + Math.sin(x * 0.035) * 3.2) * 0.5 + 0.5;
      const band = Math.sin(y * 0.024 + n1 * 2.4) * 0.5 + 0.5;
      const value = 174 + n1 * 26 + n2 * 18 + n3 * 9 + (strata - 0.5) * 20 - band * 8;
      const warm = 3 + n2 * 5;
      const i = (y * size + x) * 4;
      image.data[i] = Math.max(0, Math.min(255, value + warm));
      image.data[i + 1] = Math.max(0, Math.min(255, value));
      image.data[i + 2] = Math.max(0, Math.min(255, value - warm * 0.6));
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  context.globalAlpha = 0.22;
  context.strokeStyle = '#584f45';
  context.lineWidth = 1;
  const random = seededRandom(191);
  for (let i = 0; i < 26; i += 1) {
    context.beginPath();
    let x = random() * size;
    let y = random() * size;
    context.moveTo(x, y);
    for (let j = 0; j < 4; j += 1) {
      x += (random() - 0.5) * 36;
      y += random() * 26;
      context.lineTo(x, y);
    }
    context.stroke();
  }
  context.globalAlpha = 0.16;
  context.fillStyle = '#f2e8d5';
  for (let i = 0; i < 160; i += 1) {
    context.beginPath();
    context.arc(random() * size, random() * size, 0.7 + random() * 2.2, 0, Math.PI * 2);
    context.fill();
  }
  return toTexture(canvas);
};
