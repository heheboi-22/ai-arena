import * as THREE from 'three';
import type { WorldState } from './state';
import { batchMeshes, damp, material, mesh, random } from './world/primitives';
import { inPond, onIsland, POND } from './world/terrain';

const skyStops = [
  { t: 0, sky: '#202e40', sun: '#a6bee0', power: 0.48, ambient: 1.05 },
  { t: 5, sky: '#3f475b', sun: '#c4c2dc', power: 0.55, ambient: 1.1 },
  { t: 6.5, sky: '#e3baaa', sun: '#ffbf91', power: 1.9, ambient: 1.8 },
  { t: 9, sky: '#e9efdf', sun: '#fff4d5', power: 3.0, ambient: 2.2 },
  { t: 13, sky: '#edf1e7', sun: '#fff5de', power: 3.0, ambient: 2.2 },
  { t: 16, sky: '#f1f2e9', sun: '#ffe0ac', power: 2.8, ambient: 2.0 },
  { t: 18, sky: '#e8c0a3', sun: '#ffac69', power: 2.2, ambient: 1.65 },
  { t: 19.5, sky: '#80768b', sun: '#f4a789', power: 0.9, ambient: 1.25 },
  { t: 21, sky: '#26374b', sun: '#a6bee0', power: 0.48, ambient: 1.05 },
  { t: 24, sky: '#202e40', sun: '#a6bee0', power: 0.48, ambient: 1.05 },
].map(s => ({ ...s, sky: new THREE.Color(s.sky), sun: new THREE.Color(s.sun) }));

