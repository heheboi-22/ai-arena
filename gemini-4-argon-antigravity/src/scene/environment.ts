import * as THREE from 'three';
import {
  POND_CENTER,
  POND_RADIUS,
  POND_WATER_Y,
  getIslandSurfaceHeight,
  isInsideIsland,
} from './island';

interface SkyKeyframe {
  hour: number;
  top: THREE.Color;
  horizon: THREE.Color;
  bottom: THREE.Color;
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  cloudColor: THREE.Color;
  waterColor: THREE.Color;
  nightFactor: number;
}

const SKY_KEYFRAMES: SkyKeyframe[] = [
  {
    hour: 0.0,
    top: new THREE.Color(0x0d172a),
    horizon: new THREE.Color(0x23385c),
    bottom: new THREE.Color(0x15233b),
    sunColor: new THREE.Color(0x8bb4f7),
    sunIntensity: 0.0,
    hemiSky: new THREE.Color(0x567ab8),
    hemiGround: new THREE.Color(0x384963),
    hemiIntensity: 0.88,
    cloudColor: new THREE.Color(0x52678a),
    waterColor: new THREE.Color(0x27506b),
    nightFactor: 1.0,
  },
  {
    hour: 5.5,
    top: new THREE.Color(0x3a4e7a),
    horizon: new THREE.Color(0xe89b7e),
    bottom: new THREE.Color(0x6e6882),
    sunColor: new THREE.Color(0xffad75),
    sunIntensity: 0.95,
    hemiSky: new THREE.Color(0xdba48c),
    hemiGround: new THREE.Color(0x6b606e),
    hemiIntensity: 0.9,
    cloudColor: new THREE.Color(0xf2cab6),
    waterColor: new THREE.Color(0x4d7d99),
    nightFactor: 0.45,
  },
  {
    hour: 8.5,
    top: new THREE.Color(0x5da4de),
    horizon: new THREE.Color(0xd8effc),
    bottom: new THREE.Color(0x8ec0e0),
    sunColor: new THREE.Color(0xfff2d6),
    sunIntensity: 1.85,
    hemiSky: new THREE.Color(0xdbf0ff),
    hemiGround: new THREE.Color(0x82997a),
    hemiIntensity: 0.98,
    cloudColor: new THREE.Color(0xffffff),
    waterColor: new THREE.Color(0x52a3c7),
    nightFactor: 0.0,
  },
  {
    hour: 12.5,
    top: new THREE.Color(0x4990d4),
    horizon: new THREE.Color(0xdff2fc),
    bottom: new THREE.Color(0x91c4e3),
    sunColor: new THREE.Color(0xfff9eb),
    sunIntensity: 2.05,
    hemiSky: new THREE.Color(0xe6f5ff),
    hemiGround: new THREE.Color(0x879e7e),
    hemiIntensity: 1.02,
    cloudColor: new THREE.Color(0xffffff),
    waterColor: new THREE.Color(0x4ca3c9),
    nightFactor: 0.0,
  },
  {
    hour: 16.0,
    top: new THREE.Color(0x5493c9),
    horizon: new THREE.Color(0xf7e4cc),
    bottom: new THREE.Color(0x9ab8cf),
    sunColor: new THREE.Color(0xffe1b0),
    sunIntensity: 1.92,
    hemiSky: new THREE.Color(0xfff0d9),
    hemiGround: new THREE.Color(0x8c9678),
    hemiIntensity: 1.0,
    cloudColor: new THREE.Color(0xfff8ed),
    waterColor: new THREE.Color(0x529dbd),
    nightFactor: 0.0,
  },
  {
    hour: 18.5,
    top: new THREE.Color(0x374775),
    horizon: new THREE.Color(0xf08154),
    bottom: new THREE.Color(0x69546e),
    sunColor: new THREE.Color(0xff8542),
    sunIntensity: 1.48,
    hemiSky: new THREE.Color(0xe8906b),
    hemiGround: new THREE.Color(0x6e5a61),
    hemiIntensity: 0.9,
    cloudColor: new THREE.Color(0xf7b294),
    waterColor: new THREE.Color(0x4b748f),
    nightFactor: 0.4,
  },
  {
    hour: 20.5,
    top: new THREE.Color(0x162340),
    horizon: new THREE.Color(0x363b61),
    bottom: new THREE.Color(0x1f2a47),
    sunColor: new THREE.Color(0x8bb4f7),
    sunIntensity: 0.1,
    hemiSky: new THREE.Color(0x5674ab),
    hemiGround: new THREE.Color(0x36445c),
    hemiIntensity: 0.85,
    cloudColor: new THREE.Color(0x586b8a),
    waterColor: new THREE.Color(0x2b5570),
    nightFactor: 0.9,
  },
  {
    hour: 24.0,
    top: new THREE.Color(0x0d172a),
    horizon: new THREE.Color(0x23385c),
    bottom: new THREE.Color(0x15233b),
    sunColor: new THREE.Color(0x8bb4f7),
    sunIntensity: 0.0,
    hemiSky: new THREE.Color(0x567ab8),
    hemiGround: new THREE.Color(0x384963),
    hemiIntensity: 0.88,
    cloudColor: new THREE.Color(0x52678a),
    waterColor: new THREE.Color(0x27506b),
    nightFactor: 1.0,
  },
];

