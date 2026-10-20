import {
  MathUtils,
  PerspectiveCamera,
  Spherical,
  Vector3,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const INITIAL_THETA = 0.72;
const INITIAL_PHI = 1.265;
const INITIAL_TARGET = new Vector3(0, 0.06, 0);

export class CameraRig {
  readonly camera: PerspectiveCamera;
  readonly controls: OrbitControls;
  private readonly canvas: HTMLCanvasElement;
  private readonly spherical = new Spherical();
  private interacted = false;
  private aspect = 1;
  private fit = 14;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    this.camera = new PerspectiveCamera(this.fovForAspect(this.aspect), this.aspect, 0.1, 400);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.062;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.72;
    this.controls.zoomSpeed = 0.9;
    this.controls.minPolarAngle = 0.36;
    this.controls.maxPolarAngle = 1.9;
    this.controls.target.copy(INITIAL_TARGET);

    this.controls.addEventListener('start', () => {
      this.interacted = true;
    });

    canvas.addEventListener('keydown', (event) => this.onKeyDown(event));
    this.applyInitialView();
  }

  reset(): void {
    this.interacted = false;
    this.applyInitialView();
  }

  resize(width: number, height: number): void {
    this.aspect = width / Math.max(1, height);
    const fov = this.fovForAspect(this.aspect);
    this.camera.aspect = this.aspect;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();

    const previousFit = this.fit;
    this.fit = this.fitDistance(this.aspect, fov);
    this.controls.minDistance = this.fit * 0.48;
    this.controls.maxDistance = this.fit * 1.9;

    const currentDistance = this.camera.position.distanceTo(this.controls.target);
    const shouldRefit =
      !this.interacted ||
      currentDistance < this.fit * 0.92 ||
      currentDistance > this.fit * 1.82 ||
      Math.abs(previousFit - this.fit) > previousFit * 0.18;

    if (shouldRefit) {
      this.setDistance(this.fit);
      this.interacted = false;
    } else {
      this.updateLimits();
    }
    this.controls.update();
  }

  update(): void {
    this.controls.update();
  }

  private applyInitialView(): void {
    const fov = this.fovForAspect(this.aspect);
    this.fit = this.fitDistance(this.aspect, fov);
    this.camera.fov = fov;
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();

    this.controls.target.copy(INITIAL_TARGET);
    this.spherical.set(this.fit, INITIAL_PHI, INITIAL_THETA);
    this.camera.position.setFromSpherical(this.spherical).add(INITIAL_TARGET);
    this.controls.minDistance = this.fit * 0.48;
    this.controls.maxDistance = this.fit * 1.9;
    this.controls.update();
  }

  private updateLimits(): void {
    this.controls.minDistance = this.fit * 0.48;
    this.controls.maxDistance = this.fit * 1.9;
  }

  private setDistance(distance: number): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const length = Math.max(0.001, offset.length());
    offset.multiplyScalar(distance / length);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  private fovForAspect(aspect: number): number {
    return aspect < 0.82 ? 48 : 38;
  }

  private fitDistance(aspect: number, fov: number): number {
    const tan = Math.tan((fov * Math.PI) / 360);
    const halfWidth = 5.9;
    const halfHeight = 5.05;
    const forWidth = (halfWidth / (tan * aspect)) * 1.05;
    const forHeight = (halfHeight / tan) * 1.04;
    return MathUtils.clamp(Math.max(forWidth, forHeight), 11.5, 34);
  }

  private onKeyDown(event: KeyboardEvent): void {
    const key = event.key;
    const supported =
      key === 'ArrowLeft' ||
      key === 'ArrowRight' ||
      key === 'ArrowUp' ||
      key === 'ArrowDown' ||
      key === '+' ||
      key === '=' ||
      key === '-' ||
      key === '_';
    if (!supported) return;

    event.preventDefault();
    this.interacted = true;
    this.spherical.setFromVector3(this.camera.position.clone().sub(this.controls.target));

    switch (key) {
      case 'ArrowLeft':
        this.spherical.theta -= 0.09;
        break;
      case 'ArrowRight':
        this.spherical.theta += 0.09;
        break;
      case 'ArrowUp':
        this.spherical.phi = Math.max(this.controls.minPolarAngle, this.spherical.phi - 0.07);
        break;
      case 'ArrowDown':
        this.spherical.phi = Math.min(this.controls.maxPolarAngle, this.spherical.phi + 0.07);
        break;
      case '+':
      case '=':
        this.spherical.radius = Math.max(this.controls.minDistance, this.spherical.radius * 0.92);
        break;
      default:
        this.spherical.radius = Math.min(this.controls.maxDistance, this.spherical.radius * 1.08);
        break;
    }

    this.spherical.makeSafe();
    this.camera.position.setFromSpherical(this.spherical).add(this.controls.target);
    this.controls.update();
    this.canvas.focus({ preventScroll: true });
  }
}
