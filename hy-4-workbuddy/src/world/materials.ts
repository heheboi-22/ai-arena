import * as THREE from 'three';
import { clamp } from '../util/math';

export interface MatOptions {
  roughness?: number;
  metalness?: number;
  flatShading?: boolean;
  vertexColors?: boolean;
  map?: THREE.Texture | null;
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
}

export function standard(color: THREE.ColorRepresentation, opts: MatOptions = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.88,
    metalness: opts.metalness ?? 0,
    flatShading: opts.flatShading ?? false,
    vertexColors: opts.vertexColors ?? false,
    map: opts.map ?? null,
    side: opts.side ?? THREE.FrontSide,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
}

/**
 * Rain darkens and cools every outdoor surface from one place. Each tracked
 * material keeps its authored colour, so toggling weather never accumulates
 * a colour drift no matter how often it is switched.
 */
class WetnessRegistry {
  private items: { mat: THREE.MeshStandardMaterial; base: THREE.Color; amount: number }[] = [];
  private cool = new THREE.Color('#78909a');
  private last = -1;

  track<T extends THREE.MeshStandardMaterial>(mat: T, amount = 1): T {
    this.items.push({ mat, base: mat.color.clone(), amount });
    return mat;
  }

  apply(rain: number): void {
    const r = clamp(rain, 0, 1);
    if (Math.abs(r - this.last) < 0.002) return;
    this.last = r;
    for (const { mat, base, amount } of this.items) {
      const k = r * amount;
      mat.color.copy(base).multiplyScalar(1 - 0.20 * k).lerp(this.cool, 0.10 * k);
    }
  }
}

export const wetness = new WetnessRegistry();
