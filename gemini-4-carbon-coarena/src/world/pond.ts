import * as THREE from 'three';
import { createRng, lerp } from '../utils/math';
import { getProceduralTextures } from '../utils/textures';
import {
  getBrookFactor,
  getIslandOuterRadius,
  getIslandSurfaceHeight,
  getNormalizedIslandRadius,
  getPondBasinFactor,
  isPointInWater,
  LANDMARKS,
  POND_WATER_Y,
} from './terrainMath';

export interface PondRig {
  group: THREE.Group;
  spawnRipple: (x: number, z: number, strength?: number) => void;
  update: (
    dt: number,
    elapsed: number,
    wind: number,
    rainAmount: number,
    dayFactor: number,
    reducedMotion: boolean
  ) => void;
}

interface RippleSlot {
  active: boolean;
  x: number;
  z: number;
  age: number;
  maxAge: number;
  maxRadius: number;
  strength: number;
}

interface ReedCluster {
  pivot: THREE.Group;
  phase: number;
  stiffness: number;
}

interface LilyPadItem {
  group: THREE.Group;
  baseX: number;
  baseZ: number;
  phase: number;
}

const MAX_RIPPLES = 44;

export function createPond(): PondRig {
  const group = new THREE.Group();
  group.name = 'PondGroup';
  const textures = getProceduralTextures();
  const rng = createRng(7411);

  // 1. Subdivided Water Surface Mesh tailored to Pond Basin + Brook
  const { waterGeo, basePositions } = buildWaterSurfaceGeometry();
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x4e90a6,
    roughness: 0.14,
    metalness: 0.18,
    transparent: true,
    opacity: 0.86,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.receiveShadow = true;
  waterMesh.renderOrder = 1;
  waterMesh.name = 'PondWaterSurface';
  group.add(waterMesh);

  // 2. Pooled Pond Ripples (flat rings just above water surface, zero per-frame allocations)
  const rippleGeo = new THREE.RingGeometry(0.85, 1.0, 28);
  rippleGeo.rotateX(-Math.PI * 0.5);

  // Use per-instance color brightness to modulate fade while sharing one transparent material
  const rippleMat = new THREE.MeshBasicMaterial({
    color: 0xcbeeff,
    transparent: true,
    opacity: 0.48,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const rippleInstanced = new THREE.InstancedMesh(rippleGeo, rippleMat, MAX_RIPPLES);
  rippleInstanced.renderOrder = 2;
  rippleInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rippleInstanced.frustumCulled = false;

  const rippleSlots: RippleSlot[] = [];
  const dummyMat = new THREE.Matrix4();
  const dummyPos = new THREE.Vector3();
  const dummyQuat = new THREE.Quaternion();
  const dummyScale = new THREE.Vector3();
  const dummyColor = new THREE.Color();

  for (let i = 0; i < MAX_RIPPLES; i++) {
    rippleSlots.push({
      active: false,
      x: 0,
      z: 0,
      age: 0,
      maxAge: 1,
      maxRadius: 0.3,
      strength: 1,
    });
    dummyScale.set(0, 0, 0);
    dummyMat.compose(dummyPos, dummyQuat, dummyScale);
    rippleInstanced.setMatrixAt(i, dummyMat);
    rippleInstanced.setColorAt(i, dummyColor.setScalar(0));
  }
  if (rippleInstanced.instanceColor) {
    rippleInstanced.instanceColor.needsUpdate = true;
  }
  group.add(rippleInstanced);

  let nextRippleCursor = 0;

  function spawnRipple(x: number, z: number, strength = 1.0): void {
    const slot = rippleSlots[nextRippleCursor];
    nextRippleCursor = (nextRippleCursor + 1) % MAX_RIPPLES;
    slot.active = true;
    slot.x = x;
    slot.z = z;
    slot.age = 0;
    slot.maxAge = 0.85 + rng() * 0.45;
    slot.maxRadius = (0.22 + rng() * 0.18) * (0.85 + strength * 0.35);
    slot.strength = strength;
  }

  // Pre-compute candidate pond points so ambient/rain ripple spawning is O(1)
  const validWaterPoints: Array<[number, number]> = [];
  for (let i = 0; i < 160; i++) {
    const px = LANDMARKS.pond.x + (rng() * 2 - 1) * (LANDMARKS.pond.rx * 0.82);
    const pz = LANDMARKS.pond.z + (rng() * 2 - 1) * (LANDMARKS.pond.rz * 0.82);
    if (getIslandSurfaceHeight(px, pz) < POND_WATER_Y - 0.06) {
      validWaterPoints.push([px, pz]);
    }
  }

  // 3. Miniature Wooden Jetty on East Pond Shore (meets stepping-stone path)
  addPondJetty(group, textures.wood);

  // 4. Floating Lily Pads & Waterlily Blossoms
  const lilyPads = addLilyPads(group, rng);

  // 5. Swaying Shoreline Cattails / Reeds
  const reeds = addShorelineReeds(group, rng);

  // 6. Smooth River Pebbles along Shoreline
  addShorelinePebbles(group, rng);

  // 7. Miniature Cliffside Brook Waterfall & Mist Puffs
  const cascade = createBrookWaterfall(group, rng);

  let ambientRippleTimer = 0;
  let rainRippleAccum = 0;

  return {
    group,
    spawnRipple,
    update(dt, elapsed, wind, rainAmount, dayFactor, reducedMotion) {
      const motion = reducedMotion ? 0.2 : 1.0;

      // Adapt water color naturally to time of day & overcast rain
      const clearWaterColor = _cDayWater.clone().lerp(_cNightWater, 1 - dayFactor);
      const rainWaterColor = _cRainDayWater.clone().lerp(_cNightWater, (1 - dayFactor) * 0.85);
      waterMat.color.copy(clearWaterColor).lerp(rainWaterColor, rainAmount * 0.65);
      waterMat.roughness = lerp(0.14, 0.26, rainAmount * 0.6 + wind * 0.25);

      // Subtle vertex ripples across water surface
      const posAttr = waterGeo.attributes.position as THREE.BufferAttribute;
      const waveAmp = (0.004 + wind * 0.011 + rainAmount * 0.009) * motion;
      const waveSpeed = elapsed * (1.8 + wind * 2.4);

      for (let i = 0; i < posAttr.count; i++) {
        const bx = basePositions[i * 3];
        const by = basePositions[i * 3 + 1];
        const bz = basePositions[i * 3 + 2];
        const w1 = Math.sin(bx * 4.2 + bz * 3.1 + waveSpeed);
        const w2 = Math.cos(bx * 2.7 - bz * 4.8 + waveSpeed * 0.82);
        posAttr.setY(i, by + (w1 + w2) * 0.5 * waveAmp);
      }
      posAttr.needsUpdate = true;

      // Spawn frequent pond ripples during rain + occasional gentle clear-weather fish ripple
      if (validWaterPoints.length > 0) {
        if (rainAmount > 0.03) {
          const spawnsPerSec = rainAmount * 26;
          rainRippleAccum += dt * spawnsPerSec;
          while (rainRippleAccum >= 1) {
            rainRippleAccum -= 1;
            const [rx, rz] = validWaterPoints[Math.floor(rng() * validWaterPoints.length)];
            spawnRipple(rx, rz, 0.65 + rainAmount * 0.45);
          }
        } else {
          rainRippleAccum = 0;
        }

        ambientRippleTimer += dt;
        if (ambientRippleTimer > 2.3) {
          ambientRippleTimer = 0;
          const [rx, rz] = validWaterPoints[Math.floor(rng() * validWaterPoints.length)];
          spawnRipple(rx, rz, 0.45);
        }
      }

      // Advance pooled ripple instances
      rippleMat.color.copy(_cNightRipple).lerp(_cDayRipple, dayFactor);
      rippleMat.opacity = lerp(0.24, 0.52, rainAmount);
      let anyUpdated = false;

      for (let i = 0; i < MAX_RIPPLES; i++) {
        const slot = rippleSlots[i];
        if (!slot.active) continue;

        anyUpdated = true;
        slot.age += dt;
        if (slot.age >= slot.maxAge) {
          slot.active = false;
          dummyScale.set(0, 0, 0);
          dummyMat.compose(dummyPos, dummyQuat, dummyScale);
          rippleInstanced.setMatrixAt(i, dummyMat);
          rippleInstanced.setColorAt(i, dummyColor.setScalar(0));
          continue;
        }

        const t = slot.age / slot.maxAge;
        const radius = lerp(0.03, slot.maxRadius, Math.pow(t, 0.72));
        const fade = (1 - t) * (1 - t) * slot.strength;

        dummyPos.set(slot.x, POND_WATER_Y + 0.014, slot.z);
        dummyScale.set(radius, 1, radius);
        dummyMat.compose(dummyPos, dummyQuat, dummyScale);
        rippleInstanced.setMatrixAt(i, dummyMat);

        // Modulate RGB brightness for smooth per-ring fade out
        const lum = fade;
        rippleInstanced.setColorAt(i, dummyColor.setRGB(lum * 0.88, lum * 0.96, lum));
      }

      if (anyUpdated) {
        rippleInstanced.instanceMatrix.needsUpdate = true;
        if (rippleInstanced.instanceColor) {
          rippleInstanced.instanceColor.needsUpdate = true;
        }
      }

      // Bob lily pads gently
      for (const pad of lilyPads) {
        const bob = Math.sin(elapsed * 1.9 + pad.phase) * (0.005 + rainAmount * 0.006) * motion;
        const drift = Math.sin(elapsed * 0.9 + pad.phase) * 0.015 * wind * motion;
        pad.group.position.set(pad.baseX + drift, POND_WATER_Y + 0.006 + bob, pad.baseZ + drift * 0.5);
        pad.group.rotation.z = Math.sin(elapsed * 2.1 + pad.phase) * 0.04 * (0.3 + wind + rainAmount) * motion;
      }

      // Sway shoreline reeds with shared wind state (stops when wind === 0)
      for (const reed of reeds) {
        const gust = Math.sin(elapsed * (2.6 + wind * 2.8) + reed.phase) * 0.065 * wind * motion;
        const steady = wind * 0.19 * reed.stiffness;
        reed.pivot.rotation.z = -(steady + gust) * 0.88;
        reed.pivot.rotation.x = (steady + gust) * 0.47;
      }

      // Update brook waterfall & mist
      cascade.update(dt, elapsed, rainAmount, dayFactor, motion);
    },
  };
}

const _cDayWater = new THREE.Color(0x4c93ab);
const _cRainDayWater = new THREE.Color(0x426f84);
const _cNightWater = new THREE.Color(0x1f4259);
const _cDayRipple = new THREE.Color(0xd8f4ff);
const _cNightRipple = new THREE.Color(0x74a9c4);

function buildWaterSurfaceGeometry(): {
  waterGeo: THREE.BufferGeometry;
  basePositions: Float32Array;
} {
  const minX = -3.05;
  const maxX = 0.72;
  const minZ = -0.15;
  const maxZ = 4.18;
  const cols = 42;
  const rows = 46;

  const gridPos: number[] = [];
  const gridValid: boolean[] = [];

  for (let r = 0; r <= rows; r++) {
    const z = lerp(minZ, maxZ, r / rows);
    for (let c = 0; c <= cols; c++) {
      const x = lerp(minX, maxX, c / cols);
      const normR = getNormalizedIslandRadius(x, z);
      const terrainY = getIslandSurfaceHeight(x, z);
      const inBasin = getPondBasinFactor(x, z) > 0.02 || getBrookFactor(x, z) > 0.04;
      gridPos.push(x, POND_WATER_Y, z);
      // Include slightly up the sloped sandy bank so water edges tuck neatly beneath terrain
      gridValid.push(inBasin && normR <= 1.005 && terrainY < POND_WATER_Y + 0.085);
    }
  }

  const stride = cols + 1;
  const indices: number[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * stride + c;
      const b = a + 1;
      const d = (r + 1) * stride + c;
      const e = d + 1;

      if (gridValid[a] || gridValid[b] || gridValid[d]) {
        indices.push(a, d, b);
      }
      if (gridValid[b] || gridValid[d] || gridValid[e]) {
        indices.push(b, d, e);
      }
    }
  }

  const basePositions = new Float32Array(gridPos);
  const waterGeo = new THREE.BufferGeometry();
  waterGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(gridPos), 3));
  waterGeo.setIndex(indices);
  waterGeo.computeVertexNormals();

  return { waterGeo, basePositions };
}

