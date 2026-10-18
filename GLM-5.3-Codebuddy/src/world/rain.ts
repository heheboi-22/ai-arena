import * as THREE from 'three';
import { clamp } from '../util';
import { rimRadius } from './island';

/**
 * Rain as pooled 3D streaks (LineSegments), not a screen-space overlay.
 * Drops recycle when they hit the island surface or fall past the
 * underside, and the streak tilt follows the shared wind state.
 */

const DROP_COUNT = 340;
const AREA_R = 7.4; // spawn disc radius around the island
const TOP_Y = 9.5;
const UNDER_Y = -4.4; // below the rocky underside

interface Drop {
  x: number;
  z: number;
  y: number;
  speed: number;
  len: number;
}

export class Rain {
  group = new THREE.Group();
  private geo = new THREE.BufferGeometry();
  private positions = new Float32Array(DROP_COUNT * 2 * 3);
  private drops: Drop[] = [];
  private mat: THREE.LineBasicMaterial;
  /** 0..1 how hard it's raining right now (smoothed elsewhere). */
  intensity = 0;

  constructor() {
    for (let i = 0; i < DROP_COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * AREA_R;
      this.drops.push({
        x: Math.sin(a) * r,
        z: Math.cos(a) * r,
        y: Math.random() * TOP_Y,
        speed: 8.5 + Math.random() * 4,
        len: 0.4 + Math.random() * 0.25,
      });
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.mat = new THREE.LineBasicMaterial({
      color: 0xbfd6e8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: true,
    });
    const lines = new THREE.LineSegments(this.geo, this.mat);
    lines.renderOrder = 4;
    lines.frustumCulled = false;
    this.group.add(lines);
    this.group.visible = false;
  }

  update(dt: number, wet: number, wind: number): void {
    this.intensity = wet;
    this.group.visible = wet > 0.02;
    if (!this.group.visible) return;
    this.mat.opacity = clamp(wet, 0, 1) * 0.42;

    // streak direction: straight down in still air, sheared by wind
    const tiltX = wind * 0.85;
    const inv = 1 / Math.hypot(tiltX, 1);
    const dirX = tiltX * inv;
    const dirY = -inv;

    const pos = this.positions;
    for (let i = 0; i < DROP_COUNT; i++) {
      const d = this.drops[i];
      d.y -= d.speed * (0.7 + wet * 0.5) * dt;
      d.x += tiltX * d.speed * 0.35 * dt;

      // recycle: land on the island top, or fall past the underside
      const overIsland =
        Math.hypot(d.x, d.z) < rimRadius(Math.atan2(d.x, d.z)) * 0.98;
      if (overIsland && d.y < 0.08) {
        this.respawn(d);
      } else if (!overIsland && d.y < UNDER_Y) {
        this.respawn(d);
      } else if (d.y < UNDER_Y) {
        this.respawn(d);
      }

      const j = i * 6;
      pos[j] = d.x;
      pos[j + 1] = d.y;
      pos[j + 2] = d.z;
      pos[j + 3] = d.x + dirX * d.len;
      pos[j + 4] = d.y + dirY * d.len;
      pos[j + 5] = d.z;
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  private respawn(d: Drop): void {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * AREA_R;
    d.x = Math.sin(a) * r;
    d.z = Math.cos(a) * r;
    d.y = TOP_Y * (0.75 + Math.random() * 0.35);
  }
}
