import { type PaintCapability, useScene } from '@pascal-app/core'
import {
  createMaterial,
  resolveMaterialRef,
  useViewer,
} from '@pascal-app/viewer'
import { Mesh } from 'three'
import type { PergolaNode } from '../domain/schema'

const roles = new Set([
  'posts',
  'beams',
  'braces',
  'arches',
  'rafters',
  'slats',
  'feet',
  'trim',
])

export const pergolaPaint: PaintCapability = {
  resolveRole: ({ hitObject }) => {
    const role = hitObject?.userData?.slotId
    return typeof role === 'string' && roles.has(role) ? role : null
  },
  buildPatch: ({ node, role, material, materialPreset }) => {
    const paintedMaterials = {
      ...(node as unknown as PergolaNode).paintedMaterials,
    }
    if (material || materialPreset)
      paintedMaterials[role] = { material, materialPreset }
    else delete paintedMaterials[role]
    return { paintedMaterials } as Partial<typeof node>
  },
  applyPreview: ({ role, root, material, materialPreset }) => {
    const shading = useViewer.getState().shading
    const preview = material
      ? createMaterial(material, shading)
      : resolveMaterialRef(
          materialPreset,
          useScene.getState().materials,
          shading,
        )
    if (!preview) return null
    const restores: Array<() => void> = []
    root.traverse((object) => {
      if (!(object instanceof Mesh) || object.userData.slotId !== role) return
      const previous = object.material
      object.material = preview
      restores.push(() => {
        object.material = previous
      })
    })
    return restores.length
      ? () => restores.forEach((restore) => restore())
      : null
  },
  getEffectiveMaterial: ({ node, role }) => {
    const painted = (node as unknown as PergolaNode).paintedMaterials?.[role]
    return {
      material: painted?.material,
      materialPreset: painted?.materialPreset,
    }
  },
}
