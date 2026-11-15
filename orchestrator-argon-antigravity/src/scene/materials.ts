import * as THREE from 'three';

export interface SceneMaterials {
  grass: THREE.MeshStandardMaterial;
  soilRim: THREE.MeshStandardMaterial;
  rockPrimary: THREE.MeshStandardMaterial;
  rockDark: THREE.MeshStandardMaterial;
  rockLight: THREE.MeshStandardMaterial;
  sandShore: THREE.MeshStandardMaterial;
  water: THREE.MeshStandardMaterial;
  wallCream: THREE.MeshStandardMaterial;
  woodWarm: THREE.MeshStandardMaterial;
  woodDark: THREE.MeshStandardMaterial;
  roofTerracotta: THREE.MeshStandardMaterial;
  stoneGrey: THREE.MeshStandardMaterial;
  windowGlass: THREE.MeshStandardMaterial;
  lanternGlow: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  sailCloth: THREE.MeshStandardMaterial;
  cloudMaterial: THREE.MeshStandardMaterial;
  smokeMaterial: THREE.MeshStandardMaterial;
  foliageMaterials: THREE.MeshStandardMaterial[];
  flowerMaterials: THREE.MeshStandardMaterial[];
  lilyPad: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createGrainBumpTexture(size = 128): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  let seed = 1337;
  const nextRand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < size * size; i++) {
    const val = Math.floor(110 + nextRand() * 38);
    const idx = i * 4;
    data[idx] = val;
    data[idx + 1] = val;
    data[idx + 2] = val;
    data[idx + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.needsUpdate = true;
  return tex;
}

export function createSoftParticleTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.72)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createRoofShingleTexture(size = 128): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / 16);
    const rowMod = y % 16;
    for (let x = 0; x < size; x++) {
      const offset = (row % 2) * 8;
      const colMod = (x + offset) % 16;
      const seam = rowMod < 2 || colMod < 1 ? 85 : 155 - rowMod * 2;
      const idx = (y * size + x) * 4;
      data[idx] = seam;
      data[idx + 1] = seam;
      data[idx + 2] = seam;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.needsUpdate = true;
  return tex;
}

export function createSceneMaterials(): SceneMaterials {
  const grainBump = createGrainBumpTexture();
  const shingleBump = createRoofShingleTexture();

  const grass = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.02,
    bumpMap: grainBump,
    bumpScale: 0.02,
  });

  const soilRim = new THREE.MeshStandardMaterial({
    color: 0x7c5c40,
    roughness: 0.92,
    metalness: 0.02,
    flatShading: true,
  });

  const rockPrimary = new THREE.MeshStandardMaterial({
    color: 0x76727b,
    roughness: 0.92,
    metalness: 0.04,
    flatShading: true,
  });

  const rockDark = new THREE.MeshStandardMaterial({
    color: 0x56535e,
    roughness: 0.95,
    metalness: 0.04,
    flatShading: true,
  });

  const rockLight = new THREE.MeshStandardMaterial({
    color: 0x9b959e,
    roughness: 0.9,
    metalness: 0.03,
    flatShading: true,
  });

  const sandShore = new THREE.MeshStandardMaterial({
    color: 0xd9c69c,
    roughness: 0.9,
    metalness: 0.01,
    bumpMap: grainBump,
    bumpScale: 0.015,
  });

  const water = new THREE.MeshStandardMaterial({
    color: 0x5296ab,
    roughness: 0.14,
    metalness: 0.1,
    transparent: true,
    opacity: 0.86,
  });

  const wallCream = new THREE.MeshStandardMaterial({
    color: 0xf4ecda,
    roughness: 0.86,
    metalness: 0.02,
    bumpMap: grainBump,
    bumpScale: 0.015,
  });

  const woodWarm = new THREE.MeshStandardMaterial({
    color: 0x986742,
    roughness: 0.82,
    metalness: 0.03,
  });

  const woodDark = new THREE.MeshStandardMaterial({
    color: 0x5e3e28,
    roughness: 0.85,
    metalness: 0.03,
  });

  const roofTerracotta = new THREE.MeshStandardMaterial({
    color: 0xc2694b,
    roughness: 0.78,
    metalness: 0.04,
    bumpMap: shingleBump,
    bumpScale: 0.035,
  });

  const stoneGrey = new THREE.MeshStandardMaterial({
    color: 0x8e898f,
    roughness: 0.9,
    metalness: 0.03,
    flatShading: true,
  });

  const windowGlass = new THREE.MeshStandardMaterial({
    color: 0x324154,
    emissive: 0xffbe5e,
    emissiveIntensity: 0.05,
    roughness: 0.22,
    metalness: 0.15,
  });

  const lanternGlow = new THREE.MeshStandardMaterial({
    color: 0xffe4b2,
    emissive: 0xffb347,
    emissiveIntensity: 0.1,
    roughness: 0.3,
  });

  const brass = new THREE.MeshStandardMaterial({
    color: 0xc8a35a,
    roughness: 0.42,
    metalness: 0.65,
  });

  const sailCloth = new THREE.MeshStandardMaterial({
    color: 0xf6efe0,
    roughness: 0.88,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const cloudMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8f4ec,
    roughness: 0.94,
    metalness: 0.0,
    transparent: true,
    opacity: 0.92,
  });

  const smokeMaterial = new THREE.MeshStandardMaterial({
    color: 0xedeae4,
    roughness: 0.95,
    metalness: 0,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });

  const foliageMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x5d9050, roughness: 0.88, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x4b7c46, roughness: 0.9, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x74a45a, roughness: 0.86, flatShading: true }),
  ];

  const flowerMaterials = [
    new THREE.MeshStandardMaterial({ color: 0xe67c6c, roughness: 0.75 }),
    new THREE.MeshStandardMaterial({ color: 0xf2c65a, roughness: 0.75 }),
    new THREE.MeshStandardMaterial({ color: 0xb48ecc, roughness: 0.75 }),
  ];

  const lilyPad = new THREE.MeshStandardMaterial({
    color: 0x5f9653,
    roughness: 0.75,
  });

  const allDisposables: Array<{ dispose: () => void }> = [
    grainBump,
    shingleBump,
    grass,
    soilRim,
    rockPrimary,
    rockDark,
    rockLight,
    sandShore,
    water,
    wallCream,
    woodWarm,
    woodDark,
    roofTerracotta,
    stoneGrey,
    windowGlass,
    lanternGlow,
    brass,
    sailCloth,
    cloudMaterial,
    smokeMaterial,
    lilyPad,
    ...foliageMaterials,
    ...flowerMaterials,
  ];

  return {
    grass,
    soilRim,
    rockPrimary,
    rockDark,
    rockLight,
    sandShore,
    water,
    wallCream,
    woodWarm,
    woodDark,
    roofTerracotta,
    stoneGrey,
    windowGlass,
    lanternGlow,
    brass,
    sailCloth,
    cloudMaterial,
    smokeMaterial,
    foliageMaterials,
    flowerMaterials,
    lilyPad,
    dispose: () => {
      for (const item of allDisposables) {
        item.dispose();
      }
    },
  };
}
