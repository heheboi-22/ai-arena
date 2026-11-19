import * as THREE from "three";
import {
  AtmosphereSnapshot,
  WorldStateStore,
  clamp,
  computeAtmosphere,
  deriveWindEffects,
} from "../state/worldState";
import { createAtmosphere, AtmosphereSystem } from "./atmosphere";
import { createFoliageAndProps, FoliageSystem } from "./foliageAndProps";
import { createHouse, HouseSystem } from "./house";
import { createIsland, IslandSystem } from "./island";
import { createProceduralTextures, ProceduralTextures } from "./textures";
import { createWeatherSystem, WeatherSystem } from "./weather";
import { createWindmill, WindmillSystem } from "./windmill";
import {
  CameraAndPickingSystem,
  createCameraAndPicking,
} from "../interaction/cameraAndPicking";

export interface PocketWorldAppOptions {
  container: HTMLElement;
  store: WorldStateStore;
  onThemeChange?: (theme: "light" | "dark") => void;
}

export interface PocketWorldAppHandle {
  resetView: () => void;
  dispose: () => void;
}

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function createPocketWorldApp(options: PocketWorldAppOptions): PocketWorldAppHandle {
  const { container, store, onThemeChange } = options;

  if (!isWebGLAvailable()) {
    throw new Error(
      "WebGL is unavailable in this browser or device. Please enable hardware acceleration or use a WebGL-capable browser to view Pocket World."
    );
  }

  const isSoftwareGl = detectSoftwareWebGL();
  const isCompactDevice = window.innerWidth < 768 || navigator.hardwareConcurrency <= 4;

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(
    isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, isCompactDevice ? 1.5 : 2)
  );
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const initWidth = Math.max(1, container.clientWidth || window.innerWidth);
  const initHeight = Math.max(1, container.clientHeight || window.innerHeight);
  renderer.setSize(initWidth, initHeight, false);
  renderer.domElement.className = "world-canvas";
  renderer.domElement.setAttribute("data-testid", "pocket-world-canvas");
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, initWidth / initHeight, 0.25, 160);

  // Build procedural textures & scene modules
  const textures: ProceduralTextures = createProceduralTextures(
    renderer.capabilities.getMaxAnisotropy()
  );
  const atmosphere: AtmosphereSystem = createAtmosphere(scene, renderer, isSoftwareGl);
  scene.add(atmosphere.group);

  // Diorama root hovers gently as a cohesive floating island
  const dioramaRoot = new THREE.Group();
  dioramaRoot.name = "DioramaRoot";
  scene.add(dioramaRoot);

  const island: IslandSystem = createIsland(textures);
  const house: HouseSystem = createHouse(textures);
  const windmill: WindmillSystem = createWindmill(textures);
  const foliage: FoliageSystem = createFoliageAndProps(textures);
  const weather: WeatherSystem = createWeatherSystem();

  dioramaRoot.add(island.group, house.group, windmill.group, foliage.group, weather.group);

  const cameraSystem: CameraAndPickingSystem = createCameraAndPicking(
    camera,
    renderer.domElement,
    house.hitTargets,
    isSoftwareGl,
    () => {
      store.toggleHouseLights();
    },
    (hovered) => {
      house.setHovered(hovered);
    }
  );

  // Pre-warm shaders on GPU devices to avoid first-frame stutter
  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  // Smoothly damped runtime simulation values (all transitions are interruptible)
  const initialState = store.getState();
  let smoothTimeMinutes = initialState.timeMinutes;
  let smoothRainFactor = initialState.weather === "rain" ? 1 : 0;
  let smoothWindStrength = initialState.windStrength;
  let currentUiTheme: "light" | "dark" | null = null;
  let contextLost = false;

  // Respect prefers-reduced-motion dynamically
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = reducedMotionQuery.matches;
  const onReducedMotionChange = (e: MediaQueryListEvent) => {
    reducedMotion = e.matches;
  };
  reducedMotionQuery.addEventListener("change", onReducedMotionChange);

  // WebGL context resilience
  const onContextLost = (e: Event) => {
    e.preventDefault();
    contextLost = true;
  };
  const onContextRestored = () => {
    contextLost = false;
  };
  renderer.domElement.addEventListener("webglcontextlost", onContextLost);
  renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);

  // Store subscription for camera reset on Reset button
  const unsubscribeStore = store.subscribe((_state, changedKey) => {
    if (changedKey === "reset") {
      cameraSystem.resetCamera(false);
    }
  });

  // Resize handling without stretching or losing framing
  const handleResize = () => {
    const w = Math.max(1, container.clientWidth || window.innerWidth);
    const h = Math.max(1, container.clientHeight || window.innerHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    cameraSystem.updateAspectPreset(w / h);
    renderer.setSize(w, h, false);
  };
  const resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(container);
  window.addEventListener("resize", handleResize);

  // Render loop with clamped dt and software-WebGL afterDraw pacing
  let disposed = false;
  let frameHandle = 0;
  let elapsed = 0;
  let lastTimestamp = performance.now();

  const applyFrame = (dt: number) => {
    const state = store.getState();

    // Smooth, interruptible transitions toward target state
    const timeAlpha = 1 - Math.exp(-8.5 * dt);
    const rainAlpha = 1 - Math.exp(-2.8 * dt);
    const windAlpha = 1 - Math.exp(-5.0 * dt);

    smoothTimeMinutes += (state.timeMinutes - smoothTimeMinutes) * timeAlpha;
    if (Math.abs(state.timeMinutes - smoothTimeMinutes) < 0.05) {
      smoothTimeMinutes = state.timeMinutes;
    }

    const targetRain = state.weather === "rain" ? 1 : 0;
    smoothRainFactor += (targetRain - smoothRainFactor) * rainAlpha;
    if (Math.abs(targetRain - smoothRainFactor) < 0.002) {
      smoothRainFactor = targetRain;
    }

    smoothWindStrength += (state.windStrength - smoothWindStrength) * windAlpha;
    if (Math.abs(state.windStrength - smoothWindStrength) < 0.001) {
      smoothWindStrength = state.windStrength;
    }

    const atmo: AtmosphereSnapshot = computeAtmosphere(smoothTimeMinutes, smoothRainFactor);
    const wind = deriveWindEffects(smoothWindStrength);

    if (atmo.uiTheme !== currentUiTheme) {
      currentUiTheme = atmo.uiTheme;
      document.documentElement.dataset.theme = atmo.uiTheme;
      onThemeChange?.(atmo.uiTheme);
    }

    // Subtle floating hover of the entire island (disabled in reduced-motion)
    dioramaRoot.position.y = reducedMotion ? 0 : Math.sin(elapsed * 0.72) * 0.085;

    // Update all synchronized subsystems
    atmosphere.update(dt, elapsed, atmo, wind, reducedMotion);
    island.update(elapsed, dt, atmo, smoothWindStrength, reducedMotion);
    house.update(dt, elapsed, state.houseLightsOn, atmo, wind, reducedMotion);
    windmill.update(dt, wind, atmo, state.houseLightsOn, reducedMotion);
    foliage.update(dt, elapsed, wind, reducedMotion);
    weather.update(dt, smoothRainFactor, wind, atmo, reducedMotion);
    cameraSystem.update(dt);

    // Expose non-visual state attributes for accessibility & verification
    document.body.dataset.weather = state.weather;
    document.body.dataset.lights = state.houseLightsOn ? "on" : "off";
    document.body.dataset.wind = String(Math.round(state.windStrength * 100));
  };

  function afterDraw(cb: () => void) {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === "function") {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (status === gl.UNSIGNALED) {
          frameHandle = window.setTimeout(poll, 6);
        } else {
          if (sync) gl.deleteSync(sync);
          frameHandle = window.setTimeout(cb, 80);
        }
      };
      frameHandle = window.setTimeout(poll, 6);
    } else {
      frameHandle = window.setTimeout(cb, 80);
    }
  }

  const tick = () => {
    if (disposed) return;
    const now = performance.now();
    // Clamp unusually large frame deltas (e.g., returning from a background tab)
    const dt = clamp((now - lastTimestamp) / 1000, 0.001, 0.08);
    lastTimestamp = now;
    elapsed += dt;

    if (!contextLost) {
      applyFrame(dt);
      renderer.render(scene, camera);
    }

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameHandle = window.requestAnimationFrame(tick);
    }
  };

  // Render an immediate settled first frame so there is zero blank flash
  applyFrame(0.016);
  renderer.render(scene, camera);
  if (isSoftwareGl) {
    afterDraw(tick);
  } else {
    frameHandle = window.requestAnimationFrame(tick);
  }

  return {
    resetView: () => cameraSystem.resetCamera(false),
    dispose: () => {
      disposed = true;
      window.cancelAnimationFrame(frameHandle);
      window.clearTimeout(frameHandle);
      unsubscribeStore();
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      reducedMotionQuery.removeEventListener("change", onReducedMotionChange);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);

      cameraSystem.dispose();
      island.dispose();
      house.dispose();
      windmill.dispose();
      foliage.dispose();
      weather.dispose();
      atmosphere.dispose();
      textures.dispose();
      renderer.dispose();
    },
  };
}
