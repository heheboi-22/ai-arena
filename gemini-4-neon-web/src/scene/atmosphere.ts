import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { AtmosphereSnapshot, WindDerived } from "../state/worldState";
import { createRng } from "./terrainMath";

export interface AtmosphereSystem {
  group: THREE.Group;
  sunLight: THREE.DirectionalLight;
  update: (
    dt: number,
    elapsed: number,
    atmosphere: AtmosphereSnapshot,
    wind: WindDerived,
    reducedMotion: boolean
  ) => void;
  dispose: () => void;
}

interface CloudCluster {
  group: THREE.Group;
  x: number;
  y: number;
  z: number;
  baseY: number;
  speedScale: number;
  bobPhase: number;
}

export function createAtmosphere(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean
): AtmosphereSystem {
  const group = new THREE.Group();
  group.name = "Atmosphere";
  const disposables: Array<{ dispose: () => void }> = [];

  // 1. Studio PMREM environment map for soft PBR specular response (all devices)
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.45;
  pmremGenerator.dispose();
  disposables.push(envRT);

  // 2. Horizon-matched subtle fog so distant clouds/sky merge gracefully
  const fog = new THREE.FogExp2(0xead9c3, 0.0115);
  scene.fog = fog;

  // 3. Procedural GLSL Sky Dome (smooth 24h gradient + sun halo + moon + stars)
  const skyGeo = new THREE.SphereGeometry(72, 36, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color(0x628ec0) },
      uHorizon: { value: new THREE.Color(0xead9c3) },
      uNadir: { value: new THREE.Color(0xa29ea3) },
      uSunDir: { value: new THREE.Vector3(0.6, 0.45, 0.5) },
      uMoonDir: { value: new THREE.Vector3(-0.5, 0.55, -0.5) },
      uSunColor: { value: new THREE.Color(0xffe1b0) },
      uDaylight: { value: 1.0 },
      uTwilight: { value: 0.2 },
      uMoonVis: { value: 0.0 },
      uStarVis: { value: 0.0 },
      uTime: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uNadir;
      uniform vec3 uSunDir;
      uniform vec3 uMoonDir;
      uniform vec3 uSunColor;
      uniform float uDaylight;
      uniform float uTwilight;
      uniform float uMoonVis;
      uniform float uStarVis;
      uniform float uTime;
      varying vec3 vDir;

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      void main() {
        vec3 dir = normalize(vDir);
        float y = dir.y;

        // Smooth vertical sky gradient with subtle horizon warmth
        vec3 col;
        if (y >= 0.0) {
          float t = pow(clamp(y, 0.0, 1.0), 0.58);
          col = mix(uHorizon, uZenith, t);
        } else {
          float t = pow(clamp(-y, 0.0, 1.0), 0.62);
          col = mix(uHorizon, uNadir, t);
        }

        // Soft sun glow & disc when above/near horizon
        vec3 sDir = normalize(uSunDir);
        float sunDot = max(dot(dir, sDir), 0.0);
        float sunHalo = pow(sunDot, 12.0) * (0.28 + uTwilight * 0.35) * clamp(uDaylight + uTwilight * 0.7, 0.0, 1.0);
        float sunDisc = smoothstep(0.9965, 0.9988, sunDot) * smoothstep(-0.08, 0.06, sDir.y) * clamp(uDaylight + uTwilight, 0.0, 1.0);
        col += uSunColor * (sunHalo + sunDisc * 1.15);

        // Soft silvery moon disc + gentle lunar halo at night
        if (uMoonVis > 0.01) {
          vec3 mDir = normalize(uMoonDir);
          float moonDot = max(dot(dir, mDir), 0.0);
          float moonHalo = pow(moonDot, 36.0) * 0.25 * uMoonVis;
          float moonDisc = smoothstep(0.9974, 0.9986, moonDot) * uMoonVis;
          col += vec3(0.84, 0.91, 1.0) * (moonHalo + moonDisc * 0.95);
        }

        // Delicate twinkling starfield in upper sky at night
        if (uStarVis > 0.01 && y > 0.02) {
          vec3 cell = floor(dir * 135.0);
          float rnd = hash31(cell);
          if (rnd > 0.993) {
            float twinkle = 0.65 + 0.35 * sin(uTime * 1.8 + rnd * 90.0);
            float elevFade = smoothstep(0.02, 0.32, y);
            col += vec3(0.88, 0.93, 1.0) * uStarVis * elevFade * twinkle * 0.85;
          }
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.frustumCulled = false;
  group.add(skyDome);
  disposables.push(skyGeo, skyMat);

  // 4. Three-point + Hemisphere lighting rig
  const sunLight = new THREE.DirectionalLight(0xffe1b0, 2.2);
  sunLight.position.set(12, 14, 10);
  sunLight.castShadow = !isSoftwareGl;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 42;
  sunLight.shadow.camera.left = -12;
  sunLight.shadow.camera.right = 12;
  sunLight.shadow.camera.top = 12;
  sunLight.shadow.camera.bottom = -12;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.025;
  group.add(sunLight);

  const hemiLight = new THREE.HemisphereLight(0xd1dff0, 0x7c6e58, 0.95);
  group.add(hemiLight);

  // Subtle backlight/rim separating floating rocky underside from sky backdrop
  const rimLight = new THREE.DirectionalLight(0xffdfba, 0.45);
  rimLight.position.set(-10, -4, -12);
  group.add(rimLight);

  // 5. Stylized multi-puff volumetric floating clouds drifting with shared wind
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xfaf2e4,
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true,
  });
  const puffGeo = new THREE.IcosahedronGeometry(0.75, 1);
  disposables.push(cloudMat, puffGeo);

  const rng = createRng(512);
  const clouds: CloudCluster[] = [];
  const cloudSpecs = [
    { x: -6.8, y: 5.5, z: -5.4, scale: 1.05, speed: 0.95 },
    { x: 5.8, y: 6.1, z: -6.5, scale: 1.15, speed: 1.1 },
    { x: -1.4, y: 6.8, z: -8.2, scale: 0.88, speed: 0.82 },
    { x: 8.4, y: 4.8, z: -1.8, scale: 0.78, speed: 1.05 },
    { x: -8.6, y: 4.4, z: 1.8, scale: 0.76, speed: 0.9 },
  ];

  const cloudWrapper = new THREE.Group();
  cloudWrapper.name = "Clouds";
  group.add(cloudWrapper);

  for (let i = 0; i < cloudSpecs.length; i++) {
    const cs = cloudSpecs[i];
    const cg = new THREE.Group();
    cg.position.set(cs.x, cs.y, cs.z);
    cg.scale.setScalar(cs.scale);

    // 5-6 sculpted overlapping puffs with flattened soft underside
    const puffs: Array<[number, number, number, number, number, number]> = [
      [0, 0.15, 0, 1.35, 0.85, 1.05],
      [-1.05, -0.02, 0.14, 0.95, 0.68, 0.86],
      [1.08, -0.04, -0.1, 0.98, 0.66, 0.88],
      [-0.45, 0.44, -0.18, 0.78, 0.62, 0.75],
      [0.48, 0.36, 0.22, 0.82, 0.6, 0.76],
    ];
    for (let p = 0; p < puffs.length; p++) {
      const [px, py, pz, sx, sy, sz] = puffs[p];
      const m = new THREE.Mesh(puffGeo, cloudMat);
      m.position.set(px, py, pz);
      m.scale.set(sx, sy, sz);
      m.rotation.set(rng() * 1.2, rng() * 2.5, rng() * 0.8);
      m.castShadow = false;
      m.receiveShadow = true;
      cg.add(m);
    }

    cloudWrapper.add(cg);
    clouds.push({
      group: cg,
      x: cs.x,
      y: cs.y,
      z: cs.z,
      baseY: cs.y,
      speedScale: cs.speed,
      bobPhase: i * 1.45,
    });
  }

  const CLOUD_WRAP_LIMIT = 15.5;

  return {
    group,
    sunLight,
    update: (dt, elapsed, atmosphere, wind, reducedMotion) => {
      // Sky dome uniforms
      skyMat.uniforms.uZenith.value.setRGB(
        atmosphere.skyZenith.r,
        atmosphere.skyZenith.g,
        atmosphere.skyZenith.b
      );
      skyMat.uniforms.uHorizon.value.setRGB(
        atmosphere.skyHorizon.r,
        atmosphere.skyHorizon.g,
        atmosphere.skyHorizon.b
      );
      skyMat.uniforms.uNadir.value.setRGB(
        atmosphere.skyNadir.r,
        atmosphere.skyNadir.g,
        atmosphere.skyNadir.b
      );
      skyMat.uniforms.uSunDir.value.set(
        atmosphere.sunDirection.x,
        atmosphere.sunDirection.y,
        atmosphere.sunDirection.z
      );
      skyMat.uniforms.uMoonDir.value.set(
        atmosphere.moonDirection.x,
        atmosphere.moonDirection.y,
        atmosphere.moonDirection.z
      );
      skyMat.uniforms.uSunColor.value.setRGB(
        atmosphere.sunLightColor.r,
        atmosphere.sunLightColor.g,
        atmosphere.sunLightColor.b
      );
      skyMat.uniforms.uDaylight.value = atmosphere.daylight;
      skyMat.uniforms.uTwilight.value = atmosphere.twilight;
      skyMat.uniforms.uMoonVis.value = atmosphere.moonVisibility;
      skyMat.uniforms.uStarVis.value = atmosphere.starVisibility;
      skyMat.uniforms.uTime.value = reducedMotion ? 0 : elapsed;

      // Sync fog & renderer exposure + environment intensity
      fog.color.setRGB(atmosphere.fogColor.r, atmosphere.fogColor.g, atmosphere.fogColor.b);
      renderer.toneMappingExposure = atmosphere.exposure;
      scene.environmentIntensity = atmosphere.environmentIntensity;

      // Key light tracks sun during day and smoothly hands off to moon at night so shadows stay coherent
      const useMoon = atmosphere.sunElevation < -0.05;
      const keyDir = useMoon ? atmosphere.moonDirection : atmosphere.sunDirection;
      const keyY = Math.max(0.24, keyDir.y);
      sunLight.position.set(keyDir.x * 20, keyY * 20, keyDir.z * 20);
      sunLight.color.setRGB(
        atmosphere.sunLightColor.r,
        atmosphere.sunLightColor.g,
        atmosphere.sunLightColor.b
      );
      sunLight.intensity = atmosphere.sunLightIntensity;

      hemiLight.color.setRGB(
        atmosphere.hemiSkyColor.r,
        atmosphere.hemiSkyColor.g,
        atmosphere.hemiSkyColor.b
      );
      hemiLight.groundColor.setRGB(
        atmosphere.hemiGroundColor.r,
        atmosphere.hemiGroundColor.g,
        atmosphere.hemiGroundColor.b
      );
      hemiLight.intensity = atmosphere.hemiIntensity;

      rimLight.color.setRGB(atmosphere.rimColor.r, atmosphere.rimColor.g, atmosphere.rimColor.b);
      rimLight.intensity = atmosphere.rimIntensity;

      // Cloud tint adapts to time of day and darkens smoothly in rain
      cloudMat.color.setRGB(
        atmosphere.cloudColor.r,
        atmosphere.cloudColor.g,
        atmosphere.cloudColor.b
      );

      // Drift clouds seamlessly along shared wind vector (halts cleanly when wind === 0)
      const moveFactor = reducedMotion ? 0.2 : 1.0;
      const vx = wind.dirX * wind.cloudSpeed * moveFactor;
      const vz = wind.dirZ * wind.cloudSpeed * moveFactor;

      for (const c of clouds) {
        c.x += vx * dt * c.speedScale;
        c.z += vz * dt * c.speedScale;

        // Soft wrap when drifting past horizon boundary
        const proj = c.x * wind.dirX + c.z * wind.dirZ;
        if (proj > CLOUD_WRAP_LIMIT) {
          c.x -= wind.dirX * CLOUD_WRAP_LIMIT * 2;
          c.z -= wind.dirZ * CLOUD_WRAP_LIMIT * 2;
        }
        const bob = reducedMotion ? 0 : Math.sin(elapsed * 0.55 + c.bobPhase) * 0.14;
        c.group.position.set(c.x, c.baseY + bob, c.z);
      }
    },
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
