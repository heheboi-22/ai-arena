import * as THREE from 'three';
import type { SceneContext } from '../environment/runtime';
import { seededRandom } from '../utils/math';
import { ISLAND_RADIUS } from '../world/terrain';

const RAIN_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uAmount;
  uniform float uWind;
  uniform float uIslandRadius;
  attribute float aEnd;
  attribute float aLength;
  attribute float aSpeed;
  varying float vAlpha;

  void main() {
    float cycle = fract(position.y + uTime * (0.23 + aSpeed * 0.14));
    float y = 11.2 - cycle * 17.8;
    float fall = 11.2 - y;
    vec3 p = vec3(
      position.x + fall * uWind * 0.16,
      y,
      position.z + fall * uWind * 0.05
    );
    if (aEnd > 0.5) {
      p.y -= aLength;
      p.x -= aLength * uWind * 0.48;
      p.z -= aLength * uWind * 0.12;
    }
    float radial = length(p.xz);
    float islandMask = 1.0 - smoothstep(uIslandRadius - 0.9, uIslandRadius, radial);
    float aboveGround = smoothstep(-0.12, 0.28, p.y);
    float hide = mix(1.0, aboveGround, islandMask);
    float edgeFade = 1.0 - smoothstep(7.6, 9.8, radial);
    vAlpha = uAmount * hide * edgeFade;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const RAIN_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    if (vAlpha < 0.012) discard;
    gl_FragColor = vec4(uColor, vAlpha * 0.46);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class Rain {
  readonly mesh: THREE.LineSegments;
  private readonly material: THREE.ShaderMaterial;

  constructor(count: number) {
    const random = seededRandom(1701);
    const positions = new Float32Array(count * 2 * 3);
    const ends = new Float32Array(count * 2);
    const lengths = new Float32Array(count * 2);
    const speeds = new Float32Array(count * 2);
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * 10.2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const seed = random();
      const length = 0.28 + random() * 0.42;
      const speed = random();
      for (let end = 0; end < 2; end += 1) {
        const index = i * 2 + end;
        positions[index * 3] = x;
        positions[index * 3 + 1] = seed;
        positions[index * 3 + 2] = z;
        ends[index] = end;
        lengths[index] = length;
        speeds[index] = speed;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
    geometry.setAttribute('aLength', new THREE.BufferAttribute(lengths, 1));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: RAIN_VERTEX,
      fragmentShader: RAIN_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uAmount: { value: 0 },
        uWind: { value: 0.3 },
        uIslandRadius: { value: ISLAND_RADIUS + 0.2 },
        uColor: { value: new THREE.Color(0xc6d9db) }
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: false
    });

    this.mesh = new THREE.LineSegments(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
  }

  update(ctx: SceneContext): void {
    const uniforms = this.material.uniforms;
    uniforms.uTime!.value = ctx.time;
    uniforms.uAmount!.value = ctx.rain;
    uniforms.uWind!.value = ctx.wind;
    this.mesh.visible = ctx.rain > 0.012;
  }
}
