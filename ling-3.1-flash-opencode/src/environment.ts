import * as THREE from 'three';
import { clamp, damp, lerp } from './noise';
import { WIND_DIR, type AppState } from './state';
import type { EnvSample } from './palette';
import { ISLAND_RADIUS } from './island';

/* ------------------------------------------------------------------ */
/* Sky dome, stars, sun & moon                                         */
/* ------------------------------------------------------------------ */

export class Sky {
  readonly material: THREE.ShaderMaterial;
  readonly mesh: THREE.Mesh;
  private stars: THREE.Points;
  private starMat: THREE.PointsMaterial;
  readonly sunMesh: THREE.Mesh;
  readonly moonMesh: THREE.Mesh;
  private sunMat: THREE.MeshBasicMaterial;
  private moonMat: THREE.MeshBasicMaterial;
  private readonly scratch = new THREE.Color();

  constructor() {
    this.material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color('#64a9d8') },
        midColor: { value: new THREE.Color('#b4dbe9') },
        botColor: { value: new THREE.Color('#f3eddc') },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 botColor;
        varying vec3 vDir;
        void main() {
          float h = normalize(vDir).y;
          vec3 col = h >= 0.0
            ? mix(midColor, topColor, pow(clamp(h, 0.0, 1.0), 0.55))
            : mix(midColor, botColor, pow(clamp(-h, 0.0, 1.0), 0.6));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(170, 32, 16), this.material);
    this.mesh.renderOrder = -1;

    // Stars: fixed points on the upper dome, faded in at night.
    const starCount = 340;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const y = 0.06 + Math.random() * 0.94;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      starPos[i * 3] = Math.cos(a) * r * 150;
      starPos[i * 3 + 1] = y * 150;
      starPos[i * 3 + 2] = Math.sin(a) * r * 150;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starMat = new THREE.PointsMaterial({
      color: '#dfe8ff',
      size: 1.7,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    this.stars = new THREE.Points(starGeo, this.starMat);

    this.sunMat = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false });
    this.sunMesh = new THREE.Mesh(new THREE.SphereGeometry(3.4, 20, 14), this.sunMat);
    this.moonMat = new THREE.MeshBasicMaterial({ color: '#e8eeff', fog: false, transparent: true, opacity: 0 });
    this.moonMesh = new THREE.Mesh(new THREE.SphereGeometry(2.4, 20, 14), this.moonMat);
  }

  get starsMesh(): THREE.Points {
    return this.stars;
  }

  update(env: EnvSample, rainBlend: number): void {
    // Rain desaturates the sky toward slate.
    const grey = this.scratch.set('#8d94a3');
    this.material.uniforms.topColor.value.copy(env.skyTop).lerp(grey, rainBlend * 0.4);
    this.material.uniforms.midColor.value.copy(env.skyMid).lerp(grey, rainBlend * 0.45);
    this.material.uniforms.botColor.value.copy(env.skyBot).lerp(grey, rainBlend * 0.35);

    this.starMat.opacity = env.nightFactor * (1 - rainBlend) * 0.9;

    this.sunMesh.position.copy(env.sunDir).multiplyScalar(140);
    this.sunMat.color.copy(env.sunColor);
    this.sunMesh.visible = env.sunElevation > -0.1;

    this.moonMesh.position.copy(env.moonDir).multiplyScalar(140);
    this.moonMat.opacity = env.nightFactor;
    this.moonMesh.visible = env.sunElevation < 0.12;
  }
}

/* ------------------------------------------------------------------ */
/* Lighting                                                            */
/* ------------------------------------------------------------------ */

export class Lights {
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly ambient: THREE.AmbientLight;
  private readonly scratchSky = new THREE.Color();
  private readonly scratchGround = new THREE.Color();

  constructor(isSmallDevice: boolean) {
    this.sun = new THREE.DirectionalLight('#ffffff', 1.1);
    this.sun.castShadow = true;
    const shadowSize = isSmallDevice ? 1024 : 2048;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    const cam = this.sun.shadow.camera;
    cam.near = 2;
    cam.far = 90;
    cam.left = -9;
    cam.right = 9;
    cam.top = 9;
    cam.bottom = -9;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;

    this.hemi = new THREE.HemisphereLight('#b4dbe9', '#77875a', 0.6);
    this.ambient = new THREE.AmbientLight('#ffffff', 0.1);
  }

