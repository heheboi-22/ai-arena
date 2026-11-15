import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { isClickGesture } from '../state/worldState';

export interface InputControllerOptions {
  camera: THREE.PerspectiveCamera;
  domElement: HTMLElement;
  houseHitTargets: THREE.Object3D[];
  onToggleHouseLights: () => void;
}

const INITIAL_CAMERA_POS = new THREE.Vector3(8.8, 5.4, 10.2);
const INITIAL_TARGET = new THREE.Vector3(0, -0.35, 0);

export class InputController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly domElement: HTMLElement;
  private readonly controls: OrbitControls;
  private readonly houseHitTargets: THREE.Object3D[];
  private readonly onToggleHouseLights: () => void;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();

  private activePointerId: number | null = null;
  private downX = 0;
  private downY = 0;
  private downTime = 0;
  private pointerCount = 0;
  private resettingCamera = false;

  constructor(options: InputControllerOptions) {
    this.camera = options.camera;
    this.domElement = options.domElement;
    this.houseHitTargets = options.houseHitTargets;
    this.onToggleHouseLights = options.onToggleHouseLights;

    this.camera.position.copy(INITIAL_CAMERA_POS);
    this.controls = new OrbitControls(this.camera, this.domElement);
    this.controls.target.copy(INITIAL_TARGET);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.minDistance = 6.5;
    this.controls.maxDistance = 24;
    this.controls.minPolarAngle = 0.25;
    this.controls.maxPolarAngle = Math.PI * 0.57;
    this.controls.rotateSpeed = 0.78;
    this.controls.zoomSpeed = 0.85;
    this.controls.update();

    this.controls.addEventListener('start', this.handleControlStart);
    this.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.domElement.addEventListener('pointerup', this.handlePointerUp);
    this.domElement.addEventListener('pointercancel', this.handlePointerCancel);
    this.domElement.addEventListener('pointermove', this.handlePointerMove);
  }

  public update(dt: number): void {
    if (this.resettingCamera) {
      const alpha = 1 - Math.exp(-8 * dt);
      this.camera.position.lerp(INITIAL_CAMERA_POS, alpha);
      this.controls.target.lerp(INITIAL_TARGET, alpha);
      if (
        this.camera.position.distanceToSquared(INITIAL_CAMERA_POS) < 0.0005 &&
        this.controls.target.distanceToSquared(INITIAL_TARGET) < 0.0005
      ) {
        this.camera.position.copy(INITIAL_CAMERA_POS);
        this.controls.target.copy(INITIAL_TARGET);
        this.resettingCamera = false;
      }
    }
    this.controls.update();
  }

  public resetCamera(): void {
    this.resettingCamera = true;
  }

  private handleControlStart = (): void => {
    this.resettingCamera = false;
  };

  private handlePointerDown = (event: PointerEvent): void => {
    this.pointerCount += 1;
    if (this.pointerCount > 1 || event.button > 0) {
      this.activePointerId = null;
      return;
    }
    this.activePointerId = event.pointerId;
    this.downX = event.clientX;
    this.downY = event.clientY;
    this.downTime = performance.now();
  };

  private handlePointerCancel = (): void => {
    this.pointerCount = Math.max(0, this.pointerCount - 1);
    this.activePointerId = null;
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse' || event.buttons !== 0) {
      return;
    }
    const hits = this.raycastHouse(event.clientX, event.clientY);
    this.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
  };

  private handlePointerUp = (event: PointerEvent): void => {
    const wasMultiTouch = this.pointerCount > 1;
    this.pointerCount = Math.max(0, this.pointerCount - 1);

    if (wasMultiTouch || event.pointerId !== this.activePointerId) {
      this.activePointerId = null;
      return;
    }
    this.activePointerId = null;

    const durationMs = performance.now() - this.downTime;
    if (!isClickGesture(this.downX, this.downY, event.clientX, event.clientY, durationMs)) {
      return;
    }

    const hits = this.raycastHouse(event.clientX, event.clientY);
    if (hits.length > 0) {
      this.onToggleHouseLights();
    }
  };

  private raycastHouse(clientX: number, clientY: number): THREE.Intersection[] {
    const rect = this.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return [];
    }
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    return this.raycaster.intersectObjects(this.houseHitTargets, false);
  }

  public dispose(): void {
    this.controls.removeEventListener('start', this.handleControlStart);
    this.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.domElement.removeEventListener('pointercancel', this.handlePointerCancel);
    this.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.controls.dispose();
  }
}
