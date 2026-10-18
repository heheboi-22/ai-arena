import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { angleDelta, clamp, damp, easeInOutCubic, lerp } from '../util/math';
import { rimRadius } from '../world/layout';

/** Space on each side of the canvas that is covered by interface, in CSS pixels. */
export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const TARGET = new THREE.Vector3(0, -1.0, 0);
const HOME = { azimuth: -0.62, polar: 1.2 };
const FOV = 34;
const MIN_POLAR = 0.38;
const MAX_POLAR = 1.64;

/** Points that must stay on screen: the island's rim, its underside, and the tall things on it. */
const FRAME_POINTS: THREE.Vector3[] = (() => {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < 40; i++) {
    const th = (i / 40) * Math.PI * 2;
    const r = rimRadius(th);
    pts.push(new THREE.Vector3(Math.cos(th) * r * 1.05, 0.3, Math.sin(th) * r * 1.05));
    pts.push(new THREE.Vector3(Math.cos(th) * r * 0.8, -2.6, Math.sin(th) * r * 0.8));
  }
  pts.push(
    new THREE.Vector3(0.55, -6.2, -0.3),
    new THREE.Vector3(-2.35, 3.9, -2.45),
    new THREE.Vector3(1.9, 3.1, -0.9),
    new THREE.Vector3(3.35, 3.1, -2.0),
    new THREE.Vector3(-0.35, 3.5, -3.65),
  );
  // The windmill's sails sweep a circle that faces the default camera; keep the whole circle in frame.
  const hub = new THREE.Vector3(-2.79, 2.9, -2.01);
  const across = new THREE.Vector3(0.711, 0, 0.703);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    pts.push(hub.clone().addScaledVector(across, Math.cos(a) * 1.95).add(new THREE.Vector3(0, Math.sin(a) * 1.95, 0)));
  }
  return pts;
})();

interface ResetAnimation {
  t: number;
  duration: number;
  from: { azimuth: number; polar: number; distance: number };
  to: { azimuth: number; polar: number; distance: number };
}