  update(env: EnvSample, rainBlend: number): void {
    // The "sun" light follows the sun by day and the moon by night.
    const dir = env.sunElevation > -0.02 ? env.sunDir : env.moonDir;
    this.sun.position.copy(dir).multiplyScalar(34);
    this.sun.color.copy(env.sunColor);
    this.sun.intensity = env.sunIntensity * (1 - 0.5 * rainBlend);

    this.hemi.intensity = env.hemiIntensity * (1 - 0.35 * rainBlend);
    this.hemi.color.copy(this.scratchSky.copy(env.skyMid).lerp(new THREE.Color('#8d94a3'), rainBlend * 0.45));
    this.hemi.groundColor.copy(this.scratchGround.set('#77875a').lerp(new THREE.Color('#2c3244'), env.nightFactor));
  }
}

/* ------------------------------------------------------------------ */
/* Rain: pooled 3D line streaks that land on the island and fall past  */
/* its underside, slanted by the shared wind.                          */
/* ------------------------------------------------------------------ */

const DROP_COUNT = 650;

export class Rain {
  readonly mesh: THREE.LineSegments;
  private readonly drops: Float32Array;
  private opacity = 0;
  private readonly dir = new THREE.Vector3();
  private readonly rainMat: THREE.LineBasicMaterial;

  constructor() {
    this.drops = new Float32Array(DROP_COUNT * 3);
    const positions = new Float32Array(DROP_COUNT * 2 * 3);
    for (let i = 0; i < DROP_COUNT; i++) this.respawn(i, true);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainMat = new THREE.LineBasicMaterial({ color: '#aebfd8', transparent: true, opacity: 0, depthWrite: false });
    this.mesh = new THREE.LineSegments(geo, this.rainMat);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
  }

  private respawn(i: number, scatter = false): void {
    const a = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(Math.random()) * 9;
    this.drops[i * 3] = Math.cos(a) * rr;
    this.drops[i * 3 + 1] = scatter ? Math.random() * 14 - 4.5 : 9 + Math.random() * 4.5;
    this.drops[i * 3 + 2] = Math.sin(a) * rr;
  }

