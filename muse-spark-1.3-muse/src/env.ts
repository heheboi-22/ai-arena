// env.ts — time-of-day keyframes, sky dome, sun/moon, lights, fog, stars, rain.
//
// Two pieces live here:
//   computeEnvFrame(hour, rainAmount) — a pure function that turns the clock
//     and the weather into one coherent set of colours and intensities.
//   Environment — the scene objects that consume a frame every tick: sky
//     shader dome, star field, sun/moon sprites, shadow-casting directional
//     light (sun by day, moon by night), hemisphere fill, fog and the pooled
//     instanced rain.
//
// Everything is procedural: the sun/moon glow textures are painted on a
// canvas at start-up and no external asset is ever fetched.

import * as THREE from 'three';
import { clamp, lerp, smoothstep, createRng } from './util';

// ---------------------------------------------------------------------------
// Frame contract
// ---------------------------------------------------------------------------

export interface EnvFrame {
  night: number;
  dusk: number;
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiIntensity: number;
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  fogColor: THREE.Color;
  waterColor: THREE.Color;
  cloudColor: THREE.Color;
  starOpacity: number;
}

// ---------------------------------------------------------------------------
// Keyframe table
// ---------------------------------------------------------------------------

interface EnvKey {
  hour: number;
  skyTop: number;
  skyHorizon: number;
  sunColor: number;
  sunIntensity: number;
  hemiIntensity: number;
  waterColor: number;
  cloudTint: number;
}

// Night is a deep, readable blue — never black — so the island silhouette
// stays legible. 16.5 is the default view: warm afternoon, sun a touch
// stronger than midday. Sunset keys carry the orange; the table returns to
// the 0h values at 24h so the loop wraps seamlessly.
const KEYS: EnvKey[] = [
  { hour: 0.0,  skyTop: 0x16233f, skyHorizon: 0x2c3e5d, sunColor: 0xa9c2e8, sunIntensity: 0.50, hemiIntensity: 0.32, waterColor: 0x2e4a63, cloudTint: 0x39465e },
  { hour: 4.5,  skyTop: 0x182641, skyHorizon: 0x2f4062, sunColor: 0xa9c2e8, sunIntensity: 0.50, hemiIntensity: 0.33, waterColor: 0x2f4c64, cloudTint: 0x3b4862 },
  { hour: 6.0,  skyTop: 0x2c3d63, skyHorizon: 0x7d7f95, sunColor: 0xd9b48f, sunIntensity: 0.75, hemiIntensity: 0.42, waterColor: 0x3d5a70, cloudTint: 0x8d8b9c },
  { hour: 7.5,  skyTop: 0x4777b8, skyHorizon: 0xf2b06e, sunColor: 0xffc37e, sunIntensity: 1.90, hemiIntensity: 0.62, waterColor: 0x47708c, cloudTint: 0xf6cf9f },
  { hour: 10.0, skyTop: 0x3f7fd0, skyHorizon: 0xbcd9ea, sunColor: 0xfff1d6, sunIntensity: 2.45, hemiIntensity: 0.85, waterColor: 0x4d7ea8, cloudTint: 0xf4f7f7 },
  { hour: 14.0, skyTop: 0x3d7ccf, skyHorizon: 0xb7d6e8, sunColor: 0xffedd0, sunIntensity: 2.55, hemiIntensity: 0.87, waterColor: 0x4d7ea8, cloudTint: 0xf3f5f2 },
  { hour: 16.5, skyTop: 0x3e76c6, skyHorizon: 0xc2d9e2, sunColor: 0xffe3ae, sunIntensity: 2.60, hemiIntensity: 0.85, waterColor: 0x4e7d9f, cloudTint: 0xf7eedb },
  { hour: 18.0, skyTop: 0x46639f, skyHorizon: 0xf3cf9e, sunColor: 0xffb066, sunIntensity: 2.05, hemiIntensity: 0.72, waterColor: 0x51708a, cloudTint: 0xf2c493 },
  { hour: 19.3, skyTop: 0x4a5f9e, skyHorizon: 0xeaa26c, sunColor: 0xffab63, sunIntensity: 1.35, hemiIntensity: 0.55, waterColor: 0x4c617c, cloudTint: 0xe0aa84 },
  { hour: 20.3, skyTop: 0x27355e, skyHorizon: 0x77556b, sunColor: 0xc99a86, sunIntensity: 0.70, hemiIntensity: 0.40, waterColor: 0x39536c, cloudTint: 0x6d5a6d },
  { hour: 22.0, skyTop: 0x182641, skyHorizon: 0x2f4062, sunColor: 0xa9c2e8, sunIntensity: 0.52, hemiIntensity: 0.33, waterColor: 0x2f4c64, cloudTint: 0x3b4862 },
  { hour: 24.0, skyTop: 0x16233f, skyHorizon: 0x2c3e5d, sunColor: 0xa9c2e8, sunIntensity: 0.50, hemiIntensity: 0.32, waterColor: 0x2e4a63, cloudTint: 0x39465e },
];

