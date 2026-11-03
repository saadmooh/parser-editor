'use client'
import { SceneMetricControl, SceneToggleControl } from '../editor/scene-property-controls'
import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { ActionButton, useEditor, PanelSection } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { IrrigationPathControls } from './path-controls'
import { irrigationPorts, portIsOccupied } from './ports'
import { IrrigationRunNode, irrigationRunIssues, irrigationRunLength } from './run'
export default function IrrigationRunInspector({ node: raw }: { node?: AnyNode } = {}) {
  const id = useViewer(state => state.selection.selectedIds[0])
  const selected = useScene(state => id ? state.nodes[id as AnyNodeId] : undefined)
  const nodes = useScene(state => state.nodes), readOnly = useScene(state => state.readOnly)
  const parsed = IrrigationRunNode.safeParse(raw ?? selected)
  if (!parsed.success) return null
  const node = parsed.data
  return <div onWheelCapture={event => event.stopPropagation()}><PanelSection title="Irrigation run">
    <p className="text-xs leading-5 text-muted-foreground">{irrigationRunLength(node).toFixed(2)} m centerline · {node.zone || 'Unassigned'}. Drag the pipe handles to adjust its route. Draw from a free end to continue, or click a pipe to create a branch.</p>
    {irrigationRunIssues(node, nodes).map(issue => <p key={issue} className="text-xs leading-5 text-muted-foreground">{issue}</p>)}
    <div className="flex flex-wrap gap-2">{irrigationPorts(node).filter(p => !portIsOccupied(p, nodes)).map(p => <ActionButton key={p.id} label={`Continue from ${p.id}`} disabled={readOnly} onClick={() => { useEditor.getState().setToolDefaults('landscape:irrigation-run', { continuation: { nodeId: node.id, portId: p.id } }); useEditor.getState().setMode('build'); useEditor.getState().setTool('landscape:irrigation-run') }} />)}<ActionButton label="Draw a branch" disabled={readOnly} onClick={() => { useEditor.getState().setToolDefaults('landscape:irrigation-run', {}); useEditor.getState().setMode('build'); useEditor.getState().setTool('landscape:irrigation-run') }} /></div>
    <p className="text-xs text-muted-foreground">Drag a midpoint handle to add a bend. Alt-drag an end to detach its socket.</p>
    <SceneMetricControl label="Run nominal diameter" value={node.diameter} unit="in" precision={2} min={0.25} max={4} step={0.25} onChange={diameter => {
      const state = useScene.getState()
      if (!state.readOnly && IrrigationRunNode.safeParse(state.nodes[node.id as AnyNodeId]).success) state.updateNode(node.id as AnyNodeId, { diameter } as Partial<AnyNode>)
    }} />
    <SceneToggleControl label="Protect this route from automatic branching" checked={node.routingLocked} onChange={routingLocked => { if (!useScene.getState().readOnly) useScene.getState().updateNode(node.id as AnyNodeId, { routingLocked } as Partial<AnyNode>) }} />
    <SceneMetricControl label="Pipe internal diameter" value={node.internalDiameterMm ?? node.diameter * 25.4} unit="mm" precision={1} min={4} max={200} step={1} onChange={internalDiameterMm => { if (!useScene.getState().readOnly) useScene.getState().updateNode(node.id as AnyNodeId, { internalDiameterMm } as Partial<AnyNode>) }} />
    <details className="text-xs"><summary className="cursor-pointer py-2">Exact path coordinates</summary><IrrigationPathControls key={node.id} node={node} /></details>
  </PanelSection></div>
}
