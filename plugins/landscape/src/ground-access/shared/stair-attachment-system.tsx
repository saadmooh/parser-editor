'use client'
import { type AnyNode, type AnyNodeId, useLiveNodeOverrides, useScene } from '@pascal-app/core'
import { getMovingNode, useInteractionScope } from '@pascal-app/editor'
import { useEffect } from 'react'
import { stairAttachmentUpdates } from './stair-attachment'

let subscribers = 0
let unsubscribe: (() => void) | null = null
let unsubscribeScope: (() => void) | null = null
let unsubscribeOverrides: (() => void) | null = null
let syncing = false
let previewSyncing = false
const previewFields = new Map<string, string[]>()

function syncPreviews() {
  if (previewSyncing) return
  previewSyncing = true
  try {
    const base = useScene.getState().nodes as Record<string, AnyNode>
    const store = useLiveNodeOverrides.getState()
    const effective: Record<string, AnyNode> = { ...base }
    const previewSurfaces = new Set<string>()
    for (const [id, override] of store.overrides) {
      const node = base[id]
      if (!node || !['landscape:deck', 'landscape:patio', 'landscape:concrete-slab',
        'landscape:landing'].includes(node.type as string)) continue
      effective[id] = { ...node, ...override } as AnyNode
      previewSurfaces.add(id)
    }
    const next = new Map<string, Record<string, unknown>>()
    if (previewSurfaces.size) {
      for (const { id, data } of stairAttachmentUpdates(effective, undefined, base)) {
        // Preview only changes to an already attached stair and its flight.
        if (data.parentId !== undefined || data.destinationSurfaceId !== undefined) continue
        const node = base[id]
        const stair = node?.type === 'stair' ? node : base[node?.parentId ?? '']
        if (!stair || !previewSurfaces.has(stair.parentId ?? '')) continue
        next.set(id, data)
      }
    }
    for (const [id, fields] of previewFields) {
      const upcoming = next.get(id)
      const stale = fields.filter((field) => !upcoming || !(field in upcoming))
      if (stale.length) store.clearFields(id, stale)
    }
    previewFields.clear()
    for (const [id, data] of next) previewFields.set(id, Object.keys(data))
    store.setMany([...next])
  } finally {
    previewSyncing = false
  }
}

function reconcile(previousNodes?: Readonly<Record<string, AnyNode>>) {
  if (syncing) return
  const movingNode = getMovingNode()
  const updates = stairAttachmentUpdates(useScene.getState().nodes,
    movingNode?.type === 'stair' ? movingNode.id : undefined, previousNodes)
  if (!updates.length) return
  syncing = true
  const tracking = useScene.temporal.getState().isTracking
  try {
    if (tracking) useScene.temporal.getState().pause()
    useScene.getState().updateNodes(updates.map(({ id, data }) => ({
      id: id as AnyNodeId, data: data as Partial<AnyNode>,
    })))
    syncPreviews()
  } finally {
    if (tracking) useScene.temporal.getState().resume()
    syncing = false
  }
}

export default function StairAttachmentSystem() {
  useEffect(() => {
    if (subscribers++ === 0) {
      unsubscribe = useScene.subscribe((current, previous) => {
        if (current.nodes !== previous.nodes) reconcile(previous.nodes)
      })
      unsubscribeScope = useInteractionScope.subscribe((current, previous) => {
        if (current.scope !== previous.scope) reconcile()
      })
      unsubscribeOverrides = useLiveNodeOverrides.subscribe((current, previous) => {
        if (current.overrides !== previous.overrides) syncPreviews()
      })
      reconcile()
      syncPreviews()
    }
    return () => {
      subscribers--
      if (subscribers === 0) {
        unsubscribe?.()
        unsubscribe = null
        unsubscribeScope?.()
        unsubscribeScope = null
        unsubscribeOverrides?.()
        unsubscribeOverrides = null
        for (const [id, fields] of previewFields)
          useLiveNodeOverrides.getState().clearFields(id, fields)
        previewFields.clear()
      }
    }
  }, [])
  return null
}