const MOON_COLOR = new THREE.Color(0xa9c2e8);
const RAIN_SKY_TOP = new THREE.Color(0x5a6b7d);
const RAIN_SKY_HORIZON = new THREE.Color(0x93a3ae);
const RAIN_WATER = new THREE.Color(0x46626f);
const RAIN_CLOUD = new THREE.Color(0x6d7680);
const NIGHT_CLOUD = new THREE.Color(0x2e3a4d);

// ---------------------------------------------------------------------------
// Sun / moon directions
// ---------------------------------------------------------------------------

interface SunMoon {
  sunDir: THREE.Vector3;
  moonDir: THREE.Vector3;
  /** 1 in full daylight, 0 at night; blends the two bodies. */
  dayness: number;
}

function sunMoonDirs(hour: number): SunMoon {
  const ang = ((hour - 6) / 12) * Math.PI;
  const elevation = Math.sin(ang);
  const sunDir = new THREE.Vector3(Math.cos(ang) * 0.85, elevation, 0.45).normalize();

  const moonHour = hour >= 18 ? hour - 18 : hour + 6;
  const angN = (moonHour / 12) * Math.PI;
  const moonDir = new THREE.Vector3(Math.cos(angN) * 0.85, Math.sin(angN), -0.35).normalize();

  return { sunDir, moonDir, dayness: smoothstep(-0.06, 0.12, elevation) };
}

function nightFactor(hour: number): number {
  if (hour < 5.5) return 1;
  if (hour < 7.5) return 1 - smoothstep(5.5, 7.5, hour);
  if (hour < 18.8) return 0;
  if (hour < 20.5) return smoothstep(18.8, 20.5, hour);
  return 1;
}

function duskFactor(hour: number): number {
  const rise = smoothstep(17.8, 19.0, hour);
  const fall = 1 - smoothstep(19.0, 20.2, hour);
  return rise * fall;
}

// ---------------------------------------------------------------------------
// Pure frame computation
// ---------------------------------------------------------------------------

