import * as THREE from "three";
import { createRng } from "./terrainMath";

export interface ProceduralTextures {
  grassBump: THREE.CanvasTexture;
  plasterMap: THREE.CanvasTexture;
  plasterBump: THREE.CanvasTexture;
  woodMap: THREE.CanvasTexture;
  woodBump: THREE.CanvasTexture;
  shingleMap: THREE.CanvasTexture;
  shingleBump: THREE.CanvasTexture;
  stoneMap: THREE.CanvasTexture;
  stoneBump: THREE.CanvasTexture;
  rockBump: THREE.CanvasTexture;
  sailMap: THREE.CanvasTexture;
  softGlowMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to acquire 2D canvas context for procedural textures.");
  }
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  repeatX: number,
  repeatY: number,
  anisotropy: number
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextures {
  const aniso = Math.min(maxAnisotropy || 4, 8);
  const all: THREE.Texture[] = [];

  // 1. Grass felt/meadow micro-bump
  const [gCanvas, gCtx] = makeCanvas(256);
  const rngG = createRng(101);
  gCtx.fillStyle = "#808080";
  gCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4200; i++) {
    const x = rngG() * 256;
    const y = rngG() * 256;
    const v = Math.floor(95 + rngG() * 75);
    gCtx.fillStyle = `rgb(${v},${v},${v})`;
    gCtx.fillRect(x, y, 2, 2 + rngG() * 3);
  }
  const grassBump = finalizeTexture(gCanvas, false, 6, 6, aniso);
  all.push(grassBump);

  // 2. Warm cream limewash plaster (color + bump)
  const [pCanvas, pCtx] = makeCanvas(256);
  const [pbCanvas, pbCtx] = makeCanvas(256);
  const rngP = createRng(202);
  pCtx.fillStyle = "#efe5d2";
  pCtx.fillRect(0, 0, 256, 256);
  pbCtx.fillStyle = "#808080";
  pbCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    const x = rngP() * 256;
    const y = rngP() * 256;
    const r = 2 + rngP() * 14;
    const delta = Math.floor((rngP() - 0.5) * 18);
    pCtx.fillStyle = `rgba(${238 + delta},${226 + delta},${205 + delta},0.16)`;
    pCtx.beginPath();
    pCtx.arc(x, y, r, 0, Math.PI * 2);
    pCtx.fill();

    const bv = Math.floor(128 + delta * 1.4);
    pbCtx.fillStyle = `rgba(${bv},${bv},${bv},0.22)`;
    pbCtx.beginPath();
    pbCtx.arc(x, y, r * 0.8, 0, Math.PI * 2);
    pbCtx.fill();
  }
  const plasterMap = finalizeTexture(pCanvas, true, 2, 2, aniso);
  const plasterBump = finalizeTexture(pbCanvas, false, 2, 2, aniso);
  all.push(plasterMap, plasterBump);

  // 3. Warm hand-planed wood grain
  const [wCanvas, wCtx] = makeCanvas(256);
  const [wbCanvas, wbCtx] = makeCanvas(256);
  const rngW = createRng(303);
  wCtx.fillStyle = "#8c5e3c";
  wCtx.fillRect(0, 0, 256, 256);
  wbCtx.fillStyle = "#7c7c7c";
  wbCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    const streak = Math.sin(y * 0.14) * 10 + (rngW() - 0.5) * 16;
    wCtx.fillStyle = `rgb(${Math.round(138 + streak)},${Math.round(92 + streak * 0.7)},${Math.round(58 + streak * 0.5)})`;
    wCtx.fillRect(0, y, 256, 2);
    const bv = Math.round(128 + streak * 1.6);
    wbCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    wbCtx.fillRect(0, y, 256, 2);
  }
  // Plank seams
  wCtx.fillStyle = "rgba(48, 28, 15, 0.45)";
  wbCtx.fillStyle = "rgb(45,45,45)";
  for (let y = 64; y < 256; y += 64) {
    wCtx.fillRect(0, y, 256, 2);
    wbCtx.fillRect(0, y, 256, 2);
  }
  const woodMap = finalizeTexture(wCanvas, true, 1.5, 1.5, aniso);
  const woodBump = finalizeTexture(wbCanvas, false, 1.5, 1.5, aniso);
  all.push(woodMap, woodBump);

  // 4. Handcrafted terracotta / cedar roof shingles
  const [sCanvas, sCtx] = makeCanvas(256);
  const [sbCanvas, sbCtx] = makeCanvas(256);
  const rngS = createRng(404);
  sCtx.fillStyle = "#9c4d39";
  sCtx.fillRect(0, 0, 256, 256);
  sbCtx.fillStyle = "#606060";
  sbCtx.fillRect(0, 0, 256, 256);
  const rows = 8;
  const cols = 6;
  const rowH = 256 / rows;
  const colW = 256 / cols;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * colW + offset;
      const y = r * rowH;
      const tone = (rngS() - 0.5) * 26;
      const rr = Math.round(182 + tone);
      const gg = Math.round(93 + tone * 0.65);
      const bb = Math.round(68 + tone * 0.5);
      sCtx.fillStyle = `rgb(${rr},${gg},${bb})`;
      sCtx.fillRect(x + 1, y + 1, colW - 2, rowH - 2);

      // Subtle lower lip shadow for tactile overlap
      sCtx.fillStyle = "rgba(58, 24, 18, 0.35)";
      sCtx.fillRect(x, y + rowH - 3, colW, 3);

      const grad = sbCtx.createLinearGradient(0, y, 0, y + rowH);
      grad.addColorStop(0, "#707070");
      grad.addColorStop(0.82, "#c8c8c8");
      grad.addColorStop(1, "#353535");
      sbCtx.fillStyle = grad;
      sbCtx.fillRect(x + 1, y + 1, colW - 2, rowH - 1);
    }
  }
  const shingleMap = finalizeTexture(sCanvas, true, 2.2, 2.2, aniso);
  const shingleBump = finalizeTexture(sbCanvas, false, 2.2, 2.2, aniso);
  all.push(shingleMap, shingleBump);

  // 5. Dressed limestone / cottage masonry
  const [stCanvas, stCtx] = makeCanvas(256);
  const [stbCanvas, stbCtx] = makeCanvas(256);
  const rngSt = createRng(505);
  stCtx.fillStyle = "#7a7268";
  stCtx.fillRect(0, 0, 256, 256);
  stbCtx.fillStyle = "#484848";
  stbCtx.fillRect(0, 0, 256, 256);
  const sRows = 6;
  const sRowH = 256 / sRows;
  for (let r = 0; r < sRows; r++) {
    let x = -(rngSt() * 24);
    const y = r * sRowH;
    while (x < 256) {
      const w = 36 + rngSt() * 34;
      const tone = (rngSt() - 0.5) * 26;
      stCtx.fillStyle = `rgb(${Math.round(156 + tone)},${Math.round(146 + tone * 0.92)},${Math.round(134 + tone * 0.85)})`;
      stCtx.fillRect(x + 2, y + 2, w - 4, sRowH - 4);
      const bv = Math.round(155 + tone);
      stbCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
      stbCtx.fillRect(x + 2, y + 2, w - 4, sRowH - 4);
      x += w;
    }
  }
  const stoneMap = finalizeTexture(stCanvas, true, 2.4, 1.8, aniso);
  const stoneBump = finalizeTexture(stbCanvas, false, 2.4, 1.8, aniso);
  all.push(stoneMap, stoneBump);

  // 6. Sculpted underside rock strata bump
  const [rkCanvas, rkCtx] = makeCanvas(256);
  const rngRk = createRng(606);
  rkCtx.fillStyle = "#808080";
  rkCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 6) {
    const band = Math.round(112 + Math.sin(y * 0.16) * 24 + (rngRk() - 0.5) * 24);
    rkCtx.fillStyle = `rgb(${band},${band},${band})`;
    rkCtx.fillRect(0, y, 256, 6);
  }
  for (let i = 0; i < 650; i++) {
    const x = rngRk() * 256;
    const y = rngRk() * 256;
    const v = Math.round(70 + rngRk() * 120);
    rkCtx.fillStyle = `rgba(${v},${v},${v},0.3)`;
    rkCtx.fillRect(x, y, 3 + rngRk() * 14, 2 + rngRk() * 5);
  }
  const rockBump = finalizeTexture(rkCanvas, false, 3, 3, aniso);
  all.push(rockBump);

  // 7. Woven cream canvas sail texture
  const [slCanvas, slCtx] = makeCanvas(128);
  slCtx.fillStyle = "#f4ecdc";
  slCtx.fillRect(0, 0, 128, 128);
  slCtx.strokeStyle = "rgba(145, 122, 92, 0.22)";
  slCtx.lineWidth = 1;
  for (let i = 0; i <= 128; i += 8) {
    slCtx.beginPath();
    slCtx.moveTo(i, 0);
    slCtx.lineTo(i, 128);
    slCtx.stroke();
    slCtx.beginPath();
    slCtx.moveTo(0, i);
    slCtx.lineTo(128, i);
    slCtx.stroke();
  }
  slCtx.strokeStyle = "rgba(122, 86, 54, 0.45)";
  slCtx.lineWidth = 3;
  slCtx.strokeRect(2, 2, 124, 124);
  const sailMap = finalizeTexture(slCanvas, true, 1, 1, aniso);
  all.push(sailMap);

  // 8. Soft radial glow/smoke sprite
  const [glCanvas, glCtx] = makeCanvas(128);
  const radGrad = glCtx.createRadialGradient(64, 64, 4, 64, 64, 62);
  radGrad.addColorStop(0, "rgba(255,255,255,1)");
  radGrad.addColorStop(0.42, "rgba(255,255,255,0.55)");
  radGrad.addColorStop(1, "rgba(255,255,255,0)");
  glCtx.fillStyle = radGrad;
  glCtx.fillRect(0, 0, 128, 128);
  const softGlowMap = new THREE.CanvasTexture(glCanvas);
  softGlowMap.colorSpace = THREE.SRGBColorSpace;
  softGlowMap.needsUpdate = true;
  all.push(softGlowMap);

  return {
    grassBump,
    plasterMap,
    plasterBump,
    woodMap,
    woodBump,
    shingleMap,
    shingleBump,
    stoneMap,
    stoneBump,
    rockBump,
    sailMap,
    softGlowMap,
    dispose: () => {
      for (const tex of all) {
        tex.dispose();
      }
    },
  };
}
