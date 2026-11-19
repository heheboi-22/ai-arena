import "./styles.css";
import { WorldStateStore } from "./state/worldState";
import { createPocketWorldApp } from "./scene/PocketWorldApp";
import { createControlPanel } from "./ui/ControlPanel";

function renderFallback(container: HTMLElement, message: string): void {
  container.innerHTML = "";
  const wrap = document.createElement("main");
  wrap.className = "pw-fallback";
  wrap.setAttribute("role", "alert");

  const card = document.createElement("div");
  card.className = "pw-fallback-card";

  const title = document.createElement("h1");
  title.textContent = "Pocket World";

  const body = document.createElement("p");
  body.textContent = message;

  card.append(title, body);
  wrap.appendChild(card);
  container.appendChild(wrap);
}

function bootstrap(): void {
  const appEl = document.getElementById("app");
  const viewportEl = document.getElementById("viewport");
  const uiRootEl = document.getElementById("ui-root");

  if (!appEl || !viewportEl || !uiRootEl) {
    return;
  }

  const store = new WorldStateStore();

  try {
    const world = createPocketWorldApp({
      container: viewportEl,
      store,
    });
    const ui = createControlPanel(uiRootEl, store);

    window.addEventListener("beforeunload", () => {
      ui.dispose();
      world.dispose();
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Pocket World could not initialize the 3D scene on this device.";
    renderFallback(appEl, message);
  }
}

bootstrap();