function addPondJetty(parent: THREE.Group, woodTex: THREE.CanvasTexture): void {
  const jettyGroup = new THREE.Group();
  // East bank where stepping-stone path reaches the shoreline
  jettyGroup.position.set(-0.22, POND_WATER_Y + 0.08, 1.24);
  jettyGroup.rotation.y = -0.22;

  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    color: 0x916443,
    roughness: 0.86,
  });
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x5c3d28,
    roughness: 0.9,
  });

  // 4 pilings extending into pond bed
  for (const px of [-0.32, 0.22]) {
    for (const pz of [-0.16, 0.16]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.42, 7), postMat);
      post.position.set(px, -0.12, pz);
      post.castShadow = true;
      jettyGroup.add(post);
    }
  }

  // Stringer beams
  for (const pz of [-0.14, 0.14]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.035, 0.035), postMat);
    beam.position.set(-0.04, 0.02, pz);
    jettyGroup.add(beam);
  }

  // Individual miniature timber planks
  for (let i = 0; i < 6; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.026, 0.42), woodMat);
    plank.position.set(-0.35 + i * 0.122, 0.05, 0);
    plank.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.018;
    plank.castShadow = true;
    plank.receiveShadow = true;
    jettyGroup.add(plank);
  }

  parent.add(jettyGroup);
}

