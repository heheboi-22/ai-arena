import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { damp, easeInOutCubic } from '../core/math';
import { VIEW_AZIMUTH, WINDMILL } from '../world/layout';
import { rimHeight, rimRadius, WINDMILL_BASE_Y } from '../world/terrain';

const deg = THREE.MathUtils.degToRad;
const TARGET = new THREE.Vector3(0, -0.6, 0);
const DEFAULT_POLAR = deg(90 - 19);
const MIN_POLAR = deg(24);
const MAX_POLAR = deg(101);

/** Points that must stay in frame: the rim, the tallest things on top and the rocky tip. */
const FRAME_POINTS: THREE.Vector3[] = (() => {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const r = rimRadius(a) * 1.02;
    pts.push(new THREE.Vector3(Math.cos(a) * r, rimHeight(a) + 0.35, Math.sin(a) * r));
    pts.push(new THREE.Vector3(Math.cos(a) * r * 0.66, -2.0, Math.sin(a) * r * 0.66));
  }
  pts.push(new THREE.Vector3(WINDMILL.x, WINDMILL_BASE_Y + 4.1, WINDMILL.z));
  pts.push(new THREE.Vector3(0, 2.7, 0));
  pts.push(new THREE.Vector3(0.35, -5.1, -0.25));
  return pts;
})();

export interface Insets {
  left: number;
  bottom: number;
}

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 240);
  readonly controls: OrbitControls;
  private readonly scratch = new THREE.PerspectiveCamera(34, 1, 0.1, 240);
  private readonly defaultDir = new THREE.Vector3().setFromSphericalCoords(1, DEFAULT_POLAR, VIEW_AZIMUTH);
  private width = 1;
  private height = 1;
  private fit = 18;
  /** Insets the composition is framed for (panel in its resting state). */
  private frameInsets: Insets = { left: 0, bottom: 0 };
  /** Live insets, eased, so opening the panel slides the island instead of jumping. */
  private target: Insets = { left: 0, bottom: 0 };
  private current: Insets = { left: 0, bottom: 0 };
  private fly: { from: THREE.Spherical; to: THREE.Spherical; t: number; duration: number } | null = null;
  private readonly sph = new THREE.Spherical();
  private readonly offset = new THREE.Vector3();

  constructor(dom: HTMLElement) {
    this.controls = new OrbitControls(this.camera, dom);
    const c = this.controls;
    c.target.copy(TARGET);
    c.enableDamping = true;
    c.dampingFactor = 0.075;
    c.enablePan = false;
    c.rotateSpeed = 0.55;
    c.zoomSpeed = 0.75;
    c.minPolarAngle = MIN_POLAR;
    c.maxPolarAngle = MAX_POLAR;
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
    c.addEventListener('start', () => {
      this.fly = null;
    });
    this.camera.position.copy(TARGET).addScaledVector(this.defaultDir, this.fit);
    this.camera.lookAt(TARGET);
  }

  /** Called on window resize. Keeps the current angle and rescales distance to the new fit. */
  resize(width: number, height: number, frame: Insets, live: Insets): void {
    this.width = width;
    this.height = height;
    this.frameInsets = frame;
    this.target = live;
    this.current = { ...live };
    this.camera.aspect = width / height;
    this.applyViewOffset(this.camera, this.current);

    const oldFit = this.fit;
    this.fit = this.computeFit();
    const c = this.controls;
    c.minDistance = this.fit * 0.55;
    c.maxDistance = this.fit * 1.55;
    this.offset.copy(this.camera.position).sub(TARGET);
    const dist = THREE.MathUtils.clamp(this.offset.length() * (this.fit / oldFit), c.minDistance, c.maxDistance);
    this.camera.position.copy(TARGET).addScaledVector(this.offset.normalize(), dist);
    if (this.fly) this.fly.to.radius = this.fit;
    c.update();
  }

  setInsets(live: Insets): void {
    this.target = live;
  }

  reset(animate: boolean): void {
    // Flush any leftover orbit momentum before taking over the camera.
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enableDamping = true;

    const to = new THREE.Spherical(this.fit, DEFAULT_POLAR, VIEW_AZIMUTH);
    if (!animate) {
      this.fly = null;
      this.camera.position.setFromSpherical(to).add(TARGET);
      this.controls.update();
      return;
    }
    const from = new THREE.Spherical().setFromVector3(this.offset.copy(this.camera.position).sub(TARGET));
    // Take the short way round.
    let dTheta = to.theta - from.theta;
    dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
    to.theta = from.theta + dTheta;
    const span = Math.abs(dTheta) + Math.abs(to.phi - from.phi) + Math.abs(Math.log(to.radius / from.radius));
    this.fly = { from, to, t: 0, duration: 0.6 + Math.min(span, 2.5) * 0.35 };
  }

  /** Keyboard orbiting: small steps in angle, clamped like the pointer controls. */
  nudge(dTheta: number, dPhi: number, zoom: number): void {
    this.fly = null;
    this.sph.setFromVector3(this.offset.copy(this.camera.position).sub(TARGET));
    this.sph.theta += dTheta;
    this.sph.phi = THREE.MathUtils.clamp(this.sph.phi + dPhi, MIN_POLAR, MAX_POLAR);
    this.sph.radius = THREE.MathUtils.clamp(this.sph.radius * zoom, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.setFromSpherical(this.sph).add(TARGET);
    this.controls.update();
  }

  update(dt: number): void {
    const moved =
      Math.abs(this.current.left - this.target.left) > 0.5 || Math.abs(this.current.bottom - this.target.bottom) > 0.5;
    if (moved) {
      this.current.left = damp(this.current.left, this.target.left, 7, dt);
      this.current.bottom = damp(this.current.bottom, this.target.bottom, 7, dt);
      this.applyViewOffset(this.camera, this.current);
    }

    if (this.fly) {
      const f = this.fly;
      f.t = Math.min(1, f.t + dt / f.duration);
      const k = easeInOutCubic(f.t);
      this.sph.set(
        THREE.MathUtils.lerp(f.from.radius, f.to.radius, k),
        THREE.MathUtils.lerp(f.from.phi, f.to.phi, k),
        THREE.MathUtils.lerp(f.from.theta, f.to.theta, k),
      );
      this.camera.position.setFromSpherical(this.sph).add(TARGET);
      if (f.t >= 1) this.fly = null;
    }
    this.controls.update();
  }

  private applyViewOffset(cam: THREE.PerspectiveCamera, insets: Insets): void {
    cam.setViewOffset(this.width, this.height, -insets.left / 2, insets.bottom / 2, this.width, this.height);
    cam.updateProjectionMatrix();
  }

  /** Smallest distance at which every frame point fits the free part of the screen. */
  private computeFit(): number {
    const cam = this.scratch;
    cam.fov = this.camera.fov;
    cam.aspect = this.width / this.height;
    this.applyViewOffset(cam, this.frameInsets);
    const margin = 0.05;
    const minX = -1 + (2 * this.frameInsets.left) / this.width + margin;
    const minY = -1 + (2 * this.frameInsets.bottom) / this.height + margin;
    const p = new THREE.Vector3();
    const fits = (d: number) => {
      cam.position.copy(TARGET).addScaledVector(this.defaultDir, d);
      cam.lookAt(TARGET);
      cam.updateMatrixWorld();
      for (const pt of FRAME_POINTS) {
        p.copy(pt).project(cam);
        if (p.x < minX || p.x > 1 - margin || p.y < minY || p.y > 1 - margin) return false;
      }
      return true;
    };
    let lo = 8;
    let hi = 80;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    return hi;
  }
}
