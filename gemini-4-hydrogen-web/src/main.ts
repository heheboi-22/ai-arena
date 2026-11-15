import "./styles.css";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  createInitialState,
  DEFAULT_WORLD_STATE,
  type WeatherMode,
  type WorldState,
} from "./state";
import { damp } from "./util/math";
import { createProceduralTextures } from "./world/textures";
import { createIsland } from "./world/island";
import { createHouse } from "./world/house";
import { createWindmill } from "./world/windmill";
import { createPond } from "./world/pond";
import { createTrees } from "./world/trees";
import { createDetails } from "./world/details";
import { createSkyAndLighting } from "./environment/sky";
import { createClouds } from "./environment/clouds";
import { createRain } from "./environment/rain";
import { createInteractionRig } from "./interaction/controls";
import { createControlPanel } from "./ui/panel";

function detectSoftwareWebGL(): { supported: boolean; isSoftwareGl: boolean } {
  try {
    const probeCanvas = document.createElement("canvas");
    const gl =
      probeCanvas.getContext("webgl2") ||
      probeCanvas.getContext("webgl");
    if (!gl) {
      return { supported: false, isSoftwareGl: true };
    }
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return { supported: true, isSoftwareGl };
  } catch {
    return { supported: false, isSoftwareGl: true };
  }
}

function showFallback(visible: boolean) {
  const fallback = document.getElementById("webgl-fallback");
  if (fallback) {
    fallback.hidden = !visible;
  }
}

