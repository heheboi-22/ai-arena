import {
  Object3D,
  Raycaster,
  Vector2,
  type Camera,
} from 'three';

interface PointerStart {
  id: number;
  x: number;
  y: number;
  time: number;
}

export class HousePicker {
  private readonly canvas: HTMLCanvasElement;
  private readonly camera: Camera;
  private readonly target: Object3D;
  private readonly onPick: () => void;
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly activePointers = new Set<number>();
  private candidate: PointerStart | null = null;
  private hovering = false;
  private multiTouch = false;

  constructor(canvas: HTMLCanvasElement, camera: Camera, target: Object3D, onPick: () => void) {
    this.canvas = canvas;
    this.camera = camera;
    this.target = target;
    this.onPick = onPick;

    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointercancel', this.handlePointerCancel);
    canvas.addEventListener('pointerleave', this.handlePointerLeave);
    canvas.addEventListener('pointermove', this.handlePointerMove);
  }

  private updateRay(x: number, y: number): boolean {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster.intersectObject(this.target, false).length > 0;
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.activePointers.add(event.pointerId);
    if (this.activePointers.size > 1) {
      this.multiTouch = true;
      this.candidate = null;
      return;
    }
    this.candidate = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
    };
  };

  private handlePointerUp = (event: PointerEvent): void => {
    const candidate = this.candidate;
    this.activePointers.delete(event.pointerId);

    if (!candidate || candidate.id !== event.pointerId || this.multiTouch) {
      this.candidate = null;
      if (this.activePointers.size === 0) this.multiTouch = false;
      return;
    }

    const moved = Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y);
    const elapsed = performance.now() - candidate.time;
    this.candidate = null;
    if (this.activePointers.size === 0) this.multiTouch = false;

    if (moved <= 7 && elapsed <= 520 && this.updateRay(event.clientX, event.clientY)) {
      this.onPick();
    }

    if (event.pointerType === 'mouse') {
      this.setHover(this.updateRay(event.clientX, event.clientY));
    }
  };

  private handlePointerCancel = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);
    this.candidate = null;
    if (this.activePointers.size === 0) {
      this.multiTouch = false;
      this.canvas.style.cursor = 'grab';
    }
  };

  private handlePointerLeave = (): void => {
    if (this.activePointers.size > 0) return;
    this.setHover(false);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    if (event.buttons !== 0) {
      this.canvas.style.cursor = 'grabbing';
      return;
    }
    const hit = this.updateRay(event.clientX, event.clientY);
    this.setHover(hit);
  };

  private setHover(hovering: boolean): void {
    if (this.hovering === hovering) return;
    this.hovering = hovering;
    this.canvas.style.cursor = hovering ? 'pointer' : 'grab';
    this.canvas.dataset.houseHover = hovering ? 'true' : 'false';
  }
}
