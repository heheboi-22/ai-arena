import {
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Scene,
  Vector3,
  type Texture,
} from 'three';
import { damp, dampAngle, smoothstep } from '../lib/noise';
import { DEFAULT_STATE, type WorldState } from '../state';
import { Sky } from './sky';
import {
  createTimeSample,
  daylightAt,
  sampleTime,
  sunDirectionAt,
  type TimeSample,
} from './timeOfDay';

export interface EnvironmentFrame {
  time: number;
  daylight: number;
  night: number;
  rain: number;
  wind: number;
  lights: number;
  stars: number;
  exposure: number;
  sunDirection: Vector3;
  moonDirection: Vector3;
  lightDirection: Vector3;
  lightColor: Color;
  skyTop: Color;
  skyHorizon: Color;
  cloudColor: Color;
  fogColor: Color;
  hemiSky: Color;
  hemiGround: Color;
  hemiIntensity: number;
  ambientIntensity: number;
  lightIntensity: number;
}

const MOON_COLOR = new Color('#a7bad9');
const RAIN_TOP = new Color('#65747b');
const RAIN_HORIZON = new Color('#9ba6a4');
const RAIN_CLOUD = new Color('#6f787d');
const RAIN_FOG = new Color('#8a9494');
const RAIN_LIGHT = new Color('#cfd9da');

function makeFrame(): EnvironmentFrame {
  return {
    time: DEFAULT_STATE.time,
    daylight: 1,
    night: 0,
    rain: 0,
    wind: DEFAULT_STATE.wind,
    lights: 0,
    stars: 0,
    exposure: 1,
    sunDirection: new Vector3(0.3, 0.8, -0.4),
    moonDirection: new Vector3(-0.3, -0.8, 0.4),
    lightDirection: new Vector3(0.3, 0.8, -0.4),
    lightColor: new Color(),
    skyTop: new Color(),
    skyHorizon: new Color(),
    cloudColor: new Color(),
    fogColor: new Color(),
    hemiSky: new Color(),
    hemiGround: new Color(),
    hemiIntensity: 1,
    ambientIntensity: 0.3,
    lightIntensity: 3,
  };
}

export class Environment {
  readonly frame: EnvironmentFrame = makeFrame();
  readonly sky: Sky;
  private readonly sample: TimeSample = createTimeSample();
  private readonly sun: DirectionalLight;
  private readonly hemi: HemisphereLight;
  private readonly ambient: AmbientLight;
  private readonly fill: DirectionalLight;
  private readonly frontFill: DirectionalLight;
  private readonly fog: FogExp2;
  private readonly scene: Scene;
  private readonly skyTopTint = new Color();
  private readonly skyHorizonTint = new Color();
  private readonly cloudTint = new Color();
  private readonly fogTint = new Color();

  private currentHour = DEFAULT_STATE.time;
  private currentRain = 0;
  private currentWind = DEFAULT_STATE.wind;
  private currentLights = 0;

