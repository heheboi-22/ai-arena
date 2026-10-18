import * as THREE from 'three';
import type { AppState } from './State';
import type { SceneObjects } from './Builder';

export class Environment {
  scene: THREE.Scene;
  ctx: SceneObjects;

  sunLight: THREE.DirectionalLight;
  ambientLight: THREE.HemisphereLight;
  housePointLight: THREE.PointLight;
  windowMatOn: THREE.Material;
  windowMatOff: THREE.Material;

  rainSystem: THREE.Group;
  rainParticles: THREE.Mesh[];
  rainMaterial: THREE.MeshBasicMaterial;

  weatherIntensity = 0; // 0 = clear, 1 = raining

  constructor(scene: THREE.Scene, ctx: SceneObjects) {
    this.scene = scene;
    this.ctx = ctx;

    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 15, 35);
    
    this.ambientLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 40;
    this.sunLight.shadow.camera.left = -10;
    this.sunLight.shadow.camera.right = 10;
    this.sunLight.shadow.camera.top = 10;
    this.sunLight.shadow.camera.bottom = -10;
    this.sunLight.shadow.bias = -0.001;
    this.scene.add(this.sunLight);

    this.housePointLight = new THREE.PointLight(0xffcc33, 1, 8);
    this.housePointLight.position.set(-2, 2.5, -1);
    this.housePointLight.castShadow = true; 
    this.scene.add(this.housePointLight);

    this.windowMatOff = new THREE.MeshStandardMaterial({ color: 0x4a6a8a, roughness: 0.2, metalness: 0.5 });
    this.windowMatOn = new THREE.MeshStandardMaterial({ color: 0xffdb58, emissive: 0xffcc33, emissiveIntensity: 1.0 });

    this.rainSystem = new THREE.Group();
    this.rainParticles = [];
    this.rainMaterial = new THREE.MeshBasicMaterial({ color: 0x99ccff, transparent: true, opacity: 0 });
    const rainGeom = new THREE.BoxGeometry(0.04, 0.6, 0.04);
    
