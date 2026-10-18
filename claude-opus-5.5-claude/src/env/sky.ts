import * as THREE from 'three';

const vertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

// Three-stop gradient (the island floats, so there is sky below the horizon too), a sun
// glow, a moon disc and hashed stars that cover the whole sphere apart from the haze band.
const fragmentShader = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunVis;
uniform vec3 uMoonDir;
uniform float uMoonVis;
uniform float uStars;
uniform float uTime;
varying vec3 vDir;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col = y > 0.0
    ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.75, y), 0.75))
    : mix(uHorizon, uBottom, smoothstep(0.0, -0.4, y));

  float s = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(s, 5.0) * 0.28 + pow(s, 48.0) * 0.35 + smoothstep(0.9993, 0.9996, s) * 1.6) * uSunVis;

  float m = dot(d, uMoonDir);
  col += vec3(0.9, 0.93, 1.0) * (smoothstep(0.99935, 0.99955, m) * 1.1 + pow(max(m, 0.0), 220.0) * 0.18) * uMoonVis;

  if (uStars > 0.001) {
    vec3 p = d * 170.0;
    vec3 cell = floor(p);
    float h = hash(cell);
    if (h > 0.986) {
      vec3 offs = vec3(hash(cell + 1.3), hash(cell + 2.7), hash(cell + 4.1)) - 0.5;
      float r = length(fract(p) - 0.5 - offs * 0.5);
      float tw = 0.65 + 0.35 * sin(uTime * (1.0 + h * 3.0) + h * 40.0);
      float band = smoothstep(-0.55, -0.15, y);
      col += vec3(1.0, 0.96, 0.9) * smoothstep(0.2, 0.0, r) * tw * uStars * band * (h - 0.986) * 95.0;
    }
  }

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createSky() {
  const uniforms = {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uBottom: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color() },
    uSunVis: { value: 1 },
    uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonVis: { value: 0 },
    uStars: { value: 0 },
    uTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(90, 48, 24), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.raycast = () => {};
  mesh.name = 'sky';
  return { mesh, uniforms };
}
