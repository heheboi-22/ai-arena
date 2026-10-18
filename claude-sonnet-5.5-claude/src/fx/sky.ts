import * as THREE from 'three';
import { moonTexture } from '../util/textures';
import type { Environment } from './environment';

const vertexShader = /* glsl */ `
  uniform mat4 uInvProj;
  uniform mat4 uCamWorld;
  varying vec3 vRay;
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    vec4 view = uInvProj * vec4(position.xy, 1.0, 1.0);
    vRay = mat3(uCamWorld) * (view.xyz / view.w);
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uBottom;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunVisibility;
  uniform float uStars;
  uniform float uTime;
  uniform float uRain;
  varying vec3 vRay;
  varying vec2 vUv;

  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }

  void main() {
    vec3 dir = normalize(vRay);

    // A vertical gradient that follows the screen, so the backdrop stays
    // composed whichever way the camera is turned.
    float g = clamp(vUv.y, 0.0, 1.0);
    vec3 col = mix(uBottom, uMid, smoothstep(0.0, 0.5, g));
    col = mix(col, uTop, smoothstep(0.42, 1.0, g));

    // Sun: a soft halo that leans toward wherever the sun really is, and a disc.
    float sd = max(dot(dir, uSunDir), 0.0);
    float halo = pow(sd, 5.0) * 0.28 + pow(sd, 28.0) * 0.5;
    float disc = smoothstep(0.99935, 0.99975, sd);
    col += uSunColor * (halo + disc * 2.4) * uSunVisibility;

    // Stars: one jittered point per grid cell on a sphere of cells.
    if (uStars > 0.001) {
      vec3 p = dir * 62.0;
      vec3 cell = floor(p);
      vec3 f = fract(p) - 0.5;
      float h = hash13(cell);
      if (h > 0.86) {
        vec3 off = (vec3(hash13(cell + 1.7), hash13(cell + 3.1), hash13(cell + 5.3)) - 0.5) * 0.66;
        float d = length(f - off);
        float r = 0.065 + 0.06 * hash13(cell + 8.3);
        float twinkle = 0.7 + 0.3 * sin(uTime * (1.2 + h * 4.0) + h * 60.0);
        float s = smoothstep(r, r * 0.25, d) * twinkle;
        vec3 tint = mix(vec3(0.8, 0.88, 1.0), vec3(1.0, 0.92, 0.8), hash13(cell + 2.2));
        col += tint * s * uStars * (0.6 + 0.9 * (h - 0.86) * 7.0);
      }
    }

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/**
 * The backdrop: a full-screen gradient with a sun disc and stars, plus a
 * moon sprite. It is drawn first and never writes depth.
 */
export class Sky {
  readonly mesh: THREE.Mesh;
  readonly moon: THREE.Sprite;
  private readonly material: THREE.ShaderMaterial;
  private readonly moonMaterial: THREE.SpriteMaterial;
  private readonly moonMap: THREE.CanvasTexture;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uInvProj: { value: new THREE.Matrix4() },
        uCamWorld: { value: new THREE.Matrix4() },
        uTop: { value: new THREE.Color() },
        uMid: { value: new THREE.Color() },
        uBottom: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color() },
        uSunVisibility: { value: 0 },
        uStars: { value: 0 },
        uTime: { value: 0 },
        uRain: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const quad = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(quad, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.name = 'sky';

    this.moonMap = moonTexture();
    this.moonMaterial = new THREE.SpriteMaterial({
      map: this.moonMap,
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    this.moon = new THREE.Sprite(this.moonMaterial);
    this.moon.scale.setScalar(26);
    this.moon.renderOrder = -900;
    this.moon.name = 'moon';
  }

  update(env: Environment, camera: THREE.Camera, time: number): void {
    const u = this.material.uniforms;
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    u.uCamWorld.value.copy(camera.matrixWorld);
    u.uTop.value.copy(env.skyTop);
    u.uMid.value.copy(env.skyMid);
    u.uBottom.value.copy(env.skyBottom);
    u.uSunDir.value.copy(env.sunDir);
    u.uSunColor.value.copy(env.sunColor);
    u.uSunVisibility.value = env.sunVisibility;
    u.uStars.value = env.starVisibility;
    u.uTime.value = time;
    u.uRain.value = env.rain;

    this.moon.position.copy(camera.position).addScaledVector(env.moonDir, 150);
    this.moonMaterial.opacity = env.moonVisibility;
    this.moon.visible = env.moonVisibility > 0.01;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.moonMaterial.dispose();
    this.moonMap.dispose();
  }
}
