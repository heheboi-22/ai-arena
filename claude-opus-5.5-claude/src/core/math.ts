export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

export const wrap24 = (h: number): number => ((h % 24) + 24) % 24;

/** Frame-rate independent exponential approach; `rate` is roughly 1 / time-constant. */
export function damp(current: number, target: number, rate: number, dt: number): number {
  const next = lerp(current, target, 1 - Math.exp(-rate * dt));
  return Math.abs(next - target) < 1e-4 ? target : next;
}

/** Like `damp`, but on a 24 hour circle so 23:00 -> 01:00 goes through midnight. */
export function dampHours(current: number, target: number, rate: number, dt: number): number {
  const diff = wrap24(target - current + 12) - 12;
  if (Math.abs(diff) < 1e-3) return wrap24(target);
  return wrap24(current + diff * (1 - Math.exp(-rate * dt)));
}

/** Moves toward `target` at a constant speed. Used for fades that should take a known time. */
export function approach(current: number, target: number, step: number): number {
  if (current < target) return Math.min(target, current + step);
  return Math.max(target, current - step);
}

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
