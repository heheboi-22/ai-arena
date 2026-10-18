import * as THREE from 'three';
import type { AppState } from './state';
import type { PocketWorld } from './world';

type Moment = {
  hour: number;
  top: string;
  bottom: string;
  sun: string;
  sunPower: number;
  ambient: number;
  moon: number;
};

const DAY: Moment[] = [
  { hour: 0, top: '#152640', bottom: '#374c62', sun: '#a1bfe2', sunPower: 0.04, ambient: 0.64, moon: 0.78 },
  { hour: 5, top: '#30425f', bottom: '#757783', sun: '#dbb5a4', sunPower: 0.06, ambient: 0.72, moon: 0.61 },
  { hour: 6.5, top: '#9b9aac', bottom: '#edb394', sun: '#ffc390', sunPower: 0.96, ambient: 0.93, moon: 0.22 },
  { hour: 9, top: '#a8cdd3', bottom: '#e6d8bf', sun: '#ffe6b8', sunPower: 2.65, ambient: 1.28, moon: 0 },
  { hour: 13, top: '#afd4dc', bottom: '#e6e5cc', sun: '#fff0d2', sunPower: 3.05, ambient: 1.38, moon: 0 },
  { hour: 16, top: '#b7d5d2', bottom: '#f0d9b9', sun: '#ffe0a5', sunPower: 2.75, ambient: 1.28, moon: 0 },
  { hour: 18.3, top: '#bd92a2', bottom: '#efb185', sun: '#ffad7d', sunPower: 1.12, ambient: 1.03, moon: 0.16 },
  { hour: 20, top: '#313f63', bottom: '#7b6d7c', sun: '#b4b0b9', sunPower: 0.06, ambient: 0.73, moon: 0.62 },
  { hour: 24, top: '#152640', bottom: '#374c62', sun: '#a1bfe2', sunPower: 0.04, ambient: 0.64, moon: 0.78 },
];

const color = (hex: string): THREE.Color => new THREE.Color(hex);
const ease = (value: number): number => value * value * (3 - 2 * value);

function hourColors(hour: number): { top: THREE.Color; bottom: THREE.Color; sun: THREE.Color; sunPower: number; ambient: number; moon: number } {
  const time = THREE.MathUtils.clamp(hour, 0, 24);
  const next = DAY.findIndex((moment) => time <= moment.hour);
  const right = Math.max(1, next);
  const a = DAY[right - 1];
  const b = DAY[right];
  const t = ease(THREE.MathUtils.clamp((time - a.hour) / (b.hour - a.hour), 0, 1));
  return {
    top: color(a.top).lerp(color(b.top), t),
    bottom: color(a.bottom).lerp(color(b.bottom), t),
    sun: color(a.sun).lerp(color(b.sun), t),
    sunPower: THREE.MathUtils.lerp(a.sunPower, b.sunPower, t),
    ambient: THREE.MathUtils.lerp(a.ambient, b.ambient, t),
    moon: THREE.MathUtils.lerp(a.moon, b.moon, t),
  };
}

