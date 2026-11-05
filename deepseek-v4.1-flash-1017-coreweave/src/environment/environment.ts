import * as THREE from 'three';
import type { Palette } from './palette';
import type { SceneContext } from './runtime';
import { seededRandom, smoothstep, sunDirection } from '../utils/math';
import {
  makeMistTexture,
  makeMoonTexture,
  makeShadowTexture,
  makeStarTexture,
  makeSunTexture
} from '../utils/textures';

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uBelow;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform float uGlow;
  varying vec3 vDirection;

  void main() {
    vec3 direction = normalize(vDirection);
    float h = direction.y;
    float skyMix = pow(clamp(smoothstep(-0.005, 0.16, h), 0.0, 1.0), 0.65);
    vec3 color = mix(uHorizon, uZenith, skyMix);
    float horizonBlend = smoothstep(-0.13, 0.015, h);
    color = mix(uBelow * 0.7, color, horizonBlend);
    color += uHorizon * 0.07 * exp(-abs(h) * 24.0);
    color = mix(color, uBelow * 0.5, smoothstep(-0.16, -0.72, h));

    float sunDot = max(dot(direction, normalize(uSunDir)), 0.0);
    float halo = pow(sunDot, 7.0) * 0.75 + pow(sunDot, 2.0) * 0.25;
    color += uSunColor * uGlow * halo;
    color += uSunColor * uGlow * 0.18 * exp(-abs(h) * 9.0) * pow(sunDot, 1.4);

    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    color += (grain - 0.5) * 0.0025;

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const makeStars = (count: number, radius: number, seed: number): THREE.Points => {
  const random = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  let written = 0;
  while (written < count) {
    const theta = random() * Math.PI * 2;
    const y = 0.06 + Math.pow(random(), 0.65) * 0.94;
    const ring = Math.sqrt(1 - y * y);
    positions[written * 3] = Math.cos(theta) * ring * radius;
    positions[written * 3 + 1] = y * radius;
    positions[written * 3 + 2] = Math.sin(theta) * ring * radius;
    written += 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    size: 1.9,
    sizeAttenuation: false,
    map: makeStarTexture(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    color: 0xdde6f2,
    fog: false,
    toneMapped: false
  });
  const points = new THREE.Points(geometry, material);
  points.renderOrder = -50;
  points.frustumCulled = false;
  return points;
};

export interface EnvironmentOptions {
  shadowMapSize: number;
}

export class Environment {
  readonly keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
  readonly hemiLight = new THREE.HemisphereLight(0xcad9d3, 0x7f805f, 0.8);
  readonly ambientLight = new THREE.AmbientLight(0xffffff, 0.18);
  readonly sunDirection = new THREE.Vector3();
  readonly moonDirection = new THREE.Vector3();
  readonly keyDirection = new THREE.Vector3();
  readonly keyColor = new THREE.Color();
  private readonly sky: THREE.Mesh;
  private readonly skyMaterial: THREE.ShaderMaterial;
  private readonly sunSprite: THREE.Sprite;
  private readonly moonSprite: THREE.Sprite;
  readonly bounceLight = new THREE.DirectionalLight(0xc8d8cf, 0.32);
  private readonly stars: THREE.Points;
  private readonly brightStars: THREE.Points;
  private readonly mist: THREE.Mesh;
  private readonly mistMaterial: THREE.MeshBasicMaterial;
  private readonly islandShadow: THREE.Mesh;
  private readonly islandShadowMaterial: THREE.MeshBasicMaterial;
  private readonly fog: THREE.FogExp2;
  private readonly scene: THREE.Scene;

  constructor(scene: THREE.Scene, options: EnvironmentOptions) {
    this.scene = scene;
    this.fog = new THREE.FogExp2(0xdfd2b7, 0.005);
    scene.fog = this.fog;

    this.skyMaterial = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      uniforms: {
        uZenith: { value: new THREE.Color(0x7fa6ba) },
        uHorizon: { value: new THREE.Color(0xf2ddbd) },
        uBelow: { value: new THREE.Color(0xb3a082) },
        uSunColor: { value: new THREE.Color(0xffd39b) },
        uSunDir: { value: new THREE.Vector3(-0.7, 0.5, 0.35) },
        uGlow: { value: 0.4 }
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(220, 48, 28), this.skyMaterial);
    this.sky.renderOrder = -100;
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    this.stars = makeStars(620, 170, 7);
    this.brightStars = makeStars(80, 168, 31);
    (this.brightStars.material as THREE.PointsMaterial).size = 2.8;
    scene.add(this.stars, this.brightStars);

    const sunMaterial = new THREE.SpriteMaterial({
      map: makeSunTexture(),
      color: 0xffd6a0,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false
    });
    this.sunSprite = new THREE.Sprite(sunMaterial);
    this.sunSprite.scale.setScalar(20);
    this.sunSprite.renderOrder = -40;
    scene.add(this.sunSprite);

    const moonMaterial = new THREE.SpriteMaterial({
      map: makeMoonTexture(),
      color: 0xd7e4f5,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      fog: false
    });
    this.moonSprite = new THREE.Sprite(moonMaterial);
    this.moonSprite.scale.setScalar(12);
    this.moonSprite.renderOrder = -40;
    scene.add(this.moonSprite);

    this.mistMaterial = new THREE.MeshBasicMaterial({
      map: makeMistTexture(),
      color: 0xdfd2b7,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false
    });
    this.mist = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), this.mistMaterial);
    this.mist.rotation.x = -Math.PI / 2;
    this.mist.position.y = -8.6;
    this.mist.renderOrder = -30;
    scene.add(this.mist);

    this.islandShadowMaterial = new THREE.MeshBasicMaterial({
      map: makeShadowTexture(),
      color: 0x1c2830,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      fog: false
    });
    this.islandShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 9),
      this.islandShadowMaterial
    );
    this.islandShadow.rotation.x = -Math.PI / 2;
    this.islandShadow.position.set(0.3, -8.5, 0.2);
    this.islandShadow.renderOrder = -29;
    scene.add(this.islandShadow);

    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(options.shadowMapSize, options.shadowMapSize);
    this.keyLight.shadow.camera.left = -8.5;
    this.keyLight.shadow.camera.right = 8.5;
    this.keyLight.shadow.camera.top = 8.5;
    this.keyLight.shadow.camera.bottom = -8.5;
    this.keyLight.shadow.camera.near = 4;
    this.keyLight.shadow.camera.far = 68;
    this.keyLight.shadow.bias = -0.00045;
    this.keyLight.shadow.normalBias = 0.028;
    this.keyLight.shadow.radius = 3;
    this.keyLight.shadow.camera.updateProjectionMatrix();
    this.keyLight.target.position.set(0, 0.3, 0);
    scene.add(this.keyLight, this.keyLight.target);

    this.bounceLight.position.set(7, -7, 11);
    this.bounceLight.target.position.set(0, -1, 0);
    this.bounceLight.castShadow = false;
    scene.add(this.bounceLight, this.bounceLight.target);

    scene.add(this.hemiLight, this.ambientLight);
    scene.background = new THREE.Color(0xdfd2b7);
  }

  update(ctx: SceneContext, palette: Palette): void {
    sunDirection(ctx.hour, this.sunDirection);
    sunDirection(ctx.hour + 12, this.moonDirection);
    const useSun = palette.sunIntensity >= palette.moonIntensity;
    this.keyDirection.copy(useSun ? this.sunDirection : this.moonDirection).normalize();
    this.keyColor.copy(useSun ? palette.sunColor : palette.moonColor);

    this.keyLight.color.copy(this.keyColor);
    this.keyLight.intensity = useSun ? palette.sunIntensity : palette.moonIntensity;
    this.keyLight.position.copy(this.keyDirection).multiplyScalar(36);
    this.keyLight.position.y += 0.3;
    this.keyLight.target.position.set(0, 0.3, 0);
    this.keyLight.target.updateMatrixWorld();

    this.hemiLight.color.copy(palette.hemiSky);
    this.hemiLight.groundColor.copy(palette.hemiGround);
    this.hemiLight.intensity = palette.hemiIntensity;
    this.ambientLight.color.copy(palette.ambient);
    this.ambientLight.intensity = palette.ambientIntensity;
    this.bounceLight.color.copy(palette.horizon).lerp(palette.below, 0.35);
    this.bounceLight.intensity = 0.36 + (1 - palette.night) * 0.42 + ctx.rain * 0.03;

    const uniforms = this.skyMaterial.uniforms;
    (uniforms.uZenith!.value as THREE.Color).copy(palette.zenith);
    (uniforms.uHorizon!.value as THREE.Color).copy(palette.horizon);
    (uniforms.uBelow!.value as THREE.Color).copy(palette.below);
    (uniforms.uSunColor!.value as THREE.Color).copy(palette.sunColor);
    (uniforms.uSunDir!.value as THREE.Vector3).copy(this.sunDirection);
    uniforms.uGlow!.value = palette.sunGlow;

    this.sunSprite.position.copy(this.sunDirection).multiplyScalar(150);
    const sunMaterial = this.sunSprite.material as THREE.SpriteMaterial;
    sunMaterial.color.copy(palette.sunColor);
    sunMaterial.opacity =
      0.78 * smoothstep(-0.045, 0.08, this.sunDirection.y) * (1 - ctx.rain * 0.92);

    this.moonSprite.position.copy(this.moonDirection).multiplyScalar(150);
    const moonMaterial = this.moonSprite.material as THREE.SpriteMaterial;
    moonMaterial.opacity =
      0.82 *
      smoothstep(0.06, 0.65, palette.night) *
      smoothstep(-0.02, 0.1, this.moonDirection.y) *
      (1 - ctx.rain * 0.8);

    const starOpacity = palette.starAlpha * (1 - ctx.rain * 0.94);
    (this.stars.material as THREE.PointsMaterial).opacity = starOpacity;
    (this.brightStars.material as THREE.PointsMaterial).opacity = Math.min(1, starOpacity * 1.15);
    this.stars.visible = starOpacity > 0.012;
    this.brightStars.visible = starOpacity > 0.012;

    this.mistMaterial.color.copy(palette.fog).lerp(palette.horizon, 0.35);
    this.mistMaterial.opacity = 0.2 + ctx.rain * 0.15 + palette.night * 0.03;
    this.islandShadowMaterial.opacity = 0.16 + (1 - palette.night) * 0.06;

    this.fog.color.copy(palette.fog);
    this.fog.density = palette.fogDensity;
    (this.scene.background as THREE.Color).copy(palette.fog);
  }
}
