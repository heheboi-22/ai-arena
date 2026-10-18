import * as THREE from 'three';

interface Press {
  id: number;
  x: number;
  y: number;
  time: number;
  moved: boolean;
  multi: boolean;
}

/**
 * Turns a click or tap on the house into a toggle, without reacting to orbit drags:
 * the pointer must go down and up in nearly the same place, quickly, with one finger.
 */
export class HousePicker {
  private press: Press | null = null;
  private readonly pointers = new Set<number>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private hoverPending = false;
  private hoverX = 0;
  private hoverY = 0;

  constructor(
    private readonly dom: HTMLElement,
    private readonly camera: THREE.Camera,
    private readonly hitbox: THREE.Object3D,
    private readonly occluders: THREE.Object3D[],
    private readonly onPick: () => void,
  ) {
    dom.addEventListener('pointerdown', this.down);
    dom.addEventListener('pointermove', this.move);
    dom.addEventListener('pointerup', this.up);
    dom.addEventListener('pointercancel', this.cancel);
    dom.addEventListener('pointerleave', () => {
      if (!this.press) this.dom.style.cursor = '';
    });
  }

  private readonly down = (e: PointerEvent) => {
    this.pointers.add(e.pointerId);
    if (this.pointers.size === 1) {
      this.press = { id: e.pointerId, x: e.clientX, y: e.clientY, time: performance.now(), moved: false, multi: false };
    } else if (this.press) {
      this.press.multi = true;
    }
  };

  private readonly move = (e: PointerEvent) => {
    const p = this.press;
    if (p && e.pointerId === p.id) {
      const limit = e.pointerType === 'mouse' ? 5 : 10;
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > limit) p.moved = true;
    }
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      this.hoverX = e.clientX;
      this.hoverY = e.clientY;
      if (!this.hoverPending) {
        this.hoverPending = true;
        requestAnimationFrame(() => {
          this.hoverPending = false;
          this.dom.style.cursor = this.hits(this.hoverX, this.hoverY) ? 'pointer' : '';
        });
      }
    }
  };

  private readonly up = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    const p = this.press;
    if (p && e.pointerId === p.id) {
      const quick = performance.now() - p.time < 650;
      if (!p.moved && !p.multi && quick && this.hits(e.clientX, e.clientY)) this.onPick();
    }
    if (this.pointers.size === 0) this.press = null;
  };

  private readonly cancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    this.press = null;
  };

  /** The house counts as hit when its box is struck before any tree, rock or terrain. */
  private hits(clientX: number, clientY: number): boolean {
    const rect = this.dom.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const house = this.raycaster.intersectObject(this.hitbox, false)[0];
    if (!house) return false;
    const blocker = this.raycaster.intersectObjects(this.occluders, true)[0];
    return !blocker || house.distance <= blocker.distance + 0.05;
  }
}
