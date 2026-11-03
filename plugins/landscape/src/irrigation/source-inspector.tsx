'use client'
import { SceneMetricControl, SceneToggleControl } from '../editor/scene-property-controls'
import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { PanelSection } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { sourceReadiness } from './readiness'
import { IrrigationSourceNode } from './source'
export default function IrrigationSourceInspector({ node: raw }: { node?: AnyNode } = {}) {
  const id = useViewer(state => state.selection.selectedIds[0])
  const selected = useScene(state => id ? state.nodes[id as AnyNodeId] : undefined)
  const nodes = useScene(state => state.nodes)
  const parsed = IrrigationSourceNode.safeParse(raw ?? selected)
  if (!parsed.success) return null
  const node = parsed.data
  const readiness = sourceReadiness(node, nodes)
  const update = (patch: Partial<IrrigationSourceNode>) => {
    const state = useScene.getState()
    if (!state.readOnly && IrrigationSourceNode.safeParse(state.nodes[node.id as AnyNodeId]).success) state.updateNode(node.id as AnyNodeId, patch as Partial<AnyNode>)
  }
  return <div onWheelCapture={event => event.stopPropagation()}><PanelSection title="Water supply">
    <label className="flex items-center gap-2 text-xs">Supply data<select aria-label="Supply measurement status" value={node.measurementStatus} onChange={e => update({ measurementStatus: e.target.value as 'assumed' | 'measured' })} className="rounded border border-border bg-background p-2"><option value="assumed">Assumed, draft only</option><option value="measured">Measured under flow</option></select></label>
    <SceneToggleControl label="Backflow protection confirmed" checked={node.backflowProvided} onChange={backflowProvided => update({ backflowProvided })} />
    <SceneToggleControl label="Supply enabled" checked={node.enabled} onChange={enabled => update({ enabled })} />
    <SceneMetricControl label="Supply nominal diameter" value={node.diameter} unit="in" min={0.25} max={4} step={0.25} precision={2} onChange={diameter => update({ diameter })} />
    <SceneMetricControl label="Authored supply pressure" value={node.pressureBar} unit="bar" min={0} max={20} step={0.1} precision={2} onChange={pressureBar => update({ pressureBar })} />
    <SceneMetricControl label="Authored available flow" value={node.availableFlow} unit="L/min" min={0} max={1000} step={1} precision={2} onChange={availableFlow => update({ availableFlow })} />
    <SceneMetricControl label="Usable design flow" value={node.designFlowFraction * 100} unit="%" min={10} max={100} step={5} precision={0} onChange={value => update({ designFlowFraction: value / 100 })} />
    <SceneMetricControl label="Component pressure allowance" value={node.componentAllowanceBar} unit="bar" min={0} max={5} step={.1} precision={2} onChange={componentAllowanceBar => update({ componentAllowanceBar })} />
    <div className="space-y-1 rounded-md border border-border p-2 text-xs" aria-label="Supply connection status">
      <p>{readiness.outlets} connected watering devices</p>
      <p>{readiness.demand.toFixed(2)} / {node.availableFlow.toFixed(2)} L/min installed demand</p>
      {readiness.issues.map(issue => <p key={issue} className="text-muted-foreground">{issue}</p>)}
    </div>
    <p className="text-xs leading-5 text-muted-foreground">Enter pressure measured while water is flowing. Zone checks estimate pipe losses using the entered values; component losses use the allowance above. The outlet remains present when the source is disabled.</p>
  </PanelSection></div>
}
