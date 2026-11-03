import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import { isNaturalStoneFinish, type PathwayFinish } from '../domain/schema'

export const finishOptions: Record<PathwayFinish, { label: string; color: string; description: string }> = {
  concrete: { label: 'Smooth concrete', color: '#c2b7a3', description: 'Continuous, quiet paving' },
  brick: { label: 'Brick bond', color: '#a96e55', description: 'Staggered rectangular pavers' },
  stone: { label: 'Stone slabs', color: '#a9a394', description: 'Large square-cut slabs' },
  gravel: { label: 'Gravel path', color: '#b2a58d', description: 'Compacted aggregate look' },
  laidStone: { label: 'Laid stone', color: '#b5b7a5', description: 'Individual curved rows of beveled stone' },
  concreteSlabs: { label: 'Concrete slabs', color: '#bdbbaa', description: 'Large panels with expansion joints' },
  grassFlagstones: { label: 'Grass flagstones', color: '#a8aca4', description: 'Loose irregular slabs with open grass joints' },
  riverStones: { label: 'River stones', color: '#b6b4a8', description: 'Dense varied pebbles with smaller infill stones' },
  steppingStones: { label: 'Stepping stones', color: '#c5c5bc', description: 'Single spaced stones following the centerline' },
}

function shade(hex: string, amount: number) {
  const n = Number.parseInt(hex.slice(1), 16)
  const channels = [n >> 16, n >> 8 & 255, n & 255]
  return `rgb(${channels.map((v) => Math.max(0, Math.min(255, Math.round(v + amount)))).join(',')})`
}

export function createFinishTexture(finish: PathwayFinish, color: string): CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 512, 512)
  let seed = 7831
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  if (finish === 'brick' || finish === 'stone') {
    const width = finish === 'brick' ? 128 : 256
    const height = finish === 'brick' ? 64 : 256
    const gap = finish === 'brick' ? 5 : 7
    ctx.fillStyle = shade(color, -37)
    ctx.fillRect(0, 0, 512, 512)
    for (let row = -1; row <= 512 / height; row++) {
      const shift = finish === 'brick' && row % 2 ? width / 2 : 0
      for (let x = -width; x <= 512; x += width) {
        const px = x + shift + gap / 2, py = row * height + gap / 2
        ctx.fillStyle = shade(color, Math.round((random() - 0.5) * 24))
        ctx.fillRect(px, py, width - gap, height - gap)
        ctx.fillStyle = 'rgba(255,255,255,0.13)'
        ctx.fillRect(px, py, width - gap, 3)
      }
    }
  } else {
    if (finish === 'laidStone' || isNaturalStoneFinish(finish)) for (let i = 0; i < 45; i++) {
      const x = random() * 512, y = random() * 512, radius = 15 + random() * 60
      const cloud = ctx.createRadialGradient(x, y, 0, x, y, radius)
      cloud.addColorStop(0, random() > 0.5 ? 'rgba(255,255,240,0.07)' : 'rgba(58,65,48,0.06)')
      cloud.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = cloud
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
    }
    const count = finish === 'gravel' ? 8000 : finish === 'laidStone' || isNaturalStoneFinish(finish) ? 14000 : 1900
    for (let i = 0; i < count; i++) {
      const x = random() * 512, y = random() * 512
      const size = finish === 'gravel' ? 1 + random() * 3 : 1 + random() * 2
      ctx.fillStyle = shade(color, (random() - 0.5) * (finish === 'gravel' ? 90 : 25))
      ctx.fillRect(x, y, size, size)
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.colorSpace = SRGBColorSpace
  return texture
}