/**
 * The camera, its orbit controls and its framing.
 *
 *  - Orbit and zoom only: panning is off, polar angle and distance are limited.
 *  - Zoom is eased: the controls ask for a distance, and the camera glides to it.
 *  - The distance that frames the whole island is solved numerically, for the
 *    current window shape and for whatever part of it the interface covers, so
 *    resizing or opening the panel never crops the island or stretches it.
 */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 500);
  readonly controls: OrbitControls;

  private readonly probe = new THREE.PerspectiveCamera(FOV, 1, 0.5, 500);
  private readonly spherical = new THREE.Spherical();
  private readonly offset = new THREE.Vector3();
  private readonly point = new THREE.Vector3();

  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private insets: Insets = { left: 0, right: 0, top: 0, bottom: 0 };
  private fit = 22;
  /** The distance the controls (or a key press, or the reset) asked for. */
  private desired = 22;
  /** The distance on screen: it glides toward `desired`. */
  private shown = 22;
  private animation: ResetAnimation | null = null;
  private readonly keys = new Set<string>();
  reducedMotion = false;

  constructor(private readonly dom: HTMLElement) {
    this.controls = new OrbitControls(this.camera, dom);
    const c = this.controls;
    c.target.copy(TARGET);
    c.enableDamping = true;
    c.enablePan = false;
    c.enableZoom = true;
    c.zoomSpeed = 0.7;
    c.rotateSpeed = 0.62;
    c.minPolarAngle = MIN_POLAR;
    c.maxPolarAngle = MAX_POLAR;
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
    c.addEventListener('start', () => {
      this.animation = null;
    });

    dom.addEventListener('keydown', this.onKeyDown);
    dom.addEventListener('keyup', this.onKeyUp);
    dom.addEventListener('blur', () => this.keys.clear());

    this.placeAt(HOME.azimuth, HOME.polar, this.fit);
  }

  private placeAt(azimuth: number, polar: number, distance: number): void {
    this.spherical.set(distance, polar, azimuth);
    this.offset.setFromSpherical(this.spherical);
    this.camera.position.copy(this.controls.target).add(this.offset);
    this.camera.lookAt(this.controls.target);
  }

  private currentAngles(): { azimuth: number; polar: number; distance: number } {
    this.offset.copy(this.camera.position).sub(this.controls.target);
    this.spherical.setFromVector3(this.offset);
    return { azimuth: this.spherical.theta, polar: this.spherical.phi, distance: this.spherical.radius };
  }

  /** Smallest camera distance that keeps every frame point inside `margin` of the free area. */
  private solveFit(): { distance: number; shiftX: number; shiftY: number } {
    const probe = this.probe;
    probe.aspect = this.width / this.height;
    probe.updateProjectionMatrix();
    const freeW = Math.max(120, this.width - this.insets.left - this.insets.right);
    const freeH = Math.max(120, this.height - this.insets.top - this.insets.bottom);
    const margin = 0.86;

    let lo = 6;
    let hi = 120;
    let bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      bounds = this.project(mid);
      const fits = bounds.maxX - bounds.minX <= freeW * margin && bounds.maxY - bounds.minY <= freeH * margin;
      if (fits) hi = mid;
      else lo = mid;
    }
    bounds = this.project(hi);
    // Centre the island on the screen, but slide it clear of whatever the interface covers.
    const boxW = bounds.maxX - bounds.minX;
    const boxH = bounds.maxY - bounds.minY;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const gap = 0.04 * Math.min(this.width, this.height);
    const loX = this.insets.left + gap + boxW / 2;
    const hiX = this.width - this.insets.right - gap - boxW / 2;
    const loY = this.insets.top + gap + boxH / 2;
    const hiY = this.height - this.insets.bottom - gap - boxH / 2;
    const wantX = loX > hiX ? (loX + hiX) / 2 : clamp(this.width / 2, loX, hiX);
    const wantY = loY > hiY ? (loY + hiY) / 2 : clamp(this.height / 2, loY, hiY);
    return { distance: hi, shiftX: centerX - wantX, shiftY: centerY - wantY };
  }

  private project(distance: number): { minX: number; maxX: number; minY: number; maxY: number } {
    this.spherical.set(distance, HOME.polar, HOME.azimuth);
    this.offset.setFromSpherical(this.spherical);
    this.probe.position.copy(TARGET).add(this.offset);
    this.probe.lookAt(TARGET);
    this.probe.updateMatrixWorld();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of FRAME_POINTS) {
      this.point.copy(p).project(this.probe);
      const x = (this.point.x * 0.5 + 0.5) * this.width;
      const y = (1 - (this.point.y * 0.5 + 0.5)) * this.height;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    return { minX, maxX, minY, maxY };
  }

  /** Call whenever the canvas size or the covered area changes. */
  resize(width: number, height: number, insets: Insets, pixelRatio: number): void {
    this.pixelRatio = pixelRatio;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.insets = insets;

    const { distance, shiftX, shiftY } = this.solveFit();
    const previousFit = this.fit;
    this.fit = distance;

    // Keep the same relative zoom the visitor chose, whatever the new window shape.
    const angles = this.currentAngles();
    const ratio = previousFit > 0 ? angles.distance / previousFit : 1;
    const next = this.fit * clamp(ratio, 0.5, 1.5);
    this.desired = next;
    this.shown = next;
    this.placeAt(angles.azimuth, angles.polar, next);

    this.controls.minDistance = this.fit * 0.46;
    this.controls.maxDistance = this.fit * 1.5;

    this.camera.aspect = this.width / this.height;
    this.camera.setViewOffset(this.width, this.height, shiftX, shiftY, this.width, this.height);
    this.camera.updateProjectionMatrix();
  }

  /** Pixels per world unit at distance 1, for point sprites. */
  get pixelsPerUnit(): number {
    return (this.height * this.pixelRatio) / (2 * Math.tan((FOV * Math.PI) / 360));
  }

  /** Back to the opening view. */
  reset(): void {
    const from = this.currentAngles();
    const to = { azimuth: HOME.azimuth, polar: HOME.polar, distance: this.fit };
    if (this.reducedMotion) {
      this.animation = null;
      this.desired = this.shown = to.distance;
      this.placeAt(to.azimuth, to.polar, to.distance);
      this.controls.update();
      return;
    }
    // `from.distance` is what is on screen right now, so the glide starts without a jump.
    from.distance = this.shown;
    this.animation = { t: 0, duration: 0.9, from, to };
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_', 'PageUp', 'PageDown'].includes(k)) {
      this.keys.add(k);
      this.animation = null;
      e.preventDefault();
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key);
  };

  private applyKeys(dt: number): void {
    if (this.keys.size === 0) return;
    const k = this.keys;
    const turn = ((k.has('ArrowLeft') ? 1 : 0) - (k.has('ArrowRight') ? 1 : 0)) * 1.3 * dt;
    const tilt = ((k.has('ArrowUp') ? 1 : 0) - (k.has('ArrowDown') ? 1 : 0)) * 0.9 * dt;
    const zoom = ((k.has('+') || k.has('=') || k.has('PageUp') ? 1 : 0) - (k.has('-') || k.has('_') || k.has('PageDown') ? 1 : 0)) * 1.1 * dt;
    if (!turn && !tilt && !zoom) return;
    const a = this.currentAngles();
    const distance = clamp(a.distance * Math.exp(-zoom), this.controls.minDistance, this.controls.maxDistance);
    // Arrow keys move the view, so Left carries the island to the left.
    this.placeAt(a.azimuth + turn, clamp(a.polar - tilt, MIN_POLAR, MAX_POLAR), distance);
    this.desired = this.shown = distance;
  }

  update(dt: number): void {
    const c = this.controls;
    // Time-based inertia: the same feel at 60 Hz and at 144 Hz.
    c.dampingFactor = this.reducedMotion ? 0.35 : 1 - Math.exp(-dt * 9);

    if (this.animation) {
      const a = this.animation;
      a.t = Math.min(1, a.t + dt / a.duration);
      const e = easeInOutCubic(a.t);
      this.desired = this.shown = lerp(a.from.distance, a.to.distance, e);
      this.placeAt(a.from.azimuth + angleDelta(a.from.azimuth, a.to.azimuth) * e, lerp(a.from.polar, a.to.polar, e), this.desired);
      if (a.t >= 1) this.animation = null;
    }
    this.applyKeys(dt);

    // The controls apply wheel and pinch zoom from inside their own event handlers, which
    // moves the camera between frames. Notice that, and treat it as the new request.
    const actual = this.camera.position.distanceTo(c.target);
    if (!this.animation && Math.abs(actual - this.shown) > 1e-3) this.desired = actual;

    // Let the controls act on the camera at the distance that was asked for ...
    this.setDistance(this.desired);
    c.update();
    // ... then glide the camera to wherever they put it.
    this.desired = this.camera.position.distanceTo(c.target);
    this.shown = this.animation || this.reducedMotion ? this.desired : damp(this.shown, this.desired, 11, dt);
    if (Math.abs(this.shown - this.desired) < 0.002) this.shown = this.desired;
    this.setDistance(this.shown);
  }

  private setDistance(distance: number): void {
    this.offset.copy(this.camera.position).sub(this.controls.target);
    if (this.offset.lengthSq() < 1e-8) return;
    this.offset.setLength(distance);
    this.camera.position.copy(this.controls.target).add(this.offset);
  }

  dispose(): void {
    this.dom.removeEventListener('keydown', this.onKeyDown);
    this.dom.removeEventListener('keyup', this.onKeyUp);
    this.controls.dispose();
  }
}
