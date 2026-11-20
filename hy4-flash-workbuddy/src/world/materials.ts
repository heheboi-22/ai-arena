import { Color, DoubleSide, MeshStandardMaterial } from 'three'
import { grassTexture, plasterTexture, sailTexture, shingleTexture, woodTexture } from './textures'

export interface Materials {
  grass: MeshStandardMaterial
  grassLip: MeshStandardMaterial
  cliff: MeshStandardMaterial
  soil: MeshStandardMaterial
  sand: MeshStandardMaterial
  cream: MeshStandardMaterial
  wood: MeshStandardMaterial
  woodDark: MeshStandardMaterial
  roof: MeshStandardMaterial
  stone: MeshStandardMaterial
  glass: MeshStandardMaterial
  frame: MeshStandardMaterial
  sail: MeshStandardMaterial
  leafLight: MeshStandardMaterial
  leafMid: MeshStandardMaterial
  leafDark: MeshStandardMaterial
  blossom: MeshStandardMaterial
  applyWetness: (amount: number) => void
}

interface WetEntry {
  material: MeshStandardMaterial
  dry: Color
  roughness: number
  wetFactor: number
}

export function createMaterials(): Materials {
  const wet: WetEntry[] = []
  const track = (material: MeshStandardMaterial, wetFactor = 0.32): MeshStandardMaterial => {
    wet.push({ material, dry: material.color.clone(), roughness: material.roughness, wetFactor })
    return material
  }

  const grass = track(new MeshStandardMaterial({
    color: 0xffffff, map: grassTexture(), vertexColors: true, roughness: 0.96, metalness: 0,
  }))
  const grassLip = track(new MeshStandardMaterial({ color: 0x5d8146, roughness: 0.95, flatShading: true }))
  const cliff = track(new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.94, flatShading: true }))
  const soil = track(new MeshStandardMaterial({ color: 0x6b523c, roughness: 0.97, flatShading: true }))
  const sand = track(new MeshStandardMaterial({ color: 0xd9c49a, roughness: 0.92, flatShading: true }))
  const cream = track(new MeshStandardMaterial({ color: 0xf4e6ca, map: plasterTexture(), roughness: 0.92 }))
  const wood = track(new MeshStandardMaterial({ color: 0xa57750, map: woodTexture(), roughness: 0.86 }))
  const woodDark = track(new MeshStandardMaterial({ color: 0x6d4b33, roughness: 0.88, flatShading: true }))
  const roof = track(new MeshStandardMaterial({ color: 0xd08a6a, map: shingleTexture(), roughness: 0.9 }))
  const stone = track(new MeshStandardMaterial({ color: 0xa9a291, roughness: 0.95, flatShading: true }))
  const frame = track(new MeshStandardMaterial({ color: 0x5c4533, roughness: 0.85 }))
  const sail = track(new MeshStandardMaterial({ color: 0xf1e5ca, map: sailTexture(), roughness: 0.95, side: DoubleSide }))
  const leafLight = track(new MeshStandardMaterial({ color: 0x84ad62, roughness: 0.93, flatShading: true }), 0.24)
  const leafMid = track(new MeshStandardMaterial({ color: 0x5f8a4d, roughness: 0.93, flatShading: true }), 0.24)
  const leafDark = track(new MeshStandardMaterial({ color: 0x3f6a43, roughness: 0.93, flatShading: true }), 0.24)
  const blossom = track(new MeshStandardMaterial({ color: 0xe6a9b4, roughness: 0.9, flatShading: true }), 0.22)

  const glass = new MeshStandardMaterial({
    color: 0x53666b,
    emissive: new Color(0xffb865),
    emissiveIntensity: 0.02,
    roughness: 0.28,
    metalness: 0.05,
  })

  const wetTint = new Color(0x3d4d4a)

  return {
    grass, grassLip, cliff, soil, sand, cream, wood, woodDark, roof, stone, glass, frame, sail,
    leafLight, leafMid, leafDark, blossom,
    applyWetness(amount: number) {
      for (const entry of wet) {
        entry.material.color.copy(entry.dry).lerp(wetTint, amount * entry.wetFactor)
        entry.material.roughness = entry.roughness * (1 - amount * 0.32)
      }
    },
  }
}
