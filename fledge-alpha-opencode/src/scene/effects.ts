import * as THREE from 'three';
import { groundY, ISLAND_TOP, ISLAND_RADIUS } from './island';
import { POND } from './props';

export class Clouds {
  readonly group = new THREE.Group();
  private material = new THREE.MeshStandardMaterial({ color: 0xf7fafc, roughness: 1 });
  private defs: Array<{ speed: number; bobPhase: number; baseY: number }> = [];

  constructor(count = 4) {
    for (let i = 0; i < count; i++) {
      const cloud = new THREE.Group();
      const puffs = 4 + Math.floor(Math.random() * 2);
      for (let j = 0; j < puffs; j++) {
        const r = 0.7 + Math.random() * 0.7;
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), this.material);
        m.position.set((j - puffs / 2) * 1.0 + Math.random() * 0.5, Math.random() * 0.4, (Math.random() - 0.5) * 1.2);
        m.scale.y = 0.62;
        cloud.add(m);
      }
      const angle = (i / count) * Math.PI * 2 + 0.7;
      const radius = 12 + Math.random() * 7;
      cloud.position.set(Math.cos(angle) * radius, 5.4 + Math.random() * 1.6, Math.sin(angle) * radius * 0.6);
      const s = 0.7 + Math.random() * 0.6;
      cloud.scale.setScalar(s);
      this.defs.push({ speed: 0.6 + Math.random() * 0.7, bobPhase: Math.random() * 6.28, baseY: cloud.position.y });
      this.group.add(cloud);
    }
  }

  update(t: number, wind: number, rainAmount: number, nightness: number, dt: number, motionScale: number) {
    const drift = wind * 2.6 * motionScale;
    this.group.children.forEach((cloud, i) => {
      cloud.position.x += drift * this.defs[i].speed * dt;
      if (cloud.position.x > 26) cloud.position.x = -26;
      if (cloud.position.x < -26) cloud.position.x = 26;
      cloud.position.y = this.defs[i].baseY + Math.sin(t * 0.5 + this.defs[i].bobPhase) * 0.18 * motionScale;
    });
    const day = new THREE.Color(0xf7fafc);
    const night = new THREE.Color(0x46506a);
    const rain = new THREE.Color(0x7e8798);
    this.material.color.copy(day).lerp(night, nightness).lerp(rain, rainAmount * 0.85);
    this.material.emissive.copy(this.material.color).multiplyScalar(0.25);
  }
}

/** Pooled line-segment rain */
export class Rain {
  private static MAX = 650;
  private geometry = new THREE.BufferGeometry();
  private mesh: THREE.LineSegments;
  private drops: Array<{ x: number; y: number; z: number; speed: number }> = [];
  private positions: Float32Array;

  constructor() {
    this.positions = new Float32Array(Rain.MAX * 2 * 3);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x9fb4c8, transparent: true, opacity: 0 });
    this.mesh = new THREE.LineSegments(this.geometry, mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    for (let i = 0; i < Rain.MAX; i++) {
      this.drops.push({
        x: (Math.random() - 0.5) * 20,
        y: Math.random() * 10 + 1,
        z: (Math.random() - 0.5) * 20,
        speed: 7 + Math.random() * 5,
      });
    }
  }

  get object() {
    return this.mesh;
  }

  update(dt: number, wind: number, rainAmount: number) {
    const mat = this.mesh.material as THREE.LineBasicMaterial;
    this.mesh.visible = rainAmount > 0.02;
    mat.opacity = rainAmount * 0.55;
    if (!this.mesh.visible) return;

    const count = Math.floor(Rain.MAX * rainAmount) * 2;
    const windX = wind * 4.2;
    for (let i = 0; i < Rain.MAX; i++) {
      const d = this.drops[i];
      d.y -= d.speed * dt;
      d.x += windX * dt;
      const r = Math.hypot(d.x, d.z);
      const floor = r < ISLAND_RADIUS + 1.5 ? ISLAND_TOP + 0.05 : -3.4;
      if (d.y < floor || Math.abs(d.x) > 12 || Math.abs(d.z) > 12) {
        d.x = (Math.random() - 0.5) * 20;
        d.z = (Math.random() - 0.5) * 20;
        d.y = 8 + Math.random() * 3;
      }
      const o = i * 6;
      const slant = windX * 0.045;
      this.positions[o] = d.x;
      this.positions[o + 1] = d.y;
      this.positions[o + 2] = d.z;
      this.positions[o + 3] = d.x - slant;
      this.positions[o + 4] = d.y + 0.55;
      this.positions[o + 5] = d.z;
    }
    this.geometry.setDrawRange(0, count);
    (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}

interface Ripple {
  t: number;
  life: number;
  x: number;
  z: number;
}

/** Pooled expanding rings on the pond */
export class Ripples {
  private group = new THREE.Group();
  private pool: Array<{ mesh: THREE.Mesh; r: Ripple }> = [];
  private acc = 0;

  get object() {
    return this.group;
  }

  constructor() {
    const geo = new THREE.RingGeometry(0.82, 1, 24);
    for (let i = 0; i < 22; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xdff2fa, transparent: true, opacity: 0, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({ mesh, r: { t: 1, life: 1, x: 0, z: 0 } });
    }
  }

  update(dt: number, rainAmount: number, motionScale: number) {
    this.acc += dt * rainAmount * 7;
    while (this.acc >= 1) {
      this.acc -= 1;
      const free = this.pool.find((p) => !p.mesh.visible);
      if (free) {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.random() * POND.r * 0.75;
        free.r = { t: 0, life: 1.1 + Math.random() * 0.5, x: POND.x + Math.cos(a) * rr, z: POND.z + Math.sin(a) * rr };
        free.mesh.visible = true;
        free.mesh.position.set(free.r.x, groundY(free.r.x, free.r.z) + 0.05, free.r.z);
      }
    }
    for (const p of this.pool) {
      if (!p.mesh.visible) continue;
      p.r.t += dt / p.r.life;
      if (p.r.t >= 1) {
        p.mesh.visible = false;
        continue;
      }
      const s = 0.12 + p.r.t * 0.7;
      p.mesh.scale.setScalar(s);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - p.r.t) * 0.55 * rainAmount * motionScale;
    }
  }
}
