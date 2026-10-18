import { Object3D, Raycaster, Vector2, type PerspectiveCamera } from 'three';

// Pixels a pointer may travel and still count as a tap. Anything longer is an orbit drag.
const TAP_SLOP = 7;
const HOVER_INTERVAL_MS = 80;

export interface PickOptions {
  canvas: HTMLCanvasElement;
  camera: PerspectiveCamera;
  /** Solid geometry to test against. Occlusion counts: a tree in front of the house blocks the tap. */
  pickRoot: Object3D;
  /** The house group. A tap only counts when the first thing hit belongs to it. */
  target: Object3D;
  onTap: () => void;
}

function isWithin(object: Object3D | null, ancestor: Object3D): boolean {
  let node: Object3D | null = object;
  while (node) {
    if (node === ancestor) return true;
    node = node.parent;
  }
  return false;
}

/**
 * Click-or-tap on the house, distinguished from an orbit drag. Pointer movement
 * beyond TAP_SLOP, or a second pointer at any point (pinch), cancels the tap.
 * Also sets the pointer cursor while hovering the house.
 */
export function attachHousePicking(options: PickOptions): () => void {
  const { canvas, camera, pickRoot, target, onTap } = options;
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const pointers = new Map<number, { x: number; y: number }>();

  let primaryId = -1;
  let startX = 0;
  let startY = 0;
  let moved = false;
  let multi = false;
  let lastHover = 0;

  const hitsTarget = (clientX: number, clientY: number): boolean => {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(pickRoot, true);
    return hits.length > 0 && isWithin(hits[0].object, target);
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const firstPointer = pointers.size === 0;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (firstPointer) {
      // A fresh gesture starts with clean flags.
      primaryId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      moved = false;
      multi = false;
    } else {
      multi = true;
    }
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (pointers.has(e.pointerId)) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (e.pointerId === primaryId && Math.hypot(e.clientX - startX, e.clientY - startY) > TAP_SLOP) {
      moved = true;
    }
    // Hover feedback is for a mouse only, and throttled so the raycast stays cheap.
    if (e.pointerType === 'mouse' && pointers.size === 0) {
      const now = performance.now();
      if (now - lastHover < HOVER_INTERVAL_MS) return;
      lastHover = now;
      canvas.style.cursor = hitsTarget(e.clientX, e.clientY) ? 'pointer' : '';
    }
  };

  const onPointerUp = (e: PointerEvent): void => {
    const wasTracked = pointers.delete(e.pointerId);
    if (e.pointerId !== primaryId) return;
    const isTap = wasTracked && !moved && !multi && pointers.size === 0;
    primaryId = -1;
    if (isTap && hitsTarget(e.clientX, e.clientY)) onTap();
  };

  const onPointerCancel = (e: PointerEvent): void => {
    pointers.delete(e.pointerId);
    if (e.pointerId === primaryId) {
      primaryId = -1;
      moved = true;
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('pointerleave', () => {
    canvas.style.cursor = '';
  });

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
  };
}