function addLilyPads(parent: THREE.Group, rng: () => number): LilyPadItem[] {
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x5d9c54,
    roughness: 0.72,
  });
  const petalPink = new THREE.MeshStandardMaterial({ color: 0xf6b8c6, roughness: 0.65 });
  const petalCream = new THREE.MeshStandardMaterial({ color: 0xfff4d9, roughness: 0.65 });
  const centerMat = new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.7 });

  const specs = [
    { x: -1.48, z: 1.05, r: 0.13, flower: 'pink' },
    { x: -1.26, z: 0.92, r: 0.095, flower: null },
    { x: -0.92, z: 1.72, r: 0.125, flower: 'cream' },
    { x: -1.14, z: 1.84, r: 0.088, flower: null },
    { x: -1.78, z: 1.48, r: 0.115, flower: 'pink' },
  ] as const;

  const items: LilyPadItem[] = [];

  for (const s of specs) {
    if (!isPointInWater(s.x, s.z)) continue;
    const g = new THREE.Group();
    g.position.set(s.x, POND_WATER_Y + 0.006, s.z);

    // Notched circular lily pad (pacman-style wedge ~325 deg)
    const padGeo = new THREE.CylinderGeometry(s.r, s.r * 0.96, 0.014, 14, 1, false, 0, Math.PI * 1.82);
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.rotation.y = rng() * Math.PI * 2;
    pad.receiveShadow = true;
    g.add(pad);

    if (s.flower) {
      const pMat = s.flower === 'pink' ? petalPink : petalCream;
      const flowerGroup = new THREE.Group();
      flowerGroup.position.y = 0.016;
      for (let p = 0; p < 6; p++) {
        const angle = (p / 6) * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.055, 5), pMat);
        petal.position.set(Math.cos(angle) * 0.024, 0.012, Math.sin(angle) * 0.024);
        petal.rotation.z = -Math.cos(angle) * 0.65;
        petal.rotation.x = Math.sin(angle) * 0.65;
        flowerGroup.add(petal);
      }
      const stamen = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), centerMat);
      stamen.position.y = 0.018;
      flowerGroup.add(stamen);
      g.add(flowerGroup);
    }

    parent.add(g);
    items.push({
      group: g,
      baseX: s.x,
      baseZ: s.z,
      phase: rng() * Math.PI * 2,
    });
  }

  return items;
}

