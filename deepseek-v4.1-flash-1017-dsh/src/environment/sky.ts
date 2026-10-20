import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Texture,
} from 'three';
import { mulberry32 } from '../lib/noise';
import type { EnvironmentFrame } from './environment';

interface SkyUniforms {
  uTop: { value: Color };
  uHorizon: { value: Color };
  uSunColor: { value: Color };
  uSunDir: { value: Vector3 };
  uMoonDir: { value: Vector3 };
  uNight: { value: number };
  uRain: { value: number };
  [key: string]: { value: unknown };
}

export class Sky {
  readonly group = new Group();
  private readonly uniforms: SkyUniforms;
  private readonly stars: Points;
  private readonly starMaterial: PointsMaterial;
  private readonly moonMaterial: SpriteMaterial;
  private readonly moon: Sprite;

  constructor(softDot: Texture, moonTexture: Texture) {
    this.uniforms = {
      uTop: { value: new Color('#7fb1c4') },
      uHorizon: { value: new Color('#e8ece1') },
      uSunColor: { value: new Color('#ffe5b8') },
      uSunDir: { value: new Vector3(0.3, 0.8, 0.4) },
      uMoonDir: { value: new Vector3(-0.3, -0.8, -0.4) },
      uNight: { value: 0 },
      uRain: { value: 0 },
    };

    const material = new ShaderMaterial({
      uniforms: this.uniforms,
      side: BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      vertexShader: /* glsl */ `
        varying vec3 vDirection;

        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vDirection = normalize(world.xyz - cameraPosition);
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        uniform vec3 uMoonDir;
        uniform float uNight;
        uniform float uRain;
        varying vec3 vDirection;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        void main() {
          vec3 direction = normalize(vDirection);
          float height = direction.y;

          vec3 color = mix(uHorizon, uTop, smoothstep(-0.06, 0.56, height));
          color = mix(color, uHorizon, pow(clamp(1.0 - abs(height) * 2.4, 0.0, 1.0), 3.0) * 0.15);
          color *= mix(1.0, 0.58, smoothstep(0.0, -0.7, height));

          float sunDot = max(dot(direction, normalize(uSunDir)), 0.0);
          float sunDisc = smoothstep(0.9992, 0.99972, sunDot);
          float sunHalo = pow(sunDot, 14.0) * 0.3 + pow(sunDot, 150.0) * 0.35;
          color += uSunColor * (sunDisc * 2.4 + sunHalo) * (1.0 - uRain * 0.55);

          float moonDot = max(dot(direction, normalize(uMoonDir)), 0.0);
          float moonDisc = smoothstep(0.99955, 0.99988, moonDot);
          float moonHalo = pow(moonDot, 320.0) * 0.22;
          vec3 moonColor = vec3(0.78, 0.84, 0.96);
          color += moonColor * (moonDisc * 2.0 + moonHalo) * uNight;

          // A whisper of dithering keeps the large sky gradients from banding.
          float dither = (hash(gl_FragCoord.xy) - 0.5) / 255.0;
          color += dither;

          gl_FragColor = vec4(color, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });

    const dome = new SphereGeometry(140, 36, 20);
    const mesh = new Mesh(dome, material);
    mesh.renderOrder = -100;
    mesh.frustumCulled = false;
    this.group.add(mesh);

    const starPositions: number[] = [];
    const starRandom = mulberry32(92731);
    for (let i = 0; i < 760; i += 1) {
      const theta = starRandom() * Math.PI * 2;
      // A floating island has no ground plane, so stars can surround it.
      const y = starRandom() * 1.3 - 0.25;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      starPositions.push(Math.cos(theta) * radius * 130, y * 130, Math.sin(theta) * radius * 130);
    }
    const starGeometry = new BufferGeometry();
    starGeometry.setAttribute('position', new Float32BufferAttribute(starPositions, 3));
    this.starMaterial = new PointsMaterial({
      color: new Color('#eef3ff'),
      size: 5.4,
      sizeAttenuation: false,
      map: softDot,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
      alphaTest: 0.02,
      fog: false,
    });
    this.stars = new Points(starGeometry, this.starMaterial);
    this.stars.renderOrder = -99;
    this.stars.frustumCulled = false;
    this.group.add(this.stars);

    this.moonMaterial = new SpriteMaterial({
      map: moonTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    this.moon = new Sprite(this.moonMaterial);
    this.moon.position.set(-10, 3.3, -16);
    this.moon.scale.setScalar(1.7);
    this.moon.visible = false;
    this.moon.renderOrder = -98;
    this.group.add(this.moon);
  }

  update(frame: EnvironmentFrame): void {
    this.uniforms.uTop.value.copy(frame.skyTop);
    this.uniforms.uHorizon.value.copy(frame.skyHorizon);
    this.uniforms.uSunColor.value.copy(frame.lightColor);
    this.uniforms.uSunDir.value.copy(frame.sunDirection);
    this.uniforms.uMoonDir.value.copy(frame.moonDirection);
    this.uniforms.uNight.value = frame.night;
    this.uniforms.uRain.value = frame.rain;
    this.starMaterial.opacity = Math.max(frame.night * 0.98, frame.stars) * (1 - frame.rain * 0.65);
    this.stars.visible = this.starMaterial.opacity > 0.02;

    const moonOpacity = Math.pow(Math.max(0, frame.night), 1.4) * (1 - frame.rain * 0.7);
    this.moonMaterial.opacity = moonOpacity * 0.95;
    this.moon.visible = moonOpacity > 0.02;
  }
}
