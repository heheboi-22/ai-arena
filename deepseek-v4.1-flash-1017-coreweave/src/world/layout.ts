import { POND, terrainHeight } from './terrain';

export const HOUSE = {
  x: -1.5,
  z: -0.2,
  rotation: 0.46,
  doorLocalX: 0.28,
  doorLocalZ: 0.76
};

export const houseDoorWorld = (): { x: number; z: number } => {
  const cos = Math.cos(HOUSE.rotation);
  const sin = Math.sin(HOUSE.rotation);
  return {
    x: HOUSE.x + HOUSE.doorLocalX * cos + HOUSE.doorLocalZ * sin,
    z: HOUSE.z - HOUSE.doorLocalX * sin + HOUSE.doorLocalZ * cos
  };
};

export const WINDMILL = {
  x: 3.0,
  z: -2.3,
  rotation: 0.36
};

export type TreeKind = 'oak' | 'conifer' | 'birch' | 'sapling';

export interface TreeSpec {
  kind: TreeKind;
  x: number;
  z: number;
  scale: number;
  phase: number;
}

export const TREES: TreeSpec[] = [
  { kind: 'oak', x: -4.2, z: -0.5, scale: 1.35, phase: 0.4 },
  { kind: 'conifer', x: 0.48, z: -3.28, scale: 0.82, phase: 2.1 },
  { kind: 'birch', x: 4.25, z: 2.3, scale: 0.8, phase: 4.4 },
  { kind: 'sapling', x: -2.72, z: 1.92, scale: 0.68, phase: 1.2 }
];

export const PATH_POINTS = (() => {
  const door = houseDoorWorld();
  return [
    { x: door.x + 0.05, z: door.z + 0.6 },
    { x: -1.28, z: 1.85 },
    { x: -1.06, z: 2.62 },
    { x: -0.82, z: 3.55 },
    { x: -0.7, z: 3.92 }
  ];
})();

export const FLOWER_CLUSTERS = [
  { x: -2.5, z: 1.25, radius: 0.42, count: 16 },
  { x: -1.72, z: 2.35, radius: 0.32, count: 10 },
  { x: 2.95, z: 0.25, radius: 0.36, count: 12 },
  { x: -3.12, z: 0.62, radius: 0.36, count: 9 },
  { x: -0.12, z: -1.62, radius: 0.34, count: 8 },
  { x: 3.25, z: 2.7, radius: 0.34, count: 10 },
  { x: -1.82, z: 3.3, radius: 0.28, count: 8 }
];

export const ROCK_SPOTS = [
  { x: 0.42, z: 0.55, scale: 0.23 },
  { x: 2.56, z: 2.14, scale: 0.3 },
  { x: 1.02, z: 2.28, scale: 0.17 },
  { x: 3.72, z: -1.18, scale: 0.26 },
  { x: -4.1, z: 0.62, scale: 0.3 },
  { x: -3.12, z: -3.02, scale: 0.36 },
  { x: 4.04, z: 1.92, scale: 0.2 }
];

export const FENCE = {
  radius: 4.14,
  fromAngle: (122 * Math.PI) / 180,
  toAngle: (159 * Math.PI) / 180,
  posts: 7
};

export const BOAT = {
  x: POND.x - 0.72,
  z: POND.z + 0.42,
  rotation: 0.7
};

export const houseGround = terrainHeight(HOUSE.x, HOUSE.z);
export const windmillGround = terrainHeight(WINDMILL.x, WINDMILL.z);