function addShorelineReeds(parent: THREE.Group, rng: () => number): ReedCluster[] {
  const stalkMat = new THREE.MeshStandardMaterial({ color: 0x5c8c4a, roughness: 0.86 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x6b4429, roughness: 0.92 });

  const spots: ReadonlyArray<readonly [number, number]> = [
    [-2.25, 0.95],
    [-2.42, 1.32],
    [-2.18, 1.88],
    [-0.78, 0.32],
    [-0.52, 2.22],
    [-1.32, 2.38],
  ];

  const clusters: ReedCluster[] = [];

  for (const [bx, bz] of spots) {
    const groundY = getIslandSurfaceHeight(bx, bz);
    const baseY = Math.max(groundY - 0.04, POND_WATER_Y - 0.08);
    const pivot = new THREE.Group();
    pivot.position.set(bx, baseY, bz);

    const count = 4 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
      const h = 0.34 + rng() * 0.22;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, h, 5), stalkMat);
      const ox = (rng() - 0.5) * 0.14;
      const oz = (rng() - 0.5) * 0.14;
      stalk.position.set(ox, h * 0.5, oz);
      stalk.rotation.set((rng() - 0.5) * 0.18, 0, (rng() - 0.5) * 0.18);
      stalk.castShadow = true;
      pivot.add(stalk);

      if (i < 2) {
        const cattail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.09, 6), headMat);
        cattail.position.set(0, h * 0.34, 0);
        stalk.add(cattail);
      }
    }

    parent.add(pivot);
    clusters.push({
      pivot,
      phase: rng() * Math.PI * 2,
      stiffness: 0.75 + rng() * 0.4,
    });
  }

  return clusters;
}

