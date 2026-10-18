import * as THREE from 'three';

const vertexShader = /* glsl */ `
attribute vec4 aData; // world x, y, z, final radius
attribute float aAge; // 0..1 while alive, >= 1 when free
varying float vAlpha;
void main() {
  float alive = step(aAge, 0.999);
  float grow = 1.0 - (1.0 - aAge) * (1.0 - aAge);
  float r = aData.w * (0.12 + 0.88 * grow) * alive;
  vec3 p = vec3(position.x * r, 0.0, position.z * r) + aData.xyz;
  vAlpha = alive * pow(1.0 - aAge, 1.5);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(uColor, vAlpha * uOpacity);
  #include <colorspace_fragment>
}
`;

/**
 * Fixed pool of expanding rings drawn in one instanced call. Used for pond ripples and the
 * smaller splashes where drops hit the ground. When the pool is full new rings are skipped.
 */
export class RingPool {
  readonly mesh: THREE.Mesh;
  private readonly data: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly dataAttr: THREE.InstancedBufferAttribute;
  private readonly ageAttr: THREE.InstancedBufferAttribute;
  private readonly uniforms: { uColor: { value: THREE.Color }; uOpacity: { value: number } };
  private cursor = 0;
  private active = 0;

  constructor(
    private readonly size: number,
    innerRatio: number,
    opacity: number,
  ) {
    const base = new THREE.RingGeometry(innerRatio, 1, 28, 1);
    base.rotateX(-Math.PI / 2);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute('position', base.getAttribute('position'));
    this.data = new Float32Array(size * 4);
    this.age = new Float32Array(size).fill(1);
    this.life = new Float32Array(size).fill(1);
    this.dataAttr = new THREE.InstancedBufferAttribute(this.data, 4).setUsage(THREE.DynamicDrawUsage);
    this.ageAttr = new THREE.InstancedBufferAttribute(this.age, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aData', this.dataAttr);
    g.setAttribute('aAge', this.ageAttr);
    g.instanceCount = size;

    this.uniforms = { uColor: { value: new THREE.Color('#e6eef5') }, uOpacity: { value: opacity } };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.raycast = () => {};
  }

  spawn(x: number, y: number, z: number, radius: number, life: number): void {
    for (let n = 0; n < this.size; n++) {
      const i = (this.cursor + n) % this.size;
      if (this.age[i] < 1) continue;
      this.data[i * 4] = x;
      this.data[i * 4 + 1] = y;
      this.data[i * 4 + 2] = z;
      this.data[i * 4 + 3] = radius;
      this.age[i] = 0;
      this.life[i] = life;
      this.cursor = (i + 1) % this.size;
      this.active++;
      return;
    }
  }

  update(dt: number, color: THREE.Color): void {
    this.uniforms.uColor.value.copy(color);
    if (this.active === 0) return;
    let active = 0;
    for (let i = 0; i < this.size; i++) {
      if (this.age[i] >= 1) continue;
      this.age[i] = Math.min(1, this.age[i] + dt / this.life[i]);
      if (this.age[i] < 1) active++;
    }
    this.active = active;
    this.dataAttr.needsUpdate = true;
    this.ageAttr.needsUpdate = true;
  }

  get count(): number {
    return this.active;
  }
}