export interface EnvironmentComponents {
  root: THREE.Group;
  getNightFactor: () => number;
  update: (
    dt: number,
    timeOfDay: number,
    rainFactor: number,
    windFactor: number,
    reducedMotion: boolean
  ) => void;
}

export function createEnvironment(
  scene: THREE.Scene,
  waterMaterial: THREE.MeshStandardMaterial,
  chimneyWorldPos: THREE.Vector3
): EnvironmentComponents {
  const root = new THREE.Group();
  root.name = 'EnvironmentRoot';

  // 1. Sky Dome with Custom Gradient + Sun/Moon Halo + Stars Shader
  const skyUniforms = {
    uTopColor: { value: new THREE.Color(0x5493c9) },
    uHorizonColor: { value: new THREE.Color(0xf5dfc4) },
    uBottomColor: { value: new THREE.Color(0x668399) },
    uSunDir: { value: new THREE.Vector3(0.5, 0.5, 0.5).normalize() },
    uSunColor: { value: new THREE.Color(0xffe1b0) },
    uSunStrength: { value: 1.0 },
    uStarIntensity: { value: 0.0 },
  };

  const skyGeo = new THREE.SphereGeometry(68, 32, 24);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uBottomColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uSunStrength;
      uniform float uStarIntensity;
      varying vec3 vWorldPosition;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        vec3 dir = normalize(vWorldPosition - cameraPosition);
        float horizonY = -0.16;
        float y = dir.y - horizonY;

        vec3 col;
        if (y >= 0.0) {
          float t = clamp(y / 0.36, 0.0, 1.0);
          col = mix(uHorizonColor, uTopColor, smoothstep(0.0, 1.0, t));
        } else {
          float t = clamp(-y / 0.42, 0.0, 1.0);
          col = mix(uHorizonColor, uBottomColor, smoothstep(0.0, 1.0, t));
        }

        // Subtle sun disc & atmospheric glow
        float sunAmt = max(dot(dir, uSunDir), 0.0);
        col += uSunColor * pow(sunAmt, 14.0) * 0.28 * uSunStrength;
        col += uSunColor * smoothstep(0.996, 0.9992, sunAmt) * 0.75 * uSunStrength;

        // Crisp procedural circular night stars in upper sky
        if (uStarIntensity > 0.01 && y > 0.02) {
          vec3 scaled = dir * 185.0;
          vec3 grid = floor(scaled);
          vec3 cellUv = fract(scaled) - 0.5;
          float h = hash(grid);
          if (h > 0.991) {
            float dist = length(cellUv);
            float pointShape = smoothstep(0.32, 0.04, dist);
            float starFade = smoothstep(0.02, 0.22, y) * uStarIntensity;
            float brightness = (h - 0.991) / 0.009;
            col += vec3(0.9, 0.94, 1.0) * pointShape * brightness * starFade * 1.15;
          }
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  root.add(skyDome);

  // Subtle exponential fog to blend distant sky & clouds
  const fog = new THREE.FogExp2(0xe8d8c3, 0.0085);
  scene.fog = fog;

  // 2. Lights: Sun Directional Light, Moon Rim Light, Hemisphere Light
  const sunLight = new THREE.DirectionalLight(0xffe1b0, 1.9);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 36;
  const shadowBounds = 7.8;
  sunLight.shadow.camera.left = -shadowBounds;
  sunLight.shadow.camera.right = shadowBounds;
  sunLight.shadow.camera.top = shadowBounds;
  sunLight.shadow.camera.bottom = -shadowBounds;
  sunLight.shadow.bias = -0.0006;
  sunLight.shadow.normalBias = 0.02;
  root.add(sunLight);

  // Cool silver-blue moonlight so nighttime remains atmospheric yet clearly readable
  const moonLight = new THREE.DirectionalLight(0x8cb8ff, 0.0);
  moonLight.position.set(-9, 11, -7);
  root.add(moonLight);

  const hemiLight = new THREE.HemisphereLight(0xfff0d9, 0x8c9678, 1.0);
  root.add(hemiLight);

  // Upward atmospheric bounce light to sculpt the rocky underside facets
  const undersideBounceLight = new THREE.DirectionalLight(0xd9c3ab, 0.55);
  undersideBounceLight.position.set(5, -10, 8);
  root.add(undersideBounceLight);

  // 3. Stylized 3D Clouds
  const cloudMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff8ed,
    roughness: 0.92,
    metalness: 0.0,
    flatShading: true,
  });

  const cloudsData = createClouds(cloudMaterial);
  root.add(cloudsData.group);

  // 4. Pooled 3D Rain System (LineSegments)
  const rainSystem = createRainSystem();
  root.add(rainSystem.mesh);

  // 5. Pooled Pond Ripples System
  const rippleSystem = createRippleSystem();
  root.add(rippleSystem.group);

  // 6. Pooled Chimney Smoke System
  const smokeSystem = createSmokeSystem(chimneyWorldPos);
  root.add(smokeSystem.group);

  // Scratch objects to avoid per-frame allocations
  const tmpTop = new THREE.Color();
  const tmpHorizon = new THREE.Color();
  const tmpBottom = new THREE.Color();
  const tmpSunCol = new THREE.Color();
  const tmpHemiSky = new THREE.Color();
  const tmpHemiGround = new THREE.Color();
  const tmpCloudCol = new THREE.Color();
  const tmpWaterCol = new THREE.Color();

  const rainSkyTopDay = new THREE.Color(0x526478);
  const rainSkyHorizonDay = new THREE.Color(0x8899a8);
  const rainSkyBottomDay = new THREE.Color(0x485868);
  const rainCloudDay = new THREE.Color(0x7c8b99);
  const rainWaterDay = new THREE.Color(0x3d6d82);

  const rainSkyTopNight = new THREE.Color(0x111b2b);
  const rainSkyHorizonNight = new THREE.Color(0x233247);
  const rainCloudNight = new THREE.Color(0x41536e);

  const rainTintTop = new THREE.Color();
  const rainTintHorizon = new THREE.Color();
  const rainTintCloud = new THREE.Color();

  let currentNightFactor = 0;

  const update = (
    dt: number,
    timeOfDay: number,
    rainFactor: number,
    windFactor: number,
    reducedMotion: boolean
  ) => {
    const h = ((timeOfDay % 24) + 24) % 24;

    // Find surrounding keyframes
    let k0 = SKY_KEYFRAMES[0];
    let k1 = SKY_KEYFRAMES[1];
    for (let i = 0; i < SKY_KEYFRAMES.length - 1; i++) {
      if (h >= SKY_KEYFRAMES[i].hour && h <= SKY_KEYFRAMES[i + 1].hour) {
        k0 = SKY_KEYFRAMES[i];
        k1 = SKY_KEYFRAMES[i + 1];
        break;
      }
    }

    const span = Math.max(0.0001, k1.hour - k0.hour);
    const rawT = (h - k0.hour) / span;
    const t = rawT * rawT * (3 - 2 * rawT); // smoothstep interpolation

    tmpTop.lerpColors(k0.top, k1.top, t);
    tmpHorizon.lerpColors(k0.horizon, k1.horizon, t);
    tmpBottom.lerpColors(k0.bottom, k1.bottom, t);
    tmpSunCol.lerpColors(k0.sunColor, k1.sunColor, t);
    tmpHemiSky.lerpColors(k0.hemiSky, k1.hemiSky, t);
    tmpHemiGround.lerpColors(k0.hemiGround, k1.hemiGround, t);
    tmpCloudCol.lerpColors(k0.cloudColor, k1.cloudColor, t);
    tmpWaterCol.lerpColors(k0.waterColor, k1.waterColor, t);

    const baseSunIntensity = THREE.MathUtils.lerp(
      k0.sunIntensity,
      k1.sunIntensity,
      t
    );
    const baseHemiIntensity = THREE.MathUtils.lerp(
      k0.hemiIntensity,
      k1.hemiIntensity,
      t
    );
    currentNightFactor = THREE.MathUtils.lerp(
      k0.nightFactor,
      k1.nightFactor,
      t
    );

    // Apply Rain / Overcast weather blending smoothly
    if (rainFactor > 0.001) {
      rainTintTop.lerpColors(rainSkyTopDay, rainSkyTopNight, currentNightFactor);
      rainTintHorizon.lerpColors(
        rainSkyHorizonDay,
        rainSkyHorizonNight,
        currentNightFactor
      );
      rainTintCloud.lerpColors(rainCloudDay, rainCloudNight, currentNightFactor);

      tmpTop.lerp(rainTintTop, rainFactor * 0.78);
      tmpHorizon.lerp(rainTintHorizon, rainFactor * 0.82);
      tmpBottom.lerp(rainSkyBottomDay, rainFactor * (1 - currentNightFactor * 0.6) * 0.7);
      tmpCloudCol.lerp(rainTintCloud, rainFactor * 0.85);
      tmpWaterCol.lerp(rainWaterDay, rainFactor * 0.6);
      tmpHemiSky.lerp(rainTintHorizon, rainFactor * 0.65);
    }

    // Update Sky Uniforms & Fog
    skyUniforms.uTopColor.value.copy(tmpTop);
    skyUniforms.uHorizonColor.value.copy(tmpHorizon);
    skyUniforms.uBottomColor.value.copy(tmpBottom);
    skyUniforms.uSunColor.value.copy(tmpSunCol);
    skyUniforms.uSunStrength.value =
      (1.0 - currentNightFactor * 0.85) * (1.0 - rainFactor * 0.85);
    skyUniforms.uStarIntensity.value =
      currentNightFactor * (1.0 - rainFactor * 0.92);

    fog.color.copy(tmpHorizon);

    // Update Sun Position along a natural diurnal arc
    // At 6:00 sun rises in East (+X), 12:00 high South (+Y, +Z), 18:00 sets in West (-X)
    const dayAngle = ((h - 6.0) / 12.0) * Math.PI;
    const sunRadius = 16.0;
    const sunX = Math.cos(dayAngle) * sunRadius;
    const sunY = Math.max(2.2, Math.sin(dayAngle) * 13.5);
    const sunZ = 5.5 + Math.sin(dayAngle * 0.5) * 3.5;

    sunLight.position.set(sunX, sunY, sunZ);
    skyUniforms.uSunDir.value
      .set(sunX, Math.sin(dayAngle) * 13.5, sunZ)
      .normalize();

    sunLight.color.copy(tmpSunCol);
    // Soften direct sunlight during rain
    sunLight.intensity = baseSunIntensity * (1.0 - rainFactor * 0.58);

    // Moon light provides readable silver-blue fill at night
    moonLight.intensity = currentNightFactor * (0.72 - rainFactor * 0.25);

    hemiLight.color.copy(tmpHemiSky);
    hemiLight.groundColor.copy(tmpHemiGround);
    hemiLight.intensity = baseHemiIntensity * (1.0 + rainFactor * 0.12);

    // Update Cloud Material & Orbit
    cloudMaterial.color.copy(tmpCloudCol);
    cloudsData.update(dt, windFactor, rainFactor, reducedMotion);

    // Update Water Material
    waterMaterial.color.copy(tmpWaterCol);
    waterMaterial.roughness = 0.16 + rainFactor * 0.18;

    // Update Pooled 3D Rain, Ripples, and Chimney Smoke
    rainSystem.update(dt, rainFactor, windFactor, currentNightFactor);
    rippleSystem.update(dt, rainFactor);
    smokeSystem.update(dt, windFactor, reducedMotion);
  };

  return {
    root,
    getNightFactor: () => currentNightFactor,
    update,
  };
}

