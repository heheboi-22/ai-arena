import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// A gradient dome with a sun disc, a moon disc and pixel-sized stars. Stars come
// from a hashed cell grid, so there are no textures to load.
const fragmentShader = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunGlow;
  uniform vec3 uMoonDir;
  uniform float uStars;
  uniform float uTime;
  varying vec3 vDir;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    // The default camera looks down, so most of the visible dome sits just below
    // the horizon. Blend bluer toward the top of the frame and keep the bottom warm.
    vec3 col = mix(uHorizon, uZenith, 0.7 * smoothstep(-0.45, 0.2, h));
    col = mix(col, uZenith, smoothstep(0.25, 1.0, h));

    float sunD = max(dot(d, normalize(uSunDir)), 0.0);
    col += uSunColor * (pow(sunD, 10.0) * 0.28 + smoothstep(0.9992, 0.9997, sunD) * 1.2) * uSunGlow;

    float moonD = max(dot(d, normalize(uMoonDir)), 0.0);
    col += vec3(0.78, 0.84, 1.0) * (pow(moonD, 60.0) * 0.18 + smoothstep(0.9993, 0.9997, moonD)) * uStars;

    vec3 cell = floor(d * 900.0);
    vec3 local = fract(d * 900.0) - 0.5;
    float seed = hash(cell);
    float dotShape = 1.0 - smoothstep(0.12, 0.34, length(local));
    float twinkle = 0.65 + 0.35 * sin(uTime * (1.5 + seed * 2.0) + seed * 40.0);
    float star = step(0.9982, seed) * dotShape * twinkle;
    col += vec3(star) * uStars * smoothstep(0.02, 0.35, h);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// A type alias rather than an interface: ShaderMaterial needs an implicit index signature.
export type SkyUniforms = {
  uZenith: { value: Color };
  uHorizon: { value: Color };
  uSunDir: { value: Vector3 };
  uSunColor: { value: Color };
  uSunGlow: { value: number };
  uMoonDir: { value: Vector3 };
  uStars: { value: number };
  uTime: { value: number };
};

export function createSky(): { mesh: Mesh; uniforms: SkyUniforms } {
  const uniforms: SkyUniforms = {
    uZenith: { value: new Color() },
    uHorizon: { value: new Color() },
    uSunDir: { value: new Vector3(0, 1, 0) },
    uSunColor: { value: new Color() },
    uSunGlow: { value: 1 },
    uMoonDir: { value: new Vector3(0, -1, 0) },
    uStars: { value: 0 },
    uTime: { value: 0 },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new Mesh(new SphereGeometry(200, 32, 16), material);
  mesh.name = 'sky';
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}
