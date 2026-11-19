export interface Model {
  id: string;
  name: string;
  port: number;
  fallbackPort: number | null;
  path: string;
  tag: string;
  color: string;
}

export interface Telemetry {
  up: boolean;
  status: number;
}

export type LoadState = "loading" | "ready" | "error";

export interface Filters {
  q: string;
  tag: string;
  status: "ALL" | "UP" | "DOWN";
}

export type FrameWidth = "desktop" | "tablet" | "mobile";

export const MODELS_URL = "/models.json";
export const PROBE_TIMEOUT = 2500;
export const HEARTBEAT = 10000;

export async function fetchModels(): Promise<Model[]> {
  const res = await fetch(MODELS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error("expected a JSON array");
  return data as Model[];
}

/** One route probe. A timeout counts as down, which is what the old page did. */
export async function probe(model: Model): Promise<Telemetry> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT);
  let up = false;
  let status = 0;
  try {
    const res = await fetch(model.path, {
      headers: { "Cache-Control": "no-cache" },
      signal: controller.signal,
    });
    up = res.ok || res.status === 304;
    status = res.status;
  } catch {
    status = 0;
  } finally {
    clearTimeout(timer);
  }
  return { up, status };
}

export function isTyping(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  const tag = target?.tagName;
  return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || target?.isContentEditable === true;
}
