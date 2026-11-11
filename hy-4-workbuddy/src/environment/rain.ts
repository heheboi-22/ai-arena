import * as THREE from 'three';
import { mulberry32, range } from '../util/math';
import { onIsland } from '../world/island';
import { inPond } from '../world/pond';
import type { Pond } from '../world/pond';

export interface Rain {
  points: THREE.LineSegments;
  count: number;
  /** How many streaks are visible at the current opacity. */
  visibleStreaks(): number;
  update(dt: number, rainAmount: number, wind: number, pond: Pond): void;
  setTint(color: THREE.Color): void;
}

interface Drop {
  x: number;
  y: number;
  z: number;
  speed: number;
  len: number;
  threshold: number;
}

const VERT = /* glsl */ `
attribute float aThreshold;
uniform float uOpacity;
varying float vAlpha;
void main() {
  vAlpha = clamp((uOpacity - aThreshold) * 5.0, 0.0, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  if (vAlpha < 0.01) discard;
  gl_FragColor = vec4(uColor, vAlpha * 0.72);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createRain(count: number): Rain {
  const rng = mulberry32(4242);
  const drops: Drop[] = [];
  const positions = new Float32Array(count * 6);
  const thresholds = new Float32Array(count * 2);

  const respawn = (d: Drop, initial = false): void => {
    d.x = range(rng, -7.2, 7.2);
    d.z = range(rng, -6.2, 6.2);
    d.y = initial ? range(rng, -0.4, 12) : range(rng, 8.5, 13.5);
    d.speed = range(rng, 8.5, 13.5);
    d.len = range(rng, 0.24, 0.46);
  };
  for (let i = 0; i < count; i++) {
    const d: Drop = { x: 0, y: 0, z: 0, speed: 0, len: 0, threshold: rng() };
    respawn(d, true);
    drops.push(d);
    thresholds[i * 2] = d.threshold;
    thresholds[i * 2 + 1] = d.threshold;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aThreshold', new THREE.BufferAttribute(thresholds, 1));
  geo.setDrawRange(0, count * 2);
  // The bounding sphere is irrelevant: positions change every frame.
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 30);

  const uniforms = {
    uOpacity: { value: 0 },
    uColor: { value: new THREE.Color('#e3eef0') },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const points = new THREE.LineSegments(geo, material);
  points.name = 'rain';
  points.frustumCulled = false;
  points.visible = false;

  let lastOpacity = 0;

  const api: Rain = {
    points,
    count,
    visibleStreaks() {
      let n = 0;
      for (const d of drops) if (d.threshold < lastOpacity) n++;
      return n;
    },
    setTint(color) {
      uniforms.uColor.value.copy(color);
    },
    update(dt, rainAmount, wind, pond) {
      const opacity = Math.min(1, Math.max(0, rainAmount));
      lastOpacity = opacity;
      uniforms.uOpacity.value = opacity;
      points.visible = opacity > 0.004;
      if (!points.visible) return;

      const driftX = wind * 3.1;
      const slantX = wind * 2.3;
      const slantZ = wind * 0.45;
      for (let i = 0; i < count; i++) {
        const d = drops[i];
        d.y -= d.speed * dt;
        d.x += driftX * dt;
        if (d.x > 7.6) d.x = -7.6;
        // Drops that are over the island stop at the grass; those outside it
        // fall away into the sky below and are recycled there.
        const ground = onIsland(d.x, d.z, 0) ? 0.02 : -6.0;
        if (d.y < ground) {
          if (ground > 0 && inPond(d.x, d.z, 0.92) && opacity > 0.25 && rng() < 0.35) {
            pond.spawnRipple(d.x, d.z, 0.75);
          }
          respawn(d);
        }
        const o = i * 6;
        positions[o] = d.x;
        positions[o + 1] = d.y;
        positions[o + 2] = d.z;
        positions[o + 3] = d.x - slantX * d.len;
        positions[o + 4] = d.y + d.len;
        positions[o + 5] = d.z - slantZ * d.len;
      }
      geo.getAttribute('position').needsUpdate = true;
    },
  };
  return api;
}
