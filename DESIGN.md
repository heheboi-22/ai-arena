# DESIGN.md - AI Arena (Model Aggregator & Comparison Console)

> Design contract. Read together with `antislop.md` (the filter) and
> `skills/antislop-ui/SKILL.md`.
>
> Rewritten 2026-09-28. The previous direction (deep navy, system blue,
> Plus Jakarta Sans, "feels like Linear / Railway / Datadog") is withdrawn: it
> named a product to clone (R-30) and its palette was the default dev-tool
> costume (R-01, R-20, R-21).

---

## 1. Product & the one decision

- **What it is**: a local console for 17 model-built frontends served through a
  single Caddy route on `:8080`.
- **The one decision the screen supports**: "which model's build do I open or
  compare next, and is it up?" Everything on screen is ordered around that. The
  roster answers "is it up"; the framed views answer "how does it look".
- **Audience**: one developer, at a desk, with 17 routes already running.
- **Not** a marketing page and **not** a dashboard: there are no stat cards, no
  charts, no invented metrics.

## 2. Design Read and dials

> Reading this as: an internal comparison console for one developer, in a warm
> editorial catalogue language, dial ENERGY 1 / RHYTHM 2 / MOTION 1.

| Dial | Level | Why |
|:--|:--:|:--|
| **ENERGY** | 1 (calm) | The energy on screen belongs to the 17 renderings inside the frames, not to the shell around them. |
| **RHYTHM** | 2 (balanced) | One shell for all three views, but the views are genuinely different shapes: a roster, two frames, four frames. |
| **MOTION** | 1 (hover only) | 120 ms to 160 ms on color, border and opacity. No loops, no pulses, no rises. Status is a solid mark, never a heartbeat animation. |

## 3. Identity: the route is the headline

Every model in this project is identified by its URI (`/space-bunny-cline/`),
and that URI is the only label that is always true across dev, local and Docker
runs. So the URI is the primary typographic element of the whole console, set in
mono wherever a model is identified: roster rows and frame headers.
Model pickers show the display name instead, because a `select` option is a
single run of text and the name is what a reader scans for there.

The second motif is the catalogue number (`№ 01` to `№ 17`) in mono, taken from
the order of `aggregator/models.json`. Together they read as an index of
specimens, which is what this page is.

Reasons, one line each (R-31):

- Route as headline: it is the real, stable identity of each model; ports change
  between local and Docker, names repeat across providers.
- Catalogue numbers: the roster is an ordered set, and a number lets you say
  "open 07" out loud.
- Warm paper ground: a neutral mat keeps attention on other people's renderings
  and refuses the dark-dev-tool default (R-21).
- Hairlines instead of cards: 17 rows are a list, not 17 objects; card fills
  would imply each model is a separate destination when the list is one surface.

## 4. Palette

Two neutrals plus one accent; status colors are functional, not decorative.

| Token | Light | Dark | Role |
|:--|:--|:--|:--|
| `--paper` | `#f8f4ed` | `#171412` | Page ground |
| `--paper-2` | `#f1eae0` | `#201c18` | Row hover, frame mat |
| `--surface` | `#fffdf9` | `#221e1a` | Raised surfaces: bars, frame chrome |
| `--ink` | `#1b1817` | `#f6f1e9` | Primary text |
| `--ink-2` | `#6b625c` | `#aaa096` | Secondary text, labels |
| `--rule` | `#e3dacd` | `#332c26` | Hairline borders |
| `--rule-2` | `#cfc3b2` | `#453c34` | Stronger rule, input borders |
| `--accent` | `#a32b3f` | `#e8828f` | One accent: active tab, focus ring, the single primary action |
| `--live` | `#2f6f4f` | `#74c194` | Route answering |
| `--dead` | `#6e6560` | `#948a80` | Route not answering |

Reasons: crimson marks the active/current thing the way a proofing mark marks a
correction, and it is deliberately not the system blue the old direction used;
it is kept to focus rings, the active tab and one primary action per screen
(R-13-style dose discipline). Green and grey are status only and never used as
decoration (R-31). Every pairing above is checked to WCAG AA in section 7.

## 5. Type

| Family | Jurisdiction | Reason |
|:--|:--|:--|
| **Fraunces** (display) | Wordmark, the three view titles, empty-state titles. Nothing else. | A warm editorial serif gives the console a voice and marks the top of the hierarchy; it is not the sans every dev tool ships (R-06, R-20). |
| **IBM Plex Sans** (UI) | All controls, labels, body, table cells. | Squared, humanist, slightly technical. Reads as a tool without borrowing Inter or the shadcn default roster (R-06). |
| **IBM Plex Mono** | Routes, ports, latency, commands, catalogue numbers. Never headings. | These are literal machine strings where character alignment matters: equal-width digits keep the latency column from jumping as it updates (R-06). |

