import './style.css';

// Entry point: verify WebGL 2 is usable, then start the world.
// On failure we show the readable fallback card from index.html
// instead of a blank page.

function webgl2Available(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    return gl !== null;
  } catch {
    return false;
  }
}

const canvas = document.getElementById('scene') as HTMLCanvasElement | null;
const fallback = document.getElementById('fallback');
const panel = document.getElementById('panel');

if (!canvas || !webgl2Available()) {
  if (fallback) fallback.hidden = false;
  if (panel) panel.style.display = 'none';
  if (canvas) canvas.style.display = 'none';
} else {
  import('./app')
    .then(({ start }) => start(canvas))
    .catch(() => {
      if (fallback) fallback.hidden = false;
      if (panel) panel.style.display = 'none';
    });
}
