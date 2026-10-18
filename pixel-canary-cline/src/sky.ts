import * as THREE from 'three';
import { clamp, makeRandom } from './noise';
import { SkyPalette } from './theme';

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  varying vec3 vDir;

  void main() {
    float h = clamp(vDir.y, -1.0, 1.0);
    vec3 col = mix(uZenith, uHorizon, smoothstep(0.0, 1.0, 1.0 - max(h, -0.25)));
    // Soft band along the horizon keeps the gradient from looking banded.
    col = mix(col, uHorizon, pow(1.0 - abs(h), 2.4) * 0.35);

    // Wide sun glow plus a tighter core, both centred on the sun direction.
    float towards = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
    col += uSunColor * pow(towards, 8.0) * 0.20;
    col += uSunColor * pow(towards, 2.0) * 0.07;

    // Darken the underside so the island stays readable from below.
    col *= mix(0.62, 1.0, smoothstep(-0.55, 0.15, h));

    gl_FragColor = vec4(col, 1.0);
  }
`;

/** Tiny sprites built in canvas: this project loads no external textures at all. */
function glowTexture(inner: string, outer: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grd = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    grd.addColorStop(0, inner);
    grd.addColorStop(0.35, outer);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Stars: one Points cloud on a hemisphere, faded in only after dusk. */
function buildStars(): THREE.Points {
  const rand = makeRandom(31137);
  const count = 620;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const theta = rand() * Math.PI * 2;
    const y = Math.abs(rand() * 0.95 + 0.05);
    const s = Math.sqrt(Math.max(0, 1 - y * y));
    const r = 80;
    positions[i * 3] = Math.cos(theta) * s * r;
    positions[i * 3 + 1] = y * r;
    positions[i * 3 + 2] = Math.sin(theta) * s * r;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: '#e8eefc',
      size: 0.62,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    }),
  );
  points.renderOrder = -1;
  return points;
}

export class SkyRig {
  readonly group = new THREE.Group();
  readonly sun = new THREE.DirectionalLight('#fff2d6', 2);
  readonly moon = new THREE.DirectionalLight('#a9c0e6', 0);
  readonly hemi = new THREE.HemisphereLight('#bcdcf0', '#6b6350', 1);
  readonly ambient = new THREE.AmbientLight('#cfe0ee', 0.2);

  /** Shared with the pond shader and the window glow. */
  readonly sunDir = new THREE.Vector3(0.4, 0.6, 0.3);
  readonly skyColor = new THREE.Color('#cfe6f2');
  readonly sunColorOut = new THREE.Color('#fff2d6');
  readonly waterColor = new THREE.Color('#3a6b80');
  night = 0;
  exposure = 1;
  readonly fogColor = new THREE.Color('#cfe4f0');
  fogDensity = 0.004;

  private readonly uniforms: {
    uZenith: { value: THREE.Color };
    uHorizon: { value: THREE.Color };
    uSunColor: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
  };
  private readonly sunSprite: THREE.Sprite;
  private readonly sunHalo: THREE.Sprite;
  private readonly moonMesh: THREE.Mesh;
  private readonly stars: THREE.Points;
  private readonly palette = new SkyPalette();

  constructor() {
    this.group.name = 'sky';

    this.uniforms = {
      uZenith: { value: new THREE.Color('#77b8e6') },
      uHorizon: { value: new THREE.Color('#e2f2fb') },
      uSunColor: { value: new THREE.Color('#ffe9c0') },
      uSunDir: { value: new THREE.Vector3(0.4, 0.6, 0.3) },
    };

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(90, 32, 24),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    );
    dome.renderOrder = -2;

    this.sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture('rgba(255,252,236,1)', 'rgba(255,214,150,0.5)'),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    this.sunSprite.scale.setScalar(9);

    this.sunHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture('rgba(255,226,170,0.5)', 'rgba(255,170,90,0.16)'),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    this.sunHalo.scale.setScalar(30);

    this.moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#dce5f4', fog: false }),
    );

    this.stars = buildStars();
    this.group.add(dome, this.sunSprite, this.sunHalo, this.moonMesh, this.stars);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 2;
    this.sun.shadow.camera.far = 44;
    const span = 7.6;
    this.sun.shadow.camera.left = -span;
    this.sun.shadow.camera.right = span;
    this.sun.shadow.camera.top = span;
    this.sun.shadow.camera.bottom = -span;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.022;
    this.group.add(this.sun, this.sun.target, this.moon, this.hemi, this.ambient);
  }

  /** @param hour 0..24 @param rain 0..1, both already smoothed by the state layer. */
  update(hour: number, rain: number): void {
    const s = this.palette.at(hour, rain);
    const solar = ((hour - 6) / 12) * Math.PI;
    const elevation = Math.sin(solar);

    this.sunDir.set(Math.cos(solar) * 0.92, Math.max(0.03, elevation), 0.32).normalize();
    this.sun.position.copy(this.sunDir).multiplyScalar(24);
    this.sun.target.position.set(0, 0, 0);
    this.sun.color.copy(s.sunColor);
    this.sun.intensity = s.sunlight;

    // Moonlight arrives from the opposite side, only once the sun is down.
    this.moon.position.set(-this.sunDir.x * 22, Math.max(0.15, -elevation) * 16 + 6, -this.sunDir.z * 22);
    this.moon.intensity = 0.3 * s.night;
    this.moonMesh.position.copy(this.moon.position).multiplyScalar(2.4);
    this.moonMesh.visible = s.night > 0.02;

    this.sunSprite.position.copy(this.sunDir).multiplyScalar(62);
    this.sunHalo.position.copy(this.sunSprite.position);
    const visible = elevation > -0.06;
    this.sunSprite.visible = visible;
    this.sunHalo.visible = visible;
    this.sunHalo.material.opacity = clamp(1 - rain * 0.7, 0, 1);

    this.hemi.color.copy(s.hemiSky);
    this.hemi.groundColor.copy(s.hemiGround);
    this.hemi.intensity = s.hemiIntensity;
    this.ambient.intensity = s.ambient;

    this.uniforms.uZenith.value.copy(s.zenith);
    this.uniforms.uHorizon.value.copy(s.horizon);
    this.uniforms.uSunColor.value.copy(s.sunColor);
    this.uniforms.uSunDir.value.copy(this.sunDir);

    (this.stars.material as THREE.PointsMaterial).opacity = s.night * (1 - rain);
    this.stars.visible = s.night > 0.02 && rain < 0.6;

    this.skyColor.copy(s.horizon).lerp(s.zenith, 0.4);
    this.sunColorOut.copy(s.sunColor);
    this.waterColor.copy(s.water);
    this.night = s.night;
    this.exposure = s.exposure;
    this.fogColor.copy(s.fogColor);
    this.fogDensity = s.fogDensity;
  }
}
