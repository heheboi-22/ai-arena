import * as THREE from 'three';
import { approach, clamp01, damp, lerp, smoothstep } from '../core/math';
import type { AppState } from '../state';
import { createDayFrame, sampleDay, type DayFrame } from './daycycle';
import { Sky } from './sky';

const MOON_COLOR = new THREE.Color('#a8bcff');
// At night the key light is a high three-quarter backlight from the right,
// which is also where the crescent hangs in the opening view.
const MOON_LIGHT_DIR = new THREE.Vector3(0.43, 0.8, -0.66).normalize();
const MOON_SKY_DIR = new THREE.Vector3(-0.423, -0.178, -0.888).normalize();
const SHADOW_RANGE = 10.5;

/**
 * Eases the raw app state (time, weather, lights) and turns it into light,
 * sky and exposure. All visible change flows through `update`, so dragging a
 * slider back and forth can never queue up competing transitions.
 */
export class Environment {
  readonly sky = new Sky();
  readonly key = new THREE.DirectionalLight('#ffffff', 3);
  readonly hemi = new THREE.HemisphereLight('#ffffff', '#888888', 1);
  readonly frame: DayFrame = createDayFrame();

  /** Eased hour of day, 0..24. */
  hour = 16;
  /** Eased rain amount, 0..1. */
  rain = 0;
  /** Eased house-light amount, 0..1. */
  lights = 0;
  /** How much lit windows should stand out, 0..1. */
  glowProminence = 0;

  private rainLinear = 0;
  private readonly grey = new THREE.Color();
  private readonly tmp = new THREE.Color();

  constructor(shadowMapSize: number) {
    const s = this.key.shadow;
    this.key.castShadow = true;
    s.mapSize.set(shadowMapSize, shadowMapSize);
    s.camera.left = -SHADOW_RANGE;
    s.camera.right = SHADOW_RANGE;
    s.camera.top = SHADOW_RANGE;
    s.camera.bottom = -SHADOW_RANGE;
    s.camera.near = 1;
    s.camera.far = 70;
    s.bias = -0.0006;
    s.normalBias = 0.035;
    s.radius = 3;
    this.key.target.position.set(0, -0.5, 0);
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.sky.group, this.key, this.key.target, this.hemi);
  }

  /** Jump straight to the target state (first frame, reduced motion). */
  snap(state: Readonly<AppState>): void {
    this.hour = state.minutes / 60;
    this.rainLinear = state.weather === 'rain' ? 1 : 0;
    this.lights = state.lights ? 1 : 0;
  }

  update(dt: number, state: Readonly<AppState>, renderer: THREE.WebGLRenderer): void {
    const targetHour = state.minutes / 60;
    this.hour = damp(this.hour, targetHour, 5.5, dt);
    if (Math.abs(this.hour - targetHour) < 0.002) this.hour = targetHour;
    this.rainLinear = approach(this.rainLinear, state.weather === 'rain' ? 1 : 0, dt / 2.4);
    this.rain = smoothstep(0, 1, this.rainLinear);
    this.lights = damp(this.lights, state.lights ? 1 : 0, 9, dt);
    if (Math.abs(this.lights - (state.lights ? 1 : 0)) < 0.002) this.lights = state.lights ? 1 : 0;

    const f = sampleDay(this.hour, this.frame);
    const rain = this.rain;

    // Overcast: pull colours towards a cool grey and take the sun down.
    const overcast = (c: THREE.Color, amount: number, dim: number): void => {
      const l = c.r * 0.3 + c.g * 0.55 + c.b * 0.15;
      this.grey.setRGB(l * 0.93, l * 0.98, l * 1.06);
      c.lerp(this.grey, amount * rain).multiplyScalar(1 - dim * rain);
    };
    overcast(f.skyTop, 0.8, 0.3);
    overcast(f.skyHorizon, 0.85, 0.24);
    overcast(f.skyBottom, 0.8, 0.26);
    overcast(f.hemiSky, 0.6, 0.0);
    overcast(f.hemiGround, 0.5, 0.0);

    // Key light: the sun by day, handed over to the moon once it has set.
    // Both fade to zero around the horizon, so the swap is never visible.
    const useMoon = f.sunDir.y < -0.02;
    const keyDir = useMoon ? MOON_LIGHT_DIR : f.sunDir;
    this.key.position.copy(this.key.target.position).addScaledVector(keyDir, 34);
    if (useMoon) {
      this.key.color.copy(MOON_COLOR);
      this.key.intensity = 1.25 * f.moonUp * (1 - 0.55 * rain);
    } else {
      this.key.color.copy(f.sunColor);
      this.tmp.setRGB(0.82, 0.88, 1.0);
      this.key.color.lerp(this.tmp, 0.5 * rain);
      this.key.intensity = f.sunIntensity * f.sunUp * (1 - 0.72 * rain);
    }
    this.key.visible = this.key.intensity > 0.002;

    this.hemi.color.copy(f.hemiSky);
    this.hemi.groundColor.copy(f.hemiGround);
    this.hemi.intensity = f.hemiIntensity * (1 - 0.1 * rain);
    renderer.toneMappingExposure = f.exposure * (1 - 0.07 * rain);

    const u = this.sky.uniforms;
    u.uTop.value.copy(f.skyTop);
    u.uHorizon.value.copy(f.skyHorizon);
    u.uBottom.value.copy(f.skyBottom);
    u.uSunDir.value.copy(f.sunDir);
    u.uSunColor.value.copy(f.sunColor);
    u.uMoonDir.value.copy(MOON_SKY_DIR);
    const above = smoothstep(-0.07, 0.02, f.sunDir.y);
    u.uSun.value = above * (1 - rain);
    u.uGlow.value = smoothstep(-0.25, 0.05, f.sunDir.y) * (1 - 0.85 * rain);
    u.uMoon.value = f.moonUp * (1 - 0.9 * rain);

    // Lit windows are a quiet detail at noon and the focal point after dark.
    this.glowProminence = clamp01(Math.max(f.night, rain * 0.45 + f.night * 0.3));
  }

  /** Star opacity after weather. */
  get starOpacity(): number {
    return this.frame.stars * (1 - this.rain) * lerp(0.9, 1, this.frame.night);
  }
}
