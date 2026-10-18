import * as THREE from 'three';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ProceduralTextures {
  grass: THREE.CanvasTexture;
  rock: THREE.CanvasTexture;
  wood: THREE.CanvasTexture;
  roofTile: THREE.CanvasTexture;
  plaster: THREE.CanvasTexture;
  softGlow: THREE.CanvasTexture;
}

export function createProceduralTextures(): ProceduralTextures {
  return {
    grass: makeGrassTexture(),
    rock: makeRockTexture(),
    wood: makeWoodTexture(),
    roofTile: makeRoofTileTexture(),
    plaster: makePlasterTexture(),
    softGlow: makeSoftGlowTexture(),
  };
}

function makeGrassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(101);

  ctx.fillStyle = '#7bb662';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 150; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const r = 10 + rand() * 24;
    const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
    const tone = rand() > 0.5 ? 'rgba(143, 199, 105, 0.24)' : 'rgba(92, 148, 74, 0.22)';
    grad.addColorStop(0, tone);
    grad.addColorStop(1, 'rgba(123, 182, 98, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineWidth = 1.4;
  for (let i = 0; i < 650; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const h = 3 + rand() * 5;
    ctx.strokeStyle = rand() > 0.45 ? 'rgba(155, 212, 114, 0.35)' : 'rgba(78, 132, 62, 0.32)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 2.5, y - h);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRockTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(202);

  ctx.fillStyle = '#8b7b6e';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 100; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const w = 18 + rand() * 48;
    const h = 6 + rand() * 16;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(164, 148, 134, 0.18)' : 'rgba(92, 80, 71, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, (rand() - 0.5) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 450; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const s = 1 + rand() * 2.2;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(205, 190, 175, 0.2)' : 'rgba(65, 55, 48, 0.24)';
    ctx.fillRect(x, y, s, s);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
