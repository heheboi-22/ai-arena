import * as THREE from 'three';
import { mulberry32 } from '../util/math';
import type { Atmosphere } from '../world/palette';

export interface Sky {
  group: THREE.Group;
  fog: THREE.Fog;
  setSize(width: number, height: number): void;
  update(atm: Atmosphere, elapsed: number, rain: number, reducedMotion: boolean): void;
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform vec2 uResolution;
uniform float uGlow;
varying vec3 vDir;
void main() {
  // This is a diorama backdrop, not a planetarium. The camera always looks
  // slightly down at the island, so a world-Y gradient would show only its
  // horizon band. Grading by screen height keeps the full day/night sky in view
  // at every orbit angle.
  float t = clamp(gl_FragCoord.y / max(uResolution.y, 1.0), 0.0, 1.0);
  vec3 col = mix(uBottom, uHorizon, smoothstep(0.0, 0.58, t));
  col = mix(col, uTop, smoothstep(0.42, 1.0, t));
  vec3 d = normalize(vDir);
  float halo = pow(max(dot(d, normalize(uSunDir)), 0.0), 10.0) * uGlow;
  col += uSunColor * halo * 0.22;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function discTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.24, 'rgba(255,251,238,.98)');
  g.addColorStop(0.34, 'rgba(255,241,212,.62)');
  g.addColorStop(0.55, 'rgba(255,228,188,.16)');
  g.addColorStop(1, 'rgba(255,224,175,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createSky(): Sky {
  const group = new THREE.Group();
  group.name = 'sky';

  const uniforms = {
    uTop: { value: new THREE.Color('#77aecd') },
    uHorizon: { value: new THREE.Color('#ecdfc2') },
    uBottom: { value: new THREE.Color('#b9cfd0') },
    uSunColor: { value: new THREE.Color('#fff3da') },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uResolution: { value: new THREE.Vector2(1280, 800) },
    uGlow: { value: 1 },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(130, 40, 24),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  dome.frustumCulled = false;
  group.add(dome);

  const tex = discTexture();
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color: '#ffe6b8', transparent: true, depthWrite: false, fog: false,
  }));
  sun.scale.setScalar(3.4);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color: '#e8ecf5', transparent: true, depthWrite: false, fog: false,
  }));
  moon.scale.setScalar(2.4);
  // Both discs sit low and far behind the island. A downward-looking camera
  // only sees the sky close to its horizon, so a physically high sun would be
  // permanently off-frame.
  sun.position.set(-12, 3.2, -22);
  moon.position.set(-2, 2.6, -26);
  group.add(sun, moon);

  // Stars: fixed points on the celestial sphere, faded in by night.
  const rng = mulberry32(1207);
  const starPos: number[] = [];
  const starBig: number[] = [];
  for (let i = 0; i < 520; i++) {
    const a = rng() * Math.PI * 2;
    // Near and below the horizon: that band is what a downward-looking camera
    // actually frames as "sky".
    const y = -0.62 + rng() * 0.70;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const p = [Math.cos(a) * r * 105, y * 105, Math.sin(a) * r * 105];
    (i % 11 === 0 ? starBig : starPos).push(...p);
  }
  const makeStars = (arr: number[], size: number): THREE.Points => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({
      color: '#f4f1e2', size, sizeAttenuation: false, transparent: true,
      opacity: 0, depthWrite: false, fog: false,
    }));
  };
  const stars = makeStars(starPos, 2.0);
  const starsBig = makeStars(starBig, 3.2);
  group.add(stars, starsBig);

  const fog = new THREE.Fog('#ecdfc2', 24, 100);

  return {
    group,
    fog,
    setSize(width, height) {
      uniforms.uResolution.value.set(Math.max(1, width), Math.max(1, height));
    },
    update(atm, elapsed, rain, reducedMotion) {
      uniforms.uTop.value.copy(atm.top);
      uniforms.uHorizon.value.copy(atm.horizon);
      uniforms.uBottom.value.copy(atm.bottom);
      uniforms.uSunColor.value.copy(atm.sunColor);
      uniforms.uSunDir.value.copy(atm.sunDir);
      uniforms.uGlow.value = (0.35 + atm.golden * 0.9) * (1 - rain * 0.85) * (1 - atm.night * 0.7);

      sun.material.color.copy(atm.sunColor).lerp(new THREE.Color('#fff6e2'), 0.35);
      sun.material.opacity = Math.max(0, atm.day * (1 - rain * 0.9)) * 0.92;
      sun.visible = sun.material.opacity > 0.01;
      sun.scale.setScalar(3.4 * (1 + atm.golden * 0.30));

      moon.material.opacity = Math.max(0, atm.night * (1 - rain * 0.85)) * 0.85;
      moon.visible = moon.material.opacity > 0.01;

      const twinkle = reducedMotion ? 1 : 0.92 + 0.08 * Math.sin(elapsed * 0.8);
      const starOpacity = Math.pow(Math.max(0, atm.night), 1.4) * (1 - rain * 0.92) * twinkle;
      (stars.material as THREE.PointsMaterial).opacity = starOpacity;
      (starsBig.material as THREE.PointsMaterial).opacity = starOpacity * 0.9;
      stars.visible = starsBig.visible = starOpacity > 0.015;

      fog.color.copy(atm.horizon).lerp(atm.bottom, 0.35);
      fog.near = 24;
      fog.far = 100 + rain * 25;
    },
  };
}
