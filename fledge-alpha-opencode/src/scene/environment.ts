import * as THREE from 'three';

interface Stop {
  h: number;
  sky: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  fog: THREE.Color;
}

const STOPS: Stop[] = [
  { h: 0.0, sky: new THREE.Color(0x0e1626), hemiSky: new THREE.Color(0x2a3a5c), hemiGround: new THREE.Color(0x1a1f2e), fog: new THREE.Color(0x0e1626) },
  { h: 4.5, sky: new THREE.Color(0x14203a), hemiSky: new THREE.Color(0x33456e), hemiGround: new THREE.Color(0x20243a), fog: new THREE.Color(0x14203a) },
  { h: 6.0, sky: new THREE.Color(0xd98a63), hemiSky: new THREE.Color(0xe8b490), hemiGround: new THREE.Color(0x6b5a52), fog: new THREE.Color(0xc98a6b) },
  { h: 8.0, sky: new THREE.Color(0xa9d4e6), hemiSky: new THREE.Color(0xbfe3f0), hemiGround: new THREE.Color(0x8a9a7a), fog: new THREE.Color(0xa9d4e6) },
  { h: 12.0, sky: new THREE.Color(0x9ecfe6), hemiSky: new THREE.Color(0xcfeaf5), hemiGround: new THREE.Color(0x93a884), fog: new THREE.Color(0xa8d4e8) },
  { h: 16.0, sky: new THREE.Color(0xa6d2e4), hemiSky: new THREE.Color(0xcce6ee), hemiGround: new THREE.Color(0x8fa07e), fog: new THREE.Color(0xaed6e6) },
  { h: 18.2, sky: new THREE.Color(0xf2a468), hemiSky: new THREE.Color(0xf5c39a), hemiGround: new THREE.Color(0x7a624f), fog: new THREE.Color(0xe8a878) },
  { h: 19.8, sky: new THREE.Color(0x54497a), hemiSky: new THREE.Color(0x6e6398), hemiGround: new THREE.Color(0x33304a), fog: new THREE.Color(0x4c4570) },
  { h: 21.5, sky: new THREE.Color(0x18223c), hemiSky: new THREE.Color(0x35446e), hemiGround: new THREE.Color(0x22263c), fog: new THREE.Color(0x18223c) },
  { h: 24.0, sky: new THREE.Color(0x0e1626), hemiSky: new THREE.Color(0x2a3a5c), hemiGround: new THREE.Color(0x1a1f2e), fog: new THREE.Color(0x0e1626) },
];

function sampleStops(h: number): Stop {
  const hh = ((h % 24) + 24) % 24;
  let a = STOPS[0];
  let b = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (hh >= STOPS[i].h && hh <= STOPS[i + 1].h) {
      a = STOPS[i];
      b = STOPS[i + 1];
      break;
    }
  }
  const t = THREE.MathUtils.clamp((hh - a.h) / Math.max(1e-5, b.h - a.h), 0, 1);
  const s = t * t * (3 - 2 * t);
  return {
    h: hh,
    sky: a.sky.clone().lerp(b.sky, s),
    hemiSky: a.hemiSky.clone().lerp(b.hemiSky, s),
    hemiGround: a.hemiGround.clone().lerp(b.hemiGround, s),
    fog: a.fog.clone().lerp(b.fog, s),
  };
}

export function sunElevation(h: number): number {
  return Math.sin(((h - 6) / 12) * Math.PI);
}

export class Environment {
  readonly sun = new THREE.DirectionalLight(0xffffff, 1.2);
  readonly hemi = new THREE.HemisphereLight(0xcfeaf5, 0x8a9a7a, 0.7);
  readonly stars: THREE.Points;
  private starMat: THREE.PointsMaterial;
  readonly sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private bg = new THREE.Color();
  nightness = 0;
  sunAltitude = 1;