function addShorelinePebbles(parent: THREE.Group, rng: () => number): void {
  const pebbleMat = new THREE.MeshStandardMaterial({
    color: 0x9b958a,
    roughness: 0.85,
    flatShading: true,
  });

  const angles = [0.65, 0.82, 1.95, 2.15, 2.85, 3.65, 4.35, 5.15];
  for (const ang of angles) {
    // Walk outward from pond center until right at shoreline height
    for (let d = 0.65; d <= 1.25; d += 0.06) {
      const px = LANDMARKS.pond.x + Math.cos(ang) * LANDMARKS.pond.rx * d;
      const pz = LANDMARKS.pond.z + Math.sin(ang) * LANDMARKS.pond.rz * d;
      const py = getIslandSurfaceHeight(px, pz);
      if (py >= POND_WATER_Y - 0.01 && py <= POND_WATER_Y + 0.08) {
        const count = 2 + Math.floor(rng() * 2);
        for (let k = 0; k < count; k++) {
          const r = 0.055 + rng() * 0.065;
          const geo = new THREE.DodecahedronGeometry(r, 0);
          geo.scale(1.25, 0.62, 1.05);
          const rock = new THREE.Mesh(geo, pebbleMat);
          rock.position.set(
            px + (rng() - 0.5) * 0.18,
            py + r * 0.25,
            pz + (rng() - 0.5) * 0.18
          );
          rock.rotation.set(rng() * 0.4, rng() * Math.PI * 2, rng() * 0.4);
          rock.castShadow = true;
          rock.receiveShadow = true;
          parent.add(rock);
        }
        break;
      }
    }
  }
}

