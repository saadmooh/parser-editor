'use client'
import { type AnyNode, useScene } from '@pascal-app/core'
import { useMemo } from 'react'
import { ActionButton, PanelSection } from '@pascal-app/editor'
import { landscapeDesignChecks } from './design-checks'
import { PathwayNode } from '../pathways/domain/schema'
import { edgeGradeProfile } from '../pathways/domain/grade'
import { IrrigationRunNode, irrigationRunIssues } from '../irrigation/run'
import { IrrigationSourceNode } from '../irrigation/source'
import { sourceReadiness } from '../irrigation/readiness'
import { IrrigationControllerNode, controllerAssignmentIssues } from '../irrigation/controller'
import { IrrigationValveNode } from '../irrigation/valve'
import { selectLandscapeObjects } from './objects-panel'

export function DesignChecksPanel({ nodes }: { nodes: AnyNode[] }) {
  const sceneNodes = useScene((state) => state.nodes)
  const issues = useMemo(() => landscapeDesignChecks(nodes, sceneNodes), [nodes, sceneNodes])
  const irrigationIssues = useMemo(() => {
    const controllers = Object.values(sceneNodes).flatMap(raw => { const parsed = IrrigationControllerNode.safeParse(raw); return parsed.success ? [parsed.data] : [] })
    const valves = Object.values(sceneNodes).flatMap(raw => { const parsed = IrrigationValveNode.safeParse(raw); return parsed.success ? [parsed.data] : [] })
    return nodes.flatMap(node => {
      const run = IrrigationRunNode.safeParse(node)
      const source = IrrigationSourceNode.safeParse(node)
      const controller = IrrigationControllerNode.safeParse(node)
      const messages = run.success ? irrigationRunIssues(run.data, sceneNodes)
        : source.success ? sourceReadiness(source.data, sceneNodes).issues
        : controller.success ? controllerAssignmentIssues(controller.data, valves, controllers) : []
      return messages.map(message => ({ node, message }))
    })
  }, [nodes, sceneNodes])
  const grades = useMemo(() => nodes.flatMap(raw => {
    const parsed = PathwayNode.safeParse(raw)
    return parsed.success ? parsed.data.edges.map((edge, index) => ({ node: raw, edge, number: index + 1, profile: edgeGradeProfile(parsed.data, edge) })) : []
  }), [nodes])
  return <section aria-label="Landscape design checks" className="my-3">
    <PanelSection title={`Geometry review · ${issues.length} findings`}>
    {!issues.length && <p className="mt-2 text-[11px] text-muted-foreground">No outline, path continuity or planting footprint issues found.</p>}
    <div className="mt-2 space-y-2">{issues.map((issue, index) => {
      const node = nodes.find((candidate) => candidate.id === issue.nodeId)
      const related = nodes.find((candidate) => candidate.id === issue.relatedId)
      return <div key={`${issue.nodeId}:${index}`} className="space-y-1">
        <div className="flex"><ActionButton type="button" label={related ? 'Select overlapping plants' : node?.name || node?.type || issue.nodeId} className="w-full justify-start [&>span]:truncate" onClick={() => node && selectLandscapeObjects(related ? [node, related] : [node])} /></div>
        <p className="text-[11px] text-muted-foreground">{issue.message}</p>
      </div>
    })}</div>
    <p className="mt-2 text-[11px] text-muted-foreground">Checks cover outlines, path continuity and the first 100 planting overlaps within each parent. Plant circles use scaled catalog spread; tree crowns are schematic estimates from height. These are plan checks, not mature growth or vertical clearance. Buildings, nested-parent clearances, slopes, drainage and accessibility need separate review.</p>
    </PanelSection>
    {irrigationIssues.length > 0 && <PanelSection title={`Irrigation review · ${irrigationIssues.length} finding${irrigationIssues.length === 1 ? '' : 's'}`}>
      <div aria-label="Irrigation review findings" className="space-y-2">
        {irrigationIssues.map(({ node, message }, index) => <div key={`${node.id}:${index}`} className="space-y-1">
          <div className="flex"><ActionButton label={node.name || 'Irrigation equipment'} className="min-w-0 justify-start [&>span]:truncate" onClick={() => selectLandscapeObjects([node])} /></div>
          <p className="text-xs text-muted-foreground">{message}</p>
        </div>)}
      </div>
      <p className="text-xs text-muted-foreground">Authored connections, controller assignments and installed supply demand. Actual watering, pressure loss and simultaneous station operation are not simulated.</p>
    </PanelSection>}
    {grades.length > 0 && <PanelSection title={`Walkway grades · ${grades.length} segment${grades.length === 1 ? '' : 's'}`}>
      <div className="overflow-x-auto">
        <table aria-label="Measured walkway grades" className="w-full text-left text-xs">
          <thead className="text-muted-foreground"><tr><th className="py-2 pr-2">Segment</th><th className="pr-2 text-right">Length m</th><th className="pr-2 text-right">Rise m</th><th className="pr-2 text-right">Grade %</th><th className="text-right">Bearing °</th></tr></thead>
          <tbody>{grades.map(({ node, edge, number, profile }) => <tr key={`${node.id}:${edge.id}`} className="border-t border-border">
            <td className="py-2 pr-2"><div className="flex"><ActionButton label={`${node.name || 'Walkway'} · Segment ${number}`} title={`Select ${node.name || 'Walkway'}`} className="min-w-0 justify-start [&>span]:truncate" onClick={() => selectLandscapeObjects([node])} /></div></td>
            <td className="pr-2 text-right tabular-nums">{profile.length.toFixed(2)}</td>
            <td className="pr-2 text-right tabular-nums">{profile.rise.toFixed(2)}</td>
            <td className="text-right tabular-nums">{profile.slopePercent === null ? 'Undefined' : profile.slopePercent.toFixed(2)}</td>
            <td className="text-right tabular-nums">{profile.bearingDegrees === null ? 'Undefined' : profile.bearingDegrees.toFixed(2)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Authored longitudinal grades follow each segment’s start-to-end direction. Length is sampled plan distance. Bearing is the endpoint chord, clockwise from parent-local −Z (0°); +X is 90°. Crossfall, terrain, drainage and accessibility compliance require separate review.</p>
    </PanelSection>}
  </section>
}
