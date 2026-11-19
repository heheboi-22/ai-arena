const paths = {
  sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  rain: '<path d="M6 15a4 4 0 0 1-.5-7.9A5.6 5.6 0 0 1 16 6a4.5 4.5 0 0 1 1.5 8.8M7 17l-1 2m6-2-1 2m6-2-1 2"/>',
  weather:
    '<path d="M6 18a4 4 0 1 1 1-7.9 5 5 0 0 1 9.6.9A3.6 3.6 0 1 1 17 18H6zM16 3v1m5 1-1 1m2 4h-1M14 7a3 3 0 0 1 4 3"/>',
  wind: '<path d="M3 9h12a3 3 0 1 0-3-3M2 13h16a2.5 2.5 0 1 1-2.5 2.5M5 17h4a2 2 0 1 1-2 2"/>',
  bulb: '<path d="M8.5 16c-.2-3-3-3.7-3-7a6.5 6.5 0 0 1 13 0c0 3.3-2.8 4-3 7zm.5 3h6m-5 2h4M10 9l2 2 2-2m-2 2v5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 6.5V12l3.8 2.2"/>',
  reset: '<path d="M4 5v5h5M4.5 9a8 8 0 1 1 .6 7"/>',
  orbit:
    '<ellipse cx="12" cy="12" rx="10" ry="4.8" transform="rotate(-32 12 12)"/><circle cx="12" cy="12" r="2.6"/><path d="m17 4 3-.1-.4 3"/>',
  zoom: '<rect x="6.3" y="2.5" width="11.4" height="19" rx="5.7"/><path d="M12 6v4"/>',
  pointer: '<path d="m5 3 13 9-6 1.2-3.2 5.5z"/>',
  expand: '<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>',
  shrink: '<path d="M9 4v5H4m16 0h-5V4m0 16v-5h5M4 15h5v5"/>',
  sliders:
    '<path d="M3 7h5m4 0h9M3 17h10m4 0h4"/><circle cx="10" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
  island: '<path d="m3 14 9 4 9-4-8 8zM4 13l3-5 3 4m-1 1 5-9 5 9"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  moon: '<path d="M20 14a8.5 8.5 0 0 1-10-10A8.5 8.5 0 1 0 20 14z"/>',
  leaf: '<path d="M4 18C2 9 9 4 21 4c-.5 11-4 16-13 14m-5 4L16 9"/>',
} as const
export type IconName = keyof typeof paths
export const icon = (name: IconName) =>
  '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  paths[name] +
  '</svg>'
export const mark =
  '<svg class="brand-mark" aria-hidden="true" viewBox="0 0 50 50" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><path d="m3 28 20-9 23 9-22 11zM3 28l9 9 12 8 11-10 11-7M9 25l10-15 10 15m-7-10 5-9 12 20M16 16l3 2 3-2M7 30l17 5 17-6"/><circle cx="38" cy="10" r="3"/><path d="m4 13 1-2m27 30 2-1"/></svg>'
