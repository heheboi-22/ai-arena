import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  // Base flattering 3/4 miniature hero composition showing top meadow, cottage, windmill, pond & rocky underside
  private readonly baseOffset = new THREE.Vector3(9.4, 4.9, 13.4);
  private readonly baseTarget = new THREE.Vector3(-0.25, -0.3, 0.05);

  private resetting = false;
  private resetElapsed = 0;
  private readonly resetDuration = 0.65;
  private readonly resetStartPos = new THREE.Vector3();
  private readonly resetStartTarget = new THREE.Vector3();
  private readonly resetEndPos = new THREE.Vector3();
  private readonly resetEndTarget = new THREE.Vector3();

  private currentDistanceScale = 1.0;

  constructor(domElement: HTMLElement, width: number, height: number) {
    const aspect = Math.max(0.2, width / Math.max(1, height));
    this.camera = new THREE.PerspectiveCamera(38, aspect, 0.25, 160);

    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.enablePan = false; // Keep island hero-centered; never pan scene out of view
    this.controls.rotateSpeed = 0.85;
    this.controls.zoomSpeed = 0.9;
    this.controls.minPolarAngle = 0.22;
    this.controls.maxPolarAngle = Math.PI * 0.65; // Allows admiring rocky underside without flipping under

    // Interrupt smooth reset immediately if user grabs or scrolls the camera
    this.controls.addEventListener('start', this.handleUserInteractStart);

    this.applyResponsiveFraming(width, height, true);
  }

  private handleUserInteractStart = (): void => {
    this.resetting = false;
  };

  private computeIdealFraming(width: number, height: number): {
    position: THREE.Vector3;
    target: THREE.Vector3;
    distanceScale: number;
  } {
    const aspect = Math.max(0.35, width / Math.max(1, height));
    const isPortrait = aspect < 1.0;
    const isCompact = width <= 680;

    // On narrow portrait viewports, step back gracefully so the full island fits comfortably
    const distanceScale = isPortrait
      ? Math.min(1.85, Math.max(1.15, 1.06 / aspect))
      : Math.min(1.24, Math.max(0.98, 1.32 / Math.max(aspect, 1.0)));

    // Slight vertical framing lift on mobile so the collapsed bottom sheet never overlaps the rocky tip
    const targetY = isCompact ? -0.65 : -0.22;
    // Slight horizontal offset on wide desktop so the left floating UI card has breathing room
    const targetX = width >= 980 ? -0.95 : -0.2;

    const target = new THREE.Vector3(targetX, targetY, this.baseTarget.z);
    const position = target
      .clone()
      .addScaledVector(this.baseOffset, distanceScale);

    return { position, target, distanceScale };
  }

  applyResponsiveFraming(width: number, height: number, snapCamera = false): void {
    const aspect = Math.max(0.2, width / Math.max(1, height));
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    const { position, target, distanceScale } = this.computeIdealFraming(width, height);
    this.controls.minDistance = 7.4 * Math.min(1.15, distanceScale);
    this.controls.maxDistance = 24.5 * Math.max(1.0, distanceScale);

    if (snapCamera) {
      this.currentDistanceScale = distanceScale;
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      this.controls.update();
      return;
    }

    // Preserve the user's current orbit angle on resize while scaling distance cleanly
    if (Math.abs(distanceScale - this.currentDistanceScale) > 0.005) {
      const ratio = distanceScale / this.currentDistanceScale;
      const offset = this.camera.position.clone().sub(this.controls.target);
      offset.multiplyScalar(ratio);
      this.camera.position.copy(this.controls.target).add(offset);
      this.currentDistanceScale = distanceScale;
    }
    this.controls.update();
  }

  reset(width: number, height: number, immediate: boolean): void {
    const { position, target, distanceScale } = this.computeIdealFraming(width, height);
    this.currentDistanceScale = distanceScale;

    if (immediate) {
      this.resetting = false;
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      this.controls.update();
      return;
    }

    this.resetStartPos.copy(this.camera.position);
    this.resetStartTarget.copy(this.controls.target);
    this.resetEndPos.copy(position);
    this.resetEndTarget.copy(target);
    this.resetElapsed = 0;
    this.resetting = true;
  }

  update(dt: number): void {
    if (this.resetting) {
      this.resetElapsed += dt;
      const rawT = Math.min(1, this.resetElapsed / this.resetDuration);
      // Smooth ease-out cubic
      const eased = 1 - Math.pow(1 - rawT, 3);
      this.camera.position.lerpVectors(this.resetStartPos, this.resetEndPos, eased);
      this.controls.target.lerpVectors(this.resetStartTarget, this.resetEndTarget, eased);
      if (rawT >= 1) {
        this.resetting = false;
      }
    }
    this.controls.update();
  }

  getCameraState(): { pos: [number, number, number]; target: [number, number, number] } {
    return {
      pos: [
        Number(this.camera.position.x.toFixed(3)),
        Number(this.camera.position.y.toFixed(3)),
        Number(this.camera.position.z.toFixed(3)),
      ],
      target: [
        Number(this.controls.target.x.toFixed(3)),
        Number(this.controls.target.y.toFixed(3)),
        Number(this.controls.target.z.toFixed(3)),
      ],
    };
  }

  dispose(): void {
    this.controls.removeEventListener('start', this.handleUserInteractStart);
    this.controls.dispose();
  }
}