    for (let i = 0; i < 300; i++) {
        const drop = new THREE.Mesh(rainGeom, this.rainMaterial);
        drop.position.set(
            (Math.random() - 0.5) * 20,
            Math.random() * 20,
            (Math.random() - 0.5) * 20
        );
        this.rainParticles.push(drop);
        this.rainSystem.add(drop);
    }
    this.scene.add(this.rainSystem);
  }

  update(appState: AppState, dt: number, timeElapsed: number) {
    const t = appState.time;
    
    const targetWeather = appState.weather === 'rain' ? 1.0 : 0.0;
    const weatherSpeed = 1.0 * dt; 
    if (this.weatherIntensity < targetWeather) {
      this.weatherIntensity = Math.min(1.0, this.weatherIntensity + weatherSpeed);
    } else if (this.weatherIntensity > targetWeather) {
      this.weatherIntensity = Math.max(0.0, this.weatherIntensity - weatherSpeed);
    }

    const dayRatio = t / 24; 
    const sunAngle = (dayRatio * Math.PI * 2) - Math.PI / 2;
    this.sunLight.position.set(Math.cos(sunAngle) * 15, Math.sin(sunAngle) * 15, Math.sin(sunAngle) * 5);
    
    let skyColor = new THREE.Color();
    let hemiSky = new THREE.Color();
    let hemiGround = new THREE.Color(0x444444);
    let sunColor = new THREE.Color();
    let baseSunIntensity = 0;
    let hemiIntensity = 0;

    if (t >= 4 && t < 8) {
      const f = (t - 4) / 4;
      skyColor.lerpColors(new THREE.Color(0x0a1128), new THREE.Color(0x87CEEB), f);
      sunColor.lerpColors(new THREE.Color(0xff8c00), new THREE.Color(0xffffee), f);
      baseSunIntensity = f * 1.5;
      hemiSky.lerpColors(new THREE.Color(0x223355), new THREE.Color(0xffffff), f);
      hemiIntensity = 0.2 + f * 0.4;
    } else if (t >= 8 && t < 16) {
      skyColor.setHex(0x87CEEB);
      sunColor.setHex(0xffffee);
      baseSunIntensity = 1.5;
      hemiSky.setHex(0xffffff);
      hemiIntensity = 0.6;
    } else if (t >= 16 && t < 20) {
      const f = (t - 16) / 4;
      skyColor.lerpColors(new THREE.Color(0x87CEEB), new THREE.Color(0xff7a59), Math.min(f * 2, 1));
      skyColor.lerpColors(skyColor, new THREE.Color(0x0a1128), Math.max(0, (f - 0.5) * 2));
      sunColor.lerpColors(new THREE.Color(0xffffee), new THREE.Color(0xff4500), f);
      baseSunIntensity = 1.5 * (1 - f);
      hemiSky.lerpColors(new THREE.Color(0xffffff), new THREE.Color(0x223355), f);
      hemiIntensity = 0.6 - f * 0.4;
    } else {
      skyColor.setHex(0x0a1128);
      sunColor.setHex(0x0a1128);
      baseSunIntensity = 0;
      hemiSky.setHex(0x223355);
      hemiIntensity = 0.2;
    }

    if (this.weatherIntensity > 0) {
      skyColor.lerp(new THREE.Color(0x556677), this.weatherIntensity * 0.8);
      hemiSky.lerp(new THREE.Color(0x8899aa), this.weatherIntensity * 0.7);
      baseSunIntensity *= (1.0 - (this.weatherIntensity * 0.6));
    }

    (this.scene.background as THREE.Color).copy(skyColor);
    if (this.scene.fog && this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(skyColor);
    }
    
    this.ambientLight.color.copy(hemiSky);
    this.ambientLight.groundColor.copy(hemiGround);
    this.ambientLight.intensity = hemiIntensity;
    this.sunLight.color.copy(sunColor);
    this.sunLight.intensity = baseSunIntensity;

    this.housePointLight.visible = appState.houseLights;
    this.ctx.houseWindows.forEach(win => {
        win.material = appState.houseLights ? this.windowMatOn : this.windowMatOff;
    });

    const w = appState.wind;
    
    this.ctx.windmillBlades.rotation.z -= (0.2 + w * 2.5) * dt;

    this.ctx.trees.forEach((tree, idx) => {
        const swayOffset = idx * 1.5;
        const activeWind = 0.1 + w * 0.9;
        tree.rotation.z = Math.sin(timeElapsed * 2 + swayOffset) * 0.05 * activeWind;
        tree.rotation.x = Math.cos(timeElapsed * 1.5 + swayOffset) * 0.05 * activeWind;
    });

    this.ctx.clouds.forEach(cloud => {
        cloud.position.x -= (0.3 + w * 3) * dt;
        if (cloud.position.x < -15) {
            cloud.position.x = 15;
            cloud.position.z = (Math.random() - 0.5) * 20; 
        }
        cloud.children.forEach(puff => {
           if (puff instanceof THREE.Mesh) {
             const cloudMat = puff.material as THREE.MeshStandardMaterial;
             cloudMat.color.lerpColors(
                 new THREE.Color(0xffffff), 
                 new THREE.Color(0x6b7b8b), 
                 this.weatherIntensity
             );
           }
        });
    });

    this.rainMaterial.opacity = this.weatherIntensity > 0 ? this.weatherIntensity * 0.5 : 0;
    this.rainSystem.visible = this.weatherIntensity > 0.01;

    if (this.weatherIntensity > 0) {
        this.rainParticles.forEach(drop => {
            drop.position.y -= 15 * dt;
            drop.position.x -= (w * 4) * dt;
            if (drop.position.y < -2) {
                drop.position.y = 10 + Math.random() * 5;
                drop.position.x = (Math.random() - 0.5) * 25 + (w * 5); 
            }
        });
        
        const ripY = 1 + Math.sin(timeElapsed * 12) * 0.015 * this.weatherIntensity;
        const ripX = 1 + Math.cos(timeElapsed * 10) * 0.015 * this.weatherIntensity;
        this.ctx.pond.scale.set(ripX, ripY, ripX);
    } else {
        this.ctx.pond.scale.set(1, 1, 1);
    }
  }
}
