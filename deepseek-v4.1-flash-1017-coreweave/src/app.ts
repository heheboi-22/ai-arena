import * as THREE from 'three';
import { Ripples } from './effects/ripples';
import { Rain } from './effects/rain';
import { Environment } from './environment/environment';
import { Palette } from './environment/palette';
import { SceneRuntime, type SceneContext } from './environment/runtime';
import { CameraRig, type LayoutMetrics } from './interaction/camera';
import type { PocketStore } from './state';
import { Clouds } from './world/clouds';
import { Fireflies } from './world/fireflies';
import { House } from './world/house';
import { Island } from './world/island';
import { createMaterials } from './world/materials';
import { Pond } from './world/pond';
import { Props } from './world/props';
import { Trees } from './world/trees';
import { Windmill } from './world/windmill';

interface AppOptions {
  onContextLost: () => void;
}

interface Quality {
  maxPixelRatio: number;
  shadowMapSize: number;
  rainCount: number;
  reducedQuality: boolean;
}

interface Press {
  id: number;
  x: number;
  y: number;
  time: number;
}

const DRAG_THRESHOLD = 7;
const PRESS_DURATION = 600;

const computeQuality = (): Quality => {
  const compact = window.matchMedia('(max-width: 1099px)').matches;
  const lowPower = (navigator.hardwareConcurrency ?? 8) <= 4;
  const reducedQuality = compact || lowPower;
  return {
    maxPixelRatio: lowPower ? 1.5 : compact ? 1.7 : 2,
    shadowMapSize: reducedQuality ? 1024 : 2048,
    rainCount: reducedQuality ? 900 : 1500,
    reducedQuality
  };
};

export class PocketWorldApp {
  private readonly container: HTMLElement;
  private readonly store: PocketStore;
  private readonly options: AppOptions;
  private readonly quality = computeQuality();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly rig: CameraRig;
  private readonly palette = new Palette();
  private readonly runtime: SceneRuntime;
  private readonly environment: Environment;
  private readonly island: Island;
  private readonly house: House;
  private readonly trees: Trees;
  private readonly windmill: Windmill;
  private readonly pond: Pond;
  private readonly props: Props;
  private readonly clouds: Clouds;
  private readonly fireflies: Fireflies;
  private readonly rain: Rain;
  private readonly ripples: Ripples;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly activePointers = new Set<number>();
  private panelElement: HTMLElement | null = null;
  private press: Press | null = null;
  private frameId = 0;
  private lastFrame = 0;
  private running = false;
  private reducedMotion = false;
  private layoutScheduled = false;
  private resizeObserver: ResizeObserver | null = null;
  private readonly motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');