export function computeEnvFrame(hour: number, rainAmount: number): EnvFrame {
  const h = ((hour % 24) + 24) % 24;
  const rain = clamp(rainAmount, 0, 1);
  const night = nightFactor(h);
  const dusk = duskFactor(h);

  // Locate the surrounding keyframes and ease across the segment so colour
  // changes glide instead of stepping.
  let i = 0;
  while (i < KEYS.length - 2 && h >= KEYS[i + 1].hour) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const span = Math.max(b.hour - a.hour, 0.0001);
  const t = smoothstep(0, 1, clamp((h - a.hour) / span, 0, 1));

  const skyTop = new THREE.Color(a.skyTop).lerp(new THREE.Color(b.skyTop), t);
  const skyHorizon = new THREE.Color(a.skyHorizon).lerp(new THREE.Color(b.skyHorizon), t);
  const tableSunColor = new THREE.Color(a.sunColor).lerp(new THREE.Color(b.sunColor), t);
  const tableSunIntensity = lerp(a.sunIntensity, b.sunIntensity, t);
  let hemiIntensity = lerp(a.hemiIntensity, b.hemiIntensity, t);
  const waterColor = new THREE.Color(a.waterColor).lerp(new THREE.Color(b.waterColor), t);
  const cloudColor = new THREE.Color(a.cloudTint).lerp(new THREE.Color(b.cloudTint), t);

  // One directional light plays both bodies: sun by day, moon by night.
  const { sunDir: rawSun, moonDir, dayness } = sunMoonDirs(h);
  const sunDir = moonDir.clone().lerp(rawSun, dayness).normalize();
  const sunColor = MOON_COLOR.clone().lerp(tableSunColor, dayness);
  let sunIntensity = lerp(0.5, tableSunIntensity, dayness);

  // Clouds go properly dark at night before weather touches them.
  cloudColor.lerp(NIGHT_CLOUD, night * 0.55);

  // Rain: desaturate the world toward grey-blue and soften every light.
  const rainSky = rain * 0.75;
  skyTop.lerp(RAIN_SKY_TOP, rainSky);
  skyHorizon.lerp(RAIN_SKY_HORIZON, rainSky);
  sunIntensity *= 1 - 0.62 * rain;
  hemiIntensity *= 1 - 0.25 * rain;
  waterColor.lerp(RAIN_WATER, rain * 0.7);
  cloudColor.lerp(RAIN_CLOUD, rain * 0.85);

  const fogColor = skyHorizon.clone();
  const starOpacity = clamp(night * (1 - rain * 0.9), 0, 1);

  return {
    night,
    dusk,
    sunDir,
    sunColor,
    sunIntensity,
    hemiIntensity,
    skyTop,
    skyHorizon,
    fogColor,
    waterColor,
    cloudColor,
    starOpacity,
  };
}

// ---------------------------------------------------------------------------
// Glow sprite textures (painted once, reused forever)
// ---------------------------------------------------------------------------

function makeGlowTexture(stops: Array<[number, string]>): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [offset, color] of stops) grad.addColorStop(offset, color);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Environment — live scene objects
// ---------------------------------------------------------------------------

const RAIN_COUNT = 1100;
const RAIN_RADIUS = 14;
const RAIN_TOP_MIN = 15;
const RAIN_TOP_MAX = 19;

export class Environment {
  private readonly skyMat: THREE.ShaderMaterial;
  private readonly starsMat: THREE.PointsMaterial;
  private readonly sunSprite: THREE.Sprite;
  private readonly moonSprite: THREE.Sprite;
  private readonly sunLight: THREE.DirectionalLight;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly rainMesh: THREE.InstancedMesh;
  private readonly rainMat: THREE.MeshBasicMaterial;
  private readonly rainPos: Float32Array;
  private readonly rainSpeed: Float32Array;
  private readonly dummy = new THREE.Object3D();
  private readonly scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    scene.fog = new THREE.Fog(0xbcd9ea, 60, 150);

