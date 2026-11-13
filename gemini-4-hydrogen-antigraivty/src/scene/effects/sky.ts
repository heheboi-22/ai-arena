import * as THREE from 'three';
import { AtmosphereSample } from '../palette';

export class SkySystem {
  readonly group = new THREE.Group();
  private readonly domeGeo: THREE.SphereGeometry;
  private readonly domeMat: THREE.ShaderMaterial;
  private readonly starsGeo: THREE.BufferGeometry;
  private readonly starsMat: THREE.ShaderMaterial;

  constructor() {
    this.group.name = 'sky-system';

    this.domeGeo = new THREE.SphereGeometry(85, 32, 24);
    this.domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTopColor: { value: new THREE.Color('#5b8fc2') },
        uHorizonColor: { value: new THREE.Color('#eadac3') },
        uBottomColor: { value: new THREE.Color('#6d87a1') },
        uSunDir: { value: new THREE.Vector3(-0.6, 0.55, 0.55).normalize() },
        uSunColor: { value: new THREE.Color('#ffe0b0') },
        uSunGlow: { value: 0.45 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldDir;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uBottomColor;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uSunGlow;
        varying vec3 vWorldDir;

        void main() {
          vec3 dir = normalize(vWorldDir);
          float h = dir.y;

          vec3 col;
          if (h >= -0.08) {
            float upperT = pow(clamp((h + 0.08) / 1.08, 0.0, 1.0), 0.56);
            col = mix(uHorizonColor, uTopColor, upperT);
          } else {
            float lowerT = pow(clamp((-0.08 - h) / 0.92, 0.0, 1.0), 0.72);
            col = mix(uHorizonColor, uBottomColor, lowerT);
          }

          float sunAlign = max(dot(dir, normalize(uSunDir)), 0.0);
          float halo = pow(sunAlign, 10.0) * 0.24 * uSunGlow;
          float disc = smoothstep(0.9965, 0.9992, sunAlign) * 0.65 * uSunGlow;
          col += uSunColor * (halo + disc);

          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });

    const domeMesh = new THREE.Mesh(this.domeGeo, this.domeMat);
    domeMesh.name = 'sky-dome';
    domeMesh.renderOrder = -2;
    this.group.add(domeMesh);

    // Procedural starfield on upper sky shell
    const starCount = 240;
    const positions = new Float32Array(starCount * 3);
    const phases = new Float32Array(starCount);
    const sizes = new Float32Array(starCount);

    let seed = 4242;
    const nextRand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < starCount; i++) {
      const u = nextRand();
      const v = nextRand();
      const theta = u * Math.PI * 2;
      // Bias stars above and near horizon (y >= -0.15)
      const cosPhi = -0.15 + v * 1.15;
      const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
      const r = 74;
      positions[i * 3] = r * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = r * cosPhi;
      positions[i * 3 + 2] = r * sinPhi * Math.sin(theta);
      phases[i] = nextRand() * Math.PI * 2;
      sizes[i] = 1.6 + nextRand() * 2.4;
    }

    this.starsGeo = new THREE.BufferGeometry();
    this.starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starsGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    this.starsGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    this.starsMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uOpacity: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute float aPhase;
        attribute float aSize;
        varying float vTwinkle;
        uniform float uTime;

        void main() {
          vTwinkle = 0.72 + 0.28 * sin(uTime * 1.6 + aPhase);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (160.0 / max(-mvPosition.z, 1.0));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vTwinkle;

        void main() {
          vec2 cxy = 2.0 * gl_PointCoord - 1.0;
          float r2 = dot(cxy, cxy);
          if (r2 > 1.0) discard;
          float alpha = pow(1.0 - r2, 1.8) * uOpacity * vTwinkle;
          gl_FragColor = vec4(0.92, 0.95, 1.0, alpha);
        }
      `,
    });

    const starsPoints = new THREE.Points(this.starsGeo, this.starsMat);
    starsPoints.name = 'sky-stars';
    starsPoints.renderOrder = -1;
    this.group.add(starsPoints);
  }

  update(atmosphere: AtmosphereSample, timeSec: number, reducedMotion: boolean): void {
    this.domeMat.uniforms.uTopColor.value.set(atmosphere.skyTop);
    this.domeMat.uniforms.uHorizonColor.value.set(atmosphere.skyHorizon);
    this.domeMat.uniforms.uBottomColor.value.set(atmosphere.skyBottom);
    this.domeMat.uniforms.uSunDir.value.set(
      atmosphere.sunDirection[0],
      atmosphere.sunDirection[1],
      atmosphere.sunDirection[2]
    );
    this.domeMat.uniforms.uSunColor.value.set(atmosphere.sunColor);
    this.domeMat.uniforms.uSunGlow.value = Math.min(1, atmosphere.sunIntensity / 1.8);

    this.starsMat.uniforms.uOpacity.value = atmosphere.starOpacity;
    this.starsMat.uniforms.uTime.value = reducedMotion ? 0 : timeSec;
  }

  dispose(): void {
    this.domeGeo.dispose();
    this.domeMat.dispose();
    this.starsGeo.dispose();
    this.starsMat.dispose();
  }
}
