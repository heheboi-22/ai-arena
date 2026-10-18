import * as THREE from 'three';

/** A press that moves farther than this (in CSS pixels) is a camera drag, not a tap. */
const SLOP = { mouse: 5, touch: 10, pen: 8 } as const;
const MAX_TAP_MS = 650;

interface Press {
  id: number;
  x: number;
  y: number;
  time: number;
  type: keyof typeof SLOP;
  moved: boolean;
  /** Set if a second finger joined: that is a pinch, never a tap. */
  multi: boolean;
}

/**
 * Turns a clean tap or click on the house into a callback, and ignores every
 * orbit or pinch gesture, even one that starts or ends on top of the house.
 */
export class HousePicker {
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private press: Press | null = null;
  private hover: { x: number; y: number } | null = null;
  private hoverDirty = false;
  private overHouse = false;

  constructor(
    private readonly dom: HTMLElement,
    private readonly camera: THREE.Camera,
    private readonly targets: () => THREE.Object3D[],
    private readonly onTap: () => void,
  ) {
    dom.addEventListener('pointerdown', this.onDown);
    dom.addEventListener('pointermove', this.onMove);
    dom.addEventListener('pointerup', this.onUp);
    dom.addEventListener('pointercancel', this.onCancel);
    dom.addEventListener('pointerleave', this.onLeave);
  }

  private hitsHouse(clientX: number, clientY: number): boolean {
    const rect = this.dom.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.targets(), false);
    // The nearest solid thing decides, so a tree in front of the house is not a click on the house.
    return hits.length > 0 && hits[0].object.userData.house === true;
  }

  private readonly onDown = (e: PointerEvent): void => {
    if (this.press) {
      this.press.multi = true;
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) {
      this.press = null;
      return;
    }
    const type = e.pointerType === 'touch' || e.pointerType === 'pen' ? e.pointerType : 'mouse';
    this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, time: performance.now(), type, moved: false, multi: false };
  };

  private readonly onMove = (e: PointerEvent): void => {
    const p = this.press;
    if (p) {
      if (p.id === e.pointerId && Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP[p.type]) p.moved = true;
      return;
    }
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      this.hover = { x: e.clientX, y: e.clientY };
      this.hoverDirty = true;
    }
  };

  private readonly onUp = (e: PointerEvent): void => {
    const p = this.press;
    if (!p || p.id !== e.pointerId) return;
    this.press = null;
    const quick = performance.now() - p.time <= MAX_TAP_MS;
    const still = !p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) <= SLOP[p.type];
    if (!p.multi && quick && still && this.hitsHouse(e.clientX, e.clientY)) this.onTap();
  };

  private readonly onCancel = (e: PointerEvent): void => {
    if (this.press?.id === e.pointerId) this.press = null;
  };

  private readonly onLeave = (): void => {
    this.hover = null;
    this.setHover(false);
  };

  private setHover(over: boolean): void {
    if (over === this.overHouse) return;
    this.overHouse = over;
    this.dom.classList.toggle('over-house', over);
  }

  /** Called once per frame: a pointer cursor over the house, at most one raycast per frame. */
  tick(): void {
    if (!this.hoverDirty || !this.hover) return;
    this.hoverDirty = false;
    this.setHover(this.hitsHouse(this.hover.x, this.hover.y));
  }

  dispose(): void {
    this.dom.removeEventListener('pointerdown', this.onDown);
    this.dom.removeEventListener('pointermove', this.onMove);
    this.dom.removeEventListener('pointerup', this.onUp);
    this.dom.removeEventListener('pointercancel', this.onCancel);
    this.dom.removeEventListener('pointerleave', this.onLeave);
  }
}
