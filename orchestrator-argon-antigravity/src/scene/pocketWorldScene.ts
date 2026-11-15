import * as THREE from 'three';
import {
  SmoothedWorldState,
  computeEnvironmentLighting,
} from '../state/worldState';
import { ArchitectureBuildResult, buildArchitecture } from './buildArchitecture';
import { IslandBuildResult, buildIsland } from './buildIsland';
import { SceneMaterials, createSceneMaterials } from './materials';
import { NatureBuildResult, buildNatureAndDetails } from './buildNatureAndDetails';
import { WeatherEffectsController, createWeatherEffects } from './weatherEffects';

export class PocketWorldScene {
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;

  private readonly materials: SceneMaterials;
  private readonly island: IslandBuildResult;
  private readonly architecture: ArchitectureBuildResult;
  private readonly nature: NatureBuildResult;
  private readonly weatherEffects: WeatherEffectsController;

  private readonly worldPivot: THREE.Group;
  private readonly sunLight: THREE.DirectionalLight;
  private readonly ambientLight: THREE.AmbientLight;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly skyCanvas: HTMLCanvasElement;
  private readonly skyCtx: CanvasRenderingContext2D | null;
  private readonly skyTexture: THREE.CanvasTexture;

  private lastTopHex = '';
  private lastHorizonHex = '';
  private lastBottomHex = '';
  private disposed = false;