function createBrookWaterfall(
  parent: THREE.Group,
  rng: () => number
): {
  update: (
    dt: number,
    elapsed: number,
    rainAmount: number,
    dayFactor: number,
    motion: number
  ) => void;
} {
  const theta = Math.atan2(LANDMARKS.cascadeOut.z, LANDMARKS.cascadeOut.x);
  const rimR = getIslandOuterRadius(theta) * 0.99;
  const lipX = Math.cos(theta) * rimR;
  const lipZ = Math.sin(theta) * rimR;
  const lipY = POND_WATER_Y - 0.03;

  const dirX = Math.cos(theta);
  const dirZ = Math.sin(theta);

  // Curved waterfall ribbon arching slightly over the rocky rim
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(lipX - dirX * 0.18, lipY + 0.01, lipZ - dirZ * 0.18),
    new THREE.Vector3(lipX + dirX * 0.06, lipY - 0.08, lipZ + dirZ * 0.06),
    new THREE.Vector3(lipX + dirX * 0.16, lipY - 0.68, lipZ + dirZ * 0.16),
    new THREE.Vector3(lipX + dirX * 0.2, lipY - 1.48, lipZ + dirZ * 0.2),
  ]);

  const fallGeo = new THREE.TubeGeometry(curve, 14, 0.095, 6, false);
  fallGeo.scale(1.0, 1.0, 1.0);
  const fallMat = new THREE.MeshStandardMaterial({
    color: 0xaadfed,
    roughness: 0.2,
    transparent: true,
    opacity: 0.76,
  });
  const fallMesh = new THREE.Mesh(fallGeo, fallMat);
  parent.add(fallMesh);

  // Pooled mist droplets rising & dissolving at the base of the cascade
  const mistGeo = new THREE.IcosahedronGeometry(0.095, 0);
  const mistItems: Array<{
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    age: number;
    life: number;
    ox: number;
    oz: number;
  }> = [];

  for (let i = 0; i < 8; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xeaf8ff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(mistGeo, mat);
    parent.add(mesh);
    mistItems.push({
      mesh,
      mat,
      age: (i / 8) * 1.2,
      life: 1.2,
      ox: (rng() - 0.5) * 0.28,
      oz: (rng() - 0.5) * 0.28,
    });
  }

  const mistBaseX = lipX + dirX * 0.2;
  const mistBaseY = lipY - 1.45;
  const mistBaseZ = lipZ + dirZ * 0.2;

  return {
    update(dt, elapsed, rainAmount, dayFactor, motion) {
      // Swell waterfall slightly during rain
      const swell = 1 + rainAmount * 0.25 + Math.sin(elapsed * 7.5) * 0.04 * motion;
      fallMesh.scale.set(1, 1, 1);
      fallMat.opacity = lerp(0.55, 0.84, dayFactor) * (0.9 + rainAmount * 0.1);
      fallMat.color.setHex(0xaadfed).lerp(_cNightCascade, (1 - dayFactor) * 0.72);

      for (const m of mistItems) {
        m.age += dt * (0.85 + rainAmount * 0.45) * Math.max(0.35, motion);
        if (m.age >= m.life) m.age -= m.life;
        const t = m.age / m.life;
        m.mesh.position.set(
          mistBaseX + m.ox * (0.6 + t),
          mistBaseY - t * 0.35 + Math.sin(t * Math.PI) * 0.14,
          mistBaseZ + m.oz * (0.6 + t)
        );
        m.mesh.scale.setScalar(lerp(0.6, 1.65, t) * swell);
        m.mat.opacity = Math.sin(t * Math.PI) * 0.48 * lerp(0.55, 1.0, dayFactor);
      }
    },
  };
}

const _cNightCascade = new THREE.Color(0x4c7999);
