# Verification

## Build

- `npm run typecheck`: passed.
- Final `npm run build`: passed, including TypeScript checking.
- Production output was opened with Vite preview on port 5121. Rain, keyboard light toggle, full wind, and reset worked in that build, with no application errors in the browser console.
- Vite reports a bundle size advisory: the main JavaScript bundle, including Three.js, is about 622 kB minified and 160 kB gzipped. This is an advisory rather than a build failure.

## Interaction checks actually performed

| Check | Result |
| --- | --- |
| Default rendering | Island, cottage, windmill, pond, trees, and rocky underside rendered with 16:00, Clear, 30% wind, and lights off. |
| Time | Home/End keyboard controls and slider changes updated the label. Measured lighting changed between midnight, noon, and sunset. Default, sunset, and rainy night screenshots were inspected. |
| House lights | Clicking the projected house position updated both scene state and the UI switch. Space on the UI switch updated the same state. Illuminated windows and warm lighting were visually inspected at night. |
| Drag discrimination | A 90 px orbit drag starting on the house changed the camera without toggling the lights. |
| Camera | Mouse wheel, arrow keys, and plus key moved the camera; its distance remained within the configured limits. |
| Rain | Three complete Rain/Clear cycles settled correctly. Rain and ripple pool counts stayed constant. Rainy night rendering showed drops and pond ripples. |
| Wind | At zero, windmill and cloud movement became negligible, tree sway diminished, and rain remained vertical. At full strength, the rotor, trees, clouds, and slanted rain changed together. |
| Rapid changes | 35 successive changes to time, wind, and weather settled to the final chosen state without competing transitions. |
| Reset | Camera coordinates returned to their defaults. Time, weather, wind, lights, rain intensity, and emissive windows returned consistently. |
| Mobile panel | Hide/Show controls changed the scene height. Escape collapsed the panel. Controls remained reachable below the scene. |
| Initialization failure | A browser unable to create WebGL displayed the explanatory fallback and reload button instead of a blank scene. |
| Console | No application errors were recorded during successful development and production browser runs. |

Final responsive layout measurements were taken in the Codex browser at 320×720, 390×844, 640×900, 820×820, 1024×768, 844×390, and 1920×1080. There was no horizontal overflow. The mobile panel started at the bottom of the scene without overlap. Short desktop windows kept the panel within the viewport and allowed scrolling its controls. At 320×720 the page scrolls vertically to preserve a 310 px scene and usable controls.

Final screenshots of the default production view, rainy night, mobile layout, and collapsed mobile panel were inspected in the live browser. Local captures are in `.check/live-default.jpg`, `.check/live-night.jpg`, `.check/live-mobile.jpg`, and `.check/live-mobile-collapsed.jpg`; `.check/` is ignored by Git.

## Limits of verification

Physical touchscreen devices and other browser engines were not tested. One-finger orbit, two-finger dolly/orbit, multi-pointer click suppression, and reduced-motion handling were inspected in code. A physical pinch gesture and an OS-level reduced-motion preference change were not exercised.

Rain and water are stylized approximations. Rain collision uses a fixed sampled surface map, so it follows initial tree canopy shapes rather than their small animated sway. The app requires WebGL 2 and a working graphics driver.

## Container

`docker compose up -d --build` succeeded after registering the application in the Docker build, dashboard, and Caddy routes. Container `ai-arena-arena-1` is healthy. Caddy and all 19 model servers report RUNNING, including `static-gpt-6.1-sol-codex` on internal port 5119.

All 19 model routes returned HTTP 200. Pocket World's JavaScript and CSS assets returned HTTP 200 under `/gpt-6.1-sol-codex/`, and the path without a trailing slash redirected correctly. Caddy configuration validation passed. The container-served application was opened in the browser and rendered without application console errors.

Resize callbacks now defer DOM writes to animation frames. Eight viewport changes and panel collapse/expansion were repeated after this fix; the browser console and Vite's forwarded error log contained no resize-loop errors. The container image was rebuilt with the fix.
