import * as THREE from 'three';
import { CameraRig } from './interaction/cameraRig';
import { HousePicker } from './interaction/picking';
import { type WorldState, Store } from './state';
import { Panel } from './ui/panel';
import { showFatal } from './ui/fatal';
import { clamp, damp } from './util/math';
import { type Quality, detectQuality } from './util/quality';
import { computeEnvironment, createEnvironment } from './fx/environment';
import * as layout from './world/layout';
import { World } from './world/world';

/** A frame longer than this (a background tab, a debugger pause) is treated as this long. */
const MAX_FRAME = 0.05;
/** Never render more than this many pixels, whatever the screen's density. */
const PIXEL_BUDGET = 4_400_000;
/** The lowest pixel ratio the governor will ever pick. */
const MIN_RATIO = 0.75;

/** The smoothed copy of the store that the scene actually follows. */
interface Smoothed {
  hour: number;
  rain: number;
  lights: number;
}

export class App {
  readonly store = new Store();
  private readonly quality: Quality = detectQuality();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly world: World;
  private readonly rig: CameraRig;
  private readonly picker: HousePicker;
  private readonly panel: Panel;
  private readonly sim: Smoothed;
  private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly resizeObserver: ResizeObserver;

  private time = 0;
  private lastStamp = -1;
  private pixelRatio = 1;
  private night = false;
  private firstFrame = true;
  private stopped = false;
  private lights: boolean;

  // A small governor: if the frame rate stays low, render at a lower pixel ratio, and give a
  // little of it back if things calm down. It stands aside when the URL pins a quality preset.
  private readonly adaptive = !new URLSearchParams(window.location.search).has('quality');
  private ratioCap: number;
  private frameMs = 16.7;
  private slowFor = 0;
  private fastFor = 0;
  private recoveries = 0;

  constructor(private readonly stage: HTMLElement) {
    const q = this.quality;
    this.ratioCap = q.maxPixelRatio;
    this.renderer = new THREE.WebGLRenderer({
      antialias: q.antialias,
      powerPreference: 'high-performance',
    });
    const r = this.renderer;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.NeutralToneMapping;
    r.setClearColor(0x9fc4e0);
    const canvas = r.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-roledescription', '3D scene');
    canvas.setAttribute(
      'aria-label',
      'Pocket World, a floating island. Use the arrow keys to orbit and plus and minus to zoom. Controls are in the panel.',
    );
    stage.appendChild(canvas);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);

    this.world = new World(q);
    this.rig = new CameraRig(canvas);

    const s = this.store.state;
    this.lights = s.lights;
    this.sim = { hour: s.hour, rain: s.weather === 'rain' ? 1 : 0, lights: s.lights ? 1 : 0 };

    this.panel = new Panel(document.body, this.store, {
      onReset: () => this.resetAll(),
      onLayout: () => this.resize(),
    });

