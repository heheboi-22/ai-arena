import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { damp } from '../core/math';

/** Screen-space margins (CSS px) taken up by the control panel. */
export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const TARGET = new THREE.Vector3(0, 0.55, 0);
/** Half-extents of what must stay in frame: island, clouds, hanging rock. */
const HALF_WIDTH = 8.3;
const HALF_HEIGHT = 8.4;
const HOME_AZIMUTH = Math.atan2(0.62, 0.78);
const HOME_POLAR = THREE.MathUtils.degToRad(69);
export const FOV = 30;

/**
 * Orbit camera that always keeps the island framed: the fitting distance is
 * recomputed from the viewport and the panel's footprint, and the projection
 * is shifted so the island sits in the centre of the free area.
 */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 700);
  readonly controls: OrbitControls;
  /** True while the user is dragging; used to tell clicks from orbits. */
  dragging = false;

  private width = 1;
  private height = 1;
  private fit = 36;
  private readonly insets: Insets = { left: 0, right: 0, top: 0, bottom: 0 };
  private readonly shown: Insets = { left: 0, right: 0, top: 0, bottom: 0 };
  private first = true;
  private tween: { t: number; from: THREE.Spherical; to: THREE.Spherical } | null = null;
  private readonly sph = new THREE.Spherical();
  private readonly offset = new THREE.Vector3();

  constructor(dom: HTMLElement) {
    const c = new OrbitControls(this.camera, dom);
    c.target.copy(TARGET);
    c.enablePan = false;
    c.enableDamping = true;
    c.dampingFactor = 0.075;
    c.rotateSpeed = 0.62;
    c.zoomSpeed = 0.75;
    c.minPolarAngle = THREE.MathUtils.degToRad(24);
    c.maxPolarAngle = THREE.MathUtils.degToRad(108);
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
    c.addEventListener('start', () => {
      this.dragging = true;
      this.cancelTween();
    });
    c.addEventListener('end', () => {
      this.dragging = false;
    });
    this.controls = c;
    this.place(new THREE.Spherical(this.fit, HOME_POLAR, HOME_AZIMUTH));
  }

  private place(s: THREE.Spherical): void {
    this.camera.position.setFromSpherical(s).add(TARGET);
    this.camera.lookAt(TARGET);
  }

  private current(): THREE.Spherical {
    this.offset.copy(this.camera.position).sub(TARGET);
    return this.sph.setFromVector3(this.offset);
  }

  private cancelTween(): void {
    if (!this.tween) return;
    this.tween = null;
    this.controls.enableDamping = true;
  }

  /** Call when the canvas or the panel changes size. */
  setViewport(width: number, height: number, insets: Insets): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    Object.assign(this.insets, insets);
    if (this.first) Object.assign(this.shown, insets);

    const freeW = Math.max(120, this.width - insets.left - insets.right);
    const freeH = Math.max(120, this.height - insets.top - insets.bottom);
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
    const fit = Math.max(
      HALF_HEIGHT / (tan * (freeH / this.height)),
      HALF_WIDTH / (tan * (freeW / this.height)),
    );

    // Keep the user's zoom level relative to the new fit.
    const s = this.current();
    const ratio = this.first ? 1 : s.radius / this.fit;
    this.fit = fit;
    this.controls.minDistance = fit * 0.5;
    this.controls.maxDistance = fit * 1.3;
    if (this.tween) this.tween.to.radius = fit;
    else {
      s.radius = fit * ratio;
      this.place(s);
    }
    this.camera.aspect = this.width / this.height;
    this.first = false;
    this.applyOffset();
  }

  private applyOffset(): void {
    const dx = (this.shown.left - this.shown.right) / 2;
    const dy = (this.shown.top - this.shown.bottom) / 2;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) this.camera.clearViewOffset();
    else this.camera.setViewOffset(this.width, this.height, -dx, -dy, this.width, this.height);
    this.camera.updateProjectionMatrix();
  }

  /** Glide (or jump) back to the opening view. Interrupted by any drag. */
  reset(animate: boolean): void {
    const to = new THREE.Spherical(this.fit, HOME_POLAR, HOME_AZIMUTH);
    // Drop any leftover inertia so it cannot fight the glide.
    this.controls.enableDamping = false;
    this.controls.update();
    if (!animate) {
      this.tween = null;
      this.place(to);
      this.controls.update();
      this.controls.enableDamping = true;
      return;
    }
    const from = this.current().clone();
    // Take the short way round.
    const turn = Math.PI * 2;
    let d = (to.theta - from.theta) % turn;
    if (d > Math.PI) d -= turn;
    if (d < -Math.PI) d += turn;
    to.theta = from.theta + d;
    this.tween = { t: 0, from, to };
  }

  update(dt: number): void {
    // Ease the projection shift when the panel opens or closes.
    let moved = false;
    for (const k of ['left', 'right', 'top', 'bottom'] as const) {
      const next = damp(this.shown[k], this.insets[k], 9, dt);
      const v = Math.abs(next - this.insets[k]) < 0.4 ? this.insets[k] : next;
      if (v !== this.shown[k]) {
        this.shown[k] = v;
        moved = true;
      }
    }
    if (moved) this.applyOffset();

    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / 0.95);
      const e = 1 - Math.pow(1 - tw.t, 3);
      this.sph.set(
        THREE.MathUtils.lerp(tw.from.radius, tw.to.radius, e),
        THREE.MathUtils.lerp(tw.from.phi, tw.to.phi, e),
        THREE.MathUtils.lerp(tw.from.theta, tw.to.theta, e),
      );
      this.place(this.sph);
      this.controls.update();
      if (tw.t >= 1) this.cancelTween();
    } else {
      this.controls.update();
    }
  }
}
