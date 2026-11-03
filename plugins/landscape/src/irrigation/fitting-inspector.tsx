'use client'
import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { ActionButton, PanelSection, useEditor, useViewer } from '@pascal-app/editor'
import { IrrigationFittingNode } from './fitting'
import { SceneMetricControl } from '../editor/scene-property-controls'
import { selectLandscapeObjects } from '../editor/objects-panel'
import { IrrigationValveNode } from './valve'
import { irrigationPorts, portIsOccupied } from './ports'
export default function FittingInspector({ node: raw }: { node?: AnyNode } = {}) {
  const selected = useViewer(s => s.selection.selectedIds[0]), nodes = useScene(s => s.nodes), readOnly = useScene(s => s.readOnly)
  const parsed = IrrigationFittingNode.safeParse(raw ?? (selected ? nodes[selected as AnyNodeId] : undefined))
  if (!parsed.success) return null
  const node = parsed.data
  const update = (patch: Partial<IrrigationFittingNode>) => {
    const state = useScene.getState(), current = state.nodes[node.id as AnyNodeId]
    if (!state.readOnly && IrrigationFittingNode.safeParse(current).success && IrrigationFittingNode.safeParse({ ...current, ...patch }).success) state.updateNode(node.id as AnyNodeId, patch as Partial<AnyNode>)
  }
  const owner = node.ownerValveId ? IrrigationValveNode.safeParse(nodes[node.ownerValveId as AnyNodeId]) : null
  return <div onWheelCapture={event => event.stopPropagation()}><PanelSection title={node.fittingType === 'filter-regulator' ? 'Drip filter and regulator' : node.name || 'Pipe fitting'}>
    <p className="text-xs text-muted-foreground">{node.fittingType} · {node.zone || 'Supply main'} · {node.diameters.join(' / ')} in</p>
    {node.fittingType === 'filter-regulator' && <div className="space-y-2">
      <p className="text-xs leading-5 text-muted-foreground">Filters debris and sets the pressure limit for this drip zone.</p>
      <SceneMetricControl label="Outlet pressure" value={node.regulatedPressureBar} unit="bar" precision={1} min={.1} max={10} step={.1} onChange={regulatedPressureBar => update({ regulatedPressureBar })} />
      <SceneMetricControl label="Filter mesh" value={node.filterMesh} unit="mesh" precision={0} min={50} max={300} step={1} onChange={filterMesh => update({ filterMesh: Math.round(filterMesh) })} />
      <p className="text-xs leading-5 text-muted-foreground">Higher mesh numbers mean finer filtering. Match these settings to your selected equipment.</p>
      {owner?.success && <ActionButton label={`View valve: ${owner.data.name || owner.data.zone}`} onClick={() => selectLandscapeObjects([owner.data as unknown as AnyNode])} />}
    </div>}
    <p className="text-xs font-medium pt-2">Connections</p>
    {irrigationPorts(node).map((port, i) => <div key={port.id} className="flex items-center justify-between gap-2 py-1 text-xs">
      <span>{node.fittingType === 'filter-regulator' ? i === 0 ? 'Inlet' : 'Outlet' : `Socket ${i + 1}`} · {port.diameter} in</span>
      {portIsOccupied(port, nodes) ? <span className="text-muted-foreground">Connected</span> : <ActionButton label={`Draw from socket ${i + 1}`} disabled={readOnly} onClick={() => {
        useEditor.getState().setToolDefaults('landscape:irrigation-run', { continuation: { nodeId: node.id, portId: port.id } })
        useEditor.getState().setMode('build'); useEditor.getState().setTool('landscape:irrigation-run')
      }} />}
    </div>)}
  </PanelSection></div>
}
