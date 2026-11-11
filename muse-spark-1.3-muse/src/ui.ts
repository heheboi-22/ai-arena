import { store } from "./state";

type WorldState = typeof store.state;
type SkyPhase = "day" | "dusk" | "night";

const NARROW_PX = 640;

function must<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Pocket World: missing element #${id}`);
  return el as T;
}

function formatHour(hour: number): string {
  const wrapped = ((hour % 24) + 24) % 24;
  let h = Math.floor(wrapped);
  let m = Math.round((wrapped - h) * 60);
  if (m === 60) {
    m = 0;
    h = (h + 1) % 24;
  }
  return `${h}:${String(m).padStart(2, "0")}`;
}

function periodFor(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h < 5) return "Night";
  if (h < 11) return "Morning";
  if (h < 14) return "Midday";
  if (h < 17.5) return "Afternoon";
  if (h < 19.5) return "Golden hour";
  if (h < 22) return "Evening";
  return "Night";
}

function skyFor(hour: number): SkyPhase {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 7 && h < 17) return "day";
  if ((h >= 17 && h < 20.5) || (h >= 5 && h < 7)) return "dusk";
  return "night";
}

/** Wind words for the store's 0..1 wind fraction. */
function windWord(wind: number): string {
  if (wind < 0.08) return "Calm";
  if (wind < 0.25) return "Light";
  if (wind < 0.55) return "Breezy";
  if (wind < 0.8) return "Fresh";
  return "Gusty";
}

export function bindUI(opts: { onResetView: () => void }): void {
  const panel = must<HTMLElement>("panel");
  const panelBody = must<HTMLElement>("panel-body");
  const collapseBtn = must<HTMLButtonElement>("collapse");
  const expandBtn = must<HTMLButtonElement>("expand");
  const summary = must<HTMLElement>("summary");
  const announce = must<HTMLElement>("announce");

  const timeInput = must<HTMLInputElement>("time");
  const timeLabel = must<HTMLOutputElement>("time-label");
  const windInput = must<HTMLInputElement>("wind");
  const windLabel = must<HTMLOutputElement>("wind-label");

  const clearBtn = must<HTMLButtonElement>("w-clear");
  const rainBtn = must<HTMLButtonElement>("w-rain");
  const lightsBtn = must<HTMLButtonElement>("lights");
  const lightsState = must<HTMLElement>("lights-state");
  const resetBtn = must<HTMLButtonElement>("reset");

  const root = document.documentElement;

  /* ---------- Panel open / collapsed ---------- */

  let panelOpen = window.innerWidth >= NARROW_PX;

  const applyPanelOpen = (): void => {
    panel.dataset.open = String(panelOpen);
    panelBody.hidden = !panelOpen;
    collapseBtn.setAttribute("aria-expanded", String(panelOpen));
    collapseBtn.setAttribute(
      "aria-label",
      panelOpen ? "Collapse controls" : "Expand controls",
    );
    collapseBtn.title = panelOpen ? "Collapse controls" : "Expand controls";
    expandBtn.hidden = panelOpen || window.innerWidth >= NARROW_PX;
  };

  collapseBtn.addEventListener("click", () => {
    panelOpen = !panelOpen;
    applyPanelOpen();
    if (panelOpen) timeInput.focus({ preventScroll: true });
  });

  expandBtn.addEventListener("click", () => {
    panelOpen = true;
    applyPanelOpen();
  });

  window.addEventListener("resize", applyPanelOpen);
  applyPanelOpen();

  /* ---------- Announcements (change-tracked, never on first sync) ---------- */

  let seenLights: boolean | null = null;
  let seenWeather: WorldState["weather"] | null = null;

  const say = (message: string): void => {
    announce.textContent = "";
    announce.textContent = message;
  };

  /* ---------- Store -> DOM ---------- */

  const sync = (s: WorldState): void => {
    const timeText = formatHour(s.hour);
    const timeFull = `${timeText} · ${periodFor(s.hour)}`;
    if (timeLabel.textContent !== timeFull) timeLabel.textContent = timeFull;

    const summaryText = `${timeText} · ${s.weather === "rain" ? "Rain" : "Clear"} · ${windWord(s.wind)}`;
    if (summary.textContent !== summaryText) summary.textContent = summaryText;

    if (Math.abs(Number(timeInput.value) - s.hour) > 0.001) {
      timeInput.value = String(s.hour);
    }

    const windPct = Math.round(s.wind * 100);
    const windText = `${windPct}%`;
    if (windLabel.textContent !== windText) windLabel.textContent = windText;
    if (Number(windInput.value) !== windPct) {
      windInput.value = String(windPct);
    }

    const isRain = s.weather === "rain";
    clearBtn.classList.toggle("is-active", !isRain);
    clearBtn.setAttribute("aria-pressed", String(!isRain));
    rainBtn.classList.toggle("is-active", isRain);
    rainBtn.setAttribute("aria-pressed", String(isRain));

    lightsBtn.setAttribute("aria-checked", String(s.lights));
    const lightsText = s.lights ? "On" : "Off";
    if (lightsState.textContent !== lightsText) lightsState.textContent = lightsText;

    const sky = skyFor(s.hour);
    if (root.dataset.sky !== sky) root.dataset.sky = sky;

    if (seenLights !== null && seenLights !== s.lights) {
      say(s.lights ? "House lights on" : "House lights off");
    }
    if (seenWeather !== null && seenWeather !== s.weather) {
      say(isRain ? "Weather set to rain" : "Weather set to clear");
    }
    seenLights = s.lights;
    seenWeather = s.weather;
  };

  store.on(sync);

  /* ---------- DOM -> store ---------- */

  timeInput.addEventListener("input", () => {
    const hour = Number(timeInput.value);
    if (Number.isFinite(hour) && hour !== store.state.hour) {
      store.set({ hour });
    }
  });

  windInput.addEventListener("input", () => {
    const pct = Number(windInput.value);
    if (Number.isFinite(pct) && pct / 100 !== store.state.wind) {
      store.set({ wind: pct / 100 });
    }
  });

  clearBtn.addEventListener("click", () => {
    if (store.state.weather !== "clear") store.set({ weather: "clear" });
  });

  rainBtn.addEventListener("click", () => {
    if (store.state.weather !== "rain") store.set({ weather: "rain" });
  });

  lightsBtn.addEventListener("click", () => {
    store.set({ lights: !store.state.lights });
  });

  resetBtn.addEventListener("click", () => {
    store.reset();
    opts.onResetView();
    say("Reset to 16:00, clear, wind 30%, house lights off");
  });
}
