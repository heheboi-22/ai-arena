import * as THREE from 'three';
import type { World } from './world';

interface RainDrop {
  x: number;
  y: number;
  z: number;
  speed: number;
}

interface Ripple {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  age: number;
  active: boolean;
}

export interface Environment {
  update: (dt: number, time: number, rain: number, wind: number, world: World) => number;
}

const DAY_TOP = new THREE.Color('#82b9ca');
const DAY_BOTTOM = new THREE.Color('#dce5cd');
const NIGHT_TOP = new THREE.Color('#101a34');
const NIGHT_BOTTOM = new THREE.Color('#3a4961');
const DUSK_TOP = new THREE.Color('#655b7d');
const DUSK_BOTTOM = new THREE.Color('#e9a178');
const SUN_DAY = new THREE.Color('#fff1d6');
const SUN_DUSK = new THREE.Color('#ffad72');
const SUN_RAIN = new THREE.Color('#a9b7c9');
const HEMI_NIGHT = new THREE.Color('#a7b9d1');
const HEMI_DAY = new THREE.Color('#e8edd9');
const GROUND_NIGHT = new THREE.Color('#424a52');
const GROUND_DAY = new THREE.Color('#6d7252');
const CLOUD_NIGHT = new THREE.Color('#697487');
const CLOUD_DAY = new THREE.Color('#f2eee1');
const CLOUD_RAIN = new THREE.Color('#59656b');
const WATER_NIGHT = new THREE.Color('#35566c');
const WATER_DAY = new THREE.Color('#629da3');
const WATER_RAIN = new THREE.Color('#527b82');
const tempTop = new THREE.Color();
const tempBottom = new THREE.Color();
const tempColor = new THREE.Color();
const sunPosition = new THREE.Vector3();

function smoothstep(min: number, max: number, value: number): number {
  const x = THREE.MathUtils.clamp((value - min) / (max - min), 0, 1);
  return x * x * (3 - 2 * x);
}

function createSky(scene: THREE.Scene): THREE.ShaderMaterial {
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: DAY_TOP.clone() },
      bottomColor: { value: DAY_BOTTOM.clone() },
      offset: { value: 7.0 },
      exponent: { value: 0.72 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        float mixValue = pow(max(h, 0.0), exponent);
        gl_FragColor = vec4(mix(bottomColor, topColor, mixValue), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(58, 32, 18), skyMaterial);
  sky.frustumCulled = false;
  scene.add(sky);
  return skyMaterial;
}