function createClouds(cloudMaterial: THREE.MeshStandardMaterial) {
  const group = new THREE.Group();
  group.name = 'CloudsGroup';

  const puffGeo = new THREE.DodecahedronGeometry(0.55, 1);

  const specs = [
    { angle: 0.2, radius: 4.8, y: 4.5, scale: 1.05, speed: 0.12 },
    { angle: 1.25, radius: 5.6, y: 4.9, scale: 0.9, speed: 0.09 },
    { angle: 2.35, radius: 4.2, y: 4.3, scale: 1.15, speed: 0.11 },
    { angle: 3.4, radius: 5.9, y: 4.7, scale: 0.95, speed: 0.1 },
    { angle: 4.35, radius: 3.6, y: 4.6, scale: 0.88, speed: 0.13 },
    { angle: 5.3, radius: 5.2, y: 4.4, scale: 1.08, speed: 0.1 },
  ];

  const items = specs.map((sp) => {
    const cloud = new THREE.Group();

    const puffs = [
      { x: 0, y: 0, z: 0, sx: 1.35, sy: 0.85, sz: 1.0 },
      { x: -0.52, y: -0.06, z: 0.08, sx: 0.95, sy: 0.68, sz: 0.82 },
      { x: 0.55, y: -0.04, z: -0.06, sx: 1.0, sy: 0.72, sz: 0.85 },
      { x: 0.18, y: 0.22, z: 0.12, sx: 0.85, sy: 0.7, sz: 0.78 },
      { x: -0.22, y: 0.16, z: -0.14, sx: 0.78, sy: 0.65, sz: 0.75 },
    ];

    for (const p of puffs) {
      const m = new THREE.Mesh(puffGeo, cloudMaterial);
      m.position.set(p.x, p.y, p.z);
      m.scale.set(p.sx, p.sy, p.sz);
      m.castShadow = true;
      m.receiveShadow = true;
      cloud.add(m);
    }

    group.add(cloud);
    return {
      cloud,
      angle: sp.angle,
      radius: sp.radius,
      baseY: sp.y,
      baseScale: sp.scale,
      speed: sp.speed,
    };
  });

  let bobClock = 0;

  const update = (
    dt: number,
    windFactor: number,
    rainFactor: number,
    reducedMotion: boolean
  ) => {
    const motionMult = reducedMotion ? 0.35 : 1.0;
    bobClock += dt * motionMult;

    // At 0% wind, cloud drift stops; stronger wind speeds up cloud orbit
    const windSpeedMult = windFactor * 2.4 * motionMult;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      item.angle += item.speed * windSpeedMult * dt;

      const x = Math.cos(item.angle) * item.radius;
      const z = Math.sin(item.angle) * item.radius;
      // During rain, clouds settle slightly lower and fuller over the island
      const yOffset =
        Math.sin(bobClock * 1.1 + i * 1.3) * 0.08 * motionMult -
        rainFactor * 0.28;

      item.cloud.position.set(x, item.baseY + yOffset, z);
      item.cloud.rotation.y = -item.angle + Math.PI / 2;

      const rainScale = item.baseScale * (1.0 + rainFactor * 0.18);
      item.cloud.scale.setScalar(rainScale);
    }
  };

  return { group, update };
}