    this.picker = new HousePicker(canvas, this.rig.camera, () => this.world.pickables, () => this.store.toggleLights());
    this.store.subscribe((state) => this.onState(state));

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(stage);
    this.resize();
  }

  private onState(state: Readonly<WorldState>): void {
    if (state.lights !== this.lights) {
      this.lights = state.lights;
      this.world.house.pulse();
    }
  }

  /** The Reset button: the same defaults for the world, the controls and the camera. */
  private resetAll(): void {
    this.store.reset();
    this.rig.reset();
  }

  private resize(): void {
    const w = Math.max(1, this.stage.clientWidth);
    const h = Math.max(1, this.stage.clientHeight);
    let ratio = Math.min(window.devicePixelRatio || 1, this.ratioCap);
    ratio = Math.min(ratio, Math.sqrt(PIXEL_BUDGET / (w * h)));
    this.pixelRatio = Math.max(MIN_RATIO, ratio);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.rig.resize(w, h, this.panel.insets, this.pixelRatio);
    this.world.setPointScale(this.rig.pixelsPerUnit);
  }

  /**
   * Compiles every shader and uploads every texture and mesh before the first frame, so nothing
   * hitches the first time rain, night or the house lights are used. Objects that are hidden until
   * then (rain, fireflies, storm clouds, the moon) are shown for the duration of the compile.
   */
  private async warmUp(): Promise<void> {
    const scene = this.world.scene;
    const hidden: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    try {
      for (const tex of this.world.textures) this.renderer.initTexture(tex);
      const compiled = this.renderer.compileAsync(scene, this.rig.camera);
      // A stuck compile must not leave anyone on the loading screen.
      await Promise.race([compiled, new Promise((resolve) => window.setTimeout(resolve, 8000))]);
      // One throw-away frame uploads every geometry and the shadow map, still behind the loading screen.
      this.renderer.render(scene, this.rig.camera);
    } catch (err) {
      console.warn('Shader warm-up skipped:', err);
    } finally {
      for (const o of hidden) o.visible = false;
    }
  }

  async start(): Promise<void> {
    await this.warmUp();
    if (this.stopped) return;
    this.renderer.setAnimationLoop(this.frame);
    if (new URLSearchParams(window.location.search).has('debug')) {
      (window as unknown as Record<string, unknown>).__pocket = {
        store: this.store,
        world: this.world,
        rig: this.rig,
        sim: this.sim,
        renderer: this.renderer,
        quality: this.quality,
        app: this,
        environment: { compute: computeEnvironment, create: createEnvironment },
        layout,
      };
    }
  }

  private readonly frame = (stamp: number): void => {
    try {
      this.step(stamp / 1000);
    } catch (err) {
      this.stopped = true;
      this.renderer.setAnimationLoop(null);
      console.error(err);
      showFatal(err);
    }
  };

  private step(now: number): void {
    const raw = this.lastStamp < 0 ? 0 : now - this.lastStamp;
    const dt = clamp(raw, 0, MAX_FRAME);
    this.lastStamp = now;
    this.time += dt;
    if (this.adaptive) this.govern(raw);

    // Ease the scene toward the store. The store jumps; these values never do,
    // and since they only chase a target they can be redirected at any moment.
    const target = this.store.state;
    const sim = this.sim;
    sim.hour = this.approach(sim.hour, target.hour, 5.2, dt);
    const rainTarget = target.weather === 'rain' ? 1 : 0;
    sim.rain = this.approach(sim.rain, rainTarget, rainTarget > sim.rain ? 1.25 : 1.45, dt, 0.004);
    sim.lights = this.approach(sim.lights, target.lights ? 1 : 0, 9, dt);

    // Read live, so the preference can change while the page is open.
    const reducedMotion = this.motion.matches;
    this.rig.reducedMotion = reducedMotion;
    this.rig.update(dt);
    const camera = this.rig.camera;
    camera.updateMatrixWorld();

    this.world.update({
      dt,
      time: this.time,
      hour: sim.hour,
      rain: sim.rain,
      windTarget: target.wind,
      lights: sim.lights,
      reducedMotion,
      camera,
      renderer: this.renderer,
    });

    // The panel turns night-blue a little after the sky does, with some hysteresis.
    const night = this.world.env.night;
    if (night > 0.6 && !this.night) this.night = true;
    else if (night < 0.4 && this.night) this.night = false;
    this.panel.setTone(this.night);

    this.picker.tick();
    this.renderer.render(this.world.scene, camera);

    if (this.firstFrame) {
      this.firstFrame = false;
      document.getElementById('boot')?.classList.add('is-done');
      window.setTimeout(() => document.getElementById('boot')?.remove(), 900);
    }
  }

  private govern(raw: number): void {
    // Long gaps are a hidden tab or a debugger pause, not a slow renderer.
    if (raw <= 0 || raw > 0.1) return;
    this.frameMs += (raw * 1000 - this.frameMs) * 0.06;
    // Slower than about 28 fps. A 30 fps cap (power saving) sits just under this, so it is left alone.
    this.slowFor = this.frameMs > 36 ? this.slowFor + raw : 0;
    this.fastFor = this.frameMs < 18.5 ? this.fastFor + raw : 0;
    if (this.slowFor > 2.5 && this.ratioCap > MIN_RATIO) {
      // Step down from what is actually being rendered, not from the cap.
      this.ratioCap = Math.max(MIN_RATIO, Math.min(this.ratioCap, this.pixelRatio) - 0.25);
      this.retune();
    } else if (this.fastFor > 12 && this.recoveries < 2 && this.ratioCap < this.quality.maxPixelRatio) {
      // A steady 60 fps for a while: the slowdown was probably temporary. Try one step back.
      this.ratioCap = Math.min(this.quality.maxPixelRatio, this.ratioCap + 0.25);
      this.recoveries++;
      this.retune();
    }
  }

  private retune(): void {
    this.slowFor = 0;
    this.fastFor = 0;
    this.frameMs = 16.7;
    this.resize();
  }

  /** Exponential approach that lands exactly on the target instead of creeping toward it forever. */
  private approach(current: number, target: number, rate: number, dt: number, epsilon = 0.0004): number {
    const next = damp(current, target, rate, dt);
    return Math.abs(next - target) < epsilon ? target : next;
  }

  private readonly onContextLost = (e: Event): void => {
    e.preventDefault();
    this.renderer.setAnimationLoop(null);
    this.setToast('The graphics context was lost. Waiting for the browser to restore it…');
  };

  private readonly onContextRestored = (): void => {
    this.setToast(null);
    if (!this.stopped) this.renderer.setAnimationLoop(this.frame);
  };

  private setToast(text: string | null): void {
    let el = document.getElementById('toast');
    if (!text) {
      el?.remove();
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = text;
  }

  dispose(): void {
    this.stopped = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.picker.dispose();
    this.rig.dispose();
    this.panel.dispose();
    this.world.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
