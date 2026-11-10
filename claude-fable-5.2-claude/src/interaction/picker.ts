import * as THREE from 'three';

export interface PickerOptions {
  dom: HTMLElement;
  camera: THREE.Camera;
  /** Everything that can block the view of the target. */
  occluders: THREE.Object3D[];
  target: THREE.Object3D;
  onPick: () => void;
}

const MOVE_TOLERANCE_MOUSE = 5;
const MOVE_TOLERANCE_TOUCH = 10;
const MAX_PRESS_MS = 600;

/**
 * Turns a press-and-release on the house into a "pick", and nothing else:
 * a press that travels (an orbit), lasts too long, or involves a second
 * finger (a pinch) is ignored.
 */
export class Picker {
  private readonly ray = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly pointers = new Set<number>();
  private press: { id: number; x: number; y: number; t: number; travelled: number } | null = null;
  private hoverDirty = false;
  private hoverX = 0;
  private hoverY = 0;
  private hovering = false;

  constructor(private readonly o: PickerOptions) {
    const el = o.dom;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onCancel);
    el.addEventListener('pointerleave', () => this.setHover(false));
  }

  private hit(clientX: number, clientY: number): boolean {
    const rect = this.o.dom.getBoundingClientRect();
    this.ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.ndc, this.o.camera);
    const hits = this.ray.intersectObjects(this.o.occluders, true);
    if (hits.length === 0) return false;
    for (let n: THREE.Object3D | null = hits[0].object; n; n = n.parent) {
      if (n === this.o.target) return true;
    }
    return false;
  }

  private setHover(on: boolean): void {
    if (on === this.hovering) return;
    this.hovering = on;
    this.o.dom.classList.toggle('over-house', on);
  }

  private onDown = (e: PointerEvent): void => {
    this.pointers.add(e.pointerId);
    if (this.pointers.size > 1 || (e.pointerType === 'mouse' && e.button !== 0)) {
      this.press = null;
      return;
    }
    this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), travelled: 0 };
  };

  private onMove = (e: PointerEvent): void => {
    const p = this.press;
    if (p && p.id === e.pointerId) {
      p.travelled = Math.max(p.travelled, Math.hypot(e.clientX - p.x, e.clientY - p.y));
    }
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      this.hoverX = e.clientX;
      this.hoverY = e.clientY;
      this.hoverDirty = true;
    }
  };

  private onUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    const p = this.press;
    this.press = null;
    if (!p || p.id !== e.pointerId) return;
    const travelled = Math.max(p.travelled, Math.hypot(e.clientX - p.x, e.clientY - p.y));
    const tolerance = e.pointerType === 'mouse' ? MOVE_TOLERANCE_MOUSE : MOVE_TOLERANCE_TOUCH;
    if (travelled > tolerance || performance.now() - p.t > MAX_PRESS_MS) return;
    if (this.hit(e.clientX, e.clientY)) this.o.onPick();
  };

  private onCancel = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    this.press = null;
  };

  /** Resolve hover at most once per frame. */
  update(): void {
    if (!this.hoverDirty) return;
    this.hoverDirty = false;
    this.setHover(this.press === null && this.hit(this.hoverX, this.hoverY));
  }
}
