import * as THREE from 'three';

export interface ProceduralTextureSet {
  grassColor: THREE.CanvasTexture;
  grassBump: THREE.CanvasTexture;
  stoneColor: THREE.CanvasTexture;
  stoneBump: THREE.CanvasTexture;
  roofColor: THREE.CanvasTexture;
  roofBump: THREE.CanvasTexture;
  woodColor: THREE.CanvasTexture;
  woodBump: THREE.CanvasTexture;
  cliffColor: THREE.CanvasTexture;
  cliffBump: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  softGlow: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create 2D canvas context for procedural textures.');
  }
  return [canvas, ctx];
}

function configureTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.max(1, Math.min(8, maxAnisotropy));
  tex.needsUpdate = true;
  return tex;
}

function seededRand(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createProceduralTextures(maxAnisotropy = 4): ProceduralTextureSet {
  const rand = seededRand(40921);

  // 1. Lush Meadow Grass Albedo + Bump
  const [grassC, grassCtx] = makeCanvas(256);
  const [grassB, grassBCtx] = makeCanvas(256);
  grassCtx.fillStyle = '#5c9d48';
  grassCtx.fillRect(0, 0, 256, 256);
  grassBCtx.fillStyle = '#808080';
  grassBCtx.fillRect(0, 0, 256, 256);

  const grassPalette = ['#68ae52', '#52913f', '#77bc59', '#4a8538', '#83c462'];
  for (let i = 0; i < 1800; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const r = 2 + rand() * 7;
    grassCtx.fillStyle = grassPalette[Math.floor(rand() * grassPalette.length)];
    grassCtx.globalAlpha = 0.28;
    grassCtx.beginPath();
    grassCtx.arc(x, y, r, 0, Math.PI * 2);
    grassCtx.fill();

    const bVal = Math.floor(105 + rand() * 50);
    grassBCtx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
    grassBCtx.globalAlpha = 0.35;
    grassBCtx.fillRect(x, y, 2, 5);
  }
  grassCtx.globalAlpha = 1;
  grassBCtx.globalAlpha = 1;

  // 2. Warm Limestone & Cobblestone Masonry Albedo + Bump
  const [stoneC, stoneCtx] = makeCanvas(256);
  const [stoneB, stoneBCtx] = makeCanvas(256);
  stoneCtx.fillStyle = '#7e7870';
  stoneCtx.fillRect(0, 0, 256, 256);
  stoneBCtx.fillStyle = '#383838';
  stoneBCtx.fillRect(0, 0, 256, 256);

  const rows = 8;
  const rowH = 256 / rows;
  const stoneShades = ['#a89f92', '#9b9286', '#b5ab9d', '#8e867a', '#c0b6a8'];
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const cols = 4 + (r % 2);
    const colW = 256 / cols;
    const offset = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * colW + offset;
      const w = colW - 3;
      const h = rowH - 3;
      stoneCtx.fillStyle = stoneShades[(r * 3 + c + 10) % stoneShades.length];
      stoneCtx.beginPath();
      stoneCtx.roundRect(x + 1.5, y + 1.5, w, h, 4);
      stoneCtx.fill();

      stoneBCtx.fillStyle = '#d8d8d8';
      stoneBCtx.beginPath();
      stoneBCtx.roundRect(x + 2, y + 2, w - 1, h - 1, 4);
      stoneBCtx.fill();
    }
  }

  // 3. Scalloped Terracotta Roof Shingles Albedo + Bump
  const [roofC, roofCtx] = makeCanvas(256);
  const [roofB, roofBCtx] = makeCanvas(256);
  roofCtx.fillStyle = '#9e4731';
  roofCtx.fillRect(0, 0, 256, 256);
  roofBCtx.fillStyle = '#404040';
  roofBCtx.fillRect(0, 0, 256, 256);

  const tileRows = 10;
  const tileH = 256 / tileRows;
  const tileColors = ['#b8533a', '#a94830', '#c45e43', '#983f29', '#cf684c'];
  for (let r = 0; r < tileRows; r++) {
    const y = r * tileH;
    const cols = 8;
    const colW = 256 / cols;
    const shift = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * colW + shift;
      roofCtx.fillStyle = tileColors[Math.floor(rand() * tileColors.length)];
      roofCtx.beginPath();
      roofCtx.roundRect(x + 1, y + 1, colW - 2, tileH - 2, [2, 2, 8, 8]);
      roofCtx.fill();

      roofBCtx.fillStyle = '#d4d4d4';
      roofBCtx.beginPath();
      roofBCtx.roundRect(x + 1.5, y + 1.5, colW - 3, tileH - 3, [2, 2, 7, 7]);
      roofBCtx.fill();
    }
  }

  // 4. Warm Cedar Wood Planks Albedo + Bump
  const [woodC, woodCtx] = makeCanvas(256);
  const [woodB, woodBCtx] = makeCanvas(256);
  woodCtx.fillStyle = '#7c5338';
  woodCtx.fillRect(0, 0, 256, 256);
  woodBCtx.fillStyle = '#808080';
  woodBCtx.fillRect(0, 0, 256, 256);

  const planks = 6;
  const plankW = 256 / planks;
  const woodTones = ['#875b3e', '#764e34', '#926445', '#6d472f'];
  for (let p = 0; p < planks; p++) {
    const x = p * plankW;
    woodCtx.fillStyle = woodTones[p % woodTones.length];
    woodCtx.fillRect(x + 1, 0, plankW - 2, 256);
    woodBCtx.fillStyle = '#bcbcbc';
    woodBCtx.fillRect(x + 1.5, 0, plankW - 3, 256);

    for (let g = 0; g < 22; g++) {
      const gx = x + 3 + rand() * (plankW - 6);
      woodCtx.strokeStyle = rand() > 0.5 ? 'rgba(50,30,16,0.22)' : 'rgba(180,130,90,0.16)';
      woodCtx.lineWidth = 1 + rand() * 1.5;
      woodCtx.beginPath();
      woodCtx.moveTo(gx, 0);
      woodCtx.lineTo(gx + (rand() - 0.5) * 4, 256);
      woodCtx.stroke();
    }
  }

  // 5. Stratified Basalt & Cliff Underside Rock Albedo + Bump
  const [cliffC, cliffCtx] = makeCanvas(256);
  const [cliffB, cliffBCtx] = makeCanvas(256);
  cliffCtx.fillStyle = '#5c5663';
  cliffCtx.fillRect(0, 0, 256, 256);
  cliffBCtx.fillStyle = '#787878';
  cliffBCtx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 65; i++) {
    const y = rand() * 256;
    const h = 4 + rand() * 16;
    const shade = Math.floor(72 + rand() * 44);
    cliffCtx.fillStyle = `rgb(${shade + 4},${shade},${shade + 10})`;
    cliffCtx.globalAlpha = 0.45;
    cliffCtx.fillRect(0, y, 256, h);

    const bShade = Math.floor(80 + rand() * 100);
    cliffBCtx.fillStyle = `rgb(${bShade},${bShade},${bShade})`;
    cliffBCtx.globalAlpha = 0.5;
    cliffBCtx.fillRect(0, y, 256, h * 0.7);
  }
  cliffCtx.globalAlpha = 1;
  cliffBCtx.globalAlpha = 1;

  // 6. Soft Radial Contact Shadow Disc
  const [shadowC, shadowCtx] = makeCanvas(128);
  const shadowGrad = shadowCtx.createRadialGradient(64, 64, 6, 64, 64, 62);
  shadowGrad.addColorStop(0, 'rgba(18, 24, 20, 0.62)');
  shadowGrad.addColorStop(0.55, 'rgba(18, 24, 20, 0.26)');
  shadowGrad.addColorStop(1, 'rgba(18, 24, 20, 0.0)');
  shadowCtx.fillStyle = shadowGrad;
  shadowCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shadowC);
  contactShadow.colorSpace = THREE.SRGBColorSpace;

  // 7. Soft Radial Glow Sprite (for sun/moon/lantern/fireflies)
  const [glowC, glowCtx] = makeCanvas(128);
  const glowGrad = glowCtx.createRadialGradient(64, 64, 2, 64, 64, 62);
  glowGrad.addColorStop(0, 'rgba(255, 250, 230, 1.0)');
  glowGrad.addColorStop(0.3, 'rgba(255, 225, 165, 0.55)');
  glowGrad.addColorStop(0.7, 'rgba(255, 195, 110, 0.14)');
  glowGrad.addColorStop(1, 'rgba(255, 180, 90, 0.0)');
  glowCtx.fillStyle = glowGrad;
  glowCtx.fillRect(0, 0, 128, 128);
  const softGlow = new THREE.CanvasTexture(glowC);
  softGlow.colorSpace = THREE.SRGBColorSpace;

  const grassColor = configureTexture(grassC, true, 4, 4, maxAnisotropy);
  const grassBump = configureTexture(grassB, false, 4, 4, maxAnisotropy);
  const stoneColor = configureTexture(stoneC, true, 2, 2, maxAnisotropy);
  const stoneBump = configureTexture(stoneB, false, 2, 2, maxAnisotropy);
  const roofColor = configureTexture(roofC, true, 3, 2, maxAnisotropy);
  const roofBump = configureTexture(roofB, false, 3, 2, maxAnisotropy);
  const woodColor = configureTexture(woodC, true, 2, 2, maxAnisotropy);
  const woodBump = configureTexture(woodB, false, 2, 2, maxAnisotropy);
  const cliffColor = configureTexture(cliffC, true, 3, 3, maxAnisotropy);
  const cliffBump = configureTexture(cliffB, false, 3, 3, maxAnisotropy);

  const all = [
    grassColor,
    grassBump,
    stoneColor,
    stoneBump,
    roofColor,
    roofBump,
    woodColor,
    woodBump,
    cliffColor,
    cliffBump,
    contactShadow,
    softGlow,
  ];

  return {
    grassColor,
    grassBump,
    stoneColor,
    stoneBump,
    roofColor,
    roofBump,
    woodColor,
    woodBump,
    cliffColor,
    cliffBump,
    contactShadow,
    softGlow,
    dispose: () => {
      for (const t of all) {
        t.dispose();
      }
    },
  };
}
