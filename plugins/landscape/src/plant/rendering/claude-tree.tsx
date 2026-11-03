'use client'
import { useEffect, useState } from 'react'
import { BufferGeometry, Color, DoubleSide, Group, LOD, Mesh, MeshStandardMaterial,
  SRGBColorSpace, TextureLoader } from 'three'
import type { PlantNode } from '../domain/schema'
import leafAtlas from '../assets/claude/leaves.webp'
import { buildPrototype } from '../vendor/claude/treegeo.js'

const speciesIds: Record<string, number> = {
  'claude:oak': 0, 'claude:yamazakura': 1, 'claude:kobushi': 2,
  'claude:cedar': 3, 'claude:evergreen': 4, 'claude:sakura': 5,
  'claude:kaki': 6, 'claude:willow': 7, 'claude:shrub': 8,
  'claude:bamboo': 9, 'claude:camellia': 10, 'claude:keyaki': 11,
  'claude:tsutsuji': 12,
}

export function isClaudeTree(preset: string) { return preset in speciesIds }

const atlasUrl = leafAtlas.src
let atlasPromise: ReturnType<TextureLoader['loadAsync']> | undefined
function loadAtlas() {
  if (!atlasPromise) atlasPromise = new TextureLoader().loadAsync(atlasUrl).then((texture) => {
    texture.flipY = false
    texture.colorSpace = SRGBColorSpace
    texture.needsUpdate = true
    return texture
  })
  return atlasPromise
}

const prototypeCache = new Map<string, Promise<LOD>>()
function partGeometry(source: BufferGeometry, foliage: boolean, density: number) {
  const aux = source.getAttribute('aux')
  const original = source.index?.array
  const geometry = new BufferGeometry()
  for (const name of ['position', 'normal', 'uv']) geometry.setAttribute(name, source.getAttribute(name))
  if (!original || !aux) return geometry
  const indices: number[] = []
  for (let i = 0; i < original.length; i += 3) {
    const a = Number(original[i]), b = Number(original[i + 1]), c = Number(original[i + 2])
    if ((aux.getY(a) > 0.5) !== foliage) continue
    if (foliage && density < 1) {
      const card = Math.floor(a / 4)
      const sample = ((card * 2654435761) >>> 0) / 4294967296
      if (sample > density) continue
    }
    indices.push(a, b, c)
  }
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

function makeLevel(id: number, variant: number, quality: false | 'mid', density: number, atlas: Awaited<ReturnType<typeof loadAtlas>>) {
  const result = buildPrototype(id, variant, quality) as { geo: BufferGeometry }
  const root = new Group()
  const trunk = new Mesh(partGeometry(result.geo, false, density), new MeshStandardMaterial({ color: '#55483c', roughness: 1 }))
  const leaves = new Mesh(partGeometry(result.geo, true, density), new MeshStandardMaterial({
    map: atlas, alphaTest: 0.4, side: DoubleSide, roughness: 0.9,
  }))
  leaves.userData.claudeFoliage = true
  trunk.castShadow = true; leaves.castShadow = true
  root.add(trunk, leaves)
  return root
}

function loadPrototype(key: string, id: number, variant: number, density: number) {
  let pending = prototypeCache.get(key)
  if (!pending) {
    pending = loadAtlas().then((atlas) => {
      const lod = new LOD()
      lod.addLevel(makeLevel(id, variant, false, density, atlas), 0)
      lod.addLevel(makeLevel(id, variant, 'mid', density, atlas), 28)
      return lod
    })
    prototypeCache.set(key, pending)
    pending.catch(() => prototypeCache.delete(key))
  }
  return pending
}

export default function ClaudeTree({ node }: { node: PlantNode }) {
  const [model, setModel] = useState<LOD | null>(null)
  const id = speciesIds[node.preset] ?? 0
  const variant = Math.max(0, node.seed - 1 + Math.round((node.variation - 0.4) * 10))
  const density = Math.min(1, node.density)
  useEffect(() => {
    let cancelled = false
    let owned: LOD | null = null
    setModel(null)
    const key = `${id}:${variant}:${density}`
    loadPrototype(key, id, variant, density).then((source) => {
      if (cancelled) return
      const clone = source.clone(true)
      if (node.tint) clone.traverse((object) => {
        if (!(object instanceof Mesh) || !object.userData.claudeFoliage) return
        const material = (object.material as MeshStandardMaterial).clone()
        material.color = new Color(node.tint)
        object.material = material
      })
      owned = clone
      setModel(clone)
    }).catch((error) => console.error('Failed to generate Claude tree', node.preset, error))
    return () => {
      cancelled = true
      if (node.tint) owned?.traverse((object) => {
        if (object instanceof Mesh && object.userData.claudeFoliage) (object.material as MeshStandardMaterial).dispose()
      })
    }
  }, [id, variant, density, node.tint, node.preset])
  return model ? <primitive object={model} scale={node.scale} /> : null
}
