import * as THREE from 'three';
import { ground, material, pebble, random, inPond, onIsland, pondCenter } from './geometry';
import type { WorldState } from './state';

export class Environment {
  readonly sun = new THREE.DirectionalLight(0xffedcd, 3.1);
  readonly ambient = new THREE.HemisphereLight(0xdde5d9, 0x858773, 2);
  readonly moon = new THREE.DirectionalLight(0x9bbce4, 0.3);
  private rainMaterial = new THREE.LineBasicMaterial({ color: 0xc3d7de, transparent: true, opacity: 0, depthWrite: false });
  private cloudMaterial = material(0xf6f3e6, { roughness: 1, flatShading: false });
  private cloudGroups: THREE.Group[] = [];
  private rain: THREE.LineSegments;
  private drops: { x: number; y: number; z: number; speed: number }[] = [];
  private rainPositions: Float32Array;
  private ripples: { mesh: THREE.Mesh; age: number; duration: number }[] = [];
  private rippleMaterials: THREE.MeshBasicMaterial[] = [];
  private stars: THREE.Points;
  private starMaterial: THREE.PointsMaterial;
  private rand = random(912);
  private heightMap = new Float32Array(49 * 41);
  private rainAmount = 0;
  private brightness = 1;
  private sky = new THREE.Color();
  private top = new THREE.Color();
  private bottom = new THREE.Color();
  private targetColor = new THREE.Color();
  private targetTop = new THREE.Color();
  private targetBottom = new THREE.Color();
  private sunTarget = new THREE.Vector3();
  private colors = {
    sun: new THREE.Color(0xfff2d7), gold: new THREE.Color(0xffae79),
    ambientDay: new THREE.Color(0xe0e9d8), ambientNight: new THREE.Color(0xa5c3e9),
    topDay: new THREE.Color(0xdde5dc), bottomDay: new THREE.Color(0xf2efdd),
    topNight: new THREE.Color(0x263e5c), bottomNight: new THREE.Color(0x53677b),
    topGold: new THREE.Color(0xdfc4b0), bottomGold: new THREE.Color(0xf1d8b7),
    topRainDay: new THREE.Color(0xadb9b7), topRainNight: new THREE.Color(0x2b3d54),
    bottomRainDay: new THREE.Color(0xd1d6ca), bottomRainNight: new THREE.Color(0x536576),
    cloudClear: new THREE.Color(0xf6f3e6), cloudRain: new THREE.Color(0x707e87),
  };
  private wind = 0.3;
  private lightAmount = 0;

  constructor(scene: THREE.Scene, island: THREE.Group, smallDevice: boolean) {
    scene.add(this.sun, this.sun.target, this.ambient, this.moon);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(smallDevice ? 1024 : 2048, smallDevice ? 1024 : 2048);
    Object.assign(this.sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 35 });
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.radius = 3;
    this.moon.position.set(-6, 8, 5);
    const clouds = [
      [-6.8, 4.2, -1.6, 0.75], [4.9, 4.4, -4.1, 0.84],
      [-3.4, 5.1, -5, 0.65], [6.8, 2.4, 2.4, 0.58], [-6.8, 1.1, 3.3, 0.48],
    ];
    clouds.forEach(([x, y, z, size], index) => {
      const cloud = new THREE.Group();
      cloud.position.set(x, y, z);
      cloud.scale.setScalar(size);
      cloud.userData.phase = index;
      const parts = [[-0.9, 0, 0, 0.65], [0, 0.2, 0, 0.93], [0.9, 0.02, 0.05, 0.65], [-0.35, 0.38, -0.24, 0.62], [0.55, 0.26, -0.12, 0.67]];
      parts.forEach(([px, py, pz, radius]) => {
        const part = pebble(cloud, this.cloudMaterial, [px, py, pz], [radius, radius * 0.57, radius * 0.62]);
        part.castShadow = false;
        part.receiveShadow = false;
      });
      this.cloudGroups.push(cloud);
      scene.add(cloud);
    });

