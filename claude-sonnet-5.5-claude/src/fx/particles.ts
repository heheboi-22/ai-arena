import * as THREE from 'three';

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aRot;
  uniform float uScale;
  varying float vAlpha;
  varying float vRot;
  void main() {
    vAlpha = aAlpha;
    vRot = aRot;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aAlpha > 0.001 ? clamp(aSize * uScale / max(-mv.z, 0.1), 1.0, 96.0) : 0.0;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  varying float vAlpha;
  varying float vRot;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vRot);
    float s = sin(vRot);
    vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
    vec4 tex = texture2D(uMap, q);
    gl_FragColor = vec4(uColor, tex.a * vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * A fixed pool of camera-facing sprites drawn as one `Points` object. Owners
 * write into the typed arrays and call `commit()`; nothing is allocated per frame.
 */
export class ParticlePool {
  readonly points: THREE.Points;
  readonly count: number;
  readonly positions: Float32Array;
  readonly sizes: Float32Array;
  readonly alphas: Float32Array;
  readonly rotations: Float32Array;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry = new THREE.BufferGeometry();

  constructor(count: number, map: THREE.Texture, blending: THREE.Blending = THREE.NormalBlending) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.sizes = new Float32Array(count);
    this.alphas = new Float32Array(count);
    this.rotations = new Float32Array(count);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aRot', new THREE.BufferAttribute(this.rotations, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending,
      uniforms: {
        uMap: { value: map },
        uColor: { value: new THREE.Color(1, 1, 1) },
        uScale: { value: 600 },
      },
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  get color(): THREE.Color {
    return this.material.uniforms.uColor.value as THREE.Color;
  }

  /** Pixels per world unit at distance 1, so sprite sizes can be given in world units. */
  setScale(pixelsPerUnit: number): void {
    this.material.uniforms.uScale.value = pixelsPerUnit;
  }

  commit(): void {
    for (const name of ['position', 'aSize', 'aAlpha', 'aRot']) {
      this.geometry.getAttribute(name).needsUpdate = true;
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
