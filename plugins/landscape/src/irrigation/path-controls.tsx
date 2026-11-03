'use client'
import { SceneMetricControl } from '../editor/scene-property-controls'
import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { ActionButton, ActionGroup, PanelSection } from '@pascal-app/editor'
import { useState } from 'react'
import { DriplineNode } from './dripline'
import { IrrigationRunNode } from './run'
export function IrrigationPathControls({ node }: { node: DriplineNode | IrrigationRunNode }) {
  const [vertex, setVertex] = useState(0)
  const [pathError, setPathError] = useState('')
  const readOnly = useScene(state => state.readOnly)
  const isDripline = node.type === 'landscape:dripline'
  const label = isDripline ? 'Dripline' : 'Run'
  const prefix = label
  const schema = isDripline ? DriplineNode : IrrigationRunNode
  const activeVertex = Math.min(vertex, node.path.length - 1)
  const editPath = (edit: (path: DriplineNode['path']) => DriplineNode['path']) => {
    const state = useScene.getState()
    const current = schema.safeParse(state.nodes[node.id as AnyNodeId])
    if (state.readOnly || !current.success) return
    const path = edit(current.data.path.map(point => [...point] as [number, number, number]))
    const validated = schema.safeParse({ ...current.data, path })
    if (!validated.success) { setPathError(isDripline ? 'Keep 2–256 vertices and a total length of 0.1–300 m.' : 'Keep 2–256 finite vertices.'); return }
    setPathError('')
    state.updateNode(node.id as AnyNodeId, { path } as Partial<AnyNode>)
  }
  return (
    <PanelSection title={`${label} path`}>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">Vertex
        <select aria-label={`${label} path vertex`} value={activeVertex} onChange={event => { setVertex(Number(event.target.value)); setPathError('') }} className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-foreground">
          {node.path.map((_, index) => <option key={index} value={index}>Vertex {index + 1}{index === 0 ? ' · Start' : index === node.path.length - 1 ? ' · End' : ''}</option>)}
        </select>
      </label>
      {(['X', 'Elevation', 'Z'] as const).map((label, axis) => <SceneMetricControl key={axis} label={`${prefix} vertex ${label}`} value={node.path[activeVertex]![axis]!} unit="m" precision={2} min={-10000} max={10000} step={0.1} onChange={value => editPath(path => { path[Math.min(activeVertex, path.length - 1)]![axis] = value; return path })} />)}
      <ActionGroup>
        <ActionButton label={`Insert ${prefix.toLowerCase()} bend`} disabled={readOnly || node.path.length >= 256} onClick={() => editPath(path => {
          const edge = Math.min(activeVertex, path.length - 2)
          const a = path[edge]!, b = path[edge + 1]!
          path.splice(edge + 1, 0, a.map((value, axis) => (value + b[axis]!) / 2) as [number, number, number])
          setVertex(edge + 1)
          return path
        })} />
        <ActionButton label={`Remove ${prefix.toLowerCase()} vertex`} disabled={readOnly || node.path.length <= 2} onClick={() => editPath(path => { path.splice(Math.min(activeVertex, path.length - 1), 1); return path })} />
      </ActionGroup>
      {pathError && <p role="status" className="text-xs text-muted-foreground">{pathError}</p>}
      <p className="text-xs text-muted-foreground">Coordinates follow the line’s parent. Insert a midpoint, then move it to shape a bend. {isDripline ? 'Emitter stations follow the complete path.' : 'Keep endpoint vertices on their connected sockets; connection review reports mismatches.'}</p>
    </PanelSection>
  )
}