    // --- Sky dome -----------------------------------------------------------
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x3e76c6) },
        horizonColor: { value: new THREE.Color(0xc2d9e2) },
        sunDirection: { value: new THREE.Vector3(0, 1, 0) },
        sunTint: { value: new THREE.Color(0xffe3ae) },
        uDusk: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 sunDirection;
        uniform vec3 sunTint;
        uniform float uDusk;
        varying vec3 vDir;
        void main() {
          vec3 dir = normalize(vDir);
          float above = pow(max(dir.y, 0.0), 0.55);
          vec3 col = mix(horizonColor, topColor, above);
          // Below the horizon, settle to a slightly deepened horizon tone so
          // the underside view never meets a hard seam.
          col = mix(col, horizonColor * 0.88, pow(max(-dir.y, 0.0), 0.6));
          // Warm glow around the active body, stronger at dusk.
          float g = pow(max(dot(dir, normalize(sunDirection)), 0.0), 24.0);
          col += sunTint * g * (0.35 + uDusk * 0.5);
          // A whisper of extra light hugging the horizon line.
          col += horizonColor * pow(1.0 - abs(dir.y), 6.0) * 0.10;
          // Dither against gradient banding.
          float hash = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
          col += (hash - 0.5) * 0.008;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 32, 16), this.skyMat);
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    scene.add(sky);

    // --- Stars ---------------------------------------------------------------
    const starRng = createRng(20240607);
    const starPos = new Float32Array(700 * 3);
    for (let s = 0; s < 700; s++) {
      const azimuth = starRng() * Math.PI * 2;
      const y = 0.06 + starRng() * 0.94;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      starPos[s * 3] = Math.cos(azimuth) * ring * 150;
      starPos[s * 3 + 1] = y * 150;
      starPos[s * 3 + 2] = Math.sin(azimuth) * ring * 150;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starsMat = new THREE.PointsMaterial({
      color: 0xdfe9ff,
      size: 1.6,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    const stars = new THREE.Points(starGeo, this.starsMat);
    stars.frustumCulled = false;
    scene.add(stars);

    // --- Sun and moon sprites --------------------------------------------------
    const sunTex = makeGlowTexture([
      [0, 'rgba(255,246,214,1)'],
      [0.18, 'rgba(255,226,150,0.95)'],
      [0.45, 'rgba(255,180,84,0.38)'],
      [1, 'rgba(255,160,60,0)'],
    ]);
    this.sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false }),
    );
    this.sunSprite.scale.setScalar(26);
    scene.add(this.sunSprite);

    const moonTex = makeGlowTexture([
      [0, 'rgba(240,246,255,1)'],
      [0.22, 'rgba(214,228,250,0.92)'],
      [0.5, 'rgba(169,194,232,0.30)'],
      [1, 'rgba(169,194,232,0)'],
    ]);
    this.moonSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false }),
    );
    this.moonSprite.scale.setScalar(16);
    scene.add(this.moonSprite);

    // --- Lights ------------------------------------------------------------------
    this.sunLight = new THREE.DirectionalLight(0xffe3ae, 2.6);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.left = -15;
    this.sunLight.shadow.camera.right = 15;
    this.sunLight.shadow.camera.top = 15;
    this.sunLight.shadow.camera.bottom = -15;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 80;
    this.sunLight.shadow.bias = -0.0006;
    this.sunLight.shadow.normalBias = 0.02;
    this.sunLight.shadow.radius = 2;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.hemiLight = new THREE.HemisphereLight(0xc2d9e2, 0x68775a, 0.85);
    scene.add(this.hemiLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.12));

    // --- Rain ----------------------------------------------------------------------
    this.rainMat = new THREE.MeshBasicMaterial({
      color: 0xbcd2e4,
      transparent: true,
      opacity: 0,
    });
    const dropGeo = new THREE.BoxGeometry(0.02, 0.55, 0.02);
    this.rainMesh = new THREE.InstancedMesh(dropGeo, this.rainMat, RAIN_COUNT);
    this.rainMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rainMesh.frustumCulled = false;
    this.rainMesh.count = 0;
    this.rainMesh.visible = false;
    scene.add(this.rainMesh);

    this.rainPos = new Float32Array(RAIN_COUNT * 3);
    this.rainSpeed = new Float32Array(RAIN_COUNT);
    const dropRng = createRng(918273);
    for (let d = 0; d < RAIN_COUNT; d++) {
      const r = Math.sqrt(dropRng()) * RAIN_RADIUS;
      const th = dropRng() * Math.PI * 2;
      this.rainPos[d * 3] = Math.cos(th) * r;
      this.rainPos[d * 3 + 1] = -6 + dropRng() * 24;
      this.rainPos[d * 3 + 2] = Math.sin(th) * r;
      this.rainSpeed[d] = 12.5 + dropRng() * 5;
    }
  }

  update(
    dt: number,
    t: number,
    hour: number,
    rainAmount: number,
    wind: number,
    terrainHeight: (x: number, z: number) => number,
  ): EnvFrame {
    const frame = computeEnvFrame(hour, rainAmount);
    const rain = clamp(rainAmount, 0, 1);
    const { sunDir, moonDir, dayness } = sunMoonDirs(((hour % 24) + 24) % 24);

    // Sky, fog and stars.
    (this.skyMat.uniforms.topColor.value as THREE.Color).copy(frame.skyTop);
    (this.skyMat.uniforms.horizonColor.value as THREE.Color).copy(frame.skyHorizon);
    (this.skyMat.uniforms.sunDirection.value as THREE.Vector3).copy(frame.sunDir);
    (this.skyMat.uniforms.sunTint.value as THREE.Color).copy(frame.sunColor);
    this.skyMat.uniforms.uDusk.value = frame.dusk;
    this.starsMat.opacity = frame.starOpacity;

    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(frame.fogColor);
    fog.near = lerp(60, 34, rain);
    fog.far = lerp(150, 95, rain);

    // Bodies: sprites ride their true (unblended) directions while the
    // directional light rides the blended frame direction.
    this.sunSprite.position.copy(sunDir).multiplyScalar(140);
    (this.sunSprite.material as THREE.SpriteMaterial).opacity =
      clamp(dayness * 1.4, 0, 1) * (1 - rain * 0.85);
    this.moonSprite.position.copy(moonDir).multiplyScalar(140);
    (this.moonSprite.material as THREE.SpriteMaterial).opacity =
      clamp((1 - dayness) * 1.4, 0, 1) * (0.9 - rain * 0.65);

    // Lights.
    this.sunLight.position.copy(frame.sunDir).multiplyScalar(34);
    this.sunLight.color.copy(frame.sunColor);
    this.sunLight.intensity = frame.sunIntensity;
    this.hemiLight.intensity = frame.hemiIntensity;
    this.hemiLight.color.copy(frame.skyHorizon).lerp(new THREE.Color(0xffffff), 0.3);
    this.hemiLight.groundColor
      .set(0x68775a)
      .lerp(new THREE.Color(0x1c2733), frame.night * 0.8);

    this.updateRain(dt, wind, rain, terrainHeight);
    void t; // t is part of the shared update signature; rain is dt-driven.
    return frame;
  }

  private updateRain(
    dt: number,
    wind: number,
    rain: number,
    terrainHeight: (x: number, z: number) => number,
  ): void {
    const active = Math.floor(RAIN_COUNT * rain);
    this.rainMesh.count = active;
    this.rainMesh.visible = active > 0;
    this.rainMat.opacity = 0.55 * rain;
    if (active === 0 || dt <= 0) return;

    // One shared orientation: drops lean along their velocity vector.
    const axis = new THREE.Vector3(wind * 4.5, -15, 0).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    const slantX = wind * 4.5;

    for (let d = 0; d < RAIN_COUNT; d++) {
      let x = this.rainPos[d * 3];
      let y = this.rainPos[d * 3 + 1];
      const z = this.rainPos[d * 3 + 2];

      y -= this.rainSpeed[d] * dt;
      x += slantX * dt;

      const r = Math.sqrt(x * x + z * z);
      const ground = r < 10.5 ? terrainHeight(x, z) + 0.05 : -7.5;
      if (y < ground) {
        // Recycle above the island with a fresh footprint.
        const nr = Math.sqrt(Math.random()) * RAIN_RADIUS;
        const nth = Math.random() * Math.PI * 2;
        x = Math.cos(nth) * nr;
        this.rainPos[d * 3 + 2] = Math.sin(nth) * nr;
        y = RAIN_TOP_MIN + Math.random() * (RAIN_TOP_MAX - RAIN_TOP_MIN);
        this.rainSpeed[d] = 12.5 + Math.random() * 5;
      }
      if (x > RAIN_RADIUS + 2) x -= (RAIN_RADIUS + 2) * 2;

      this.rainPos[d * 3] = x;
      this.rainPos[d * 3 + 1] = y;

      if (d < active) {
        this.dummy.position.set(x, y, this.rainPos[d * 3 + 2]);
        this.dummy.quaternion.copy(quat);
        this.dummy.updateMatrix();
        this.rainMesh.setMatrixAt(d, this.dummy.matrix);
      }
    }
    this.rainMesh.instanceMatrix.needsUpdate = true;
  }
}
