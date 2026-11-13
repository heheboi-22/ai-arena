import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  AnimatedWorldState,
  WorldStateStore,
  clampDeltaTime,
  createAnimatedWorldState,
  dampValue,
  stepAnimatedState,
} from '../state/worldState';
import { evaluateAtmosphere } from './palette';
import { createProceduralTextures } from './textures';
import { createIslandMesh } from './terrain';
import { createHouse } from './assets/house';
import { createPond } from './assets/pond';
import { createWindmill } from './assets/windmill';
import { createTrees } from './assets/trees';
import { createDetails } from './assets/details';
import { createClouds } from './assets/clouds';
import { SkySystem } from './effects/sky';
import { RainSystem } from './effects/rain';
import { RippleSystem } from './effects/ripples';
import { PointerTapTracker } from './gesture';
import {
  INITIAL_CAMERA_BASE_DISTANCE,
  INITIAL_CAMERA_DIRECTION,
  INITIAL_CAMERA_FOV,
  INITIAL_CAMERA_TARGET,
  computeResponsiveCameraDistance,
} from './framing';

export class PocketWorldScene {
  private readonly container: HTMLElement;
  private readonly store: WorldStateStore;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;

  private readonly animState: AnimatedWorldState;
  private readonly textures = createProceduralTextures(true);
  private readonly sky = new SkySystem();
  private readonly island = createIslandMesh(this.textures);
  private readonly house = createHouse(this.textures);
  private readonly pond = createPond();
  private readonly windmill = createWindmill(this.textures);
  private readonly trees = createTrees(this.textures);
  private readonly details = createDetails(this.textures);
  private readonly clouds = createClouds();
  private readonly rain: RainSystem;
  private readonly ripples = new RippleSystem(14);

  private readonly dioramaGroup = new THREE.Group();
  private readonly sunLight: THREE.DirectionalLight;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly fillLight: THREE.DirectionalLight;
  private readonly fog = new THREE.FogExp2('#eadac3', 0.0085);

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private readonly tapTracker = new PointerTapTracker();

  private readonly motionQuery: MediaQueryList | null;
  private reducedMotion = false;
  private isCompactDevice = false;

  private resettingCamera = false;
  private resetTargetPos = new THREE.Vector3();
  private resetLookAt = new THREE.Vector3().copy(INITIAL_CAMERA_TARGET);

  private rafId: number | null = null;
  private lastFrameMs = 0;
  private elapsedSec = 0;
  private disposed = false;

  private readonly handleResizeBound: () => void;
  private readonly handleMotionChangeBound: (e: MediaQueryListEvent) => void;
  private readonly handlePointerDownBound: (e: PointerEvent) => void;
  private readonly handlePointerMoveBound: (e: PointerEvent) => void;
  private readonly handlePointerUpBound: (e: PointerEvent) => void;
  private readonly handlePointerCancelBound: (e: PointerEvent) => void;

