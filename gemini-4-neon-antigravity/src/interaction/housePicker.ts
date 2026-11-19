import * as THREE from 'three';

const CLICK_MAX_DISTANCE_PX = 6;
const CLICK_MAX_DURATION_MS = 450;

export class HousePicker {
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();

  private activePointers = new Set<number>();
  private trackingPointerId: number | null = null;
  private downX = 0;
  private downY = 0;
  private downTime = 0;
  private movedTooFar = false;

  constructor(
    private readonly domElement: HTMLElement,
    private readonly camera: THREE.Camera,
    private readonly houseRoot: THREE.Object3D,
    private readonly onHouseClick: () => void,
  ) {
    this.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.domElement.addEventListener('pointerup', this.handlePointerUp);
    this.domElement.addEventListener('pointercancel', this.handlePointerCancel);
  }

  private setNdcFromEvent(event: PointerEvent): void {
    const rect = this.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private isHittingHouse(event: PointerEvent): boolean {
    this.setNdcFromEvent(event);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.houseRoot, true);
    return hits.length > 0;
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    this.activePointers.add(event.pointerId);

    // Ignore multi-touch gestures (pinch zoom)
    if (this.activePointers.size > 1) {
      this.trackingPointerId = null;
      this.movedTooFar = true;
      return;
    }

    this.trackingPointerId = event.pointerId;
    this.downX = event.clientX;
    this.downY = event.clientY;
    this.downTime = performance.now();
    this.movedTooFar = false;
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.trackingPointerId === event.pointerId) {
      const dist = Math.hypot(event.clientX - this.downX, event.clientY - this.downY);
      if (dist > CLICK_MAX_DISTANCE_PX) {
        this.movedTooFar = true;
      }
      return;
    }

    // Hover feedback for mouse users (shows pointer cursor when over the interactive cottage)
    if (event.pointerType === 'mouse' && this.activePointers.size === 0) {
      const overHouse = this.isHittingHouse(event);
      this.domElement.style.cursor = overHouse ? 'pointer' : 'grab';
    }
  };

  private handlePointerUp = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);

    if (this.trackingPointerId !== event.pointerId) {
      return;
    }
    this.trackingPointerId = null;

    const dist = Math.hypot(event.clientX - this.downX, event.clientY - this.downY);
    const duration = performance.now() - this.downTime;

    if (!this.movedTooFar && dist <= CLICK_MAX_DISTANCE_PX && duration <= CLICK_MAX_DURATION_MS) {
      if (this.isHittingHouse(event)) {
        this.onHouseClick();
      }
    }
  };

  private handlePointerCancel = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);
    if (this.trackingPointerId === event.pointerId) {
      this.trackingPointerId = null;
      this.movedTooFar = true;
    }
  };

  dispose(): void {
    this.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.domElement.removeEventListener('pointercancel', this.handlePointerCancel);
  }
}
