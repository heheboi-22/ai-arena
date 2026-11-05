import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clamp, easeInOutCubic } from '../utils/math';

export interface PanelMetrics {
  top: number;
  right: number;
  width: number;
  height: number;
}

export interface LayoutMetrics {
  width: number;
  height: number;
  compact: boolean;
  panel: PanelMetrics;
}

interface Transition {
  elapsed: number;
  duration: number;
  startRadius: number;
  startPhi: number;
  startTheta: number;
  endRadius: number;
  endPhi: number;
  endTheta: number;
}

const HOME_PHI = 1.335;
const HOME_THETA = 0.7;
const HALF_WIDTH = 6.15;
const HALF_HEIGHT = 5.35;

export class CameraRig {
  readonly controls: OrbitControls;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly target = new THREE.Vector3(0, 0.12, 0);
  private transition: Transition | null = null;
  private fitDistance = 18;
  private lastFit = 0;
  private layout: LayoutMetrics | null = null;
  private baseFov = 37;
  private reducedMotion = false;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.target.copy(this.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.72;
    this.controls.zoomSpeed = 0.85;
    this.controls.minPolarAngle = 0.52;
    this.controls.maxPolarAngle = 1.53;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 46;
    this.controls.zoomToCursor = false;
    this.controls.touches.ONE = THREE.TOUCH.ROTATE;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;

    const cancel = (): void => {
      if (!this.transition) return;
      this.transition = null;
      this.controls.enabled = true;
    };
    domElement.addEventListener('pointerdown', cancel, { capture: true });
    domElement.addEventListener('wheel', cancel, { capture: true, passive: true });
    this.controls.addEventListener('start', cancel);
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  setLayout(metrics: LayoutMetrics): void {
    const firstLayout = this.layout === null;
    const previousFit = this.lastFit;
    this.layout = metrics;
    const { width, height, compact, panel } = metrics;
    const aspect = width / Math.max(1, height);
    this.camera.aspect = aspect;
    this.baseFov = compact ? 47 : 37;
    this.camera.fov = this.baseFov;

    const panelRight = compact ? 0 : clamp(panel.right + 22, 0, width * 0.44);
    const effectiveWidth = Math.max(240, width - panelRight);
    const effectiveHeight = compact
      ? Math.max(240, panel.top - 14)
      : height;
    const widthFraction = clamp(effectiveWidth / width, 0.38, 1);
    const heightFraction = clamp(effectiveHeight / height, 0.38, 1);
    const halfV = Math.tan(THREE.MathUtils.degToRad(this.baseFov) / 2);
    const distanceForWidth = HALF_WIDTH / (halfV * aspect * widthFraction * 0.95);
    const distanceForHeight = HALF_HEIGHT / (halfV * heightFraction * 0.92);
    const fit = Math.max(distanceForWidth, distanceForHeight) * (compact ? 0.97 : 1.06);

    this.fitDistance = fit;
    this.lastFit = fit;
    this.controls.minDistance = Math.max(7, fit * 0.6);
    this.controls.maxDistance = Math.max(24, fit * 1.55);

    if (firstLayout) {
      if (this.reducedMotion) {
        this.placeHomeCamera(fit, HOME_PHI, HOME_THETA);
      } else {
        this.placeHomeCamera(fit * 1.035, HOME_PHI + 0.035, HOME_THETA - 0.035);
        this.startTransition(fit, HOME_PHI, HOME_THETA, 1.7);
      }
    } else if (this.transition) {
      this.transition.endRadius = fit;
      this.transition.endPhi = HOME_PHI;
      this.transition.endTheta = HOME_THETA;
    } else {
      const zoomFactor = previousFit > 0 ? clamp(this.currentRadius() / previousFit, 0.62, 1.5) : 1;
      const spherical = this.sphericalFromCamera();
      const distance = clamp(
        fit * zoomFactor,
        this.controls.minDistance,
        this.controls.maxDistance
      );
      this.setFromSpherical(distance, spherical.phi, spherical.theta);
      this.controls.target.copy(this.target);
    }

    this.applyComposition(metrics);
    this.camera.near = 0.1;
    this.camera.far = 620;
    this.camera.updateProjectionMatrix();
  }

  private applyComposition(metrics: LayoutMetrics): void {
    const { width, height, compact, panel } = metrics;
    if (compact) {
      const availableTop = Math.max(0, panel.top - 14);
      const desiredCenterY = availableTop * 0.5;
      const offsetY = height * 0.5 - desiredCenterY;
      this.camera.setViewOffset(width, height, 0, offsetY, width, height);
    } else {
      const panelRight = clamp(panel.right + 22, 0, width * 0.44);
      const desiredCenterX = panelRight + (width - panelRight) * 0.5;
      const offsetX = -(desiredCenterX - width * 0.5);
      this.camera.setViewOffset(width, height, offsetX, 0, width, height);
    }
  }

  refreshComposition(): void {
    if (this.layout) this.applyComposition(this.layout);
  }

  private sphericalFromCamera(): { phi: number; theta: number; radius: number } {
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    return { phi: spherical.phi, theta: spherical.theta, radius: spherical.radius };
  }

  private currentRadius(): number {
    return this.camera.position.distanceTo(this.target);
  }

  private setFromSpherical(radius: number, phi: number, theta: number): void {
    const sinPhi = Math.sin(phi);
    this.camera.position.set(
      this.target.x + radius * sinPhi * Math.sin(theta),
      this.target.y + radius * Math.cos(phi),
      this.target.z + radius * sinPhi * Math.cos(theta)
    );
    this.camera.lookAt(this.target);
  }

  private placeHomeCamera(radius: number, phi: number, theta: number): void {
    this.setFromSpherical(radius, phi, theta);
    this.controls.target.copy(this.target);
  }

  private startTransition(radius: number, phi: number, theta: number, duration: number): void {
    const spherical = this.sphericalFromCamera();
    this.transition = {
      elapsed: 0,
      duration,
      startRadius: spherical.radius,
      startPhi: spherical.phi,
      startTheta: spherical.theta,
      endRadius: radius,
      endPhi: phi,
      endTheta: theta
    };
    this.controls.enabled = false;
  }

  goHome(duration = 0.95): void {
    this.startTransition(this.fitDistance, HOME_PHI, HOME_THETA, duration);
  }

  update(dt: number): void {
    if (this.transition) {
      this.transition.elapsed += dt;
      const t = Math.min(1, this.transition.elapsed / this.transition.duration);
      const eased = easeInOutCubic(t);
      let thetaDelta = this.transition.endTheta - this.transition.startTheta;
      if (thetaDelta > Math.PI) thetaDelta -= Math.PI * 2;
      if (thetaDelta < -Math.PI) thetaDelta += Math.PI * 2;
      const radius = THREE.MathUtils.lerp(
        this.transition.startRadius,
        this.transition.endRadius,
        eased
      );
      const phi = THREE.MathUtils.lerp(this.transition.startPhi, this.transition.endPhi, eased);
      const theta = this.transition.startTheta + thetaDelta * eased;
      this.setFromSpherical(radius, phi, theta);
      this.controls.target.copy(this.target);
      if (t >= 1) {
        this.transition = null;
        this.controls.enabled = true;
      }
    } else {
      this.controls.update();
    }
  }
}