  constructor(container: HTMLElement, store: WorldStateStore) {
    this.container = container;
    this.store = store;
    this.animState = createAnimatedWorldState(store.getState());

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    this.isCompactDevice = width < 768 || (navigator.hardwareConcurrency ?? 8) <= 4;

    this.motionQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    this.reducedMotion = this.motionQuery?.matches ?? false;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'pocket-world-canvas';
    this.renderer.domElement.setAttribute('aria-label', '3D floating island viewport');
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(INITIAL_CAMERA_FOV, width / height, 0.1, 160);
    const initialDist = computeResponsiveCameraDistance(width / height, INITIAL_CAMERA_BASE_DISTANCE);
    this.camera.position.copy(INITIAL_CAMERA_DIRECTION).multiplyScalar(initialDist).add(INITIAL_CAMERA_TARGET);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(INITIAL_CAMERA_TARGET);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.enablePan = false;
    this.controls.minDistance = 7.5;
    this.controls.maxDistance = Math.max(26, initialDist * 1.45);
    this.controls.minPolarAngle = 0.22;
    this.controls.maxPolarAngle = Math.PI * 0.72;
    this.controls.rotateSpeed = 0.85;
    this.controls.zoomSpeed = 0.9;
    this.controls.update();

    this.controls.addEventListener('start', () => {
      // Immediately yield control back to user if a reset glide was running
      this.resettingCamera = false;
    });

    // Lighting rig
    this.hemiLight = new THREE.HemisphereLight('#c9dcf0', '#776855', 0.88);
    this.scene.add(this.hemiLight);

    const shadowSize = this.isCompactDevice ? 1024 : 2048;
    this.sunLight = new THREE.DirectionalLight('#ffe0b0', 2.2);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(shadowSize, shadowSize);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 36;
    this.sunLight.shadow.camera.left = -7.5;
    this.sunLight.shadow.camera.right = 7.5;
    this.sunLight.shadow.camera.top = 7.5;
    this.sunLight.shadow.camera.bottom = -7.5;
    this.sunLight.shadow.bias = -0.0008;
    this.sunLight.shadow.normalBias = 0.025;
    this.sunLight.shadow.radius = 2.4;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.fillLight = new THREE.DirectionalLight('#9dc0eb', 0.34);
    this.fillLight.position.set(8, 3, -9);
    this.scene.add(this.fillLight);

    // Scene assembly
    this.rain = new RainSystem(this.isCompactDevice ? 220 : 360);

    this.dioramaGroup.name = 'diorama-root';
    this.dioramaGroup.add(this.island.group);
    this.dioramaGroup.add(this.house.group);
    this.dioramaGroup.add(this.pond.group);
    this.dioramaGroup.add(this.windmill.group);
    this.dioramaGroup.add(this.trees.group);
    this.dioramaGroup.add(this.details.group);
    this.dioramaGroup.add(this.ripples.group);

    this.scene.add(this.sky.group);
    this.scene.add(this.dioramaGroup);
    this.scene.add(this.clouds.group);
    this.scene.add(this.rain.group);

    this.applyRendererSize(width, height);

    // Event bindings
    this.handleResizeBound = this.onResize.bind(this);
    this.handleMotionChangeBound = (e: MediaQueryListEvent) => {
      this.reducedMotion = e.matches;
    };
    this.handlePointerDownBound = this.onPointerDown.bind(this);
    this.handlePointerMoveBound = this.onPointerMove.bind(this);
    this.handlePointerUpBound = this.onPointerUp.bind(this);
    this.handlePointerCancelBound = this.onPointerCancel.bind(this);

    window.addEventListener('resize', this.handleResizeBound);
    this.motionQuery?.addEventListener('change', this.handleMotionChangeBound);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.handlePointerDownBound);
    canvas.addEventListener('pointermove', this.handlePointerMoveBound);
    canvas.addEventListener('pointerup', this.handlePointerUpBound);
    canvas.addEventListener('pointercancel', this.handlePointerCancelBound);

