import * as THREE from 'three';

/** Base radius of the floating island (before edge noise). */
export const ISLAND_RADIUS = 6.2;

/** Shared default world state — also what the Reset button restores. */
export const DEFAULTS = {
  hour: 16,
  weather: 'clear' as WeatherName,
  wind: 0.3,
  lightsOn: false,
};

export type WeatherName = 'clear' | 'rain';

export const CAMERA = {
  fov: 42,
  near: 0.1,
  far: 340,
  position: new THREE.Vector3(11.8, 7.0, 13.2),
  target: new THREE.Vector3(0, 0.4, 0),
  minDistance: 7,
  maxDistance: 28,
  minPolarAngle: 0.12,
  maxPolarAngle: 1.45,
};

/** Wind response tuning shared by windmill, trees, clouds and rain. */
export const WIND = {
  /** Blade angular speed (rad/s) at full wind. */
  bladeMaxSpeed: 3.1,
  /** How fast blades accelerate / slow down. */
  bladeSpinEase: 1.6,
  cloudSpeed: 0.85,
  /** Horizontal slant applied to falling rain at full wind. */
  rainSlant: 5.4,
};

/** Pond placement — also used by rain to spawn splash ripples. */
export const POND = { x: -2.1, z: 1.8, radius: 1.42 };

export const HOUSE = {
  position: new THREE.Vector3(1.9, 0, -1.4),
  /** Rotation so the front door faces the default camera (at +x/+z). */
  rotationY: 0.6,
};

export const WINDMILL = {
  position: new THREE.Vector3(-2.7, 0, -2.3),
  rotationY: 0.72,
};

/** Rain particle budget per quality tier. */
export const RAIN_COUNT = { high: 1500, low: 800 };

export const RIPPLE_COUNT = 18;
