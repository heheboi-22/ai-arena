import './style.css';
import { startApp } from './app';

function showFatal(message?: string): void {
  const fatal = document.getElementById('fatal');
  if (!fatal) return;
  if (message) {
    const text = document.getElementById('fatal-message');
    if (text) text.textContent = message;
  }
  fatal.hidden = false;
  document.getElementById('panel')?.setAttribute('hidden', '');
}

function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
  } catch {
    return false;
  }
}

const canvas = document.getElementById('scene');
if (!(canvas instanceof HTMLCanvasElement) || !hasWebGL2()) {
  showFatal();
} else {
  try {
    startApp(canvas, showFatal);
  } catch (err) {
    console.error(err);
    showFatal('Something went wrong while building the island. Reloading the page usually helps.');
  }
}
