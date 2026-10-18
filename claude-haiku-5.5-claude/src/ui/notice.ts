/** Shows a readable message in the centre of the page, used when WebGL is missing or the context is lost. */
export function showNotice(message: string): void {
  const el = document.getElementById('notice');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

export function hideNotice(): void {
  const el = document.getElementById('notice');
  if (el) el.hidden = true;
}
