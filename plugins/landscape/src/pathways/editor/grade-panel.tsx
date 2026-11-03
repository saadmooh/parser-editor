'use client'
import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { MetricControl, PanelSection } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { PathwayNode } from '../domain/schema'
import { edgeGradeProfile } from '../domain/grade'
import { PathwaySectionPanel } from './path-section'
export function PathwayGradePanel() {
  const selected = useViewer((state) => state.selection.selectedIds)
  const raw = useScene((state) => selected.length === 1 ? state.nodes[selected[0] as AnyNodeId] : undefined)
  if ((raw?.type as string) !== 'landscape:pathway') return null
  const parsed = PathwayNode.safeParse(raw)
  if (!parsed.success) return null
  const path = parsed.data
  return <><PanelSection title="Junction grades">
    <p className="text-xs text-muted-foreground">Offsets start at the walkway's base elevation.</p>
    {path.vertices.map((vertex, index) => <MetricControl key={vertex.id} label={`Junction ${index + 1} offset`} value={vertex.elevationOffset ?? 0} unit="m" precision={2} min={-100} max={100} step={0.05} onChange={(elevationOffset) => {
      const state = useScene.getState()
      const current = PathwayNode.safeParse(state.nodes[path.id as AnyNodeId])
      if (state.readOnly || !current.success) return
      state.updateNode(path.id as AnyNodeId, { vertices: current.data.vertices.map((item) => item.id === vertex.id ? { ...item, elevationOffset } : item) } as Partial<AnyNode>)
    }} />)}
    {path.edges.map((edge, index) => {
      const profile = edgeGradeProfile(path, edge)
      return <p key={edge.id} className="text-xs">Edge {index + 1}: {profile.length.toFixed(2)} m · {profile.slopePercent?.toFixed(2) ?? 'undefined'}% grade</p>
    })}
  </PanelSection><PathwaySectionPanel key={path.id} path={path} /></>
}
