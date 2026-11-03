'use client'
import { ZonePicker, zoneAssignment } from './zone-picker'
import { SceneMetricControl, SceneToggleControl } from '../editor/scene-property-controls'
import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { PanelSection } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { zoneCatalog } from './zone-model'
import { IrrigationValveNode } from './valve'
export default function IrrigationValveInspector({ node: raw }: { node?: AnyNode } = {}) {
  const id = useViewer(state => state.selection.selectedIds[0])
  const selected = useScene(state => id ? state.nodes[id as AnyNodeId] : undefined)
  const readOnly = useScene(state => state.readOnly)
  const parsed = IrrigationValveNode.safeParse(raw ?? selected)
  if (!parsed.success) return null
  const node = parsed.data
  const update = (data: Partial<IrrigationValveNode>) => {
    const state = useScene.getState()
    if (!state.readOnly && IrrigationValveNode.safeParse(state.nodes[node.id as AnyNodeId]).success) state.updateNode(node.id as AnyNodeId, data as Partial<AnyNode>)
  }
  return <div onWheelCapture={event => event.stopPropagation()}><PanelSection title="Irrigation valve">
    <p className="text-xs leading-5 text-muted-foreground">Authored valve state. Physical sockets remain available when closed. Network flow and controller operation are not calculated.</p>
    <SceneMetricControl label="Valve nominal diameter" value={node.diameter} unit="in" precision={2} min={0.25} max={4} step={0.25} onChange={diameter => update({ diameter })} />
    <SceneToggleControl label="Valve open" checked={node.isOpen} onChange={isOpen => update({ isOpen })} />
    <p className="text-xs text-muted-foreground">{node.method === 'drip' ? 'Drip valve. Connect through its filter/regulator.' : 'Sprinkler valve. Devices share a lateral feed pipe.'}</p>
    <ZonePicker method={node.method} parentId={node.parentId} label="Valve zone" value={node.zone} disabled={readOnly} onChange={zone => update({ ...zoneAssignment(zone), method: zoneCatalog(Object.values(useScene.getState().nodes)).find(z => z.name === zone)?.method })} />
  </PanelSection></div>
}
