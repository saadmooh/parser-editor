'use client'
import { ZonePicker, zoneAssignment } from './zone-picker'
import { SceneMetricControl, SceneToggleControl } from '../editor/scene-property-controls'
import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { ActionButton, PanelSection } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { IrrigationHeadNode } from './schema'

export default function IrrigationInspector({ node: raw }: { node?: AnyNode } = {}) {
  const selectedId = useViewer((state) => state.selection.selectedIds[0])
  const selected = useScene((state) => selectedId ? state.nodes[selectedId as AnyNodeId] : undefined)
  const parsed = IrrigationHeadNode.safeParse(raw ?? selected)
  const readOnly = useScene((state) => state.readOnly)
  if (!parsed.success) return null
  const node = parsed.data
  const update = (patch: Partial<IrrigationHeadNode>) => {
    const state = useScene.getState()
    if (!state.readOnly && state.nodes[node.id as AnyNodeId]) state.updateNode(node.id as AnyNodeId, patch as Partial<AnyNode>)
  }
  return <div onWheelCapture={event => event.stopPropagation()}><PanelSection title="Irrigation head">
    <div className="space-y-2 px-3 pb-3">
      <p className="text-xs text-muted-foreground">Drag the reach, direction, and arc handles on the drawing.</p>
      <ZonePicker method="sprinkler" parentId={node.parentId} value={node.zone} disabled={readOnly} onChange={zone => update(zoneAssignment(zone))} />
      <div className="flex gap-1">{[90, 180, 270, 360].map(arc => <button key={arc} type="button" disabled={readOnly} aria-pressed={node.arc === arc} onClick={() => update({ arc })} className="rounded border border-border px-2 py-1 text-xs">{arc}°</button>)}</div>
      <SceneMetricControl label="Inlet diameter" value={node.inletDiameter} unit="in" precision={2} min={0.25} max={4} step={0.25} onChange={(inletDiameter) => update({ inletDiameter })} />
      <SceneMetricControl label="Reach radius" value={node.radius} unit="m" precision={2} min={0.1} max={30} step={0.1} onChange={(radius) => update({ radius })} />
      <SceneMetricControl label="Spray arc" value={node.arc} unit="°" precision={0} min={1} max={360} step={1} onChange={(arc) => update({ arc })} />
      <SceneMetricControl label="Authored flow" value={node.flow} unit="L/min" precision={2} min={0} max={100} step={0.1} onChange={(flow) => update({ flow })} />
      <SceneToggleControl label="Preview water spray in 3D" checked={node.showSpray} onChange={(showSpray) => update({ showSpray })} />
      <p className="text-xs text-muted-foreground">Spray shows the chosen reach. Supply pressure and obstacles do not change it.</p>
      <SceneToggleControl label="Show plan coverage" checked={node.showCoverage} onChange={(showCoverage) => update({ showCoverage })} />
      <div className="flex"><ActionButton label="Delete head" disabled={readOnly} onClick={() => {
        const state = useScene.getState()
        if (!state.readOnly) { state.deleteNode(node.id as AnyNodeId); useViewer.getState().setSelection({ selectedIds: [] }) }
      }} /></div>
    </div>
  </PanelSection></div>
}