  constructor(container: HTMLElement) {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const isSmallDevice = width < 768 || (typeof navigator !== 'undefined' && navigator.hardwareConcurrency <= 4);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmallDevice ? 1.5 : 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xdcebf5, 0.014);

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 120);
    this.camera.position.set(8.8, 5.4, 10.2);
    this.applyResponsiveCameraFov(width, height);

    // Sky gradient canvas background
    this.skyCanvas = document.createElement('canvas');
    this.skyCanvas.width = 2;
    this.skyCanvas.height = 256;
    this.skyCtx = this.skyCanvas.getContext('2d');
    this.skyTexture = new THREE.CanvasTexture(this.skyCanvas);
    this.skyTexture.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.skyTexture;

    // Lights
    this.ambientLight = new THREE.AmbientLight(0xaab9c7, 0.42);
    this.hemiLight = new THREE.HemisphereLight(0xffe9ca, 0x6b5b49, 0.74);
    this.sunLight = new THREE.DirectionalLight(0xffe4b8, 1.9);
    this.sunLight.castShadow = true;
    const shadowSize = isSmallDevice ? 1024 : 2048;
    this.sunLight.shadow.mapSize.set(shadowSize, shadowSize);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 36;
    const d = 6.8;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;

    this.scene.add(this.ambientLight, this.hemiLight, this.sunLight);

    // Build diorama layers inside worldPivot for gentle floating motion
    this.worldPivot = new THREE.Group();
    this.scene.add(this.worldPivot);

    this.materials = createSceneMaterials();
    this.island = buildIsland(this.materials);
    this.architecture = buildArchitecture(this.materials);
    this.nature = buildNatureAndDetails(this.materials, this.architecture.chimneySmokeOrigin);
    this.weatherEffects = createWeatherEffects();

    this.worldPivot.add(
      this.island.root,
      this.architecture.houseGroup,
      this.architecture.windmillGroup,
      this.nature.root,
      this.weatherEffects.group,
    );
  }

  public getHouseHitTargets(): THREE.Object3D[] {
    return this.architecture.houseHitTargets;
  }

  public resize(width: number, height: number): void {
    if (this.disposed) {
      return;
    }
    const safeW = Math.max(1, width);
    const safeH = Math.max(1, height);
    this.camera.aspect = safeW / safeH;
    this.applyResponsiveCameraFov(safeW, safeH);
    this.renderer.setSize(safeW, safeH);
  }

  private applyResponsiveCameraFov(width: number, height: number): void {
    const aspect = width / Math.max(1, height);
    const baseFov = 40;
    const minAspect = 1.08;
    if (aspect < minAspect) {
      const halfTan = Math.tan(THREE.MathUtils.degToRad(baseFov / 2));
      const adjusted = THREE.MathUtils.radToDeg(2 * Math.atan(halfTan * (minAspect / aspect)));
      this.camera.fov = Math.min(68, adjusted);
    } else {
      this.camera.fov = baseFov;
    }
    this.camera.updateProjectionMatrix();
  }

  public update(smoothed: SmoothedWorldState, dt: number, reducedMotion: boolean): void {
    if (this.disposed) {
      return;
    }

    const env = computeEnvironmentLighting(smoothed);

    // 1. Update sky gradient texture only when colors change meaningfully
    if (
      env.skyTopHex !== this.lastTopHex ||
      env.skyHorizonHex !== this.lastHorizonHex ||
      env.skyBottomHex !== this.lastBottomHex
    ) {
      this.updateSkyTexture(env.skyTopHex, env.skyHorizonHex, env.skyBottomHex);
      this.lastTopHex = env.skyTopHex;
      this.lastHorizonHex = env.skyHorizonHex;
      this.lastBottomHex = env.skyBottomHex;
    }

    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.setHex(env.fogColorHex);
      this.scene.fog.density = 0.012 + smoothed.rainFactor * 0.012;
    }

    // 2. Lighting & materials
    this.sunLight.position.set(...env.sunPosition);
    this.sunLight.color.setHex(env.sunColor);
    this.sunLight.intensity = env.sunIntensity;

    this.ambientLight.color.setHex(env.ambientColor);
    this.ambientLight.intensity = env.ambientIntensity;

    this.hemiLight.color.setHex(env.hemiSkyColor);
    this.hemiLight.groundColor.setHex(env.hemiGroundColor);
    this.hemiLight.intensity = env.hemiIntensity;

    this.materials.cloudMaterial.color.setHex(env.cloudColorHex);
    this.materials.water.color.setHex(env.waterColorHex);
    this.materials.windowGlass.emissiveIntensity = env.windowEmissiveIntensity;
    this.materials.lanternGlow.emissiveIntensity = 0.15 + smoothed.houseLightFactor * 1.4;
    this.architecture.housePointLight.intensity = env.houseLightIntensity;
    this.architecture.porchPointLight.intensity = env.houseLightIntensity * 0.65;

    // Night stars visibility (dimmed when raining)
    this.nature.starMaterial.opacity = Math.max(
      0,
      env.nightFactor * (1 - smoothed.rainFactor * 0.85) * 0.85,
    );

    // 3. Gentle floating bob for island and satellite shards
    const bobAmp = reducedMotion ? 0 : 0.09;
    this.worldPivot.position.y = Math.sin(smoothed.islandBobTime * 1.1) * bobAmp;
    for (const shard of this.island.floatingShards) {
      const shardBob = reducedMotion ? 0 : Math.sin(smoothed.islandBobTime * 1.5 + shard.phase) * 0.14;
      shard.mesh.position.y = shard.baseY + shardBob;
    }

    // 4. Windmill blades rotation
    this.architecture.windmillBladesPivot.rotation.z = -smoothed.windmillAngle;

    // 5. Tree sway driven by shared wind state
    const wind = smoothed.windFactor;
    const swayAmp = wind < 0.01 ? 0 : (0.012 + wind * 0.085) * (reducedMotion ? 0.3 : 1);
    const leanBias = wind * 0.075 * (reducedMotion ? 0.3 : 1);
    for (const tree of this.nature.trees) {
      const wave = Math.sin(smoothed.swayTime * 1.7 + tree.phase);
      const crossWave = Math.cos(smoothed.swayTime * 1.25 + tree.phase * 1.3);
      tree.crownGroup.rotation.z = tree.baseRotZ - leanBias * tree.flexibility + wave * swayAmp * tree.flexibility;
      tree.crownGroup.rotation.x = tree.baseRotX + crossWave * swayAmp * 0.55 * tree.flexibility;
    }

    // 6. Clouds gliding smoothly across the sky perimeter
    for (const cloud of this.nature.clouds) {
      const driftRange = 13.5;
      const rawOffset = (smoothed.cloudPhase * cloud.speedMultiplier * 2.2 + cloud.phase * 2.1) % driftRange;
      const xPos = ((cloud.baseX + rawOffset + driftRange / 2) % driftRange) - driftRange / 2;
      const bob = reducedMotion ? 0 : Math.sin(smoothed.islandBobTime * 0.8 + cloud.phase) * 0.12;
      cloud.group.position.set(xPos, cloud.baseY + bob, cloud.baseZ);
    }

    // 7. Chimney smoke puffs rising and leaning with wind
    for (const puff of this.nature.smokePuffs) {
      puff.age += dt;
      if (puff.age >= puff.maxAge) {
        puff.age = puff.age % puff.maxAge;
      }
      const p = puff.age / puff.maxAge;
      const windDrift = wind * 1.45 * p * p;
      puff.mesh.position.set(
        puff.startX + windDrift + Math.sin(p * 5 + puff.seed) * 0.06,
        puff.startY + p * 1.55,
        puff.startZ + wind * 0.45 * p * p + Math.cos(p * 4 + puff.seed) * 0.05,
      );
      const scale = 0.55 + p * 1.55;
      puff.mesh.scale.setScalar(scale);
      puff.mesh.visible = !reducedMotion && p < 0.96;
    }

    // 8. Pooled 3D weather effects
    this.weatherEffects.update(smoothed, dt);

    this.renderer.render(this.scene, this.camera);
  }

  private updateSkyTexture(topHex: string, horizonHex: string, bottomHex: string): void {
    if (!this.skyCtx) {
      return;
    }
    const grad = this.skyCtx.createLinearGradient(0, 0, 0, this.skyCanvas.height);
    grad.addColorStop(0, topHex);
    grad.addColorStop(0.56, horizonHex);
    grad.addColorStop(1, bottomHex);
    this.skyCtx.fillStyle = grad;
    this.skyCtx.fillRect(0, 0, this.skyCanvas.width, this.skyCanvas.height);
    this.skyTexture.needsUpdate = true;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.weatherEffects.dispose();
    this.materials.dispose();
    this.skyTexture.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