  constructor(private scene: THREE.Scene) {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x9ecfe6) },
        bottom: { value: new THREE.Color(0xcfe6f0) },
      },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 bottom;
        void main(){
          float h = normalize(vP).y;
          float t = smoothstep(-0.08, 0.55, h);
          gl_FragColor = vec4(mix(bottom, top, t), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(90, 24, 14), this.skyMat);
    this.sky.renderOrder = -1;
    scene.add(this.sky);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -10;
    this.sun.shadow.camera.right = 10;
    this.sun.shadow.camera.top = 10;
    this.sun.shadow.camera.bottom = -10;
    this.sun.shadow.camera.near = 2;
    this.sun.shadow.camera.far = 60;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    scene.add(this.sun);
    scene.add(this.sun.target);
    scene.add(this.hemi);

    const starCount = 260;
    const pos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * Math.PI * 0.45 + 0.05;
      const r = 55;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      pos[i * 3 + 1] = Math.sin(e) * r;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xcfdcff, size: 0.32, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false });
    this.stars = new THREE.Points(g, this.starMat);
    scene.add(this.stars);

    scene.fog = new THREE.Fog(0xa8d4e8, 30, 80);
    scene.background = this.bg;
  }

  update(time: number, rainAmount: number) {
    const stops = sampleStops(time);
    const elev = sunElevation(time);
    this.sunAltitude = elev;
    const night = THREE.MathUtils.clamp((0.05 - elev) / 0.3, 0, 1);
    this.nightness = night;

    // Sun / moon placement
    if (elev > -0.18) {
      const az = ((time - 6) / 12) * Math.PI; // 0 east .. PI west
      const r = 26;
      this.sun.position.set(Math.cos(az) * r * 0.9, Math.max(elev, 0.02) * r, Math.sin(az) * r * 0.35 + 6);
      const warm = new THREE.Color(0xffb26b);
      const noon = new THREE.Color(0xfff3dd);
      const dayness = THREE.MathUtils.clamp(elev * 1.6, 0, 1);
      this.sun.color.copy(warm).lerp(noon, dayness);
      const sunUp = Math.pow(Math.max(elev, 0), 1.2) * 1.35;
      const glow = THREE.MathUtils.clamp((elev + 0.18) / 0.18, 0, 1) * 0.55; // horizon glow just after sunset
      this.sun.intensity = sunUp + (elev < 0 ? glow : 0);
    } else {
      const az = ((time - 18) / 12) * Math.PI;
      const r = 26;
      const melev = Math.sin(Math.max(az, 0));
      this.sun.position.set(Math.cos(az) * r * 0.8, Math.max(melev, 0.15) * r * 0.7, Math.sin(az) * r * 0.3 + 6);
      this.sun.color.set(0x8fa8d8);
      this.sun.intensity = 0.42;
    }

    // Weather softens the key light
    this.sun.intensity *= 1 - rainAmount * 0.72;

    this.hemi.color.copy(stops.hemiSky).lerp(new THREE.Color(0x4a5a7a), rainAmount * 0.5);
    this.hemi.groundColor.copy(stops.hemiGround);
    this.hemi.intensity = 0.75 - rainAmount * 0.25 + night * -0.15;

    this.bg.copy(stops.sky);
    // Rain darkens and greys the sky, but keeps the world readable
    const rainTint = new THREE.Color().copy(stops.sky).multiplyScalar(0.55).lerp(new THREE.Color(0x3a4350), 0.5);
    this.bg.lerp(rainTint, rainAmount * 0.8);
    (this.scene.fog as THREE.Fog).color.copy(this.bg);
    (this.scene.fog as THREE.Fog).near = 30 - rainAmount * 10;
    (this.scene.background as THREE.Color).copy(this.bg);

    const top = this.bg.clone().multiplyScalar(0.72).offsetHSL(0, 0.02, -0.02);
    const bottom = this.bg.clone().offsetHSL(0, 0, 0.03);
    (this.skyMat.uniforms.top.value as THREE.Color).copy(top);
    (this.skyMat.uniforms.bottom.value as THREE.Color).copy(bottom);

    this.stars.visible = night > 0.15;
    this.starMat.opacity = night * (1 - rainAmount) * 0.9;
  }
}
