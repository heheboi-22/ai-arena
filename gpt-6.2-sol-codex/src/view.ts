import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function makeView(canvas: HTMLCanvasElement) {
  const target = new T.Vector3(0, -.14, 0);
  const direction = new T.Vector3(0.57, .43, .83).normalize();
  const camera = new T.PerspectiveCamera(35, 1, .2, 135);
  camera.position.copy(target).addScaledVector(direction, 21);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minPolarAngle = 0.34;
  controls.maxPolarAngle = 1.63;
  controls.rotateSpeed = .74;
  controls.zoomSpeed = .75;
  controls.touches.TWO = T.TOUCH.DOLLY_ROTATE;
  controls.update();

  const eye = new T.Vector3();
  let frameDistance = 21;
  const stacked = matchMedia('(max-width: 800px)');

  function resize(width: number, height: number) {
    const aspect = width / height;
    const scale = 2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2));
    const fit = Math.max(stacked.matches ? 17.6 : 18.4, 13.6 / (aspect * scale * (stacked.matches ? .95 : .72)));
    eye.copy(camera.position).sub(controls.target).multiplyScalar(fit / frameDistance);
    frameDistance = fit;
    camera.position.copy(controls.target).add(eye);
    controls.minDistance = fit * .70;
    controls.maxDistance = fit * 1.48;
    camera.setViewOffset(width, height,
      -Math.round(stacked.matches ? 0 : width * .135),
      -Math.round(stacked.matches ? height * .048 : height * .028),
      width, height);
    controls.update();
  }

  function reset() {
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(direction, frameDistance);
    controls.update();
    controls.enableDamping = damping;
  }

  return { camera, controls, resize, reset };
}

export function pickHouse(
  canvas: HTMLCanvasElement, camera: T.Camera, scene: T.Scene, house: T.Group, activate: () => void,
) {
  const pointer = new T.Vector2();
  const ray = new T.Raycaster();
  const pressed = new Set<number>();
  let tap: { id: number; x: number; y: number } | undefined;

  canvas.addEventListener('pointerdown', event => {
    pressed.add(event.pointerId);
    tap = pressed.size === 1 && event.button === 0
      ? { id: event.pointerId, x: event.clientX, y: event.clientY } : undefined;
  });

  canvas.addEventListener('pointermove', event => {
    if (tap?.id === event.pointerId && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 5) tap = undefined;
  });

  canvas.addEventListener('pointerup', event => {
    pressed.delete(event.pointerId);
    if (tap?.id !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - tap.x, event.clientY - tap.y);
    tap = undefined;
    if (distance > 5) return;
    const bounds = canvas.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1,
      1 - (event.clientY - bounds.top) / bounds.height * 2);
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(scene.children).find(({ object }) =>
      object instanceof T.Mesh && object.visible && !object.material.transparent);
    for (let hitObject = hit?.object; hitObject; hitObject = hitObject.parent ?? undefined) {
      if (hitObject === house) {
        activate();
        break;
      }
    }
  });

  function cancel(event: PointerEvent) {
    pressed.delete(event.pointerId);
    tap = undefined;
  }
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('lostpointercapture', cancel);
}
