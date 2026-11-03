'use client'
import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { lazy, Suspense, type ComponentType } from 'react'

const inspectors: Record<string, ComponentType<{ node?: AnyNode }>> = {
  'landscape:irrigation-fitting': lazy(() => import('../irrigation/fitting-inspector')),
  'landscape:irrigation-head': lazy(() => import('../irrigation/inspector')),
  'landscape:irrigation-source': lazy(() => import('../irrigation/source-inspector')),
  'landscape:irrigation-valve': lazy(() => import('../irrigation/valve-inspector')),
  'landscape:irrigation-controller': lazy(() => import('../irrigation/controller-inspector')),
  'landscape:irrigation-run': lazy(() => import('../irrigation/run-inspector')),
  'landscape:dripline': lazy(() => import('../irrigation/dripline-inspector')),
}

/** Read-only host mode hides floating inspectors; retain non-mutating inspection in Objects. */
export function ReadonlyIrrigationProperties() {
  const readOnly = useScene(state => state.readOnly)
  const ids = useViewer(state => state.selection.selectedIds)
  const node = useScene(state => ids.length === 1 ? state.nodes[ids[0]! as AnyNodeId] : undefined)
  const Inspector = node ? inspectors[node.type] : undefined
  if (!readOnly || !node || !Inspector) return null
  return <section aria-label="Read-only irrigation properties" className="space-y-2 border-t border-border pt-3">
    <p className="text-xs text-muted-foreground">Read-only properties · {node.name || 'Selected irrigation object'}</p>
    <Suspense fallback={<p role="status" className="text-xs text-muted-foreground">Loading properties…</p>}>
      <Inspector node={node} />
    </Suspense>
  </section>
}
