import * as THREE from 'three';
import { mulberry32 } from '../core/math';

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;
uniform float uSun;
uniform float uGlow;
uniform float uMoon;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec3 d = normalize(vDir);
  // The island floats far above the ground, so the haze line sits well
  // below eye level and the view from above still gets a full gradient.
  float h = d.y + 0.44;
  vec3 col = h > 0.0
    ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.9, h), 0.62))
    : mix(uHorizon, uBottom, smoothstep(0.0, -0.42, h));

  // Sun: a wide warm wash, a tight halo and a soft disc.
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 6.0) * 0.2 + pow(sd, 48.0) * 0.3) * uGlow;
  float disc = smoothstep(0.99905, 0.99945, sd);
  col = mix(col, mix(uSunColor, vec3(1.0), 0.55) * 1.05, disc * uSun);

  // Moon: a crescent, cut from one disc by another.
  float md = dot(d, uMoonDir);
  float moon = smoothstep(0.99885, 0.99915, md);
  vec3 bite = normalize(uMoonDir + vec3(0.022, 0.012, 0.0));
  moon *= 1.0 - smoothstep(0.99895, 0.99925, dot(d, bite));
  col += vec3(0.55, 0.65, 1.0) * pow(max(md, 0.0), 220.0) * 0.16 * uMoon;
  col = mix(col, vec3(0.97, 0.96, 0.88), moon * uMoon);

  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aSeed;
uniform float uTime;
uniform float uScale;
varying float vAlpha;
void main() {
  float twinkle = 0.72 + 0.28 * sin(uTime * (0.7 + aSeed * 1.6) + aSeed * 40.0);
  vAlpha = twinkle * smoothstep(-0.5, -0.12, normalize(position).y);
  gl_PointSize = aSize * uScale;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const STAR_FRAG = /* glsl */ `
uniform float uOpacity;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.08, d) * vAlpha * uOpacity;
  gl_FragColor = vec4(0.95, 0.96, 1.0, a);
  #include <colorspace_fragment>
}`;

/** Gradient sky dome with sun, crescent moon and stars. Follows the camera. */
export class Sky {
  readonly group = new THREE.Group();
  readonly uniforms = {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uBottom: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color() },
    uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
    uSun: { value: 1 },
    uGlow: { value: 1 },
    uMoon: { value: 0 },
  };
  private readonly starUniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uScale: { value: 1 },
  };
  private readonly stars: THREE.Points;

  constructor() {
    this.group.name = 'sky';
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 24),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
      }),
    );
    dome.scale.setScalar(300);
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    dome.raycast = () => {};

    const rng = mulberry32(2024);
    const COUNT = 520;
    const pos = new Float32Array(COUNT * 3);
    const size = new Float32Array(COUNT);
    const seed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const y = rng() * 1.5 - 0.5;
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      pos.set([Math.cos(a) * r * 280, y * 280, Math.sin(a) * r * 280], i * 3);
      const big = rng();
      size[i] = 1.3 + big * big * big * 3.4;
      seed[i] = rng();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.stars = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.starUniforms,
        vertexShader: STAR_VERT,
        fragmentShader: STAR_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      }),
    );
    this.stars.renderOrder = -9;
    this.stars.frustumCulled = false;
    this.stars.raycast = () => {};
    this.group.add(dome, this.stars);
  }

  setPixelRatio(ratio: number): void {
    this.starUniforms.uScale.value = ratio;
  }

  update(camera: THREE.Camera, time: number, starOpacity: number, motion: number): void {
    this.group.position.copy(camera.position);
    this.starUniforms.uTime.value = time * motion;
    this.starUniforms.uOpacity.value = starOpacity;
    this.stars.visible = starOpacity > 0.003;
  }
}