export function createEnvironment(scene: THREE.Scene, compact: boolean) {
  const sun = new THREE.DirectionalLight('#ffe0ac', 2.8);
  sun.position.set(-8, 10, 6); sun.castShadow = true;
  sun.shadow.mapSize.setScalar(compact ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 35 });
  sun.shadow.bias = -0.0007; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const hemisphere = new THREE.HemisphereLight('#f5f2da', '#887d69', 2);
  scene.add(hemisphere);
  const fill = new THREE.DirectionalLight('#b6d4e4', 0.6); fill.position.set(7, 4, -6); scene.add(fill);

  const cloudMat = material('#faf6e8', { roughness: 1, flatShading: false });
  const cloudGeo = new THREE.SphereGeometry(1, 16, 10);
  const clouds: THREE.Group[] = [];
  const specs = [[-4.2, 4.8, -3.4, 0.78], [1.4, 5.05, -3.8, 0.7], [5.0, 3.8, -2.5, 0.55], [-5.5, 1.6, -5.2, 0.47]];
  for (const [x, y, z, size] of specs) {
    const cloud = new THREE.Group(); cloud.position.set(x, y, z); cloud.scale.setScalar(size); scene.add(cloud);
    for (const [dx, dy, dz, r] of [[-0.9, 0, 0, 0.55], [-0.3, 0.2, 0, 0.76], [0.4, 0.08, 0, 0.64], [0.95, -0.08, 0.04, 0.43], [0, -0.12, 0.3, 0.55]]) {
      const lobe = mesh(cloudGeo, cloudMat, cloud, dx, dy, dz); lobe.scale.set(r, r * 0.74, r * 0.78); lobe.castShadow = false;
    }
    batchMeshes(cloud);
    cloud.userData.originX = x; cloud.userData.phase = 0;
    clouds.push(cloud);
  }

  const rand = random(951);
  const rainCount = compact ? 360 : 660;
  const positions = new Float32Array(rainCount * 6);
  const drops = Array.from({ length: rainCount }, () => ({ x: (rand() - 0.5) * 11, y: 0.4 + rand() * 8, z: (rand() - 0.5) * 8, speed: 5.5 + rand() * 2.7 }));
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  const rainMaterial = new THREE.LineBasicMaterial({ color: '#c2dce4', transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial); rain.frustumCulled = false; rain.visible = false; scene.add(rain);

  const rippleGeometry = new THREE.RingGeometry(0.94, 1, 28); rippleGeometry.rotateX(-Math.PI / 2);
  const ripples = Array.from({ length: compact ? 14 : 24 }, (_, i) => {
    const rippleMaterial = new THREE.MeshBasicMaterial({ color: '#c9e1d7', transparent: true, opacity: 0, depthWrite: false });
    const object = new THREE.Mesh(rippleGeometry, rippleMaterial); object.position.y = POND.y + 0.015; object.visible = false; scene.add(object);
    return { object, life: i / 24, material: rippleMaterial };
  });
  function resetRipple(ripple: typeof ripples[number]) {
    do { ripple.object.position.x = POND.x + (rand() - 0.5) * 2.6; ripple.object.position.z = POND.z + (rand() - 0.5) * 1.65; }
    while (!inPond(ripple.object.position.x, ripple.object.position.z, 0.76));
  }
  ripples.forEach(resetRipple);

  const starsGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(100 * 3);
  for (let i = 0; i < 100; i++) { starPositions[i * 3] = (rand() - 0.5) * 38; starPositions[i * 3 + 1] = rand() * 12 + 4; starPositions[i * 3 + 2] = -8 - rand() * 10; }
  starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starsMaterial = new THREE.PointsMaterial({ color: '#e0e6cd', size: 0.045, transparent: true, opacity: 0, depthWrite: false });
  const stars = new THREE.Points(starsGeometry, starsMaterial); scene.add(stars);

  const sky = skyStops[5].sky.clone(), skyTarget = new THREE.Color(), sunTarget = new THREE.Color();
  const rainSky = new THREE.Color('#a3b3b1'), darkSky = new THREE.Color('#1e2d3d');
  const clearCloud = new THREE.Color('#faf6e8'), wetCloud = new THREE.Color('#819598');
  const sunPosition = new THREE.Vector3();
  const stormSky = new THREE.Color(), stormSun = new THREE.Color('#c4d2dc');
  const dayHemisphere = new THREE.Color('#f5f2da'), nightHemisphere = new THREE.Color('#a5b9d5');
  let wetness = 0, wind = 0.3;

  function update(state: Readonly<WorldState>, dt: number, elapsed: number, reduced: boolean) {
    wetness = damp(wetness, state.weather === 'rain' ? 1 : 0, 2.3, dt);
    wind = damp(wind, state.wind, 3.5, dt);
    const index = Math.max(0, skyStops.findIndex(s => s.t >= state.time) - 1);
    const a = skyStops[index], b = skyStops[index + 1];
    const mix = THREE.MathUtils.smoothstep(state.time, a.t, b.t);
    skyTarget.copy(a.sky).lerp(b.sky, mix);
    const night = 1 - THREE.MathUtils.smoothstep(Math.sin((state.time - 6) / 12 * Math.PI), -0.2, 0.35);
    skyTarget.lerp(stormSky.copy(rainSky).lerp(darkSky, night), wetness * 0.66);
    const smooth = 1 - Math.exp(-4 * dt);
    sky.lerp(skyTarget, smooth);
    document.documentElement.style.setProperty('--sky', sky.getStyle());
    sunTarget.copy(a.sun).lerp(b.sun, mix).lerp(stormSun, wetness * 0.65);
    sun.color.lerp(sunTarget, smooth);
    sun.intensity = damp(sun.intensity, THREE.MathUtils.lerp(a.power, b.power, mix) * (1 - wetness * 0.7), 4, dt);
    hemisphere.intensity = damp(hemisphere.intensity, THREE.MathUtils.lerp(a.ambient, b.ambient, mix) * (1 - wetness * 0.15), 4, dt);
    hemisphere.color.copy(dayHemisphere).lerp(nightHemisphere, night * 0.75 + wetness * 0.15);
    const angle = (state.time - 6) / 12 * Math.PI;
    sunPosition.set(Math.cos(angle) * 10, 3.5 + Math.max(0, Math.sin(angle)) * 10, 6);
    if (night > 0.8) sunPosition.set(-4, 8, -4);
    sun.position.lerp(sunPosition, smooth);
    fill.intensity = damp(fill.intensity, 0.55 + night * 0.25, 4, dt);
    cloudMat.color.copy(clearCloud).lerp(wetCloud, wetness);
    starsMaterial.opacity = damp(starsMaterial.opacity, night * (1 - wetness) * 0.75, 3, dt);
    stars.visible = starsMaterial.opacity > 0.01;
    for (const cloud of clouds) {
      cloud.userData.phase += dt * wind * (reduced ? 0.005 : 0.1);
      cloud.position.x = cloud.userData.originX + Math.sin(cloud.userData.phase) * 1.3;
    }
    rain.visible = wetness > 0.005;
    rainMaterial.opacity = wetness * (night > 0.5 ? 0.42 : 0.56);
    if (rain.visible) {
      const drift = wind * 2.6;
      for (let i = 0; i < drops.length; i++) {
        const drop = drops[i]; drop.y -= dt * drop.speed; drop.x += dt * drift;
        const surface = onIsland(drop.x, drop.z) ? (inPond(drop.x, drop.z) ? POND.y : 0.31) : -3.2;
        if (drop.y <= surface + 0.03 || drop.x > 6.5) {
          drop.x = (rand() - 0.5) * 11; drop.y = 6.5 + rand() * 1.8; drop.z = (rand() - 0.5) * 8;
        }
        const j = i * 6;
        positions[j] = drop.x; positions[j + 1] = drop.y; positions[j + 2] = drop.z;
        positions[j + 3] = drop.x - drift * 0.045; positions[j + 4] = drop.y + 0.23; positions[j + 5] = drop.z;
      }
      rainGeometry.attributes.position.needsUpdate = true;
    }
    for (const ripple of ripples) {
      ripple.object.visible = rain.visible;
      if (!rain.visible) continue;
      ripple.life += dt * 0.65;
      if (ripple.life >= 1) { ripple.life %= 1; resetRipple(ripple); }
      ripple.object.scale.setScalar(0.035 + ripple.life * 0.23);
      ripple.material.opacity = Math.sin(ripple.life * Math.PI) * wetness * 0.4;
    }
    return { wetness, wind, night, elapsed };
  }
  return { update, rain, ripples, sun, clouds, stars };
}
