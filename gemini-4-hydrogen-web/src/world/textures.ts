import * as THREE from "three";
import { createRng } from "../util/math";

export interface ProceduralTextures {
  grassMap: THREE.CanvasTexture;
  rockMap: THREE.CanvasTexture;
  stuccoMap: THREE.CanvasTexture;
  woodMap: THREE.CanvasTexture;
  shingleMap: THREE.CanvasTexture;
  stoneMap: THREE.CanvasTexture;
  softSprite: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not acquire 2D canvas context for procedural texture");
  }
  return [canvas, ctx];
}

function configureTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
  isColor = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextures {
  const aniso = Math.min(8, Math.max(1, maxAnisotropy));

  // 1. Soft meadow grass texture (organic painterly brush strokes)
  const [grassCanvas, gCtx] = makeCanvas(512);
  gCtx.fillStyle = "#6e965b";
  gCtx.fillRect(0, 0, 512, 512);
  const rngG = createRng(101);
  for (let i = 0; i < 4200; i++) {
    const x = rngG() * 512;
    const y = rngG() * 512;
    const len = 4 + rngG() * 9;
    const angle = -Math.PI * 0.5 + (rngG() - 0.5) * 0.7;
    const shade = rngG();
    gCtx.strokeStyle =
      shade < 0.33
        ? "rgba(88, 126, 72, 0.32)"
        : shade < 0.66
          ? "rgba(130, 166, 102, 0.28)"
          : "rgba(155, 178, 114, 0.22)";
    gCtx.lineWidth = 1 + rngG() * 1.4;
    gCtx.beginPath();
    gCtx.moveTo(x, y);
    gCtx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    gCtx.stroke();
  }
  const grassMap = configureTexture(grassCanvas, aniso, 3, 3, true);

  // 2. Stratified cliff rock texture
  const [rockCanvas, rCtx] = makeCanvas(512);
  const rGrad = rCtx.createLinearGradient(0, 0, 0, 512);
  rGrad.addColorStop(0, "#7c624c");
  rGrad.addColorStop(0.35, "#8b6d54");
  rGrad.addColorStop(0.7, "#6e5645");
  rGrad.addColorStop(1, "#57463a");
  rCtx.fillStyle = rGrad;
  rCtx.fillRect(0, 0, 512, 512);
  const rngR = createRng(202);
  for (let y = 0; y < 512; y += 6) {
    rCtx.fillStyle =
      rngR() > 0.5 ? "rgba(210, 185, 152, 0.09)" : "rgba(48, 34, 24, 0.14)";
    const h = 2 + rngR() * 6;
    rCtx.fillRect(0, y, 512, h);
  }
  for (let i = 0; i < 1100; i++) {
    const x = rngR() * 512;
    const y = rngR() * 512;
    const w = 6 + rngR() * 24;
    const h = 2 + rngR() * 5;
    rCtx.fillStyle =
      rngR() > 0.45 ? "rgba(56, 40, 30, 0.18)" : "rgba(182, 152, 120, 0.14)";
    rCtx.fillRect(x, y, w, h);
  }
  const rockMap = configureTexture(rockCanvas, aniso, 2, 2, true);

  // 3. Warm cream stucco plaster texture
  const [stuccoCanvas, sCtx] = makeCanvas(256);
  sCtx.fillStyle = "#f2eadc";
  sCtx.fillRect(0, 0, 256, 256);
  const rngS = createRng(303);
  for (let i = 0; i < 2400; i++) {
    const x = rngS() * 256;
    const y = rngS() * 256;
    const r = 1 + rngS() * 3.5;
    sCtx.fillStyle =
      rngS() > 0.5 ? "rgba(222, 208, 186, 0.25)" : "rgba(255, 252, 246, 0.28)";
    sCtx.beginPath();
    sCtx.arc(x, y, r, 0, Math.PI * 2);
    sCtx.fill();
  }
  const stuccoMap = configureTexture(stuccoCanvas, aniso, 2, 2, true);

  // 4. Warm timber plank texture
  const [woodCanvas, wCtx] = makeCanvas(256);
  wCtx.fillStyle = "#8a5f3d";
  wCtx.fillRect(0, 0, 256, 256);
  const rngW = createRng(404);
  for (let row = 0; row < 4; row++) {
    const y0 = row * 64;
    wCtx.fillStyle = row % 2 === 0 ? "rgba(120, 78, 46, 0.25)" : "rgba(154, 110, 70, 0.22)";
    wCtx.fillRect(0, y0, 256, 62);
    wCtx.fillStyle = "rgba(48, 28, 16, 0.45)";
    wCtx.fillRect(0, y0 + 62, 256, 2);
  }
  for (let i = 0; i < 420; i++) {
    const x = rngW() * 256;
    const y = rngW() * 256;
    const len = 18 + rngW() * 54;
    wCtx.fillStyle = rngW() > 0.5 ? "rgba(64, 38, 20, 0.16)" : "rgba(182, 134, 90, 0.14)";
    wCtx.fillRect(x, y, len, 1.5);
  }
  const woodMap = configureTexture(woodCanvas, aniso, 1, 1, true);

  // 5. Terracotta roof shingle texture
  const [shingleCanvas, shCtx] = makeCanvas(256);
  shCtx.fillStyle = "#b45e45";
  shCtx.fillRect(0, 0, 256, 256);
  const rngSh = createRng(505);
  const rows = 8;
  const cols = 8;
  const rh = 256 / rows;
  const cw = 256 / cols;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (cw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * cw + offset;
      const y = r * rh;
      const tone = (rngSh() - 0.5) * 26;
      const baseR = Math.round(178 + tone);
      const baseG = Math.round(92 + tone * 0.55);
      const baseB = Math.round(68 + tone * 0.45);
      shCtx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
      shCtx.fillRect(x + 1, y + 1, cw - 2, rh - 2);
      shCtx.fillStyle = "rgba(62, 26, 18, 0.25)";
      shCtx.fillRect(x, y + rh - 3, cw, 3);
    }
  }
  const shingleMap = configureTexture(shingleCanvas, aniso, 2, 2, true);

  // 6. Cobblestone / flagstone texture
  const [stoneCanvas, stCtx] = makeCanvas(256);
  stCtx.fillStyle = "#8a857a";
  stCtx.fillRect(0, 0, 256, 256);
  const rngSt = createRng(606);
  for (let r = 0; r < 6; r++) {
    const y = (r * 256) / 6;
    const h = 256 / 6;
    const shift = (r % 2) * 22;
    for (let c = -1; c < 6; c++) {
      const x = (c * 256) / 5 + shift;
      const w = 256 / 5;
      const v = 135 + Math.round((rngSt() - 0.5) * 34);
      stCtx.fillStyle = `rgb(${v + 4}, ${v}, ${v - 6})`;
      stCtx.beginPath();
      stCtx.roundRect(x + 2, y + 2, w - 4, h - 4, 6);
      stCtx.fill();
      stCtx.strokeStyle = "rgba(74, 82, 66, 0.4)";
      stCtx.lineWidth = 2;
      stCtx.stroke();
    }
  }
  const stoneMap = configureTexture(stoneCanvas, aniso, 2, 2, true);

  // 7. Soft radial glow/smoke sprite (non-repeat)
  const [spriteCanvas, spCtx] = makeCanvas(128);
  const rad = spCtx.createRadialGradient(64, 64, 2, 64, 64, 62);
  rad.addColorStop(0, "rgba(255, 255, 255, 1)");
  rad.addColorStop(0.35, "rgba(255, 255, 255, 0.58)");
  rad.addColorStop(1, "rgba(255, 255, 255, 0)");
  spCtx.fillStyle = rad;
  spCtx.fillRect(0, 0, 128, 128);
  const softSprite = new THREE.CanvasTexture(spriteCanvas);
  softSprite.colorSpace = THREE.SRGBColorSpace;
  softSprite.needsUpdate = true;

  return {
    grassMap,
    rockMap,
    stuccoMap,
    woodMap,
    shingleMap,
    stoneMap,
    softSprite,
    dispose: () => {
      grassMap.dispose();
      rockMap.dispose();
      stuccoMap.dispose();
      woodMap.dispose();
      shingleMap.dispose();
      stoneMap.dispose();
      softSprite.dispose();
    },
  };
}
