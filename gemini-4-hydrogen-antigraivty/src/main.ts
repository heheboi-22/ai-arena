import './styles/main.css';
import { WorldStateStore } from './state/worldState';
import { PocketWorldScene } from './scene/PocketWorldScene';
import { createControlPanel } from './ui/ControlPanel';

function showWebGLFallback(container: HTMLElement, reason?: string): void {
  container.innerHTML = `
    <div class="webgl-fallback" role="alert">
      <div class="webgl-fallback-card">
        <h1>Pocket World</h1>
        <p>
          WebGL rendering is unavailable in this browser environment${reason ? ` (${reason})` : ''}.
          Please enable hardware acceleration or open Pocket World in a browser with WebGL support.
        </p>
      </div>
    </div>
  `;
}

function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

function bootstrap(): void {
  const sceneRoot = document.getElementById('scene-root');
  const uiRoot = document.getElementById('ui-root');
  if (!sceneRoot || !uiRoot) return;

  if (!isWebGLSupported()) {
    showWebGLFallback(sceneRoot);
    return;
  }

  const store = new WorldStateStore();
  let scene: PocketWorldScene | null = null;

  try {
    scene = new PocketWorldScene(sceneRoot, store);
  } catch (err) {
    const message = err instanceof Error ? err.message : undefined;
    showWebGLFallback(sceneRoot, message);
    return;
  }

  const panel = createControlPanel(uiRoot, store, () => {
    scene?.resetCamera();
  });

  window.addEventListener('beforeunload', () => {
    panel.destroy();
    scene?.dispose();
  });
}

bootstrap();