function createRainSystem() {
  const dropCount = 420;
  const positions = new Float32Array(dropCount * 6); // 2 vertices (start, end) per drop

  const dropX = new Float32Array(dropCount);
  const dropY = new Float32Array(dropCount);
  const dropZ = new Float32Array(dropCount);
  const dropSpeed = new Float32Array(dropCount);

  let seed = 9001;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const respawnDrop = (i: number, randomHeight = false) => {
    // Spawn within the island's canopy footprint so rain falls onto the miniature island
    const angle = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 4.85;
    dropX[i] = Math.cos(angle) * r;
    dropZ[i] = Math.sin(angle) * r;
    dropY[i] = randomHeight ? 0.55 + rand() * 3.8 : 4.1 + rand() * 1.1;
    dropSpeed[i] = 10.5 + rand() * 3.5;
  };

  for (let i = 0; i < dropCount; i++) {
    respawnDrop(i, true);
  }

  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);

  const mat = new THREE.LineBasicMaterial({
    color: 0xcbe4f7,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });

  const mesh = new THREE.LineSegments(geo, mat);
  mesh.name = 'RainStreaks';
  mesh.visible = false;

  const dayRainCol = new THREE.Color(0xcfe6f7);
  const nightRainCol = new THREE.Color(0x88add4);

  const update = (
    dt: number,
    rainFactor: number,
    windFactor: number,
    nightFactor: number
  ) => {
    if (rainFactor < 0.005) {
      mesh.visible = false;
      mat.opacity = 0;
      return;
    }

    mesh.visible = true;
    mat.color.lerpColors(dayRainCol, nightRainCol, nightFactor);
    mat.opacity = rainFactor * 0.58;

    // Wind-driven horizontal velocity (at 0% wind, rain falls straight down)
    const windVelX = -windFactor * 6.2;
    const windVelZ = windFactor * 1.6;

    for (let i = 0; i < dropCount; i++) {
      const vy = -dropSpeed[i];
      dropX[i] += windVelX * dt;
      dropY[i] += vy * dt;
      dropZ[i] += windVelZ * dt;

      const x = dropX[i];
      const y = dropY[i];
      const z = dropZ[i];

      const streakScale = 0.032;
      const bottomTipY = y + vy * streakScale;

      // Recycle as soon as the raindrop reaches the island/pond surface or leaves the island perimeter
      const surfaceY = Math.max(POND_WATER_Y, getIslandSurfaceHeight(x, z)) + 0.05;

      if (bottomTipY <= surfaceY || !isInsideIsland(x, z, -0.15)) {
        respawnDrop(i, false);
        // Shift spawn slightly upwind when wind is strong so the island stays evenly covered
        dropX[i] = THREE.MathUtils.clamp(dropX[i] + windFactor * 1.1, -4.7, 4.7);
      }

      const sx = dropX[i];
      const sy = dropY[i];
      const sz = dropZ[i];

      const ex = sx + windVelX * streakScale;
      const ey = Math.max(surfaceY, sy + vy * streakScale);
      const ez = sz + windVelZ * streakScale;

      const idx = i * 6;
      positions[idx] = sx;
      positions[idx + 1] = sy;
      positions[idx + 2] = sz;
      positions[idx + 3] = ex;
      positions[idx + 4] = ey;
      positions[idx + 5] = ez;
    }

    posAttr.needsUpdate = true;
  };

  return { mesh, update };
}