function bootstrap() {
  const mount = document.getElementById("canvas-mount");
  const hudRoot = document.getElementById("hud-root");
  if (!mount || !hudRoot) return;

  const { supported, isSoftwareGl } = detectSoftwareWebGL();
  if (!supported) {
    showFallback(true);
    return;
  }

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: "high-performance",
    });
  } catch {
    showFallback(true);
    return;
  }

  const isCompactDevice = window.innerWidth < 768 || navigator.hardwareConcurrency <= 4;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setPixelRatio(
    isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, isCompactDevice ? 1.5 : 2)
  );
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    39,
    window.innerWidth / window.innerHeight,
    0.2,
    140
  );

  // Studio PMREM reflection environment for realistic PBR water, glass, and brass
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();

  // Application state & animated derived factors
  const state: WorldState = createInitialState();
  let smoothedRainMix = 0;
  let smoothedWind = state.windStrength;
  let smoothedTimeMinutes = state.timeMinutes;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = motionQuery.matches;
  const onMotionChange = (e: MediaQueryListEvent) => {
    reducedMotion = e.matches;
  };
  motionQuery.addEventListener("change", onMotionChange);

  // Construct procedural textures, world, and atmosphere
  const textures = createProceduralTextures(renderer.capabilities.getMaxAnisotropy());
  const sky = createSkyAndLighting(scene, isSoftwareGl, isCompactDevice);
  const island = createIsland(textures);
  const house = createHouse(textures);
  const windmill = createWindmill(textures);
  const pond = createPond(textures);
  const trees = createTrees(textures);
  const details = createDetails(textures);
  const clouds = createClouds();
  const rain = createRain();

  scene.add(sky.group);
  scene.add(island.group);
  // Anchor island structures to island.group so gentle island float carries everything together
  island.group.add(house.group);
  island.group.add(windmill.group);
  island.group.add(pond.group);
  island.group.add(trees.group);
  island.group.add(details.group);
  scene.add(clouds.group);
  scene.add(rain.group);

  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  let panelController: ReturnType<typeof createControlPanel> | null = null;

  const toggleHouseLights = () => {
    state.houseLights = !state.houseLights;
    panelController?.sync(state);
  };

  const interaction = createInteractionRig(
    camera,
    renderer.domElement,
    house.interactiveMeshes,
    toggleHouseLights,
    isSoftwareGl
  );

  panelController = createControlPanel(hudRoot, state, {
    onTimeChange: (minutes: number) => {
      state.timeMinutes = minutes;
      panelController?.sync(state);
    },
    onWeatherChange: (weather: WeatherMode) => {
      state.weather = weather;
      panelController?.sync(state);
    },
    onWindChange: (strength: number) => {
      state.windStrength = strength;
      panelController?.sync(state);
    },
    onLightsToggle: toggleHouseLights,
    onReset: () => {
      state.timeMinutes = DEFAULT_WORLD_STATE.timeMinutes;
      state.weather = DEFAULT_WORLD_STATE.weather;
      state.windStrength = DEFAULT_WORLD_STATE.windStrength;
      state.houseLights = DEFAULT_WORLD_STATE.houseLights;
      interaction.triggerResetCamera(false);
      panelController?.sync(state);
    },
  });

  // Resize handling
  const onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, w < 768 ? 1.5 : 2)
    );
    renderer.setSize(w, h);
  };
  window.addEventListener("resize", onResize);

  // WebGL Context Loss handling
  let contextLost = false;
  const onContextLost = (e: Event) => {
    e.preventDefault();
    contextLost = true;
    showFallback(true);
  };
  const onContextRestored = () => {
    contextLost = false;
    showFallback(false);
  };
  renderer.domElement.addEventListener("webglcontextlost", onContextLost);
  renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);

  // Frame loop (time-based with clamped delta & software-WebGL afterDraw pacing)
  let frameId = 0;
  let lastTime = performance.now();
  let elapsed = 0;
  let disposed = false;

  function afterDraw(cb: () => void) {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync !== "function") {
      frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (disposed) return;
      const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (status === gl.UNSIGNALED) {
        frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        frameId = window.setTimeout(cb, 80);
      }
    };
    frameId = window.setTimeout(poll, 5);
  }

  function tick(now = performance.now()) {
    if (disposed) return;
    const rawDt = (now - lastTime) / 1000;
    lastTime = now;
    // Clamp unusually large frame deltas (e.g., returning from background tab)
    const dt = Math.min(0.05, Math.max(0.001, rawDt));
    elapsed += dt;

    if (!contextLost) {
      // Smoothly damp environmental parameters so rapid slider/button changes never snap
      smoothedRainMix = damp(smoothedRainMix, state.weather === "rain" ? 1 : 0, 3.8, dt);
      smoothedWind = damp(smoothedWind, state.windStrength, 5.5, dt);

      // Wrap shortest path if jumping across midnight or smooth damp normally
      const timeDiff = state.timeMinutes - smoothedTimeMinutes;
      if (Math.abs(timeDiff) > 720) {
        smoothedTimeMinutes = state.timeMinutes;
      } else {
        smoothedTimeMinutes = damp(smoothedTimeMinutes, state.timeMinutes, 8.5, dt);
      }

      const skyFactors = sky.update(
        smoothedTimeMinutes,
        smoothedRainMix,
        elapsed,
        reducedMotion
      );

      island.update(elapsed, reducedMotion);
      house.update(
        dt,
        elapsed,
        state.houseLights,
        skyFactors.nightness,
        smoothedWind,
        reducedMotion
      );
      windmill.update(dt, elapsed, smoothedWind, reducedMotion);
      pond.update(
        dt,
        elapsed,
        smoothedRainMix,
        smoothedWind,
        skyFactors.daylight,
        skyFactors.nightness,
        reducedMotion
      );
      trees.update(elapsed, smoothedWind, reducedMotion);
      details.update(
        elapsed,
        smoothedWind,
        skyFactors.nightness,
        smoothedRainMix,
        reducedMotion
      );
      clouds.update(
        dt,
        elapsed,
        smoothedWind,
        smoothedRainMix,
        skyFactors.daylight,
        skyFactors.twilight,
        skyFactors.nightness,
        reducedMotion
      );
      rain.update(
        dt,
        smoothedRainMix,
        smoothedWind,
        skyFactors.daylight,
        reducedMotion
      );

      interaction.update(dt);
      renderer.render(scene, camera);
    }

    if (isSoftwareGl) {
      afterDraw(() => tick(performance.now()));
    } else {
      frameId = requestAnimationFrame(tick);
    }
  }

  frameId = requestAnimationFrame(tick);

  window.addEventListener("beforeunload", () => {
    disposed = true;
    cancelAnimationFrame(frameId);
    clearTimeout(frameId);
    window.removeEventListener("resize", onResize);
    motionQuery.removeEventListener("change", onMotionChange);
    renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
    renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
    panelController?.dispose();
    interaction.dispose();
    sky.dispose();
    island.dispose();
    house.dispose();
    windmill.dispose();
    pond.dispose();
    trees.dispose();
    details.dispose();
    clouds.dispose();
    rain.dispose();
    textures.dispose();
    envTex.dispose();
    renderer.dispose();
  });
}

bootstrap();