function createStars(scene: THREE.Scene): THREE.PointsMaterial {
  const positions: number[] = [];
  for (let i = 0; i < 360; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(0.08 + Math.random() * 0.92);
    const radius = 43 + Math.random() * 3;
    positions.push(
      Math.sin(phi) * Math.cos(theta) * radius,
      Math.cos(phi) * radius,
      Math.sin(phi) * Math.sin(theta) * radius,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const starMaterial = new THREE.PointsMaterial({
    color: '#e5e9db', size: 0.085, sizeAttenuation: true, transparent: true, opacity: 0,
    depthWrite: false, fog: false,
  });
  scene.add(new THREE.Points(geometry, starMaterial));
  return starMaterial;
}

function createRain(scene: THREE.Scene): {
  lines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  drops: RainDrop[];
} {
  const count = window.innerWidth < 700 ? 280 : 480;
  const positions = new Float32Array(count * 6);
  const drops: RainDrop[] = [];
  for (let i = 0; i < count; i += 1) {
    drops.push({
      x: (Math.random() - 0.5) * 14,
      y: Math.random() * 12,
      z: (Math.random() - 0.5) * 11,
      speed: 7 + Math.random() * 4,
    });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const rainMaterial = new THREE.LineBasicMaterial({
    color: '#c1dce3', transparent: true, opacity: 0, depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, rainMaterial);
  lines.frustumCulled = false;
  lines.visible = false;
  scene.add(lines);
  return { lines, drops };
}

function createRipples(scene: THREE.Scene): Ripple[] {
  const ripples: Ripple[] = [];
  const geometry = new THREE.RingGeometry(0.82, 1, 32);
  for (let i = 0; i < 26; i += 1) {
    const rippleMaterial = new THREE.MeshBasicMaterial({
      color: '#d4ece7', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
    });
    const ring = new THREE.Mesh(geometry, rippleMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(2.1, 0.235, 1.25);
    ring.visible = false;
    scene.add(ring);
    ripples.push({ mesh: ring, age: 0, active: false });
  }
  return ripples;
}

export function createEnvironment(scene: THREE.Scene, renderer: THREE.WebGLRenderer): Environment {
  const skyMaterial = createSky(scene);
  const starMaterial = createStars(scene);
  const hemisphere = new THREE.HemisphereLight('#e5edda', '#667054', 1.1);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight('#fff0d2', 2.25);
  sun.castShadow = true;
  const shadowSize = window.innerWidth < 700 ? 1024 : 2048;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.left = -7;
  sun.shadow.camera.right = 7;
  sun.shadow.camera.top = 7;
  sun.shadow.camera.bottom = -7;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 35;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target);

  const moon = new THREE.DirectionalLight('#9cb9df', 0);
  scene.add(moon, moon.target);

  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 20, 16),
    new THREE.MeshBasicMaterial({ color: '#ffdda0', transparent: true, opacity: 0.9, fog: false, toneMapped: false }),
  );
  const moonDisc = new THREE.Mesh(
    new THREE.SphereGeometry(0.53, 20, 16),
    new THREE.MeshBasicMaterial({ color: '#dbe5e9', transparent: true, opacity: 0, fog: false, toneMapped: false }),
  );
  scene.add(sunDisc, moonDisc);

  scene.fog = new THREE.FogExp2('#c9dbcb', 0.009);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const rainSystem = createRain(scene);
  const ripples = createRipples(scene);
  let rippleCursor = 0;
  let spawnBudget = 0;

  const spawnRipple = () => {
    const ripple = ripples[rippleCursor];
    rippleCursor = (rippleCursor + 1) % ripples.length;
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * 0.88;
    ripple.mesh.position.x = 2.1 + Math.cos(angle) * 1.43 * radius;
    ripple.mesh.position.z = 1.25 + Math.sin(angle) * 0.87 * radius;
    ripple.age = 0;
    ripple.active = true;
    ripple.mesh.visible = true;
  };

  const update = (dt: number, time: number, rain: number, wind: number, world: World): number => {
    const solarAngle = ((time - 6) / 24) * Math.PI * 2;
    const altitude = Math.sin(solarAngle);
    const daylight = smoothstep(-0.13, 0.20, altitude);
    const night = 1 - daylight;
    const dusk = (1 - smoothstep(0.04, 0.58, Math.abs(altitude))) * (0.4 + daylight * 0.6);
    const lightRainPenalty = 1 - rain * 0.68;

    sunPosition.set(Math.cos(solarAngle) * 13, altitude * 15, 5.5);
    sun.position.copy(sunPosition);
    moon.position.copy(sunPosition).multiplyScalar(-1);
    sun.intensity = (0.025 + daylight * 2.25) * lightRainPenalty;
    moon.intensity = night * (0.38 - rain * 0.10);
    sun.color.copy(SUN_DAY).lerp(SUN_DUSK, dusk * 0.78).lerp(SUN_RAIN, rain * 0.48);
    hemisphere.intensity = 0.42 + daylight * 0.80 - rain * 0.15;
    hemisphere.color.copy(tempColor.copy(HEMI_NIGHT).lerp(HEMI_DAY, daylight));
    hemisphere.groundColor.copy(tempColor.copy(GROUND_NIGHT).lerp(GROUND_DAY, daylight));

    tempTop.copy(NIGHT_TOP).lerp(DAY_TOP, daylight).lerp(DUSK_TOP, dusk * 0.75);
    tempBottom.copy(NIGHT_BOTTOM).lerp(DAY_BOTTOM, daylight).lerp(DUSK_BOTTOM, dusk * 0.88);
    tempTop.multiplyScalar(1 - rain * 0.25);
    tempBottom.multiplyScalar(1 - rain * 0.30);
    skyMaterial.uniforms.topColor.value.copy(tempTop);
    skyMaterial.uniforms.bottomColor.value.copy(tempBottom);
    (scene.fog as THREE.FogExp2).color.copy(tempBottom);
    (scene.fog as THREE.FogExp2).density = 0.008 + night * 0.003 + rain * 0.008;
    renderer.setClearColor(tempBottom);

    sunDisc.position.copy(sunPosition).normalize().multiplyScalar(39);
    moonDisc.position.copy(sunPosition).normalize().multiplyScalar(-38);
    (sunDisc.material as THREE.MeshBasicMaterial).opacity = daylight * (1 - rain * 0.8) * 0.9;
    (moonDisc.material as THREE.MeshBasicMaterial).opacity = night * (1 - rain * 0.65) * 0.85;
    starMaterial.opacity = night * (1 - rain * 0.85) * 0.85;

    world.cloudMaterial.color.copy(tempColor.copy(CLOUD_NIGHT).lerp(CLOUD_DAY, daylight));
    world.cloudMaterial.color.lerp(CLOUD_RAIN, rain * 0.68);
    world.cloudMaterial.emissive.copy(world.cloudMaterial.color).multiplyScalar(0.08 + night * 0.14);
    world.cloudMaterial.opacity = 0.82 + rain * 0.12;
    world.waterMaterial.color.copy(tempColor.copy(WATER_NIGHT).lerp(WATER_DAY, daylight));
    world.waterMaterial.color.lerp(WATER_RAIN, rain * 0.55);
    world.waterMaterial.roughness = 0.24 + rain * 0.2;

    const rainPositions = rainSystem.lines.geometry.attributes.position as THREE.BufferAttribute;
    rainSystem.lines.visible = rain > 0.008;
    rainSystem.lines.material.opacity = rain * 0.52;
    if (rainSystem.lines.visible) {
      rainSystem.drops.forEach((drop, index) => {
        drop.y -= drop.speed * dt;
        drop.x += wind * dt * 2.4;
        drop.z += wind * dt * 0.38;
        const overIsland = (drop.x * drop.x) / 27 + (drop.z * drop.z) / 16 < 1;
        if ((overIsland && drop.y < 0.21) || drop.y < -4.2 || drop.x > 9) {
          drop.x = (Math.random() - 0.5) * 14 - wind * 2;
          drop.y = 8 + Math.random() * 6;
          drop.z = (Math.random() - 0.5) * 11;
        }
        const offset = index * 6;
        rainPositions.array[offset] = drop.x;
        rainPositions.array[offset + 1] = drop.y;
        rainPositions.array[offset + 2] = drop.z;
        rainPositions.array[offset + 3] = drop.x - wind * 0.17;
        rainPositions.array[offset + 4] = drop.y + 0.43;
        rainPositions.array[offset + 5] = drop.z - wind * 0.035;
      });
      rainPositions.needsUpdate = true;
    }

    spawnBudget += dt * rain * 19;
    while (spawnBudget >= 1) {
      spawnRipple();
      spawnBudget -= 1;
    }
    ripples.forEach((ripple) => {
      if (!ripple.active) return;
      ripple.age += dt;
      const progress = ripple.age / 0.9;
      if (progress >= 1 || rain < 0.01) {
        ripple.active = false;
        ripple.mesh.visible = false;
        return;
      }
      const scale = 0.025 + progress * 0.23;
      ripple.mesh.scale.set(scale, scale, scale);
      ripple.mesh.material.opacity = (1 - progress) * rain * 0.48;
    });

    return night;
  };

  return { update };
}
