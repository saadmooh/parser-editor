import { type AnyNode, type AnyNodeId, SiteNode, useScene } from '@pascal-app/core'
import { pondSiteFrame } from './site-terrain'
import { resolvePondTerrainPatch } from './site-terrain'

export function syncPondTerrain() {
  const scene = useScene.getState()
  if (scene.readOnly) return
  const tracking = useScene.temporal.getState().isTracking
  try {
    if (tracking) useScene.temporal.getState().pause()
    for (const raw of Object.values(scene.nodes)) {
      if (raw.type !== 'site') continue
      const parsed = SiteNode.safeParse(raw)
      if (!parsed.success) continue
      const patch = resolvePondTerrainPatch(parsed.data, scene.nodes)
      if (!patch) continue
      useScene.getState().updateNode(raw.id, patch as Partial<AnyNode>)
      for (const node of Object.values(scene.nodes))
        if ((node.type as string) === 'landscape:ground-area' &&
          pondSiteFrame({ parentId: node.parentId, position: [0, 0, 0], rotation: [0, 0, 0] }, scene.nodes)?.site.id === raw.id) useScene.getState().markDirty(node.id as AnyNodeId)
    }
  } finally {
    if (tracking) useScene.temporal.getState().resume()
  }
}
