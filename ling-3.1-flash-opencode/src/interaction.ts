import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface InteractionOptions {
  houseHitMeshes: THREE.Object3D[];
  onToggleLights: () => void;
}

/**
 * Camera controls (orbit + zoom, damped, pan locked) plus click-vs-drag
 * detection so dragging across the house never toggles its lights.
 */
export function setupInteraction(
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  opts: InteractionOptions,
): OrbitControls {
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false; // keep the island framed; no way to lose it
  controls.minDistance = 6.5;
  controls.maxDistance = 30;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = 1.72; // allow peeking slightly under the island
  controls.rotateSpeed = 0.85;
  controls.zoomSpeed = 0.9;

  // Click (not drag) detection on the house.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downX = 0;
  let downY = 0;
  let downTime = 0;

  const setPointer = (e: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  };

  const hitsHouse = (e: PointerEvent): boolean => {
    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(opts.houseHitMeshes, false).length > 0;
  };

  renderer.domElement.addEventListener('pointerdown', (e) => {
    downX = e.clientX;
    downY = e.clientY;
    downTime = performance.now();
  });

  renderer.domElement.addEventListener('pointerup', (e) => {
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    const held = performance.now() - downTime;
    if (moved < 7 && held < 500 && hitsHouse(e)) {
      opts.onToggleLights();
    }
  });

  // Hover cursor affordance (pointer over the house).
  let hoverPending = false;
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (hoverPending || e.pointerType !== 'mouse') return;
    hoverPending = true;
    requestAnimationFrame(() => {
      hoverPending = false;
      renderer.domElement.style.cursor = hitsHouse(e) ? 'pointer' : '';
    });
  });

  return controls;
}