    const count = smallDevice ? 280 : 560;
    this.rainPositions = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) this.drops.push({ x: (this.rand() - 0.5) * 12, y: ground + this.rand() * 9, z: (this.rand() - 0.5) * 10, speed: 5 + this.rand() * 3 });
    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.rain = new THREE.LineSegments(rainGeometry, this.rainMaterial);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);

    const ringGeometry = new THREE.RingGeometry(0.89, 1, 24);
    for (let i = 0; i < 22; i++) {
      const rippleMaterial = new THREE.MeshBasicMaterial({ color: 0xcce0dc, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      this.rippleMaterials.push(rippleMaterial);
      const ripple = new THREE.Mesh(ringGeometry, rippleMaterial);
      ripple.rotation.x = -Math.PI / 2;
      ripple.position.y = ground - 0.059;
      scene.add(ripple);
      this.ripples.push({ mesh: ripple, age: this.rand() * 1.6, duration: 1 + this.rand() * 0.6 });
      this.placeRipple(ripple);
    }

    const starPositions = new Float32Array(150 * 3);
    for (let i = 0; i < 150; i++) {
      const angle = this.rand() * Math.PI * 2;
      starPositions[i * 3] = Math.cos(angle) * (17 + this.rand() * 12);
      starPositions[i * 3 + 1] = 8 + this.rand() * 20;
      starPositions[i * 3 + 2] = Math.sin(angle) * (17 + this.rand() * 12);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starMaterial = new THREE.PointsMaterial({ color: 0xf4ead0, size: 0.065, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true });
    this.stars = new THREE.Points(starGeometry, this.starMaterial);
    scene.add(this.stars);

    island.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
    for (let z = 0; z < 41; z++) {
      for (let x = 0; x < 49; x++) {
        ray.ray.origin.set(x / 4 - 6, 8, z / 4 - 5);
        const hit = ray.intersectObject(island, true)[0];
        this.heightMap[z * 49 + x] = hit ? hit.point.y : -4.2;
      }
    }
  }

  private placeRipple(ripple: THREE.Mesh) {
    let x = 0, z = 0;
    do { x = pondCenter.x + (this.rand() - 0.5) * 2.7; z = pondCenter.y + (this.rand() - 0.5) * 1.6; } while (!inPond(x, z));
    ripple.position.x = x;
    ripple.position.z = z;
  }

  private surface(x: number, z: number) {
    if (!onIsland(x, z)) return -4.2;
    const ix = THREE.MathUtils.clamp(Math.round((x + 6) * 4), 0, 48);
    const iz = THREE.MathUtils.clamp(Math.round((z + 5) * 4), 0, 40);
    return Math.max(inPond(x, z) ? ground - 0.07 : ground, this.heightMap[iz * 49 + ix]);
  }

  update(dt: number, elapsed: number, state: WorldState, reducedMotion: boolean, immediate = false) {
    const blend = immediate ? 1 : 1 - Math.exp(-dt * 3.5);
    this.rainAmount = THREE.MathUtils.lerp(this.rainAmount, state.weather === 'rain' ? 1 : 0, blend);
    this.wind = THREE.MathUtils.lerp(this.wind, state.wind, blend);
    this.lightAmount = THREE.MathUtils.lerp(this.lightAmount, state.lights ? 1 : 0, blend);
    const sunAngle = (state.time - 6) / 24 * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle);
    const day = THREE.MathUtils.smoothstep(sunHeight, -0.16, 0.32);
    const golden = Math.exp(-Math.pow(sunHeight / 0.25, 2)) * day;
    const rain = this.rainAmount;
    const sunnyIntensity = (0.1 + day * 3.1) * (1 - rain * 0.76);
    this.sun.intensity = THREE.MathUtils.lerp(this.sun.intensity, sunnyIntensity, blend);
    this.sunTarget.set(Math.cos(sunAngle) * 11, Math.max(0.4, sunHeight * 13), 6);
    this.sun.position.lerp(this.sunTarget, blend);
    this.targetColor.copy(this.colors.sun).lerp(this.colors.gold, golden * 0.85);
    this.sun.color.lerp(this.targetColor, blend);
    this.ambient.intensity = THREE.MathUtils.lerp(this.ambient.intensity, 0.62 + day * 1.42 - rain * 0.35, blend);
    this.targetColor.copy(this.colors.ambientNight).lerp(this.colors.ambientDay, day);
    this.ambient.color.lerp(this.targetColor, blend);
    this.moon.intensity = THREE.MathUtils.lerp(this.moon.intensity, 0.62 * (1 - day), blend);
    this.brightness = THREE.MathUtils.lerp(this.brightness, day, blend);

    this.targetTop.copy(this.colors.topNight).lerp(this.colors.topDay, day).lerp(this.colors.topGold, golden * 0.65);
    this.targetBottom.copy(this.colors.bottomNight).lerp(this.colors.bottomDay, day).lerp(this.colors.bottomGold, golden * 0.6);
    this.targetColor.copy(this.colors.topRainNight).lerp(this.colors.topRainDay, day);
    this.targetTop.lerp(this.targetColor, rain * 0.7);
    this.targetColor.copy(this.colors.bottomRainNight).lerp(this.colors.bottomRainDay, day);
    this.targetBottom.lerp(this.targetColor, rain * 0.65);
    this.top.lerp(this.targetTop, blend);
    this.bottom.lerp(this.targetBottom, blend);
    this.sky.copy(this.bottom);
    document.documentElement.style.setProperty('--sky-top', `#${this.top.getHexString()}`);
    document.documentElement.style.setProperty('--sky-bottom', `#${this.sky.getHexString()}`);
    document.documentElement.classList.toggle('night', this.brightness < 0.35);
    this.starMaterial.opacity = (1 - this.brightness) * (1 - rain * 0.95) * 0.8;
    this.targetColor.copy(this.colors.cloudClear).lerp(this.colors.cloudRain, rain * 0.78 + (1 - this.brightness) * 0.22);
    this.cloudMaterial.color.lerp(this.targetColor, blend);
    for (const [index, cloud] of this.cloudGroups.entries()) {
      cloud.position.x += dt * this.wind * (0.16 + index * 0.028) * (reducedMotion ? 0.2 : 1);
      if (cloud.position.x > 10.5) cloud.position.x = -10.5;
    }

    this.rain.visible = rain > 0.005;
    this.rainMaterial.opacity = rain * (day > 0.4 ? 0.48 : 0.36);
    if (this.rain.visible) {
      for (const [i, drop] of this.drops.entries()) {
        drop.y -= dt * drop.speed;
        drop.x += dt * this.wind * 2.2;
        const floor = this.surface(drop.x, drop.z);
        if (drop.y <= floor || drop.x > 6.5) {
          drop.x = (this.rand() - 0.5) * 12;
          drop.z = (this.rand() - 0.5) * 10;
          drop.y = 7 + this.rand() * 2;
        }
        const base = i * 6;
        this.rainPositions[base] = drop.x;
        this.rainPositions[base + 1] = drop.y;
        this.rainPositions[base + 2] = drop.z;
        this.rainPositions[base + 3] = drop.x - this.wind * 0.12;
        this.rainPositions[base + 4] = drop.y + 0.33;
        this.rainPositions[base + 5] = drop.z;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
    this.ripples.forEach((ripple, i) => {
      ripple.age += dt;
      if (ripple.age > ripple.duration) {
        ripple.age %= ripple.duration;
        this.placeRipple(ripple.mesh);
      }
      const progress = ripple.age / ripple.duration;
      const radius = 0.03 + progress * 0.24;
      ripple.mesh.scale.setScalar(radius);
      ripple.mesh.visible = rain > 0.005;
      this.rippleMaterials[i].opacity = Math.sin(progress * Math.PI) * rain * 0.52;
    });
    return { wind: this.wind, day: this.brightness, rain, lights: this.lightAmount, elapsed };
  }

  resetMotion() {
    const positions = [-6.8, 4.9, -3.4, 6.8, -6.8];
    this.cloudGroups.forEach((cloud, i) => cloud.position.x = positions[i]);
  }

  snapshot() {
    return { rainAmount: this.rainAmount, rainCount: this.drops.length,
      rippleCount: this.ripples.length, wind: this.wind, daylight: this.brightness,
      sunIntensity: this.sun.intensity, lightsAmount: this.lightAmount,
      cloudX: this.cloudGroups[0].position.x,
      rainDirection: Array.from(this.rainPositions.slice(0, 6)) };
  }
}
