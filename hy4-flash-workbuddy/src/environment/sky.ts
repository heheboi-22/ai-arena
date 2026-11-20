import {
  AdditiveBlending,
  BackSide,
  Color,
  FogExp2,
  Mesh,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three'
import type { EnvironmentSample } from '../world/palette'
import { glowTexture, moonTexture } from '../world/textures'

export interface SkyHandle {
  update(env: EnvironmentSample, rain: number, elapsed: number): void
}

export function createSky(scene: Scene, _lowPower: boolean): SkyHandle {
  const uniforms = {
    uTop: { value: new Color(0x6d9ec2) },
    uHorizon: { value: new Color(0xe9dabd) },
    uBottom: { value: new Color(0xe0d8c1) },
    uSunDirection: { value: new Vector3(-0.5, 1, 0.5).normalize() },
    uSunColor: { value: new Color(0xffe7bc) },
    uStars: { value: 0 },
    uTime: { value: 0 },
  }
  const dome = new Mesh(
    new SphereGeometry(170, 32, 18),
    new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      uniforms,
      vertexShader: `
        varying vec3 vDirection;
        void main() {
          vDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uBottom;
        uniform vec3 uSunDirection;
        uniform vec3 uSunColor;
        uniform float uStars;
        uniform float uTime;
        varying vec3 vDirection;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec3 dir = normalize(vDirection);
          float y = dir.y;
          // The camera is tilted down to reveal the island's underside, so the
          // visible sky band sits between -0.65 and +0.1 in world direction Y.
          vec3 color = mix(uBottom, uHorizon, smoothstep(-0.95, -0.35, y));
          color = mix(color, uTop, smoothstep(-0.42, 0.14, y));
          float halo = pow(max(dot(dir, uSunDirection), 0.0), 22.0) * 0.13;
          color += uSunColor * halo;

          if (uStars > 0.01 && y > 0.0) {
            vec2 uv = vec2(atan(dir.z, dir.x) / 6.2831853 + 0.5, asin(clamp(y, -1.0, 1.0)) / 3.1415927 + 0.5);
            vec2 grid = uv * vec2(420.0, 190.0);
            vec2 cell = floor(grid);
            vec2 local = fract(grid) - 0.5;
            float seed = hash(cell);
            float dot = smoothstep(0.19, 0.02, length(local)) * step(0.991, seed);
            color += vec3(0.95, 0.97, 1.0) * dot * uStars * (0.65 + 0.35 * sin(uTime * 1.6 + seed * 40.0));
          }
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    }),
  )
  dome.frustumCulled = false
  dome.renderOrder = -10
  scene.add(dome)

  const glowMap = glowTexture()
  const sun = new Sprite(new SpriteMaterial({
    map: glowMap,
    color: 0xffe7bc,
    transparent: true,
    opacity: 0.8,
    blending: AdditiveBlending,
    depthWrite: false,
  }))
  sun.scale.setScalar(17)
  sun.renderOrder = -8
  scene.add(sun)

  const moon = new Sprite(new SpriteMaterial({
    map: moonTexture(),
    color: 0xdfe9ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  }))
  moon.scale.setScalar(13)
  moon.renderOrder = -7
  scene.add(moon)

  const fog = new FogExp2(0xcbd3c9, 0.0085)
  scene.fog = fog

  return {
    update(env, rain, elapsed) {
      ;(uniforms.uTop.value as Color).copy(env.top)
      ;(uniforms.uHorizon.value as Color).copy(env.horizon)
      ;(uniforms.uBottom.value as Color).copy(env.bottom)
      ;(uniforms.uSunDirection.value as Vector3).copy(env.sunDirection)
      ;(uniforms.uSunColor.value as Color).copy(env.sunColor)
      uniforms.uStars.value = env.stars
      uniforms.uTime.value = elapsed

      sun.position.copy(env.sunDirection).multiplyScalar(135)
      ;(sun.material as SpriteMaterial).color.copy(env.sunColor)
      ;(sun.material as SpriteMaterial).opacity = Math.max(0, Math.min(0.85, env.solarElevation * 1.1 + 0.05)) * (1 - rain * 0.7)
      sun.scale.setScalar(15 + rain * 4)

      moon.position.copy(env.moonDirection).multiplyScalar(135)
      ;(moon.material as SpriteMaterial).opacity = env.moonIntensity * (1 - rain * 0.8)
      moon.scale.setScalar(11 + env.moonIntensity * 2)

      fog.color.copy(env.fog)
      fog.density = 0.0075 + rain * 0.006
    },
  }
}
