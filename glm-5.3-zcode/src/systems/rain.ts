import * as THREE from 'three';
import { clamp01 } from '../lib/math';
import { POND } from '../world/layout';

const BOUNDS = 8.6;
const TOP = 9.6;

interface Ripple {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  active: boolean;
}

export interface Rain {
  group: THREE.Group;
  update: (dt: number, rainAmount: number, wind: number) => void;
  dispose: () => void;
}

/**
 * Rain as pooled line streaks plus a pool of expanding ripple rings on the
 * pond. Drops recycle at the island surface (spawning ripples over water) or
 * below the island out in the void — never passing through it forever.
 */
export function createRain(dropCount: number, pondWaterY: number): Rain {
  const group = new THREE.Group();

  const positions = new Float32Array(dropCount * 6);
  const px = new Float32Array(dropCount);
  const py = new Float32Array(dropCount);
  const pz = new Float32Array(dropCount);
  const speed = new Float32Array(dropCount);
  for (let i = 0; i < dropCount; i++) {
    px[i] = (Math.random() * 2 - 1) * BOUNDS;
    py[i] = Math.random() * TOP;
    pz[i] = (Math.random() * 2 - 1) * BOUNDS;
    speed[i] = 8.5 + Math.random() * 3.5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0xaebfd0, transparent: true, opacity: 0, depthWrite: false,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  group.add(lines);

  // ripple ring pool
  const RIPPLES = 22;
  const rippleGeo = new THREE.RingGeometry(0.82, 1, 26);
  const ripples: Ripple[] = [];
  for (let i = 0; i < RIPPLES; i++) {
    const rMat = new THREE.MeshBasicMaterial({
      color: 0xcfe6ef, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(rippleGeo, rMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    group.add(mesh);
    ripples.push({ mesh, mat: rMat, life: 0, active: false });
  }

  const spawnRipple = (x: number, z: number) => {
    const free = ripples.find((r) => !r.active);
    if (!free) return;
    free.active = true;
    free.life = 0;
    free.mesh.visible = true;
    free.mesh.position.set(x, pondWaterY + 0.02, z);
    free.mesh.scale.setScalar(0.12);
  };

  const overPond = (x: number, z: number) =>
    Math.hypot(x - POND.x, z - POND.z) < POND.r * 0.88;

  return {
    group,
    update(dt, rainAmount, wind) {
      const visible = rainAmount > 0.015;
      lines.visible = visible;
      if (!visible) {
        for (const r of ripples) {
          r.active = false;
          r.mesh.visible = false;
        }
        return;
      }
      mat.opacity = 0.14 + 0.34 * rainAmount;

      const slantX = wind * 5.2;
      for (let i = 0; i < dropCount; i++) {
        py[i] -= speed[i] * dt;
        px[i] += slantX * dt;
        const distXZ = Math.hypot(px[i], pz[i]);
        const overIsland = distXZ < 6.0;
        const killY = overIsland ? 0.35 : -8.2;
        if (py[i] < killY || px[i] > BOUNDS + 1.5) {
          if (overIsland && overPond(px[i], pz[i]) && Math.random() < 0.5) {
            spawnRipple(px[i], pz[i]);
          }
          px[i] = (Math.random() * 2 - 1) * BOUNDS;
          pz[i] = (Math.random() * 2 - 1) * BOUNDS;
          py[i] = TOP - Math.random() * 1.2;
          speed[i] = 8.5 + Math.random() * 3.5;
        }
        // streak along the velocity direction
        const vx = slantX, vy = -speed[i];
        const len = 0.34 + Math.min(speed[i] * 0.03, 0.35);
        const vl = Math.hypot(vx, vy);
        const i6 = i * 6;
        positions[i6] = px[i];
        positions[i6 + 1] = py[i];
        positions[i6 + 2] = pz[i];
        positions[i6 + 3] = px[i] + (vx / vl) * len;
        positions[i6 + 4] = py[i] + (vy / vl) * len;
        positions[i6 + 5] = pz[i];
      }
      geo.attributes.position.needsUpdate = true;

      // a few ambient rings keep the surface busy even between direct hits
      if (Math.random() < rainAmount * dt * 8) {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.random() * POND.r * 0.8;
        spawnRipple(POND.x + Math.cos(a) * rr, POND.z + Math.sin(a) * rr);
      }

      for (const r of ripples) {
        if (!r.active) continue;
        r.life += dt / 1.05;
        if (r.life >= 1) {
          r.active = false;
          r.mesh.visible = false;
          continue;
        }
        r.mesh.scale.setScalar(0.12 + r.life * 0.95);
        r.mat.opacity = clamp01(0.5 * (1 - r.life)) * rainAmount;
      }
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      rippleGeo.dispose();
      for (const r of ripples) r.mat.dispose();
    },
  };
}
