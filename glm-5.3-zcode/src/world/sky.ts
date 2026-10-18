import * as THREE from 'three';
import { mulberry32, smoothstep } from '../lib/math';
import { moonDirection, sunDirection, type PaletteSample } from '../palette';

export interface Sky {
  group: THREE.Group;
  update(hour: number, palette: PaletteSample, rain: number, dt: number): void;
}

const DOME_R = 60;

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform float uHalo;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float m = pow(clamp(d.y, 0.0, 1.0), 0.55);
    vec3 sky = mix(uHorizon, uTop, m);
    sky = mix(uHorizon * 0.82, sky, smoothstep(-0.14, 0.05, d.y));
    float s = max(dot(d, uSunDir), 0.0);
    vec3 halo = uSunColor * (pow(s, 220.0) * 1.2 + pow(s, 9.0) * 0.22) * uHalo;
    gl_FragColor = vec4(sky + halo, 1.0);
    #include <colorspace_fragment>
  }
`;

/**
 * Procedural sky: a shader gradient dome with a sun halo, a sun disc, a moon
 * with craters, and a pooled starfield. All colors arrive from the palette.
 */
export function makeSky(): Sky {
  const group = new THREE.Group();

  const uniforms = {
    uTop: { value: new THREE.Color(0x7cb0d4) },
    uHorizon: { value: new THREE.Color(0xf3e2bd) },
    uSunColor: { value: new THREE.Color(0xffe7bd) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uHalo: { value: 1 },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(DOME_R, 40, 24),
    new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  group.add(dome);

  // --- stars ---------------------------------------------------------------
  const rand = mulberry32(777);
  const starCount = 340;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const a = rand() * Math.PI * 2;
    const y = 0.1 + rand() * 0.9;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    starPos[i * 3] = Math.cos(a) * r * (DOME_R - 2);
    starPos[i * 3 + 1] = y * (DOME_R - 2);
    starPos[i * 3 + 2] = Math.sin(a) * r * (DOME_R - 2);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xdfe8ff,
    size: 1.6,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);

  // --- sun and moon discs ------------------------------------------------------
  const disc = (r: number, color: number, opacity = 1): THREE.Mesh => {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(r, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, toneMapped: false, depthWrite: false }),
    );
    return m;
  };

  const sunGroup = new THREE.Group();
  const sunCore = disc(1.35, 0xfff1c4);
  const sunGlow = disc(2.6, 0xffdd99, 0.28);
  sunGlow.position.z = -0.1; // behind the core, both facing inward later
  sunGroup.add(sunGlow, sunCore);
  group.add(sunGroup);

  const moonGroup = new THREE.Group();
  const moonCore = disc(1.05, 0xe6ecf6);
  const craterA = disc(0.2, 0xc3cddf);
  craterA.position.set(0.24, -0.18, 0.02);
  const craterB = disc(0.13, 0xc9d4e4);
  craterB.position.set(-0.28, 0.24, 0.02);
  const craterC = disc(0.09, 0xc9d4e4);
  craterC.position.set(-0.05, -0.4, 0.02);
  moonGroup.add(moonCore, craterA, craterB, craterC);
  group.add(moonGroup);

  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3();
  const place = (g: THREE.Group, dir: THREE.Vector3) => {
    g.position.copy(dir).multiplyScalar(DOME_R - 4);
    g.lookAt(0, 0, 0);
  };

  return {
    group,
    update(hour, palette, rain, dt) {
      uniforms.uTop.value.copy(palette.skyTop);
      uniforms.uHorizon.value.copy(palette.skyHorizon);
      uniforms.uSunColor.value.copy(palette.sunColor);
      sunDirection(hour, sunDir);
      uniforms.uSunDir.value.copy(sunDir);
      uniforms.uHalo.value = palette.sunIntensity * 0.5 * (1 - rain * 0.85);

      starMat.opacity = palette.starOpacity * (1 - rain * 0.85);
      stars.rotation.y += dt * 0.004;

      place(sunGroup, sunDir);
      const sunVis = smoothstep((sunDir.y + 0.04) / 0.12) * (1 - rain * 0.9);
      (sunCore.material as THREE.MeshBasicMaterial).opacity = sunVis;
      (sunGlow.material as THREE.MeshBasicMaterial).opacity = sunVis * 0.3;

      moonDirection(hour, moonDir);
      place(moonGroup, moonDir);
      const moonVis = smoothstep((moonDir.y + 0.04) / 0.12) * (1 - rain * 0.85) * (0.35 + 0.65 * (1 - palette.dayFactor));
      for (const child of moonGroup.children) {
        ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = moonVis;
      }
    },
  };
}
