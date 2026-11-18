import * as T from 'three';
import { clay, random, tau } from './craft';
import { groundHeight, landRatio, pond, pondRatio } from './terrain';
import { makeClouds, makeCottage, makeMill, makeTrees } from './miniatures';

export interface Settings {
  minutes: number;
  rainy: boolean;
  wind: number;
  lit: boolean;
}

export const defaults: Readonly<Settings> = { minutes: 960, rainy: false, wind: .30, lit: false };

const tint = (hex: string) => new T.Color(hex);
const colors = {
  sky: tint('#cddfd5'), dusk: tint('#dba291'), nightSky: tint('#172b3d'),
  horizon: tint('#f4d49e'), duskHorizon: tint('#eeab8a'), nightHorizon: tint('#3c515f'),
  glow: tint('#fff4d9'), duskGlow: tint('#ffe0b0'), nightGlow: tint('#586a7c'),
  wetSky: tint('#647984'), wetHorizon: tint('#a0aaa1'), wetGlow: tint('#bdc9c7'),
  sun: tint('#fff3d3'), sunset: tint('#ffab74'), moon: tint('#9ebce9'),
  dayGround: tint('#ab8e71'), nightGround: tint('#818a9a'),
  cloud: tint('#fff3dc'), wetCloud: tint('#778595'),
  dayWater: tint('#418b90'), nightWater: tint('#2d4c69'),
  gleam: tint('#c2dcd1'), nightGleam: tint('#6e91aa'),
};