function createRippleSystem() {
  const group = new THREE.Group();
  group.name = 'PondRipples';

  const poolSize = 18;
  const ringGeo = new THREE.RingGeometry(0.04, 0.065, 20);
  ringGeo.rotateX(-Math.PI / 2);

  interface RippleItem {
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    active: boolean;
    age: number;
    duration: number;
  }

  const pool: RippleItem[] = [];
  for (let i = 0; i < poolSize; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xdff4ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(ringGeo, mat);
    mesh.visible = false;
    group.add(mesh);

    pool.push({
      mesh,
      mat,
      active: false,
      age: 0,
      duration: 1.1,
    });
  }

  let spawnAccumulator = 0;
  let seed = 5512;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const update = (dt: number, rainFactor: number) => {
    if (rainFactor > 0.02) {
      spawnAccumulator += dt * rainFactor * 14.0;
      while (spawnAccumulator >= 1.0) {
        spawnAccumulator -= 1.0;
        const inactive = pool.find((r) => !r.active);
        if (inactive) {
          const angle = rand() * Math.PI * 2;
          const rad = Math.sqrt(rand()) * (POND_RADIUS - 0.22);
          inactive.mesh.position.set(
            POND_CENTER.x + Math.cos(angle) * rad,
            POND_WATER_Y + 0.008,
            POND_CENTER.y + Math.sin(angle) * rad
          );
          inactive.mesh.scale.setScalar(0.25);
          inactive.age = 0;
          inactive.duration = 0.85 + rand() * 0.45;
          inactive.active = true;
          inactive.mesh.visible = true;
        }
      }
    } else {
      spawnAccumulator = 0;
    }

    for (const item of pool) {
      if (!item.active) continue;
      item.age += dt;
      const progress = item.age / item.duration;
      if (progress >= 1.0 || rainFactor < 0.002) {
        item.active = false;
        item.mesh.visible = false;
        item.mat.opacity = 0;
      } else {
        const scale = 0.25 + progress * 2.1;
        item.mesh.scale.setScalar(scale);
        item.mat.opacity = (1.0 - progress) * rainFactor * 0.65;
      }
    }
  };

  return { group, update };
}