Scale: display 22 to 27 px; UI 13 px; meta 11 px; the 10 px uppercase eyebrow
(tracking `0.14em`) is the only uppercase in the system and is reserved for
column headers and section labels. A deliberate gap between display and UI is the
editorial move: no 16 to 18 px mid-headings. Secondary text is always `--ink-2`,
never a lightened ink.

## 6. Shape, depth, motion

- Radii: `3px` for controls, `6px` for frames and mat, `999px` only for the live
  counter chip. Mixed on purpose so inputs and surfaces stay distinguishable
  (R-11).
- Borders: 1 px hairlines at `--rule`, `--rule-2` for inputs. No tinted or filled
  cards, and no left-edge color stripes.
- Depth: one shadow token, used only on the toast. Everything else is flat; the
  page has a ground plane (R-12).
- Motion: `120ms` on hover/focus color and border, `160ms` for the toast. No
  transform, no layout animation, and `prefers-reduced-motion: reduce` removes
  transitions (R-19).

## 7. Accessibility contract

- Every text token was measured against the grounds it actually sits on
  (`node` script, sRGB relative luminance, WCAG 2.x formula). Ratios below are
  against `--paper`, with the worst ground in brackets where it differs:

| Token | Light | Dark |
|:--|:--|:--|
| `--ink` | 16.10:1 | 16.31:1 |
| `--ink-2` | 5.43:1 (4.99 on `--paper-2`) | 7.14:1 (6.59 on `--paper-2`) |
| `--accent` | 6.44:1 | 7.00:1 |
| `--live` | 5.46:1 | 8.56:1 |
| `--dead` | 5.19:1 (4.76 on `--paper-2`) | 5.42:1 (5.00 on `--paper-2`) |
| Primary button (error state only): `--surface` on `--accent` | 6.95:1 | 6.32:1 |

  The first drafts of `--dead` (`#8a8079` light, `#8d837a` dark) measured 3.52:1
  and 4.46:1 and were replaced; both are recorded here because they are the kind
  of near-miss that looks fine on a bright monitor.
- Tabs are a real `tablist` with roving `tabindex` and Left/Right/Home/End keys.
- Every focusable element keeps a visible accent focus ring. `outline: none` is
  never used alone.
- Status is never color-only: the mark is paired with the word "up"/"down" and a
  latency number, so it survives greyscale. An unprobed route reads "checking"
  with a hollow mark, so unknown never reads as down.

## 8. What this console deliberately does not do

No emoji, no em dashes, no arrows on buttons, no decorative capsule badges, no
stat cards, no charts, no fake "fallback port" column (Caddy has no fallback
logic and nothing reads that field, so showing it claimed a capability that does
not exist), no latency numbers (a probe time is not a fact about the build),
no trend-stacking, no pulsing status dots, no grid/dot backgrounds.

## 9. Revision 2026-11-19: Astryx controls, React shell

The console is no longer hand-written DOM. `aggregator/` is a Vite + React app
and every control is an Astryx component (TextInput, Selector, SegmentedControl,
Button, Badge, StatusDot). What changes for the sections above:

- **Type (§5)**: Newsreader for display, Geist for UI, Geist Mono for routes,
  ports and latency. Same three roles, one size scale, still no fourth family.
- **Palette (§4)**: the paper, ink and crimson values moved into an Astryx theme
  (`aggregator/src/theme.ts`) as light/dark token pairs, so both modes are
  produced by one definition instead of two CSS blocks.
- **Shape (§6)**: controls take Astryx radii; the roster and the frame gutters
  stay square, one hairline (`1px`) between panes.
- **Layout**: the frame views remain full bleed, edge to edge, with no page
  padding and no toolbar above them. Each pane carries its own model selector
  and its reload / open icons in a 36 px header, so the rest is iframe.
- **State**: the view (`index`, `duo`, `quad`), the chosen models (`a`, `b`,
  `q1`-`q4`) and the preview width (`w`) live in the query string. A comparison
  is a link.
- **No footer chrome**: shortcut hints live in tooltips and the README, not in a
  permanent bar under the content.
- **Index chrome**: no page heading, no status filter, no result counter. The
  search field and the provider selector are the only filters; the roster itself
  is the answer.

The token table in §4 and the type table in §5 keep their intent; the shipped
values now live in `aggregator/src/theme.ts` and `aggregator/src/console.css`.
