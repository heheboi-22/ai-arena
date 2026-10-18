/** A readable full-page message for when the scene cannot start, instead of a blank page. */
export function showFatal(error: unknown, reason: 'webgl' | 'other' = 'other'): void {
  document.getElementById('boot')?.remove();
  document.querySelector('.fatal')?.remove();

  const detail = error instanceof Error ? error.message : String(error ?? '');
  const wrap = document.createElement('div');
  wrap.className = 'fatal';
  wrap.setAttribute('role', 'alert');

  const card = document.createElement('div');
  card.className = 'fatal__card';

  const title = document.createElement('h1');
  title.textContent = reason === 'webgl' ? 'Pocket World cannot draw here' : 'Pocket World hit a snag';
  const lead = document.createElement('p');
  lead.textContent =
    reason === 'webgl'
      ? 'This island is drawn with WebGL, and your browser did not give us a graphics context.'
      : 'Something went wrong while building the island.';
  const hint = document.createElement('p');
  hint.textContent =
    reason === 'webgl'
      ? 'Try turning on hardware acceleration in your browser settings, updating your graphics drivers, or opening this page in a current version of Chrome, Edge, Firefox or Safari.'
      : 'Reloading the page usually fixes it. If it keeps happening, a different browser may help.';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Try again';
  retry.addEventListener('click', () => window.location.reload());

  card.append(title, lead, hint);
  if (detail) {
    const code = document.createElement('code');
    code.textContent = detail;
    card.append(code);
  }
  card.append(retry);
  wrap.append(card);
  document.body.append(wrap);
  retry.focus();
}

/** True if this browser can create a WebGL context at all. */
export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
