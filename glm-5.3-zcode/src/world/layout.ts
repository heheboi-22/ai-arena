/**
 * Shared scene layout. One module decides where everything sits so the island
 * geometry can carve the pond bowl and building plateaus to match the props
 * that will later stand on them.
 */

export const LAYOUT = {
  islandRadius: 7,
  islandSeed: 7,

  house: { x: -1.9, z: -1.5, rotation: 0.62 },
  pond: { x: 2.9, z: 1.9, waterRadius: 1.5, shoreRadius: 2.05, bowlRadius: 2.1, bowlDepth: 0.5 },
  windmill: { x: -4.1, z: -3.0, moundRadius: 2.2, moundHeight: 0.5 },

  trees: [
    { x: 3.4, z: -3.4, type: 'round', scale: 1.15 },
    { x: 4.6, z: -1.7, type: 'round', scale: 0.8 },
    { x: 2.2, z: -4.6, type: 'conifer', scale: 1.0 },
    { x: -4.9, z: 0.4, type: 'round', scale: 1.0 },
    { x: -3.4, z: 2.6, type: 'conifer', scale: 0.75 },
    { x: 0.6, z: 4.4, type: 'round', scale: 0.9 },
    { x: 5.0, z: 1.2, type: 'conifer', scale: 0.65 },
  ] as Array<{ x: number; z: number; type: 'round' | 'conifer'; scale: number }>,

  rocks: [
    { x: -5.4, z: -1.2, scale: 0.5 },
    { x: 1.1, z: -5.3, scale: 0.35 },
    { x: 4.9, z: 3.4, scale: 0.42 },
    { x: -0.6, z: 5.6, scale: 0.3 },
  ],

  /** Small stones drifting under the island. */
  floaters: [
    { x: 6.4, y: -2.6, z: 4.2, scale: 0.34, phase: 0.0 },
    { x: -6.6, y: -4.4, z: -2.8, scale: 0.26, phase: 2.1 },
    { x: 3.2, y: -5.4, z: -5.6, scale: 0.2, phase: 4.2 },
  ],
} as const;
