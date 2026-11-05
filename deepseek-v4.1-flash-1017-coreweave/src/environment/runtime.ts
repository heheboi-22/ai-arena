import * as THREE from 'three';
import type { WorldState } from '../state';
import { damp, shortestHourDelta, wrap24 } from '../utils/math';

export interface SmoothedState {
  hour: number;
  rain: number;
  wind: number;
  lights: number;
}

export interface SceneContext {
  time: number;
  delta: number;
  hour: number;
  rain: number;
  wind: number;
  houseLights: number;
  night: number;
  reducedMotion: boolean;
  lightDirection: THREE.Vector3;
  lightColor: THREE.Color;
}

export class SceneRuntime {
  private hour: number;
  private rain: number;
  private wind: number;
  private lights: number;
  private elapsed = 0;

  constructor(initial: Readonly<WorldState>) {
    this.hour = initial.hour;
    this.rain = initial.weather === 'rain' ? 1 : 0;
    this.wind = initial.wind;
    this.lights = initial.houseLights ? 1 : 0;
  }

  update(target: Readonly<WorldState>, dt: number): SmoothedState {
    this.elapsed += dt;
    const hourDelta = shortestHourDelta(this.hour, target.hour);
    this.hour = wrap24(this.hour + hourDelta * (1 - Math.exp(-4.4 * dt)));
    this.rain = damp(this.rain, target.weather === 'rain' ? 1 : 0, 1.7, dt);
    this.wind = damp(this.wind, target.wind, 3.6, dt);
    this.lights = damp(this.lights, target.houseLights ? 1 : 0, 5.2, dt);
    return { hour: this.hour, rain: this.rain, wind: this.wind, lights: this.lights };
  }

  get time(): number {
    return this.elapsed;
  }

}
