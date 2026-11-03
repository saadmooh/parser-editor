'use client'
import { DriplineConnectionsPanel } from './dripline-connections-panel'
import { ZonePicker, zoneAssignment } from './zone-picker'
import { SceneMetricControl } from '../editor/scene-property-controls'
import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { PanelSection } from '@pascal-app/editor'
import { IrrigationPathControls } from './path-controls'
import { useViewer } from '@pascal-app/viewer'
import { DriplineNode, driplineMetrics } from './dripline'
export default function DriplineInspector({ node: raw }: { node?: AnyNode } = {}) {
  const id = useViewer(state => state.selection.selectedIds[0])
  const selected = useScene(state => id ? state.nodes[id as AnyNodeId] : undefined)
  const parsed = DriplineNode.safeParse(raw ?? selected)
  const readOnly = useScene(state => state.readOnly)
  if (!parsed.success) return null
  const node = parsed.data, metrics = driplineMetrics(node)
  const update = (patch: Partial<DriplineNode>) => {
    const state = useScene.getState()
    if (!state.readOnly && DriplineNode.safeParse(state.nodes[node.id as AnyNodeId]).success) state.updateNode(node.id as AnyNodeId, patch as Partial<AnyNode>)
  }
  return <div onWheelCapture={event => event.stopPropagation()}><PanelSection title="Dripline">
    <p className="text-xs leading-5 text-muted-foreground">{metrics.length.toFixed(2)} m · {metrics.emitters} emitters · {metrics.flow.toFixed(3)} L/min authored demand. Emitters start at the line's first point and repeat at the spacing distance.</p>
    <SceneMetricControl label="Emitter spacing" value={node.emitterSpacing} unit="m" precision={2} min={0.1} max={5} step={0.05} onChange={emitterSpacing => update({ emitterSpacing })} />
    <SceneMetricControl label="Emitter authored flow" value={node.emitterFlow} unit="L/h" precision={2} min={0.1} max={20} step={0.1} onChange={emitterFlow => update({ emitterFlow })} />
    <SceneMetricControl label="Dripline nominal diameter" value={node.diameter} unit="in" precision={2} min={0.25} max={1.5} step={0.25} onChange={diameter => update({ diameter })} />
    <ZonePicker method="drip" parentId={node.parentId} label="Dripline zone" value={node.zone} disabled={readOnly} onChange={zone => update(zoneAssignment(zone))} />
    <DriplineConnectionsPanel key={node.id} node={node} />
    <details className="text-xs"><summary className="cursor-pointer py-2">Exact path coordinates</summary><IrrigationPathControls key={node.id} node={node} /></details>
    <p className="text-xs leading-5 text-muted-foreground">Level-relative schematic line. The first vertex is the inlet (marked in plan); its nominal diameter and zone are checked by connected runs. Supply routing, terrain support and actual irrigation performance require review.</p>
  </PanelSection></div>
}