function createSmokeSystem(chimneyWorldPos: THREE.Vector3) {
  const group = new THREE.Group();
  group.name = 'ChimneySmoke';

  const count = 9;
  const geo = new THREE.DodecahedronGeometry(0.08, 0);

  const puffs = Array.from({ length: count }, (_, i) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xe6e1da,
      roughness: 0.95,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
    return {
      mesh,
      mat,
      age: (i / count) * 2.7,
      maxAge: 2.7,
      offsetX: 0,
      offsetZ: 0,
    };
  });

  const update = (dt: number, windFactor: number, reducedMotion: boolean) => {
    if (reducedMotion) {
      group.visible = false;
      return;
    }
    group.visible = true;

    for (let i = 0; i < puffs.length; i++) {
      const p = puffs[i];
      p.age += dt;
      if (p.age >= p.maxAge) {
        p.age %= p.maxAge;
        p.offsetX = 0;
        p.offsetZ = 0;
      }

      const t = p.age / p.maxAge;
      p.offsetX -= windFactor * 1.45 * dt;
      p.offsetZ += windFactor * 0.35 * dt;

      p.mesh.position.set(
        chimneyWorldPos.x + p.offsetX + Math.sin(t * 5 + i) * 0.04,
        chimneyWorldPos.y + t * 1.15,
        chimneyWorldPos.z + p.offsetZ
      );

      const scale = 0.6 + t * 1.45;
      p.mesh.scale.setScalar(scale);
      p.mat.opacity = Math.sin(t * Math.PI) * 0.38;
    }
  };

  return { group, update };
}
