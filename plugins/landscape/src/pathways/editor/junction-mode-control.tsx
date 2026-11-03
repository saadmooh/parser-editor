'use client'
import { SegmentedControl } from '@pascal-app/editor'
import { isCurvedPathEdge, setPathJunctionMode, visiblePathVertices } from '../domain/edit-curve'
import type { PathwayNode } from '../domain/schema'

export function PathwayJunctionModeControl({ node, onUpdate }: {
  node: PathwayNode; onUpdate: (patch: Partial<PathwayNode>) => void
}) {
  const editable = visiblePathVertices(node).filter((vertex) => {
    const incident = node.edges.filter((edge) => edge.from === vertex.id || edge.to === vertex.id)
    return incident.length === 2 && incident.every((edge) => isCurvedPathEdge(node, edge))
  })
  if (!editable.length) return null
  return <div style={{ display: 'grid', gap: 8 }}>
    <div style={{ fontSize: 12 }}>Curve junctions</div>
    {editable.map((vertex) => <div key={vertex.id} style={{ display: 'grid', gap: 3 }}>
      <div style={{ fontSize: 11 }}>J{node.vertices.indexOf(vertex) + 1}</div>
      <SegmentedControl value={vertex.curveMode ?? 'smooth'} options={[
        { label: 'Smooth', value: 'smooth' }, { label: 'Corner', value: 'corner' },
      ]} onChange={(mode) => {
        const graph = setPathJunctionMode(node, vertex.id, mode)
        onUpdate({ vertices: graph.vertices, edges: graph.edges })
      }} />
    </div>)}
  </div>
}