  constructor(scene: Scene, softDot: Texture, moonTexture: Texture, quality: 'high' | 'low') {
    this.scene = scene;
    this.sky = new Sky(softDot, moonTexture);
    scene.add(this.sky.group);

    this.fog = new FogExp2('#d8d5c1', 0.0055);
    scene.fog = this.fog;

    this.sun = new DirectionalLight('#ffe4b8', 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
    this.sun.shadow.camera.left = -9;
    this.sun.shadow.camera.right = 9;
    this.sun.shadow.camera.top = 9;
    this.sun.shadow.camera.bottom = -9;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 46;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.022;
    this.sun.target.position.set(0, 0, 0);
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new HemisphereLight('#d7e6e1', '#74805a', 1);
    scene.add(this.hemi);

    this.ambient = new AmbientLight('#b9c6c0', 0.3);
    scene.add(this.ambient);

    // A faint cool bounce from below keeps the rocky underside legible at night.
    this.fill = new DirectionalLight('#9fb6d6', 0.1);
    this.fill.position.set(-7, -4, 6);
    scene.add(this.fill);

    // A soft, shadowless fill from the viewer's side keeps the house facade and
    // the shaded side of the island readable without flattening the sun.
    this.frontFill = new DirectionalLight('#ffe8cd', 0.4);
    this.frontFill.position.set(7, 4.5, 9);
    scene.add(this.frontFill);
  }

  get hour(): number {
    return this.currentHour;
  }

  get rainAmount(): number {
    return this.currentRain;
  }

  /** Used by Reset: put every transition at its target without a long fade. */
  snapTo(state: Readonly<WorldState>): void {
    this.currentHour = state.time;
    this.currentRain = state.weather === 'rain' ? 1 : 0;
    this.currentWind = state.wind;
    this.currentLights = state.houseLights ? 1 : 0;
    this.update(0.0001, state);
  }

  update(dt: number, state: Readonly<WorldState>): EnvironmentFrame {
    this.currentHour = dampAngle(this.currentHour, state.time, 5.5, dt);
    this.currentRain = damp(this.currentRain, state.weather === 'rain' ? 1 : 0, 1.45, dt);
    this.currentWind = damp(this.currentWind, state.wind, 4.2, dt);
    this.currentLights = damp(this.currentLights, state.houseLights ? 1 : 0, 10, dt);

    const frame = this.frame;
    const sample = sampleTime(this.currentHour, this.sample);
    const rain = this.currentRain;
    const daylight = daylightAt(this.currentHour);
    const night = 1 - daylight;

    frame.time = this.currentHour;
    frame.daylight = daylight;
    frame.night = night;
    frame.rain = rain;
    frame.wind = this.currentWind;
    frame.lights = this.currentLights;
    frame.stars = sample.stars;

    sunDirectionAt(this.currentHour, frame.sunDirection);
    frame.moonDirection.copy(frame.sunDirection).negate();

    const moonBlend = smoothstep(0.4, 0.88, night);
    frame.lightDirection.copy(frame.sunDirection).lerp(frame.moonDirection, moonBlend);
    if (frame.lightDirection.y < 0.08) frame.lightDirection.y = 0.08;
    frame.lightDirection.normalize();

    // Sky and fog pick up a grey, water-washed cast while it rains.
    this.skyTopTint.copy(RAIN_TOP).multiplyScalar(0.4 + daylight * 0.6);
    this.skyHorizonTint.copy(RAIN_HORIZON).multiplyScalar(0.35 + daylight * 0.65);
    this.cloudTint.copy(RAIN_CLOUD).multiplyScalar(0.32 + daylight * 0.68);
    this.fogTint.copy(RAIN_FOG).multiplyScalar(0.3 + daylight * 0.7);

    frame.skyTop.copy(sample.skyTop).lerp(this.skyTopTint, rain * 0.55);
    frame.skyHorizon.copy(sample.skyHorizon).lerp(this.skyHorizonTint, rain * 0.5);
    frame.fogColor.copy(sample.fogColor).lerp(this.fogTint, rain * 0.55);
    frame.cloudColor.copy(sample.cloudColor).lerp(this.cloudTint, rain * 0.72);
    frame.hemiSky.copy(sample.hemiSky);
    frame.hemiGround.copy(sample.hemiGround);
    frame.lightColor.copy(sample.lightColor).lerp(RAIN_LIGHT, rain * 0.4).lerp(MOON_COLOR, moonBlend * 0.82);

    frame.lightIntensity = sample.lightIntensity * (1 - rain * 0.58);
    frame.hemiIntensity = sample.hemiIntensity * (1 - rain * 0.16);
    frame.ambientIntensity = sample.ambientIntensity * (1 - rain * 0.04);
    frame.exposure = sample.exposure * (1 - rain * 0.045) * (1 + night * 0.03);

    this.sun.color.copy(frame.lightColor);
    this.sun.intensity = frame.lightIntensity;
    this.sun.position.copy(frame.lightDirection).multiplyScalar(24);
    this.sun.position.y = Math.max(this.sun.position.y, 1.5);
    this.sun.target.updateMatrixWorld();

    this.hemi.color.copy(frame.hemiSky);
    this.hemi.groundColor.copy(frame.hemiGround);
    this.hemi.intensity = frame.hemiIntensity;

    this.ambient.color.copy(frame.hemiSky);
    this.ambient.intensity = frame.ambientIntensity;

    this.fill.intensity = (0.2 + night * 0.3) * (1 - rain * 0.25);
    this.frontFill.intensity = 0.2 + daylight * 0.45;
    this.frontFill.color.copy(frame.lightColor).lerp(MOON_COLOR, night * 0.4);

    this.fog.color.copy(frame.fogColor);
    this.fog.density = 0.0048 + rain * 0.012;
    this.scene.fog = this.fog;

    frame.stars = Math.max(sample.stars, night * 0.9);
    this.sky.update(frame);
    return frame;
  }
}