function seededRandom(): () => number {
  let seed = 293721;
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function createEnvironment(
  scene: THREE.Scene,
  app: HTMLElement,
  renderer: THREE.WebGLRenderer,
  world: PocketWorld,
  initial: AppState,
  reducedMotion: boolean,
  compact: boolean,
): { update(state: AppState, dt: number): void; reset(state: AppState): void } {
  const sun = new THREE.DirectionalLight('#ffe0a5', 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(compact ? 1024 : 1536, compact ? 1024 : 1536);
  sun.shadow.camera.left = -5.8;
  sun.shadow.camera.right = 5.8;
  sun.shadow.camera.top = 6.8;
  sun.shadow.camera.bottom = -5.8;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 32;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  sun.target.position.set(0, -0.1, 0);
  scene.add(sun, sun.target);

  const ambient = new THREE.HemisphereLight('#e4edf1', '#967b62', 1.25);
  scene.add(ambient);
  const moonlight = new THREE.DirectionalLight('#abc9e2', 0.5);
  moonlight.position.set(-5, 7, -4);
  scene.add(moonlight);

  const starsPositions: number[] = [];
  const random = seededRandom();
  for (let i = 0; i < 65; i++) {
    const x = (random() - 0.5) * 19;
    const y = 3.0 + random() * 5.0;
    const z = -4.5 - random() * 5.5;
    if (Math.abs(x) < 3.1 && y < 4.5) continue;
    starsPositions.push(x, y, z);
  }
  const starsGeometry = new THREE.BufferGeometry();
  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsPositions, 3));
  const starsMaterial = new THREE.PointsMaterial({ color: '#ffedcb', size: 0.055, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false });
  const stars = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(stars);
  const moonMaterial = new THREE.MeshBasicMaterial({ color: '#ffecd3', transparent: true, opacity: 0, depthWrite: false });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.33, 16, 12), moonMaterial);
  moon.position.set(4.0, 5.15, -6.5);
  scene.add(moon);

  const rainCount = compact ? 135 : 235;
  const drops: { x: number; y: number; z: number; length: number }[] = [];
  const rainPositions = new Float32Array(rainCount * 6);
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3).setUsage(THREE.DynamicDrawUsage));
  const rainMaterial = new THREE.LineBasicMaterial({ color: '#d1e4e6', transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial);
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);

  function respawn(drop: { x: number; y: number; z: number; length: number }, atTop: boolean): void {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * 3.1;
    drop.x = Math.cos(angle) * radius;
    drop.z = Math.sin(angle) * radius;
    drop.y = atTop ? 3.6 + random() * 1.8 : 0.22 + random() * 4.5;
    drop.length = 0.16 + random() * 0.16;
  }
  for (let i = 0; i < rainCount; i++) {
    const drop = { x: 0, y: 0, z: 0, length: 0 };
    respawn(drop, false);
    drops.push(drop);
  }

  const rippleGeometry = new THREE.TorusGeometry(1, 0.014, 4, 32);
  const rippleSpots = [[-0.32, -0.14], [0.11, -0.17], [0.27, 0.16], [-0.06, 0.11], [-0.23, 0.27], [0.33, -0.12]];
  const ripples = rippleSpots.map(([x, z]) => {
    const material = new THREE.MeshBasicMaterial({ color: '#d9f2ed', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(rippleGeometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(world.pond.x + x, world.pond.y + 0.013, world.pond.z + z);
    mesh.visible = false;
    world.root.add(mesh);
    return mesh;
  });

  const cloudsStart = world.clouds.map((cloud) => cloud.position.x);
  const cloudMaterials: THREE.MeshStandardMaterial[] = [];
  for (const cloud of world.clouds) {
    cloud.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && !cloudMaterials.includes(object.material)) {
        cloudMaterials.push(object.material);
      }
    });
  }
  const cloudColors = cloudMaterials.map((material) => material.color.clone());
  const windowOff = color('#617d87');
  const windowOn = color('#dca46c');
  const waterClear = color('#54aebc');
  const waterRain = color('#607f8d');
  let elapsed = 0;
  let cloudDistance = 0;
  let visualTime = initial.time;
  let visualWind = initial.wind / 100;
  let rainAmount = initial.weather === 'rain' ? 1 : 0;
  let lightAmount = initial.lights ? 1 : 0;

  function update(state: AppState, dt: number): void {
    visualTime += (state.time - visualTime) * (1 - Math.exp(-dt * (reducedMotion ? 12 : 5.2)));
    visualWind += (state.wind / 100 - visualWind) * (1 - Math.exp(-dt * 5));
    rainAmount += ((state.weather === 'rain' ? 1 : 0) - rainAmount) * (1 - Math.exp(-dt * (reducedMotion ? 9 : 2.4)));
    lightAmount += ((state.lights ? 1 : 0) - lightAmount) * (1 - Math.exp(-dt * (reducedMotion ? 10 : 5)));
    elapsed += dt;

    const moment = hourColors(visualTime);
    const altitude = Math.sin((visualTime - 6) * Math.PI / 12);
    const daylight = THREE.MathUtils.smoothstep(altitude, -0.2, 0.25);
    const night = 1 - daylight;
    const rainTop = color('#192a41').lerp(color('#586f78'), daylight);
    const rainBottom = color('#304052').lerp(color('#9aa8a5'), daylight);
    const skyTop = moment.top.lerp(rainTop, rainAmount * 0.77);
    const skyBottom = moment.bottom.lerp(rainBottom, rainAmount * 0.79);
    app.style.setProperty('--sky-top', `#${skyTop.getHexString()}`);
    app.style.setProperty('--sky-bottom', `#${skyBottom.getHexString()}`);

    sun.position.set(-Math.cos((visualTime - 6) * Math.PI / 12) * 8, Math.max(2, altitude * 10), 5.5);
    sun.color.copy(moment.sun);
    sun.intensity = moment.sunPower * (1 - rainAmount * 0.71);
    ambient.intensity = moment.ambient * (1 - rainAmount * 0.19);
    ambient.color.copy(color('#adc5d8').lerp(color('#e7f0e8'), daylight));
    moonlight.intensity = moment.moon * (1 - rainAmount * 0.38);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.12, 1.24, daylight) - rainAmount * 0.045;
    starsMaterial.opacity = night * (1 - rainAmount * 0.88) * 0.91;
    moonMaterial.opacity = night * (1 - rainAmount * 0.85) * 0.89;
    stars.visible = starsMaterial.opacity > 0.012;
    moon.visible = moonMaterial.opacity > 0.012;

    for (let i = 0; i < cloudMaterials.length; i++) {
      cloudMaterials[i].color.copy(cloudColors[i]).lerp(color('#61717c'), rainAmount * 0.78);
    }
    cloudDistance += dt * visualWind * (reducedMotion ? 0.19 : 0.53);
    world.clouds.forEach((cloud, i) => {
      cloud.position.x = ((cloudsStart[i] + cloudDistance + 6) % 12 + 12) % 12 - 6;
    });
    world.rotor.rotation.z -= dt * visualWind * (reducedMotion ? 1.05 : 4.2);
    for (const tree of world.trees) {
      tree.sway.rotation.z = Math.sin(elapsed * (0.75 + visualWind * 1.25) + tree.phase) * visualWind * (reducedMotion ? 0.019 : 0.065);
      tree.sway.rotation.x = Math.sin(elapsed * (0.62 + visualWind) + tree.phase * 1.37) * visualWind * (reducedMotion ? 0.012 : 0.036);
    }

    for (const pane of world.windows) {
      pane.material.color.copy(windowOff).lerp(windowOn, lightAmount * (0.58 + night * 0.42));
      pane.material.emissive.set('#ff943f');
      pane.material.emissiveIntensity = lightAmount * (0.65 + night * 1.15);
    }
    world.porchLight.intensity = lightAmount * (0.45 + night * 2.1);
    world.porchBulb.material.emissiveIntensity = lightAmount * (1.1 + night * 2.2);
    world.porchBulb.material.color.copy(windowOff).lerp(windowOn, lightAmount);
    world.pond.surface.material.color.copy(waterClear).lerp(waterRain, rainAmount * 0.76 + night * 0.18);
    world.pond.surface.material.emissiveIntensity = 0.12 + night * 0.12;

    rain.visible = rainAmount > 0.012;
    if (rain.visible) {
      const fallSpeed = 4.8;
      const driftX = visualWind * 2.05;
      const driftZ = visualWind * 0.34;
      for (let i = 0; i < drops.length; i++) {
        const drop = drops[i];
        drop.y -= dt * fallSpeed;
        drop.x += dt * driftX;
        drop.z += dt * driftZ;
        if (drop.y < 0.21 || Math.hypot(drop.x, drop.z) > 3.35) respawn(drop, true);
        const offset = i * 6;
        rainPositions[offset] = drop.x;
        rainPositions[offset + 1] = drop.y;
        rainPositions[offset + 2] = drop.z;
        rainPositions[offset + 3] = drop.x - driftX / fallSpeed * drop.length;
        rainPositions[offset + 4] = drop.y + drop.length;
        rainPositions[offset + 5] = drop.z - driftZ / fallSpeed * drop.length;
      }
      rainGeometry.attributes.position.needsUpdate = true;
      rainMaterial.opacity = rainAmount * (night > 0.7 ? 0.56 : 0.43);
    }
    ripples.forEach((mesh, i) => {
      const phase = (elapsed * (reducedMotion ? 0.48 : 0.93) + i / ripples.length) % 1;
      const size = 0.055 + phase * 0.23;
      mesh.scale.set(size, size * 0.76, size);
      mesh.material.opacity = rainAmount * (1 - phase) * 0.66;
      mesh.visible = rainAmount > 0.015;
    });
  }

  function reset(state: AppState): void {
    elapsed = 0;
    cloudDistance = 0;
    visualTime = state.time;
    visualWind = state.wind / 100;
    rainAmount = state.weather === 'rain' ? 1 : 0;
    lightAmount = state.lights ? 1 : 0;
    world.rotor.rotation.z = 0;
    for (const tree of world.trees) tree.sway.rotation.set(0, 0, 0);
    update(state, 0);
  }

  reset(initial);
  return { update, reset };
}
