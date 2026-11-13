export interface ActivePointerRecord {
  id: number;
  startX: number;
  startY: number;
  downTimeMs: number;
  maxDistancePx: number;
}

export class PointerTapTracker {
  private active: ActivePointerRecord | null = null;
  private readonly maxMovePx: number;
  private readonly maxDurationMs: number;

  constructor(maxMovePx = 6, maxDurationMs = 450) {
    this.maxMovePx = maxMovePx;
    this.maxDurationMs = maxDurationMs;
  }

  onDown(
    id: number,
    x: number,
    y: number,
    timeMs: number,
    isPrimary: boolean,
    button: number
  ): void {
    // Multi-touch or secondary buttons cancel click eligibility
    if (!isPrimary || button !== 0 || this.active !== null) {
      this.active = null;
      return;
    }

    this.active = {
      id,
      startX: x,
      startY: y,
      downTimeMs: timeMs,
      maxDistancePx: 0,
    };
  }

  onMove(id: number, x: number, y: number): void {
    if (!this.active || this.active.id !== id) return;
    const dist = Math.hypot(x - this.active.startX, y - this.active.startY);
    if (dist > this.active.maxDistancePx) {
      this.active.maxDistancePx = dist;
    }
  }

  onUp(id: number, x: number, y: number, timeMs: number): boolean {
    if (!this.active || this.active.id !== id) {
      return false;
    }

    const record = this.active;
    this.active = null;

    const finalDist = Math.hypot(x - record.startX, y - record.startY);
    const maxDist = Math.max(record.maxDistancePx, finalDist);
    const duration = timeMs - record.downTimeMs;

    return maxDist <= this.maxMovePx && duration >= 0 && duration <= this.maxDurationMs;
  }

  onCancel(id: number): void {
    if (this.active && this.active.id === id) {
      this.active = null;
    }
  }

  clear(): void {
    this.active = null;
  }
}