  update(dt: number, state: AppState): void {
    this.opacity = damp(this.opacity, state.weatherBlend * 0.72, 2.6, dt);
    this.mesh.visible = this.opacity > 0.02;
    if (!this.mesh.visible) return;
    this.rainMat.opacity = this.opacity;

    const windAmt = state.wind;
    this.dir.set(WIND_DIR.x * windAmt * 0.45, -1, WIND_DIR.z * windAmt * 0.45).normalize();
    const speed = 8.5 + windAmt * 3.5;
    const len = 0.45 + windAmt * 0.35;

    const pos = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const landRadius = ISLAND_RADIUS + 0.35;

    for (let i = 0; i < DROP_COUNT; i++) {
      const ix = i * 3;
      let x = this.drops[ix];
      let y = this.drops[ix + 1];
      let z = this.drops[ix + 2];

      x += this.dir.x * speed * dt;
      y += this.dir.y * speed * dt;
      z += this.dir.z * speed * dt;

      const r2 = x * x + z * z;
      if ((y <= 0.04 && r2 < landRadius * landRadius) || y < -4.9 || Math.abs(x) > 11 || Math.abs(z) > 11) {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * 9;
        x = Math.cos(a) * rr;
        y = 9 + Math.random() * 4.5;
        z = Math.sin(a) * rr;
      }
      this.drops[ix] = x;
      this.drops[ix + 1] = y;
      this.drops[ix + 2] = z;

      // Head and tail of the streak.
      const tx = ix * 2;
      arr[tx] = x;
      arr[tx + 1] = y;
      arr[tx + 2] = z;
      arr[tx + 3] = x - this.dir.x * len;
      arr[tx + 4] = y - this.dir.y * len;
      arr[tx + 5] = z - this.dir.z * len;
    }
    pos.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ */
/* Ripples: pooled expanding rings on the pond surface.                */
/* ------------------------------------------------------------------ */

const RIPPLE_COUNT = 12;

export class RipplePool {
  readonly group = new THREE.Group();
  private readonly ripples: Array<{ mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; life: number; active: boolean }> = [];
  private timer = 0;

  constructor(pondRadius: number) {
    const geo = new THREE.RingGeometry(0.42, 0.5, 28);
    for (let i = 0; i < RIPPLE_COUNT; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: '#e8f4f6',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.085;
      mesh.visible = false;
      const a = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random()) * pondRadius * 0.72;
      mesh.position.x = Math.cos(a) * rr;
      mesh.position.z = Math.sin(a) * rr;
      this.group.add(mesh);
      this.ripples.push({ mesh, material, life: 0, active: false });
    }
  }

  update(dt: number, rainBlend: number): void {
    this.timer -= dt;
    if (this.timer <= 0) {
      // Rain ripples densely; a rare ambient ripple keeps the pond alive when clear.
      this.timer = lerp(2.4, 0.13, rainBlend);
      const free = this.ripples.find((r) => !r.active);
      if (free) {
        free.active = true;
        free.life = 0;
        free.mesh.visible = true;
      }
    }
    for (const r of this.ripples) {
      if (!r.active) continue;
      r.life += dt;
      const t = r.life / 1.4;
      if (t >= 1) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const s = 0.12 + t * 0.95;
      r.mesh.scale.set(s, s, s);
      r.material.opacity = (1 - t) * 0.55 * clamp(rainBlend * 3 + 0.12, 0, 1);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Smoke: pooled soft sprites rising from the chimney, blown by wind.  */
/* ------------------------------------------------------------------ */

const SMOKE_COUNT = 10;

function makeSmokeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export class SmokePool {
  readonly group = new THREE.Group();
  private readonly sprites: Array<{ sprite: THREE.Sprite; material: THREE.SpriteMaterial; age: number; active: boolean; vx: number; vy: number; vz: number }> = [];
  private timer = 0;
  private readonly texture: THREE.CanvasTexture;
  private readonly dayColor = new THREE.Color('#ffffff');
  private readonly nightColor = new THREE.Color('#9aa3c0');

  constructor() {
    this.texture = makeSmokeTexture();
    for (let i = 0; i < SMOKE_COUNT; i++) {
      const material = new THREE.SpriteMaterial({ map: this.texture, transparent: true, opacity: 0.3, depthWrite: false });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      sprite.scale.setScalar(0.15);
      this.group.add(sprite);
      this.sprites.push({ sprite, material, age: 0, active: false, vx: 0, vy: 0, vz: 0 });
    }
  }

  /** `getChimneyWorld` returns the world-space chimney tip. */
  update(dt: number, state: AppState, env: EnvSample, getChimneyWorld: (out: THREE.Vector3) => void, motionScale: number): void {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.42;
      const free = this.sprites.find((s) => !s.active);
      if (free) {
        const p = new THREE.Vector3();
        getChimneyWorld(p);
        free.sprite.position.copy(p);
        const windPush = 0.25 + state.wind * 1.5;
        free.vx = WIND_DIR.x * windPush * motionScale;
        free.vz = WIND_DIR.z * windPush * motionScale;
        free.vy = 0.5 * motionScale;
        free.age = 0;
        free.active = true;
        free.sprite.visible = true;
      }
    }
    for (const s of this.sprites) {
      s.material.color.copy(this.dayColor).lerp(this.nightColor, env.nightFactor);
    }
    for (const s of this.sprites) {
      if (!s.active) continue;
      s.age += dt;
      const t = s.age / 2.8;
      if (t >= 1) {
        s.active = false;
        s.sprite.visible = false;
        continue;
      }
      s.sprite.position.x += s.vx * dt;
      s.sprite.position.y += s.vy * dt;
      s.sprite.position.z += s.vz * dt;
      const scale = 0.14 + t * 0.55;
      s.sprite.scale.set(scale, scale, 1);
      s.material.opacity = (1 - t) * 0.3 * (0.35 + 0.65 * (1 - env.nightFactor));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Environment facade: sky + lights + rain, updated from app state.    */
/* ------------------------------------------------------------------ */

export class Environment {
  readonly sky: Sky;
  readonly lights: Lights;
  readonly rain: Rain;

  constructor(isSmallDevice: boolean, scene: THREE.Scene) {
    this.sky = new Sky();
    this.lights = new Lights(isSmallDevice);
    this.rain = new Rain();
    scene.add(this.sky.mesh, this.sky.starsMesh, this.sky.sunMesh, this.sky.moonMesh, this.lights.sun, this.lights.sun.target, this.lights.hemi, this.lights.ambient, this.rain.mesh);
  }

  update(dt: number, state: AppState, env: EnvSample): void {
    this.sky.update(env, state.weatherBlend);
    this.lights.update(env, state.weatherBlend);
    this.rain.update(dt, state);
  }
}