function makePond(scene: T.Scene) {
  const uniforms = {
    base: { value: new T.Color() }, glint: { value: new T.Color() },
    clock: { value: 0 }, wind: { value: defaults.wind }, rain: { value: 0 },
  };
  const material = new T.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec2 local;
      void main() {
        local = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 base;
      uniform vec3 glint;
      uniform float clock;
      uniform float wind;
      uniform float rain;
      varying vec2 local;
      void main() {
        vec2 p = local;
        float a = atan(p.y / 1.43, p.x / 2.14);
        float shore = length(p / vec2(2.14, 1.43)) / (1.0 + .09 * sin(a * 3.0 + .5) + .05 * cos(a * 5.0));
        float wave = sin(p.y * 19.0 + p.x * 5.0 + sin(p.x * 5.5 + clock) * 1.25 + clock);
        float crosswave = sin(p.y * 27.0 - p.x * 7.0 + clock * .85);
        float flecks = smoothstep(.78, 1.55, wave + crosswave * .63)
          * (.105 + wind * .13) * (1.0 - rain * .32);
        float shallows = smoothstep(.48, 1.03, shore) * .33;
        float line = smoothstep(.912, .927, shore) * (1.0 - smoothstep(.935, .953, shore)) * .15;
        gl_FragColor = vec4(mix(base, glint, shallows + flecks + line), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const positions = [0, 0, 0];
  const index: number[] = [];
  const segments = 96;
  for (let i = 0; i < segments; i++) {
    const angle = i * tau / segments;
    const dx = Math.cos(angle) * pond.rx;
    const dz = Math.sin(angle) * pond.rz;
    let radius = 1.13 * (1 + .09 * Math.sin(angle * 3 + .5) + .05 * Math.cos(angle * 5));
    while (landRatio(pond.x + dx * radius, pond.z + dz * radius) > .989) radius -= .012;
    positions.push(dx * radius, 0, dz * radius);
    index.push(0, 1 + (i + 1) % segments, 1 + i);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  const water = new T.Mesh(geometry, material);
  water.position.set(pond.x, pond.y, pond.z);
  scene.add(water);
  return uniforms;
}

function makeRain(scene: T.Scene, count: number, fewerRipples: boolean) {
  const rng = random(169);
  const positions = new Float32Array(count * 6);
  const data = new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', data);
  const material = new T.LineBasicMaterial({ color: '#c6e1ee', transparent: true, depthWrite: false });
  const rain = new T.LineSegments(geometry, material);
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);

  const drops = Array.from({ length: count }, () => ({
    x: (rng() - .52) * 15.9, y: -4 + rng() * 12, z: (rng() - .5) * 11.5,
    speed: 5.1 + rng() * 3.2, length: .15 + rng() * .18,
  }));
  const circle = new T.RingGeometry(.86, 1, 26).rotateX(-Math.PI / 2);
  const ripples = Array.from({ length: fewerRipples ? 10 : 19 }, () => {
    const mesh = new T.Mesh(circle, new T.MeshBasicMaterial({
      color: '#b9dfed', transparent: true, depthWrite: false,
    }));
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, age: 2 };
  });
  let nextRipple = 0;
  let rippleDelay = 0;

  return (dt: number, amount: number, wind: number, day: number, reduce: boolean) => {
    rain.visible = amount > .004;
    material.opacity = amount * (reduce ? .28 : .56) * (.82 + day * .18);
    rippleDelay -= dt;
    if (rain.visible) {
      const driftX = wind * 3.2;
      const driftZ = -wind * .95;
      const live = Math.ceil(count * (reduce ? .43 : 1) * T.MathUtils.lerp(.3, 1, amount));
      geometry.setDrawRange(0, live * 2);
      for (let i = 0; i < live; i++) {
        const drop = drops[i];
        drop.x += driftX * dt;
        drop.z += driftZ * dt;
        drop.y -= drop.speed * dt;
        const overLand = landRatio(drop.x, drop.z) <= 1;
        const onWater = overLand && pondRatio(drop.x, drop.z) < 1.12 &&
          groundHeight(drop.x, drop.z) < pond.y;
        const floor = onWater ? pond.y : overLand ? groundHeight(drop.x, drop.z) : -4.2;
        if (drop.y < floor) {
          if (onWater && rippleDelay <= 0 && amount > .18) {
            const ripple = ripples[nextRipple];
            ripple.mesh.position.set(drop.x, pond.y + .004, drop.z);
            ripple.age = 0;
            rippleDelay = reduce ? .19 : .052;
            nextRipple = (nextRipple + 1) % ripples.length;
          }
          drop.x = (rng() - .54) * 15.9;
          drop.y = 5.1 + rng() * 3.9;
          drop.z = (rng() - .48) * 11.5;
        }
        const tail = drop.length / drop.speed;
        const offset = i * 6;
        positions[offset] = drop.x;
        positions[offset + 1] = drop.y;
        positions[offset + 2] = drop.z;
        positions[offset + 3] = drop.x - driftX * tail;
        positions[offset + 4] = drop.y + drop.length;
        positions[offset + 5] = drop.z - driftZ * tail;
      }
      data.needsUpdate = true;
    }

    const lifetime = .86;
    for (const ripple of ripples) {
      ripple.age += dt;
      ripple.mesh.visible = ripple.age < lifetime && amount > .004;
      if (!ripple.mesh.visible) continue;
      const progress = ripple.age / lifetime;
      ripple.mesh.scale.setScalar(.025 + progress * (reduce ? .16 : .33));
      ripple.mesh.material.opacity = (1 - progress) * amount * .65;
    }
  };
}

export function makeEnvironment(scene: T.Scene, stage: HTMLElement, compact: boolean) {
  const sky = stage.querySelector<HTMLElement>('.sky')!;
  const stars = stage.querySelector<HTMLElement>('.stars')!;
  const rng = random(329);
  const starsImage = Array.from({ length: 61 }, () =>
    `radial-gradient(circle at ${(rng() * 100).toFixed(1)}% ${(rng() * 82).toFixed(1)}%, #fff4db ${(.25 + rng() * .8).toFixed(2)}px, transparent 1.7px)`,
  ).join(',');
  stage.style.setProperty('--stars', starsImage);

  const ambient = new T.HemisphereLight('#e4efff', '#ab8e71', 2.05);
  const sun = new T.DirectionalLight('#fff0ca', 3.0);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(compact ? 1024 : 1536);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -8.7;
  sun.shadow.camera.right = sun.shadow.camera.top = 8.7;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 40;
  sun.shadow.normalBias = .033;
  sun.shadow.bias = -.00025;
  sun.shadow.radius = 2;
  scene.add(sun.target, sun, ambient);

  const cloudMaterial = clay('#fff3dc');
  const clouds = makeClouds(scene, cloudMaterial);
  const cottage = makeCottage(scene);
  const rotor = makeMill(scene);
  const trees = makeTrees(scene);
  const water = makePond(scene);
  const updateRain = makeRain(scene, compact ? 420 : 660, compact);

  const current = { minutes: defaults.minutes, wet: 0, wind: defaults.wind, glow: 0 };
  let breeze = 0;
  let waterTime = 0;
  const skyColor = new T.Color();
  let night = false;
  function skyTone(key: string, dayColor: T.Color, twilight: T.Color, dark: T.Color, wet: T.Color,
    day: number, dusk: number, rain: number) {
    skyColor.copy(dark).lerp(dayColor, day).lerp(twilight, dusk)
      .lerp(wet, rain * (.3 + day * .43));
    sky.style.setProperty(key, '#' + skyColor.getHexString());
  }

  function update(settings: Settings, delta: number, reduce: boolean, snap = false) {
    const damping = snap ? 1 : 1 - Math.exp(-delta * 5.7);
    current.minutes = T.MathUtils.lerp(current.minutes, settings.minutes, damping);
    current.wet = T.MathUtils.lerp(current.wet, +settings.rainy, damping * (snap ? 1 : .68));
    current.wind = T.MathUtils.lerp(current.wind, settings.wind, damping);
    current.glow = T.MathUtils.lerp(current.glow, +settings.lit, damping);
    const { minutes, wet, wind, glow } = current;
    const angle = (minutes / 1440 - .25) * tau;
    const altitude = Math.sin(angle);
    const day = T.MathUtils.smoothstep(altitude, -.18, .51);
    const dusk = (1 - T.MathUtils.smoothstep(Math.abs(altitude), .045, .47)) * .72;

    sun.position.set(Math.cos(angle) * 11 + .4, 3.3 + Math.max(.02, altitude) * 13, 5.5 + day * 4.8);
    sun.color.copy(colors.moon).lerp(colors.sun, day).lerp(colors.sunset, dusk);
    sun.intensity = T.MathUtils.lerp(.75, 2.58, day) * (1 - .63 * wet);
    ambient.intensity = T.MathUtils.lerp(.94, 1.8, day) * (1 - wet * .16);
    ambient.groundColor.copy(colors.nightGround).lerp(colors.dayGround, day);
    cloudMaterial.color.copy(colors.cloud).lerp(colors.wetCloud, wet * .84 + (1 - day) * .1);

    skyTone('--zenith', colors.sky, colors.dusk, colors.nightSky, colors.wetSky, day, dusk, wet);
    skyTone('--horizon', colors.horizon, colors.duskHorizon, colors.nightHorizon, colors.wetHorizon, day, dusk, wet);
    skyTone('--glow', colors.glow, colors.duskGlow, colors.nightGlow, colors.wetGlow, day, dusk, wet);
    stars.style.opacity = ((1 - day) * (1 - wet * .85) * .66).toFixed(3);
    const nowNight = day < .31;
    if (night !== nowNight) {
      night = nowNight;
      stage.dataset.night = String(night);
    }

    cottage.glass.color.copy(cottage.darkGlass).lerp(cottage.litGlass, glow);
    cottage.glass.emissiveIntensity = glow * (1 + (1 - day) * 2.0);
    cottage.lamp.intensity = glow * T.MathUtils.lerp(7.5, 2.0, day);
    const calm = reduce ? .22 : 1;
    breeze += delta * wind * calm;
    rotor.rotation.z = (rotor.rotation.z + delta * wind * 3.6 * calm) % tau;
    for (const { tree, phase, flexibility } of trees) {
      tree.rotation.z = -wind * flexibility * calm * (.025 + .056 * Math.sin(breeze * 5 + phase));
      tree.rotation.x = wind * calm * .022 * Math.sin(breeze * 3.8 + phase);
    }
    for (const { cloud, x, y, z, phase } of clouds) {
      cloud.position.set(x + Math.sin(breeze * .82 + phase) * .78,
        y + Math.sin(breeze * .63 + phase) * .19, z + Math.cos(breeze * .46 + phase) * .4);
    }

    waterTime += delta * (.24 + wind * 1.5) * calm;
    water.clock.value = waterTime;
    water.wind.value = wind;
    water.rain.value = wet;
    water.base.value.copy(colors.nightWater).lerp(colors.dayWater, day).multiplyScalar(1 - wet * .2);
    water.glint.value.copy(colors.nightGleam).lerp(colors.gleam, day);
    updateRain(delta, wet, wind, day, reduce);
  }

  return { update, house: cottage.house };
}
