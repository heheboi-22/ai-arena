# Pocket World design notes

Reading this as: an interactive diorama for curious visitors, in a handmade storybook miniature style, with dial **ENERGY 2 / RHYTHM 2 / MOTION 2**.

The brief supplied the direction: a small, inviting, slightly whimsical floating island with soft greens, warm wood, cream walls, muted water and amber window light. These notes record how that direction became concrete choices.

## The idea

Pocket World should feel like a keepsake pulled from a coat pocket, not a graphics test. The island is the hero and the interface is a small paper tag tied to it. Everything visible is built from code: sculpted terrain, procedural canvas textures, hand-laid architectural details and a fixed pool of weather particles.

## Palette

| Role | Color | Reason |
| --- | --- | --- |
| Paper | `#f3ead7` | A warm, uncoated paper tone that belongs beside cream plaster and wood rather than floating on it. |
| Ink | `#29342b` | A soft forest black for readable text without a harsh digital black. |
| Moss | `#334a39` | The active weather state and primary button fill, pulling the UI into the island's greenery. |
| Amber | `#a8611f` | The single accent. It marks live values, the lit switch and the sliders, and echoes the window light in the scene. |
| Scene greens | meadow, moss, sage | Layered grass, foliage and lichen keep the top surface from reading as one flat color. |
| Scene stone and timber | warm grey, umber, terracotta | The underside and the cottage share a warm, tactile material family. |
| Night | indigo blue | Night stays blue and readable instead of collapsing to black. |

The interface uses two core tones plus one accent. The scene has a wider natural material palette, which is the subject rather than UI chrome.

## Type

The title and the time readout use a system serif stack (Iowan Old Style, Palatino, Georgia). That gives the keepsake a storybook voice. Labels and values use the platform sans for quick scanning and small-size legibility. No remote fonts are loaded, so the app has no runtime asset dependency and no flash of missing type.

## Composition

The initial camera sits in a three-quarter view, low enough to show the floating underside and high enough to read the house, pond and windmill. The house is the focal point on the right; the pond and bench balance it on the left; the windmill gives the skyline a landmark. A curving path connects the door to the foreground. Trees frame the outer edge rather than filling the center.

The control panel is bottom-left on desktop so it sits over open sky and does not hide the focal house. On portrait screens it becomes a bottom sheet that is collapsed by default, leaving the island clear. Its opened state uses two columns so the island remains visible above it. Short landscape screens get a compact side drawer rather than a tall sheet.

## Identity motif

The dashed inner border on the paper panel suggests a stitched edge on a fabric tag. It appears once, on the panel, and is deliberately not repeated across every surface. The small hand-drawn weather icons use the same restrained line weight as the stitching.

## Motion

Motion is there to make the miniature feel alive, not to perform:

- Wind is one shared value. It drives the windmill rotor, canopy sway, cloud drift and the tilt of rain.
- Rain adds streaks, darker clouds, softened sun and expanding rings on the pond.
- Time is a continuous 24-hour palette. Light, sky, fog, exposure, stars, the moon and window glow ease between keyframes.
- The house lights are a smoothed state so the emissive pane, porch light and UI switch never snap apart.
- Reduced-motion preferences quiet the decorative parts: smoke is hidden, canopy sway is heavily reduced and cloud drift nearly stops, while rain still falls and the windmill still answers the wind control.

## UI details

- The panel uses one low elevation shadow because it floats above the scene; the scene itself carries the depth.
- Sliders use a moss track and amber fill, with a paper thumb so the control reads as a physical part of the tag.
- Weather is a two-option segmented control, not a dropdown, because both choices are equally important and can be compared at a glance.
- The house switch is a native button with `role="switch"`, so the 3D click and the UI control share one state and one accessible status.
- Focus rings are dark ink on paper. The 3D canvas uses a two-tone light and dark ring so the focus state survives both the bright sky and the night scene.

## Scene craft

The island body is a custom ring mesh with layered grass, soil and rock bands, extra crag meshes and hanging roots. The top is a radial terrain mesh with a flattened cottage pad, a pond basin and a small windmill knoll. Shared geometries and materials keep repeated trees, rocks, flowers, planks and rain drops inexpensive. The pond water is a small custom shader with fresnel, sun glints and rain noise; rain ripples are pooled ring meshes.
