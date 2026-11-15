import * as THREE from 'three';
import { CelestialFactors, computeCelestialState, clamp } from '../state';
import { ProceduralTextureSet } from '../world/textures';

export interface SkyEnvironmentSystem {
  group: THREE.Group;
  keyLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  rimLight: THREE.DirectionalLight;
  update: (
    elapsed: number,
    timeHours: number,
    rainFactor: number,
    scene: THREE.Scene,
  ) => CelestialFactors;
}

export function createSkyEnvironment(
  textures: ProceduralTextureSet,
  enableShadows: boolean,
): SkyEnvironmentSystem {
  const group = new THREE.Group();
  group.name = 'SkyEnvironment';

  // 1. Custom GLSL Sky Dome Shader
  const skyUniforms = {
    uZenithColor: { value: new THREE.Color('#2d6ec4') },
    uHorizonColor: { value: new THREE.Color('#9bd1f5') },
    uNadirColor: { value: new THREE.Color('#3b5c7a') },
    uSunColor: { value: new THREE.Color('#ffe6a3') },
    uSunDir: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
    uSunHaloStrength: { value: 0.65 },
  };

  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uZenithColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uNadirColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uSunHaloStrength;
      varying vec3 vWorldDir;

      void main() {
        vec3 dir = normalize(vWorldDir);
        float y = dir.y;

        // Smooth blend from horizon (y=0) to zenith (y=1) and nadir (y=-1)
        float upperT = pow(clamp(y, 0.0, 1.0), 0.58);
        float lowerT = pow(clamp(-y, 0.0, 1.0), 0.65);

        vec3 col = mix(uHorizonColor, uZenithColor, upperT);
        col = mix(col, uNadirColor, lowerT);

        // Subtle atmospheric horizon band
        float horizonGlow = exp(-abs(y) * 5.5) * 0.16;
        col += uHorizonColor * horizonGlow;

        // Solar glow halo around sun direction
        float sunDot = max(0.0, dot(dir, normalize(uSunDir)));
        float halo = pow(sunDot, 10.0) * 0.28 + pow(sunDot, 64.0) * 0.45;
        col += uSunColor * halo * uSunHaloStrength;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(88, 32, 24), skyMat);
  group.add(skyDome);

  // 2. Orbiting Sun & Moon + Soft Glow Sprites
  const sunGroup = new THREE.Group();
  const sunMat = new THREE.MeshBasicMaterial({ color: '#fff5cc' });
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(2.1, 16, 16), sunMat);
  sunGroup.add(sunDisc);

  const sunSpriteMat = new THREE.SpriteMaterial({
    map: textures.softGlow,
    color: '#ffcf75',
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sunSprite = new THREE.Sprite(sunSpriteMat);
  sunSprite.scale.set(14, 14, 1);
  sunGroup.add(sunSprite);
  group.add(sunGroup);

  const moonGroup = new THREE.Group();
  const moonMat = new THREE.MeshBasicMaterial({ color: '#e8f1ff' });
  const moonDisc = new THREE.Mesh(new THREE.SphereGeometry(1.55, 16, 16), moonMat);
  moonGroup.add(moonDisc);

  const moonSpriteMat = new THREE.SpriteMaterial({
    map: textures.softGlow,
    color: '#9ec4ff',
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const moonSprite = new THREE.Sprite(moonSpriteMat);
  moonSprite.scale.set(9.5, 9.5, 1);
  moonGroup.add(moonSprite);
  group.add(moonGroup);

  // 3. 3D Starfield Dome (visible at night, dims in rain)
  const starCount = 260;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = (i * 2.39996) % (Math.PI * 2);
    const u = ((i * 0.618034) % 0.82) + 0.12; // Keep stars above horizon (y > 0.12)
    const r = Math.sqrt(Math.max(0, 1 - u * u));
    const rad = 76;
    starPositions[i * 3] = Math.cos(theta) * r * rad;
    starPositions[i * 3 + 1] = u * rad;
    starPositions[i * 3 + 2] = Math.sin(theta) * r * rad;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: '#eef5ff',
    size: 0.55,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const starField = new THREE.Points(starGeo, starMat);
  group.add(starField);

  // 4. Studio 3-Light Rig (Key Sun/Moon Light + Sky/Ground HemiLight + Underside Rim Light)
  const keyLight = new THREE.DirectionalLight('#fff2d6', 2.2);
  keyLight.position.set(12, 16, 10);
  keyLight.castShadow = enableShadows;
  if (enableShadows) {
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 42;
    const d = 10.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
  }
  group.add(keyLight);

  const hemiLight = new THREE.HemisphereLight('#a8dcff', '#5f7350', 0.95);
  group.add(hemiLight);

  // Underside & silhouette rim light so the sculpted floating island underside always pops
  const rimLight = new THREE.DirectionalLight('#7aa8d6', 0.62);
  rimLight.position.set(-12, -9, -11);
  group.add(rimLight);

  // Color Palettes for Smooth 24-Hour Interpolation
  const palettes = {
    dayZenith: new THREE.Color('#2c73d2'),
    dayHorizon: new THREE.Color('#a8dcf7'),
    dayNadir: new THREE.Color('#4a6e8a'),

    sunsetZenith: new THREE.Color('#3b3d7a'),
    sunsetHorizon: new THREE.Color('#f2855e'),
    sunsetNadir: new THREE.Color('#3a3552'),

    nightZenith: new THREE.Color('#0c1528'),
    nightHorizon: new THREE.Color('#1d3152'),
    nightNadir: new THREE.Color('#09101f'),

    rainZenith: new THREE.Color('#3c4d5e'),
    rainHorizon: new THREE.Color('#6a7d8c'),
    rainNadir: new THREE.Color('#2b3845'),
  };

  const sunDayCol = new THREE.Color('#fff4d8');
  const sunSunsetCol = new THREE.Color('#ff8e47');
  const moonNightCol = new THREE.Color('#8cb8ff');
  const rainLightCol = new THREE.Color('#9db4c9');

  const hemiSkyDay = new THREE.Color('#a6dcff');
  const hemiSkySunset = new THREE.Color('#e89c7d');
  const hemiSkyNight = new THREE.Color('#3a5b8c');

  const hemiGroundDay = new THREE.Color('#5d704e');
  const hemiGroundSunset = new THREE.Color('#4f423c');
  const hemiGroundNight = new THREE.Color('#243044');

  const zenith = new THREE.Color();
  const horizon = new THREE.Color();
  const nadir = new THREE.Color();
  const keyColor = new THREE.Color();

  return {
    group,
    keyLight,
    hemiLight,
    rimLight,
    update: (elapsed: number, timeHours: number, rainFactor: number, scene: THREE.Scene) => {
      const celestial = computeCelestialState(timeHours);
      const { sunDir, moonDir, daylight, twilight, nightness } = celestial;

      // Sky gradient blend: Day -> Twilight (Dawn/Sunset) -> Night -> Rain overcast
      zenith
        .copy(palettes.nightZenith)
        .lerp(palettes.dayZenith, daylight)
        .lerp(palettes.sunsetZenith, twilight * 0.78);
      horizon
        .copy(palettes.nightHorizon)
        .lerp(palettes.dayHorizon, daylight)
        .lerp(palettes.sunsetHorizon, twilight * 0.92);
      nadir
        .copy(palettes.nightNadir)
        .lerp(palettes.dayNadir, daylight)
        .lerp(palettes.sunsetNadir, twilight * 0.72);

      // Overcast storm shift when raining
      const rainDarken = 1 - nightness * 0.55;
      const rainZenithTarget = palettes.rainZenith.clone().multiplyScalar(rainDarken);
      const rainHorizonTarget = palettes.rainHorizon.clone().multiplyScalar(rainDarken);
      const rainNadirTarget = palettes.rainNadir.clone().multiplyScalar(rainDarken);

      zenith.lerp(rainZenithTarget, rainFactor * 0.78);
      horizon.lerp(rainHorizonTarget, rainFactor * 0.82);
      nadir.lerp(rainNadirTarget, rainFactor * 0.78);

      skyUniforms.uZenithColor.value.copy(zenith);
      skyUniforms.uHorizonColor.value.copy(horizon);
      skyUniforms.uNadirColor.value.copy(nadir);
      skyUniforms.uSunDir.value.set(sunDir[0], sunDir[1], sunDir[2]);
      skyUniforms.uSunColor.value.copy(sunDayCol).lerp(sunSunsetCol, twilight * 0.9);
      skyUniforms.uSunHaloStrength.value =
        clamp(daylight * 0.7 + twilight * 1.1, 0, 1.2) * (1 - rainFactor * 0.85);

      // Keep scene fog matched to horizon so distant clouds/edges blend seamlessly
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(horizon);
        scene.fog.density = 0.0065 + rainFactor * 0.0085;
      }

      // Position Sun & Moon on sky dome
      const orbitR = 66;
      sunGroup.position.set(sunDir[0] * orbitR, sunDir[1] * orbitR, sunDir[2] * orbitR);
      const sunAlpha = clamp((sunDir[1] + 0.12) / 0.25, 0, 1) * (1 - rainFactor * 0.88);
      sunGroup.visible = sunAlpha > 0.02;
      sunSpriteMat.opacity = sunAlpha * 0.75;
      sunMat.color.copy(sunDayCol).lerp(sunSunsetCol, twilight * 0.85);

      moonGroup.position.set(moonDir[0] * orbitR, moonDir[1] * orbitR, moonDir[2] * orbitR);
      const moonAlpha = nightness * (1 - rainFactor * 0.82);
      moonGroup.visible = moonAlpha > 0.02;
      moonSpriteMat.opacity = moonAlpha * 0.55;

      // Twinkling night stars
      starMat.opacity = nightness * (1 - rainFactor * 0.92) * (0.78 + Math.sin(elapsed * 1.9) * 0.14);
      starField.rotation.y = elapsed * 0.004;

      // Scale IBL environment intensity by time of day so RoomEnvironment never washes out nighttime
      if ('environmentIntensity' in scene) {
        (scene as THREE.Scene & { environmentIntensity: number }).environmentIntensity =
          (0.05 + daylight * 0.42 + twilight * 0.22) * (1 - rainFactor * 0.45);
      }

      // Key Directional Light smoothly transitions from Sun (Day/Sunset) to Moon (Night)
      const lightDist = 20;
      const activeDirX = THREE.MathUtils.lerp(sunDir[0], moonDir[0], nightness);
      const activeDirY = Math.max(0.28, THREE.MathUtils.lerp(Math.max(0.24, sunDir[1]), moonDir[1], nightness));
      const activeDirZ = THREE.MathUtils.lerp(sunDir[2], moonDir[2], nightness);
      keyLight.position.set(activeDirX * lightDist, activeDirY * lightDist, activeDirZ * lightDist);

      keyColor
        .copy(sunDayCol)
        .lerp(sunSunsetCol, twilight * 0.92)
        .lerp(moonNightCol, nightness)
        .lerp(rainLightCol, rainFactor * 0.55);
      keyLight.color.copy(keyColor);

      // Keep nighttime atmospheric and moonlit yet clearly readable
      const baseKeyIntensity = 0.42 + daylight * 1.85 + twilight * 0.85;
      keyLight.intensity = baseKeyIntensity * (1 - rainFactor * 0.42);

      // Hemisphere Light fill for rich shadows & nighttime readability
      hemiLight.color
        .copy(hemiSkyNight)
        .lerp(hemiSkyDay, daylight)
        .lerp(hemiSkySunset, twilight * 0.82)
        .lerp(rainLightCol, rainFactor * 0.45);
      hemiLight.groundColor
        .copy(hemiGroundNight)
        .lerp(hemiGroundDay, daylight)
        .lerp(hemiGroundSunset, twilight * 0.7);
      hemiLight.intensity = 0.36 + daylight * 0.58 + twilight * 0.28 - rainFactor * 0.08;

      // Underside rim light keeps floating island underside sculpted day and night
      rimLight.color.copy(moonNightCol).lerp(sunSunsetCol, twilight * 0.6);
      rimLight.intensity = 0.35 + nightness * 0.32 + twilight * 0.25;

      return celestial;
    },
  };
}