  constructor(container: HTMLElement, store: PocketStore, options: AppOptions) {
    this.container = container;
    this.store = store;
    this.options = options;
    this.reducedMotion = this.motionMedia.matches;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.maxPixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(37, 1, 0.1, 620);
    this.rig = new CameraRig(this.camera, this.renderer.domElement);

    const materials = createMaterials();
    this.environment = new Environment(this.scene, {
      shadowMapSize: this.quality.shadowMapSize
    });

    this.island = new Island(materials);
    this.scene.add(this.island.group);
    this.house = new House(materials);
    this.scene.add(this.house.group);
    this.trees = new Trees(materials);
    this.scene.add(this.trees.group);
    this.windmill = new Windmill(materials);
    this.scene.add(this.windmill.group);
    this.pond = new Pond(materials);
    this.scene.add(this.pond.group);
    this.props = new Props(materials, this.quality.reducedQuality);
    this.scene.add(this.props.group);
    this.clouds = new Clouds();
    this.scene.add(this.clouds.group);
    this.fireflies = new Fireflies();
    this.scene.add(this.fireflies.points);
    this.rain = new Rain(this.quality.rainCount);
    this.scene.add(this.rain.mesh);
    this.ripples = new Ripples(this.scene, this.quality.reducedQuality ? 22 : 30);

    this.runtime = new SceneRuntime(store.snapshot);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('pointerleave', this.handlePointerLeave);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);

    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('resize', this.scheduleLayout, { passive: true });
    window.visualViewport?.addEventListener('resize', this.scheduleLayout, { passive: true });
    this.motionMedia.addEventListener('change', this.handleMotionPreference);
  }

  start(panelElement: HTMLElement | null): void {
    this.panelElement = panelElement;
    this.rig.setReducedMotion(this.reducedMotion);
    this.updateLayout();
    if (this.reducedMotion) this.rig.goHome(0.001);
    this.resizeObserver = new ResizeObserver(() => this.scheduleLayout());
    this.resizeObserver.observe(this.container);
    if (import.meta.env.DEV) {
      window.__pocket = {
        scene: this.scene,
        camera: this.camera,
        renderer: this.renderer,
        rain: this.rain,
        ripples: this.ripples,
        rig: this.rig,
        store: this.store,
        trees: this.trees,
        clouds: this.clouds,
        house: this.house,
        island: this.island
      };
    }
    this.running = true;
    this.lastFrame = performance.now();
    this.animate(this.lastFrame);
  }

  updateLayout = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (width <= 0 || height <= 0) return;
    const compact = window.matchMedia('(max-width: 1099px)').matches;
    const panelRect = this.panelElement?.getBoundingClientRect();
    const metrics: LayoutMetrics = {
      width,
      height,
      compact,
      panel: {
        top: panelRect?.top ?? height - 74,
        right: panelRect?.right ?? 0,
        width: panelRect?.width ?? 0,
        height: panelRect?.height ?? 0
      }
    };
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality.maxPixelRatio);
    const currentSize = this.renderer.getSize(new THREE.Vector2());
    if (
      Math.abs(currentSize.x - width) > 0.5 ||
      Math.abs(currentSize.y - height) > 0.5 ||
      Math.abs(this.renderer.getPixelRatio() - dpr) > 0.01
    ) {
      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(width, height, false);
    }
    this.rig.setLayout(metrics);
    if (this.reducedMotion) {
      this.rig.refreshComposition();
    }
  };

  resetView(): void {
    this.rig.goHome(this.reducedMotion ? 0.001 : 0.95);
  }

  private scheduleLayout = (): void => {
    if (this.layoutScheduled) return;
    this.layoutScheduled = true;
    window.requestAnimationFrame(() => {
      this.layoutScheduled = false;
      this.updateLayout();
    });
  };

  private animate = (now: number): void => {
    if (!this.running) return;
    const rawDelta = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    const delta = Math.min(0.05, Math.max(0, Number.isFinite(rawDelta) ? rawDelta : 0.016));

    const smooth = this.runtime.update(this.store.snapshot, delta);
    this.palette.sample(smooth.hour, smooth.rain);
    const context: SceneContext = {
      time: this.runtime.time,
      delta,
      hour: smooth.hour,
      rain: smooth.rain,
      wind: smooth.wind,
      houseLights: smooth.lights,
      night: this.palette.night,
      reducedMotion: this.reducedMotion,
      lightDirection: this.environment.keyDirection,
      lightColor: this.environment.keyColor
    };

    this.environment.update(context, this.palette);
    this.island.update(context);
    this.house.update(context);
    this.trees.update(context);
    this.windmill.update(context);
    this.pond.update(context, this.palette);
    this.props.update(context);
    this.clouds.update(context, this.palette);
    this.fireflies.update(context);
    this.rain.update(context);
    this.ripples.update(context);
    this.rig.update(delta);

    this.renderer.toneMappingExposure = this.palette.exposure;
    this.renderer.render(this.scene, this.camera);
    this.frameId = window.requestAnimationFrame(this.animate);
  };

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.activePointers.add(event.pointerId);
    this.container.classList.add('is-dragging');
    if (this.activePointers.size === 1) {
      this.press = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        time: performance.now()
      };
    } else {
      this.press = null;
    }
    this.setHover(false);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.activePointers.size > 0) return;
    if (event.pointerType === 'touch') return;
    const hit = this.isHouseAt(event.clientX, event.clientY);
    this.setHover(hit);
  };

  private handlePointerLeave = (): void => {
    if (this.activePointers.size > 0) return;
    this.setHover(false);
  };

  private handlePointerUp = (event: PointerEvent): void => {
    const press = this.press;
    const wasPrimaryPointer = this.activePointers.size === 1;
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size === 0) this.container.classList.remove('is-dragging');
    this.press = null;
    if (!press || press.id !== event.pointerId || !wasPrimaryPointer) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    const distance = Math.hypot(dx, dy);
    const elapsed = performance.now() - press.time;
    if (distance <= DRAG_THRESHOLD && elapsed <= PRESS_DURATION) {
      if (this.isHouseAt(event.clientX, event.clientY)) {
        this.store.set({ houseLights: !this.store.snapshot.houseLights });
      }
    }
    if (event.pointerType !== 'touch') {
      this.setHover(this.isHouseAt(event.clientX, event.clientY));
    }
  };

  private setHover(active: boolean): void {
    this.house.setHover(active);
    this.container.classList.toggle('is-over-house', active);
  }

  private isHouseAt(clientX: number, clientY: number): boolean {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    this.pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObject(this.house.hitArea, false).length > 0;
  }

  private handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.running = false;
    window.cancelAnimationFrame(this.frameId);
    this.options.onContextLost();
  };

  private handleVisibilityChange = (): void => {
    if (!document.hidden) this.lastFrame = performance.now();
  };

  private handleMotionPreference = (event: MediaQueryListEvent): void => {
    this.reducedMotion = event.matches;
    this.rig.setReducedMotion(event.matches);
  };
}
