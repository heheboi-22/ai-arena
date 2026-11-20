import { AmbientLight, Color, DirectionalLight, HemisphereLight, Scene } from 'three'
import type { EnvironmentSample } from '../world/palette'

export interface LightingHandle {
  update(env: EnvironmentSample, rain: number): void
  sun: DirectionalLight
}

export function createLighting(scene: Scene, lowPower: boolean): LightingHandle {
  const sun = new DirectionalLight(0xffe7bc, 1.5)
  sun.position.set(-12, 20, 12)
  sun.castShadow = true
  sun.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048)
  sun.shadow.camera.left = -13
  sun.shadow.camera.right = 13
  sun.shadow.camera.top = 13
  sun.shadow.camera.bottom = -13
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 70
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.022
  sun.target.position.set(0, -0.4, 0)
  scene.add(sun, sun.target)

  const moon = new DirectionalLight(0xa9c1ec, 0)
  moon.position.set(10, 18, -12)
  scene.add(moon)

  const hemisphere = new HemisphereLight(0xb9d3e0, 0x908466, 1)
  scene.add(hemisphere)

  const ambient = new AmbientLight(0xbcd0d8, 0.42)
  scene.add(ambient)

  return {
    sun,
    update(env, rain) {
      sun.position.copy(env.sunDirection).multiplyScalar(32)
      sun.color.copy(env.sunColor)
      sun.intensity = env.sunIntensity
      moon.position.copy(env.moonDirection).multiplyScalar(28)
      moon.intensity = env.moonIntensity
      hemisphere.color.copy(env.hemiSky)
      hemisphere.groundColor.copy(env.hemiGround)
      hemisphere.intensity = env.hemiIntensity
      ambient.color.copy(env.hemiSky).lerp(new Color(0xffffff), 0.35)
      ambient.intensity = env.ambient + rain * 0.03
    },
  }
}