    // Render initial frame synchronously before RAF loop
    this.updateScene(0);
    this.lastFrameMs = performance.now();
    this.startLoop();
  }

  resetCamera(): void {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    const dist = computeResponsiveCameraDistance(width / height, INITIAL_CAMERA_BASE_DISTANCE);

    this.resetLookAt.copy(INITIAL_CAMERA_TARGET);
    this.resetTargetPos
      .copy(INITIAL_CAMERA_DIRECTION)
      .multiplyScalar(dist)
      .add(INITIAL_CAMERA_TARGET);

    if (this.reducedMotion) {
      this.camera.position.copy(this.resetTargetPos);
      this.controls.target.copy(this.resetLookAt);
      this.controls.update();
      this.resettingCamera = false;
    } else {
      this.resettingCamera = true;
    }
  }

  private applyRendererSize(width: number, height: number): void {
    this.isCompactDevice = width < 768 || (navigator.hardwareConcurrency ?? 8) <= 4;
    const dprCap = this.isCompactDevice ? 1.5 : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    const dist = computeResponsiveCameraDistance(width / height, INITIAL_CAMERA_BASE_DISTANCE);
    this.controls.maxDistance = Math.max(26, dist * 1.45);
  }

  private onResize(): void {
    if (this.disposed) return;
    const prevWidth = Math.max(this.renderer.domElement.clientWidth, 1);
    const prevHeight = Math.max(this.renderer.domElement.clientHeight, 1);
    const prevResponsive = computeResponsiveCameraDistance(prevWidth / prevHeight, INITIAL_CAMERA_BASE_DISTANCE);

    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    const nextResponsive = computeResponsiveCameraDistance(width / height, INITIAL_CAMERA_BASE_DISTANCE);

    this.applyRendererSize(width, height);

    // Keep framing proportional when crossing between desktop landscape and mobile portrait
    if (Math.abs(nextResponsive - prevResponsive) > 0.1) {
      const offset = this.camera.position.clone().sub(this.controls.target);
      const currentDist = offset.length();
      if (currentDist > 0.01) {
        const ratio = nextResponsive / prevResponsive;
        const clampedDist = Math.max(
          this.controls.minDistance,
          Math.min(this.controls.maxDistance, currentDist * ratio)
        );
        offset.normalize().multiplyScalar(clampedDist);
        this.camera.position.copy(this.controls.target).add(offset);
      }
    }
    this.controls.update();
  }

  private updatePointerNdc(clientX: number, clientY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  private hitTestHouse(clientX: number, clientY: number): boolean {
    this.updatePointerNdc(clientX, clientY);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.house.hitTargets, false);
    return hits.length > 0;
  }

  private onPointerDown(e: PointerEvent): void {
    this.tapTracker.onDown(e.pointerId, e.clientX, e.clientY, e.timeStamp, e.isPrimary, e.button);
  }

  private onPointerMove(e: PointerEvent): void {
    this.tapTracker.onMove(e.pointerId, e.clientX, e.clientY);

    if (e.pointerType === 'mouse' && e.buttons === 0) {
      const overHouse = this.hitTestHouse(e.clientX, e.clientY);
      this.renderer.domElement.style.cursor = overHouse ? 'pointer' : 'grab';
    } else if (e.buttons !== 0) {
      this.renderer.domElement.style.cursor = 'grabbing';
    }
  }

  private onPointerUp(e: PointerEvent): void {
    const isTap = this.tapTracker.onUp(e.pointerId, e.clientX, e.clientY, e.timeStamp);
    if (e.pointerType === 'mouse') {
      const overHouse = this.hitTestHouse(e.clientX, e.clientY);
      this.renderer.domElement.style.cursor = overHouse ? 'pointer' : 'grab';
    }
    if (isTap && this.hitTestHouse(e.clientX, e.clientY)) {
      this.store.toggleHouseLights();
    }
  }

  private onPointerCancel(e: PointerEvent): void {
    this.tapTracker.onCancel(e.pointerId);
  }

  private startLoop(): void {
    const tick = (nowMs: number) => {
      if (this.disposed) return;
      const rawDt = (nowMs - this.lastFrameMs) / 1000;
      this.lastFrameMs = nowMs;
      const dt = clampDeltaTime(rawDt);

      this.updateScene(dt);
      this.renderer.render(this.scene, this.camera);
      this.rafId = window.requestAnimationFrame(tick);
    };

    this.rafId = window.requestAnimationFrame(tick);
  }

  private updateScene(dt: number): void {
    this.elapsedSec += dt;

    stepAnimatedState(this.animState, this.store.getState(), dt);

    // Smooth interruptible camera reset glide
    if (this.resettingCamera && dt > 0) {
      const t = 1 - Math.exp(-7.5 * dt);
      this.camera.position.lerp(this.resetTargetPos, t);
      this.controls.target.lerp(this.resetLookAt, t);
      if (
        this.camera.position.distanceTo(this.resetTargetPos) < 0.03 &&
        this.controls.target.distanceTo(this.resetLookAt) < 0.02
      ) {
        this.camera.position.copy(this.resetTargetPos);
        this.controls.target.copy(this.resetLookAt);
        this.resettingCamera = false;
      }
    }
    this.controls.update();

    const atmo = evaluateAtmosphere(this.animState.timeOfDay, this.animState.rainFactor);

    // Sky & fog & tone mapping exposure
    this.sky.update(atmo, this.elapsedSec, this.reducedMotion);
    this.fog.color.set(atmo.fogColor);
    this.fog.density = 0.007 + this.animState.rainFactor * 0.009;
    this.renderer.toneMappingExposure = dampValue(
      this.renderer.toneMappingExposure,
      atmo.exposure,
      8,
      Math.max(dt, 0.016)
    );

    // Lighting rig
    this.sunLight.color.set(atmo.sunColor);
    this.sunLight.intensity = atmo.sunIntensity;
    this.sunLight.position.set(
      atmo.sunDirection[0] * 18,
      atmo.sunDirection[1] * 18,
      atmo.sunDirection[2] * 18
    );

    this.hemiLight.color.set(atmo.ambientSkyColor);
    this.hemiLight.groundColor.set(atmo.ambientGroundColor);
    this.hemiLight.intensity = atmo.ambientIntensity;
    this.fillLight.color.set(atmo.ambientSkyColor);
    this.fillLight.intensity = 0.25 + (1 - Math.min(1, atmo.sunIntensity / 2.2)) * 0.22;

    // Whisper-soft floating diorama levitation (disabled when reducedMotion is active)
    if (this.reducedMotion) {
      this.dioramaGroup.position.y = 0;
      for (const frag of this.island.floatingFragments) {
        frag.mesh.position.y = frag.baseY;
      }
    } else {
      this.dioramaGroup.position.y = Math.sin(this.elapsedSec * 0.9) * 0.055;
      for (const frag of this.island.floatingFragments) {
        frag.mesh.position.y = frag.baseY + Math.sin(this.elapsedSec * 1.15 + frag.phase) * frag.amp;
      }
    }

    // Update diorama objects and effects from shared animated state
    this.house.update(dt, this.animState.houseLightFactor, atmo, this.reducedMotion);
    this.pond.update(this.elapsedSec, this.animState.rainFactor, atmo, this.reducedMotion);
    this.windmill.update(dt, this.animState.windFactor);
    this.trees.update(
      this.elapsedSec,
      this.animState.windFactor,
      this.animState.windDirection,
      this.reducedMotion
    );
    this.details.update(this.elapsedSec, this.animState.windFactor, this.reducedMotion);
    this.clouds.update(
      dt,
      this.animState.windFactor,
      this.animState.windDirection,
      this.animState.rainFactor,
      atmo,
      this.reducedMotion
    );
    this.rain.update(
      dt,
      this.animState.rainFactor,
      this.animState.windFactor,
      this.animState.windDirection,
      this.reducedMotion
    );
    this.ripples.update(dt, this.animState.rainFactor, this.reducedMotion);
  }

  dispose(): void {
    this.disposed = true;
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
    }
    window.removeEventListener('resize', this.handleResizeBound);
    this.motionQuery?.removeEventListener('change', this.handleMotionChangeBound);

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.handlePointerDownBound);
    canvas.removeEventListener('pointermove', this.handlePointerMoveBound);
    canvas.removeEventListener('pointerup', this.handlePointerUpBound);
    canvas.removeEventListener('pointercancel', this.handlePointerCancelBound);

    this.controls.dispose();
    this.sky.dispose();
    this.island.dispose();
    this.house.dispose();
    this.pond.dispose();
    this.windmill.dispose();
    this.trees.dispose();
    this.details.dispose();
    this.clouds.dispose();
    this.rain.dispose();
    this.ripples.dispose();
    this.textures.dispose();
    this.renderer.dispose();

    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
