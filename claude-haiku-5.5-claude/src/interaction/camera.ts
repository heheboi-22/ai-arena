import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clamp, damp, smoothstep } from '../util/math';

export const VIEW_TARGET = new Vector3(0, -0.9, 0);
const FOV = 34;
// Angles of the home view. Azimuth 0 looks along -z; positive turns toward +x.
const HOME_AZIMUTH = 0.62;
const HOME_POLAR = 1.2;
const RESET_DURATION = 1.1;
const FIT_DURATION = 0.7;
const INSET_RATE = 6;

export interface CameraRig {
  camera: PerspectiveCamera;
  controls: OrbitControls;
  resize(width: number, height: number): void;
  /**
   * Pixels of screen covered by the panel: `left` for a side panel, `bottom` for a
   * bottom sheet. The island is centred in the uncovered area and fitted to it.
   */
  setInsets(left: number, bottom: number): void;
  /** Eases the camera back to the home view. Any user drag or wheel cancels it immediately. */
  resetView(): void;
  update(dt: number): void;
}

interface Tween {
  from: Spherical;
  to: Spherical;
  t: number;
  duration: number;
}

export function createCameraRig(canvas: HTMLCanvasElement): CameraRig {
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 400);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(VIEW_TARGET);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;
  // Keep the camera between just above the horizon and nearly overhead, so the rock stays in view.
  controls.minPolarAngle = 0.28;
  controls.maxPolarAngle = 1.42;

  let width = 1;
  let height = 1;
  let leftTarget = 0;
  let bottomTarget = 0;
  let leftNow = 0;
  let bottomNow = 0;
  let fit = 22;
  let userMoved = false;
  let tween: Tween | null = null;

  const tanHalf = Math.tan(MathUtils.degToRad(FOV / 2));

  // Distance at which the island fits the area the panel leaves uncovered.
  const fitDistance = (): number => {
    const usableW = Math.max(120, width - leftTarget);
    const usableH = Math.max(120, height - bottomTarget);
    const horizontal = (7.4 * height) / (usableW * tanHalf);
    const vertical = (5.6 * height) / (usableH * tanHalf);
    return Math.max(22, horizontal, vertical);
  };

  const applyDistances = (): void => {
    controls.minDistance = fit * 0.7;
    controls.maxDistance = fit * 1.35;
  };

  const homeSpherical = (): Spherical => new Spherical(fit, HOME_POLAR, HOME_AZIMUTH);

  const placeAt = (s: Spherical): void => {
    camera.position.setFromSpherical(s).add(VIEW_TARGET);
  };

  const sphericalNow = (): Spherical => new Spherical().setFromVector3(camera.position.clone().sub(VIEW_TARGET));

  const applyViewOffset = (): void => {
    if (leftNow < 0.5 && bottomNow < 0.5) {
      camera.clearViewOffset();
    } else {
      // Moving the sub-window left shifts the image right, and moving it down lifts the image.
      camera.setViewOffset(width, height, -leftNow / 2, bottomNow / 2, width, height);
    }
    camera.updateProjectionMatrix();
  };

  const startTween = (duration: number): void => {
    const from = sphericalNow();
    const to = homeSpherical();
    // Take the short way round the orbit, even after the user has spun the camera several times.
    const turn = Math.atan2(Math.sin(to.theta - from.theta), Math.cos(to.theta - from.theta));
    to.theta = from.theta + turn;
    tween = { from, to, t: 0, duration };
  };

  // A user gesture cancels any tween and tells resize() not to reset their zoom.
  controls.addEventListener('start', () => {
    userMoved = true;
    tween = null;
  });

  placeAt(homeSpherical());
  applyDistances();

  return {
    camera,
    controls,
    resize(w, h) {
      width = w;
      height = h;
      camera.aspect = w / h;
      fit = fitDistance();
      applyDistances();
      if (!userMoved) {
        placeAt(homeSpherical());
      } else {
        const current = camera.position.distanceTo(VIEW_TARGET);
        const offset = sphericalNow();
        offset.radius = clamp(current, fit * 0.7, fit * 1.35);
        placeAt(offset);
      }
      applyViewOffset();
      controls.update();
    },
    setInsets(left, bottom) {
      leftTarget = left;
      bottomTarget = bottom;
      fit = fitDistance();
      applyDistances();
      // Only glide to the new distance when the user hasn't taken over the camera.
      if (!userMoved) startTween(FIT_DURATION);
    },
    resetView() {
      userMoved = false;
      startTween(RESET_DURATION);
    },
    update(dt) {
      leftNow = damp(leftNow, leftTarget, INSET_RATE, dt);
      bottomNow = damp(bottomNow, bottomTarget, INSET_RATE, dt);
      applyViewOffset();

      if (tween) {
        tween.t = Math.min(1, tween.t + dt / tween.duration);
        const k = smoothstep(0, 1, tween.t);
        const { from, to } = tween;
        placeAt(
          new Spherical(
            from.radius + (to.radius - from.radius) * k,
            from.phi + (to.phi - from.phi) * k,
            from.theta + (to.theta - from.theta) * k,
          ),
        );
        if (tween.t >= 1) tween = null;
      }
      controls.update();
    },
  };
}
