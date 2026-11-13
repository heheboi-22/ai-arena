import * as THREE from 'three';

export interface ProceduralTextures {
  grassMap: THREE.CanvasTexture | null;
  plasterMap: THREE.CanvasTexture | null;
  woodMap: THREE.CanvasTexture | null;
  roofMap: THREE.CanvasTexture | null;
  stoneMap: THREE.CanvasTexture | null;
  dispose(): void;
}

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeCanvasTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    draw(ctx, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(enableCanvas = typeof document !== 'undefined'): ProceduralTextures {
  if (!enableCanvas || typeof document === 'undefined') {
    return {
      grassMap: null,
      plasterMap: null,
      woodMap: null,
      roofMap: null,
      stoneMap: null,
      dispose: () => {},
    };
  }

  const grassMap = makeCanvasTexture(
    256,
    (ctx, size) => {
      const rand = seededRandom(101);
      ctx.fillStyle = '#f2f6eb';
      ctx.fillRect(0, 0, size, size);

      for (let i = 0; i < 900; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const r = 2 + rand() * 7;
        ctx.fillStyle = rand() > 0.45 ? 'rgba(255,255,255,0.18)' : 'rgba(182,206,164,0.22)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = 'rgba(154,184,136,0.24)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 320; i++) {
        const x = rand() * size;
        const y = rand() * size;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rand() - 0.5) * 4, y - 4 - rand() * 5);
        ctx.stroke();
      }
    },
    3,
    3
  );

  const plasterMap = makeCanvasTexture(
    256,
    (ctx, size) => {
      const rand = seededRandom(202);
      ctx.fillStyle = '#faf6ee';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 750; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const w = 4 + rand() * 14;
        const h = 3 + rand() * 8;
        ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.24)' : 'rgba(218,205,184,0.2)';
        ctx.fillRect(x, y, w, h);
      }
    },
    1,
    1
  );

  const woodMap = makeCanvasTexture(
    256,
    (ctx, size) => {
      const rand = seededRandom(303);
      ctx.fillStyle = '#efe2d3';
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 3) {
        const alpha = 0.06 + rand() * 0.14;
        ctx.fillStyle = `rgba(128, 86, 52, ${alpha.toFixed(3)})`;
        ctx.fillRect(0, y, size, 1 + rand() * 1.5);
      }
      ctx.strokeStyle = 'rgba(105, 68, 38, 0.22)';
      ctx.lineWidth = 1.5;
      for (let p = 1; p < 4; p++) {
        const py = (size / 4) * p;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(size, py);
        ctx.stroke();
      }
    },
    1,
    1
  );

  const roofMap = makeCanvasTexture(
    256,
    (ctx, size) => {
      const rand = seededRandom(404);
      ctx.fillStyle = '#f2e8e2';
      ctx.fillRect(0, 0, size, size);
      const rows = 8;
      const cols = 8;
      const rowH = size / rows;
      const colW = size / cols;

      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (colW * 0.5);
        for (let c = -1; c <= cols; c++) {
          const x = c * colW + offset;
          const y = r * rowH;
          const shade = 215 + Math.floor(rand() * 32);
          ctx.fillStyle = `rgb(${shade}, ${shade - 12}, ${shade - 18})`;
          ctx.beginPath();
          ctx.roundRect(x + 1.5, y + 1.5, colW - 3, rowH - 2, [2, 2, 7, 7]);
          ctx.fill();
          ctx.strokeStyle = 'rgba(110, 56, 42, 0.22)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
    },
    2,
    2
  );

  const stoneMap = makeCanvasTexture(
    256,
    (ctx, size) => {
      const rand = seededRandom(505);
      ctx.fillStyle = '#ece6df';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 650; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const r = 1.5 + rand() * 5;
        ctx.fillStyle = rand() > 0.48 ? 'rgba(255,255,255,0.22)' : 'rgba(92,82,76,0.2)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    2,
    2
  );

  return {
    grassMap,
    plasterMap,
    woodMap,
    roofMap,
    stoneMap,
    dispose: () => {
      grassMap.dispose();
      plasterMap.dispose();
      woodMap.dispose();
      roofMap.dispose();
      stoneMap.dispose();
    },
  };
}
