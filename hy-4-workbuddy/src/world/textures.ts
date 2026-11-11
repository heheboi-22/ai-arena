import * as THREE from 'three';
import { mulberry32 } from '../util/math';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

function finish(c: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

/** Overlapping terracotta shingles, drawn row by row. */
export function shingleTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 256);
  const rng = mulberry32(41);
  ctx.fillStyle = '#8e4630';
  ctx.fillRect(0, 0, 256, 256);
  const rows = 10;
  const rh = 256 / rows;
  for (let row = 0; row < rows; row++) {
    const offset = row % 2 ? -16 : 0;
    for (let x = offset; x < 256 + 32; x += 32) {
      const v = Math.floor(rng() * 22);
      ctx.fillStyle = `rgb(${158 + v}, ${78 + Math.floor(v * 0.6)}, ${56 + Math.floor(v * 0.4)})`;
      ctx.beginPath();
      ctx.roundRect(x + 1, row * rh + 1, 30, rh - 2, [2, 2, 7, 7]);
      ctx.fill();
      ctx.strokeStyle = 'rgba(74, 35, 24, .35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 226, 190, .10)';
      ctx.fillRect(x + 3, row * rh + 3, 26, 2);
    }
  }
  return finish(c, 2, 2);
}

/** Slightly grainy lime plaster for the cottage walls. */
export function plasterTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 256);
  const rng = mulberry32(7);
  ctx.fillStyle = '#efe1c4';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    const a = rng() * 0.09;
    ctx.fillStyle = rng() > 0.5 ? `rgba(120, 96, 66, ${a})` : `rgba(255, 255, 245, ${a})`;
    ctx.fillRect(x, y, 1 + rng() * 2, 1 + rng() * 2);
  }
  return finish(c, 1, 1);
}

/** Gentle meadow speckle: keeps the large grass plane from looking like plastic. */
export function grassTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 512);
  const rng = mulberry32(19);
  ctx.fillStyle = '#7eaa61';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 7000; i++) {
    const x = rng() * 512;
    const y = rng() * 512;
    const light = rng() > 0.55;
    ctx.fillStyle = light ? `rgba(176, 205, 126, ${0.05 + rng() * 0.18})`
                          : `rgba(61, 99, 49, ${0.04 + rng() * 0.16})`;
    ctx.fillRect(x, y, 1 + rng() * 2, 2 + rng() * 4);
  }
  return finish(c, 2, 2);
}

/** Soft radial blob used as a cheap contact shadow beneath objects. */
export function contactShadowTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(38, 30, 22, .42)');
  g.addColorStop(0.55, 'rgba(38, 30, 22, .18)');
  g.addColorStop(1, 'rgba(38, 30, 22, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A soft round puff for chimney smoke. */
export function softPuffTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, 'rgba(248, 244, 234, .92)');
  g.addColorStop(0.48, 'rgba(240, 235, 222, .42)');
  g.addColorStop(1, 'rgba(236, 231, 218, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Woven sail cloth with visible battens for the windmill. */
export function sailTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 256);
  ctx.fillStyle = '#e8dcc0';
  ctx.fillRect(0, 0, 128, 256);
  ctx.strokeStyle = 'rgba(150, 124, 88, .35)';
  ctx.lineWidth = 1;
  for (let y = 8; y < 256; y += 18) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(128, y);
    ctx.stroke();
  }
  for (let x = 14; x < 128; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(110, 82, 55, .5)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 124, 252);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Small brick pattern for the chimney. */
export function brickTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  const rng = mulberry32(83);
  ctx.fillStyle = '#8d5b47';
  ctx.fillRect(0, 0, 128, 128);
  for (let row = 0; row < 8; row++) {
    const off = row % 2 ? -16 : 0;
    for (let x = off; x < 128; x += 32) {
      const v = Math.floor(rng() * 18);
      ctx.fillStyle = `rgb(${150 + v}, ${94 + v}, ${72 + v})`;
      ctx.fillRect(x + 1, row * 16 + 1, 30, 14);
    }
  }
  return finish(c, 1, 2);
}
