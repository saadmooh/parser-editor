import { type PaintCapability, useScene } from '@pascal-app/core'
import { createMaterial, resolveMaterialRef, useViewer } from '@pascal-app/viewer'
import { Mesh, type Group, type Material } from 'three'

type PaintedMaterial = { material?: Parameters<typeof createMaterial>[0]; materialPreset?: string }

export function createLandscapePaintCapability(roles: readonly string[]): PaintCapability {
  const allowed = new Set(roles)
  return {
    resolveRole: ({ hitObject }) => {
      const role = hitObject?.userData?.slotId
      return typeof role === 'string' && allowed.has(role) ? role : null
    },
    buildPatch: ({ node, role, material, materialPreset }) => {
      const paintedMaterials = { ...((node as { paintedMaterials?: Record<string, PaintedMaterial> }).paintedMaterials ?? {}) }
      if (material || materialPreset) paintedMaterials[role] = { material, materialPreset }
      else delete paintedMaterials[role]
      return { paintedMaterials } as never
    },
    applyPreview: ({ role, root, material, materialPreset }) => {
      const shading = useViewer.getState().shading
      const preview = material ? createMaterial(material, shading)
        : resolveMaterialRef(materialPreset, useScene.getState().materials, shading)
      if (!preview) return null
      const restores: Array<() => void> = []
      root.traverse((object) => {
        if (!(object instanceof Mesh) || object.userData.slotId !== role) return
        const previous = object.material
        object.material = preview
        restores.push(() => { object.material = previous })
      })
      return restores.length ? () => restores.forEach((restore) => restore()) : null
    },
    getEffectiveMaterial: ({ node, role }) => {
      const painted = (node as { paintedMaterials?: Record<string, PaintedMaterial> }).paintedMaterials?.[role]
      return { material: painted?.material, materialPreset: painted?.materialPreset }
    },
  }
}

export function applyLandscapePaintedMaterials(
  group: Group,
  paintedMaterials: Record<string, PaintedMaterial> | undefined,
  roleForMesh: (mesh: Mesh) => string | null,
  disposeReplaced = true,
) {
  const resolved = new Map<string, Material | null>()
  const replaced = new Set<Material>()
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const role = roleForMesh(object)
    if (!role) return
    object.userData.slotId = role
    const painted = paintedMaterials?.[role]
    if (!painted) return
    if (!resolved.has(role)) resolved.set(role, painted.material
      ? createMaterial(painted.material, 'rendered')
      : painted.materialPreset
        ? resolveMaterialRef(painted.materialPreset, useScene.getState().materials, 'rendered')
        : null)
    const material = resolved.get(role)
    if (!material) return
    for (const old of Array.isArray(object.material) ? object.material : [object.material]) replaced.add(old)
    object.material = material
  })
  if (disposeReplaced) for (const material of replaced) {
    if (!material.userData.__pascalCachedMaterial) {
      const map = (material as Material & { map?: { userData: Record<string, unknown>; dispose(): void } }).map
      if (map?.userData.__landscapeOwnedTexture) map.dispose()
      material.dispose()
    }
  }
}
