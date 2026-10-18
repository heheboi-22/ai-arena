import * as THREE from 'three';
import type { Quality } from '../util/quality';
import type { Environment } from './environment';
import { Sky } from './sky';

const FOCUS = new THREE.Vector3(0, -1.2, 0);
const WHITE = new THREE.Color(1, 1, 1);

/**
 * Owns the sky and every light that is not part of a prop, and pushes an
 * `Environment` onto them each frame.
 *
 *  - key:    sun by day, moon at night; the only shadow caster
 *  - fill:   a cool light from the other side so shadows keep some colour
 *  - bounce: a soft light from below, standing in for sky light bouncing off
 *            the cloud floor, which is what keeps the rocky underside readable
 *  - hemi:   sky/ground ambient
 */
export class Atmosphere {
  readonly sky = new Sky();
  readonly key: THREE.DirectionalLight;
  readonly fill: THREE.DirectionalLight;
  readonly bounce: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly fog: THREE.Fog;

  private readonly tmp = new THREE.Vector3();

  constructor(scene: THREE.Scene, quality: Quality) {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
    this.key = new THREE.DirectionalLight(0xffffff, 1);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    const cam = this.key.shadow.camera;
    cam.left = -8;
    cam.right = 8;
    cam.top = 8;
    cam.bottom = -8;
    cam.near = 2;
    cam.far = 52;
    this.key.shadow.bias = -0.0003;
    this.key.shadow.normalBias = 0.035;
    this.key.target.position.copy(FOCUS);

    this.fill = new THREE.DirectionalLight(0xffffff, 0.3);
    this.bounce = new THREE.DirectionalLight(0xffffff, 0.5);
    this.bounce.target.position.copy(FOCUS);
    this.fill.target.position.copy(FOCUS);

    this.fog = new THREE.Fog(0xffffff, 40, 130);
    scene.fog = this.fog;
    scene.add(this.sky.mesh, this.sky.moon, this.hemi, this.key, this.key.target, this.fill, this.fill.target, this.bounce, this.bounce.target);
  }

  apply(env: Environment, renderer: THREE.WebGLRenderer, camera: THREE.Camera, time: number): void {
    this.sky.update(env, camera, time);

    this.key.position.copy(FOCUS).addScaledVector(env.keyDir, 26);
    this.key.color.copy(env.keyColor);
    this.key.intensity = env.keyIntensity;
    this.key.shadow.intensity = env.keyShadow;

    this.tmp.set(-env.keyDir.x, 0.0, -env.keyDir.z).normalize().multiplyScalar(0.94);
    this.tmp.y = 0.34;
    this.fill.position.copy(FOCUS).addScaledVector(this.tmp.normalize(), 20);
    this.fill.color.copy(env.fillColor);
    this.fill.intensity = env.fillIntensity;

    this.bounce.position.set(FOCUS.x + 3, FOCUS.y - 20, FOCUS.z + 7);
    this.bounce.color.copy(env.skyBottom).lerp(WHITE, 0.35);
    this.bounce.intensity = 0.8 + 0.15 * env.daylight;

    this.hemi.color.copy(env.hemiSky);
    this.hemi.groundColor.copy(env.hemiGround);
    this.hemi.intensity = env.hemiIntensity;

    this.fog.color.copy(env.skyBottom);
    renderer.toneMappingExposure = env.exposure;
  }

  dispose(): void {
    this.sky.dispose();
    this.key.shadow.map?.dispose();
  }
}
