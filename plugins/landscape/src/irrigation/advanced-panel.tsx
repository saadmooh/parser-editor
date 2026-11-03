'use client'
import { IrrigationFittingNode } from './fitting'
import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { ActionButton, ActionGroup, MetricControl, PanelSection, SegmentedControl, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useState } from 'react'
import { selectLandscapeObjects } from '../editor/objects-panel'
import { levelDescendants } from '../editor/scene-inventory'
import { IrrigationHeadNode, IRRIGATION_HEAD_KIND } from './schema'
import { irrigationZones, zoneReachArea } from './zones'
import { irrigationScheduleCsv } from './schedule'
import { IrrigationRunNode, canRouteSourceToValve, routeSourceToValve, canRouteValveToDripline, routeValveToDripline, canRouteHeads, canRouteValveToHead, connectedIrrigationRunIds, irrigationRunIssues, irrigationRunLength, routeBetweenHeads, routeValveToHead } from './run'
import { IrrigationValveNode } from './valve'
import { IrrigationControllerNode } from './controller'
import { sourceReadiness } from './readiness'
import { IrrigationSourceNode } from './source'
import { DriplineNode, driplineMetrics } from './dripline'

export function IrrigationAdvancedPanel() {
  const [view, setView] = useState<'design' | 'network' | 'schedule'>('design')
  const levelId = useViewer((state) => state.selection.levelId)
  const selectedIds = useViewer((state) => state.selection.selectedIds)
  const [showExportPreview, setShowExportPreview] = useState(false)
  const [assignment, setAssignment] = useState('Zone 1')
  const nodes = useScene((state) => state.nodes)
  const readOnly = useScene((state) => state.readOnly)
  const [x, setX] = useState(0)
  const [z, setZ] = useState(0)
  const [depth, setDepth] = useState(0.3)
  const [dripLength, setDripLength] = useState(3)
  const heads = levelDescendants(nodes, levelId).flatMap((node) => {
    if ((node.type as string) !== IRRIGATION_HEAD_KIND) return []
    const parsed = IrrigationHeadNode.safeParse(node)
    return parsed.success ? [parsed.data] : []
  })
  const sources = levelDescendants(nodes, levelId).flatMap(raw => { const parsed = IrrigationSourceNode.safeParse(raw); return parsed.success ? [parsed.data] : [] })
  const selectedSources = sources.filter(source => selectedIds.includes(source.id))
  const selectedHeads = heads.filter((head) => selectedIds.includes(head.id))
  const driplines = levelDescendants(nodes, levelId).flatMap(raw => { const parsed = DriplineNode.safeParse(raw); return parsed.success ? [parsed.data] : [] })
  const selectedDriplines = driplines.filter(drip => selectedIds.includes(drip.id))
  const valves = levelDescendants(nodes, levelId).flatMap(raw => {
    const parsed = IrrigationValveNode.safeParse(raw)
    return parsed.success ? [parsed.data] : []
  })
  const occupiedInlet = selectedHeads.some(head => connectedIrrigationRunIds(head.id, nodes).length > 0)
  const selectedValves = valves.filter(valve => selectedIds.includes(valve.id))
  const controllers = levelDescendants(nodes, levelId).flatMap(raw => {
    const parsed = IrrigationControllerNode.safeParse(raw)
    return parsed.success ? [parsed.data] : []
  })
  const occupiedValveOutlet = selectedValves.some(valve => connectedIrrigationRunIds(valve.id, nodes, 'outlet').length > 0)
  const runs = levelDescendants(nodes, levelId).flatMap((node) => {
    const result = IrrigationRunNode.safeParse(node)
    return result.success ? [result.data] : []
  })
  const fittings = levelDescendants(nodes, levelId).flatMap(raw => { const parsed = IrrigationFittingNode.safeParse(raw); return parsed.success ? [parsed.data] : [] })
  const route = () => {
    const state = useScene.getState()
    if (state.readOnly) return
    const level = useViewer.getState().selection.levelId
    if (!level || !state.nodes[level]) return
    const selected = useViewer.getState().selection.selectedIds.flatMap((id) => {
      const result = IrrigationHeadNode.safeParse(state.nodes[id as AnyNodeId])
      return result.success && result.data.parentId === level ? [result.data] : []
    })
    if (selected.length !== 2) return
    if (selected.some(head => connectedIrrigationRunIds(head.id, state.nodes).length > 0)) return
    const run = routeBetweenHeads(selected[0]!, selected[1]!, depth)
    if (!run) return
    state.createNode(run as unknown as AnyNode, level)
    selectLandscapeObjects([run as unknown as AnyNode])
  }
  const assignZone = () => {
    const state = useScene.getState()
    if (state.readOnly) return
    const currentLevel = useViewer.getState().selection.levelId
    const currentIds = new Set(useViewer.getState().selection.selectedIds)
    const zone = assignment.trim().slice(0, 80)
    const updates = levelDescendants(state.nodes, currentLevel).flatMap((node) => {
      if (!currentIds.has(node.id) || (node.type as string) !== IRRIGATION_HEAD_KIND) return []
      const parsed = IrrigationHeadNode.safeParse(node)
      return parsed.success && parsed.data.zone !== zone ? [{ id: node.id as AnyNodeId, data: { zone } as Partial<AnyNode> }] : []
    })
    if (updates.length) state.updateNodes(updates)
  }
  const setZoneCoverage = (zone: string, showCoverage: boolean) => {
    const state = useScene.getState()
    if (state.readOnly) return
    const level = useViewer.getState().selection.levelId
    const updates = levelDescendants(state.nodes, level).flatMap((node) => {
      if ((node.type as string) !== IRRIGATION_HEAD_KIND) return []
      const parsed = IrrigationHeadNode.safeParse(node)
      return parsed.success && parsed.data.zone.trim() === zone && parsed.data.showCoverage !== showCoverage
        ? [{ id: node.id as AnyNodeId, data: { showCoverage } as Partial<AnyNode> }] : []
    })
    if (updates.length) state.updateNodes(updates)
  }
  const exportSchedule = () => {
    const url = URL.createObjectURL(new Blob(['\uFEFF' + irrigationScheduleCsv(heads, { sources, driplines, valves, controllers, runs, fittings })], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'landscape-irrigation-schedule.csv'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const add = () => {
    if (!levelId || !useScene.getState().nodes[levelId] || useScene.getState().readOnly) return
    const node = IrrigationHeadNode.parse({ parentId: levelId, name: `Irrigation head ${heads.length + 1}`, position: [x, 0, z] })
    useScene.getState().createNode(node as unknown as AnyNode, levelId)
    selectLandscapeObjects([node as unknown as AnyNode])
  }
  return <PanelSection title={`Irrigation · ${heads.length + driplines.length + valves.length + controllers.length + sources.length + runs.length} objects`}>
    <div role="group" aria-label="Irrigation workspace view" onKeyDownCapture={event => {
      if (event.key !== ' ') return
      const button = (event.target as HTMLElement).closest('button')
      if (!button || !event.currentTarget.contains(button)) return
      const next = button.textContent?.trim().toLowerCase()
      if (next !== 'design' && next !== 'network' && next !== 'schedule') return
      event.preventDefault()
      event.stopPropagation()
      setView(next)
    }}><SegmentedControl value={view} onChange={setView} options={(['design', 'network', 'schedule'] as const).map(value => ({ value, label: <span aria-current={view === value ? 'page' : undefined}>{value[0]!.toUpperCase() + value.slice(1)}</span> }))} /></div>
    {view === 'design' && <div className="space-y-3" aria-label="Irrigation design">
    <div className="flex"><ActionButton label="Place irrigation heads" disabled={readOnly || !levelId} onClick={() => {
      if (useScene.getState().readOnly) return
      useEditor.getState().setMode('build')
      useEditor.getState().setTool(IRRIGATION_HEAD_KIND)
    }} /></div>
    <p className="text-xs leading-5 text-muted-foreground">Add at level coordinates, then move in the scene. Plan reach is authored; pressure, obstacles and actual watering coverage need separate design checks.</p>
    <MetricControl label="Irrigation X" value={x} unit="m" min={-10000} max={10000} step={0.1} precision={2} onChange={setX} />
    <MetricControl label="Irrigation Z" value={z} unit="m" min={-10000} max={10000} step={0.1} precision={2} onChange={setZ} />
    <div className="flex"><ActionButton label="Add irrigation head" disabled={readOnly || !levelId} onClick={add} /></div>
    <MetricControl label="New dripline length" value={dripLength} unit="m" precision={2} min={0.1} max={300} step={0.5} onChange={setDripLength} />
    <div className="flex"><ActionButton label="Add dripline" disabled={readOnly || !levelId} onClick={() => {
      const state = useScene.getState(), level = useViewer.getState().selection.levelId
      if (state.readOnly || !level || !state.nodes[level]) return
      const line = DriplineNode.safeParse({ parentId: level, name: `Dripline ${driplines.length + 1}`, path: [[x, 0, z], [x + dripLength, 0, z]] })
      if (!line.success) return
      state.createNode(line.data as unknown as AnyNode, level)
      selectLandscapeObjects([line.data as unknown as AnyNode])
    }} /></div>
    {driplines.map(line => <div key={line.id} className="flex"><ActionButton label={`${line.name || 'Dripline'} · ${driplineMetrics(line).emitters} emitters · ${driplineMetrics(line).flow.toFixed(3)} L/min`} onClick={() => selectLandscapeObjects([line as unknown as AnyNode])} /></div>)}
    <div className="flex"><ActionButton label="Add irrigation controller" disabled={readOnly || !levelId} onClick={() => {
      const state = useScene.getState()
      const level = useViewer.getState().selection.levelId
      if (state.readOnly || !level || !state.nodes[level]) return
      const controller = IrrigationControllerNode.parse({ parentId: level, position: [x, 0, z], name: `Irrigation controller ${controllers.length + 1}` })
      state.createNode(controller as unknown as AnyNode, level)
      selectLandscapeObjects([controller as unknown as AnyNode])
    }} /></div>
    {controllers.map(controller => <div key={controller.id} className="flex"><ActionButton label={`${controller.name || 'Controller'} · ${controller.enabled ? controller.startTime : 'Off'}`} onClick={() => selectLandscapeObjects([controller as unknown as AnyNode])} /></div>)}
    <div className="flex"><ActionButton label="Add irrigation supply" disabled={readOnly || !levelId} onClick={() => {
      const state = useScene.getState(), level = useViewer.getState().selection.levelId
      if (state.readOnly || !level || !state.nodes[level]) return
      const source = IrrigationSourceNode.parse({ parentId: level, position: [x, 0, z], name: `Water supply ${sources.length + 1}` })
      state.createNode(source as unknown as AnyNode, level)
      selectLandscapeObjects([source as unknown as AnyNode])
    }} /></div>
    {sources.map(source => <div className="flex" key={source.id}><ActionButton label={`${source.name || 'Water supply'} · ${source.enabled ? `${source.pressureBar.toFixed(2)} bar · ${source.availableFlow.toFixed(2)} L/min` : 'Off'}`} onClick={() => selectLandscapeObjects([source as unknown as AnyNode])} /></div>)}
    <div className="flex"><ActionButton label="Add irrigation valve" disabled={readOnly || !levelId} onClick={() => {
      const state = useScene.getState()
      const level = useViewer.getState().selection.levelId
      if (state.readOnly || !level || !state.nodes[level]) return
      const valve = IrrigationValveNode.parse({ parentId: level, position: [x, 0, z], name: `Zone valve ${valves.length + 1}` })
      state.createNode(valve as unknown as AnyNode, level)
      selectLandscapeObjects([valve as unknown as AnyNode])
    }} /></div>
    {valves.map(valve => <div key={valve.id} className="space-y-1 border-b border-border pb-2">
      <div className="flex"><ActionButton label={`${valve.name || 'Zone valve'} · ${valve.zone} · ${valve.isOpen ? 'Open' : 'Closed'}`} onClick={() => selectLandscapeObjects([valve as unknown as AnyNode])} /></div>
      <div className="flex"><ActionButton label={`${valve.isOpen ? 'Close' : 'Open'} ${valve.name || 'zone valve'}`} disabled={readOnly} onClick={() => {
        const state = useScene.getState()
        const current = IrrigationValveNode.safeParse(state.nodes[valve.id as AnyNodeId])
        if (!state.readOnly && current.success) state.updateNode(valve.id as AnyNodeId, { isOpen: !current.data.isOpen } as Partial<AnyNode>)
      }} /></div>
    </div>)}
    {selectedHeads.length > 0 && <div className="space-y-2 border-t border-border pt-3">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">Assign zone
        <input aria-label="Zone for selected irrigation heads" value={assignment} maxLength={80} disabled={readOnly}
          className="min-w-0 flex-1 rounded-md border border-border/50 bg-secondary px-2 py-1.5 text-foreground"
          onChange={(event) => setAssignment(event.target.value)} />
      </label>
      <div className="flex"><ActionButton label={`Assign zone to ${selectedHeads.length} selected heads`} disabled={readOnly} onClick={assignZone} /></div>
    </div>}
    {heads.length + driplines.length > 0 && <div className="space-y-2 border-t border-border pt-3" aria-label="Irrigation zone summary">
      <p className="text-xs text-muted-foreground">Zone demand sums authored head and dripline flows, including hidden objects. Supply pressure and simultaneous operation are not calculated.</p>
      {irrigationZones(heads, driplines).map((zone) => <div key={zone.name} className="space-y-1">
        <p className="text-xs text-muted-foreground">Plan reach union: {zoneReachArea(zone.heads)?.toFixed(1) ?? 'needs parent-transform review'} m² (overlaps counted once).</p>
        <p className="text-xs">{zone.name || 'No zone assigned'} · {zone.heads.length} heads · {zone.driplines.length} driplines · {zone.flow.toFixed(3)} L/min</p>
        <ActionGroup>
          <ActionButton label={`Show reach for ${zone.name || 'unassigned zone'}`} disabled={readOnly || zone.heads.every((head) => head.showCoverage)} onClick={() => setZoneCoverage(zone.name, true)} />
          <ActionButton label={`Hide reach for ${zone.name || 'unassigned zone'}`} disabled={readOnly || zone.heads.every((head) => !head.showCoverage)} onClick={() => setZoneCoverage(zone.name, false)} />
        </ActionGroup>
        <div className="flex"><ActionButton label={`Select heads in ${zone.name || 'unassigned zone'}`} disabled={!zone.heads.length}
          onClick={() => selectLandscapeObjects(zone.heads.flatMap((head) => {
            const current = useScene.getState().nodes[head.id as AnyNodeId]
            return current ? [current] : []
          }))} /></div>
      </div>)}
    </div>}
    {heads.map((head) => <div className="space-y-1.5" key={head.id}>
      <div className="flex"><ActionButton label={`${head.name || 'Head'} · ${head.zone || 'Unassigned'} · ${head.flow.toFixed(1)} L/min`}
        onClick={() => selectLandscapeObjects([head as unknown as AnyNode])} /></div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">Zone
        <input aria-label={`Zone for ${head.name || 'head'}`} key={head.zone} defaultValue={head.zone} disabled={readOnly}
          className="min-w-0 flex-1 rounded-md border border-border/50 bg-[#2C2C2E] px-2 py-1.5 text-foreground"
          onBlur={(event) => {
            const zone = event.currentTarget.value.trim().slice(0, 80)
            const scene = useScene.getState()
            if (!scene.readOnly && scene.nodes[head.id as AnyNodeId] && zone !== head.zone)
              scene.updateNode(head.id as AnyNodeId, { zone } as Partial<AnyNode>)
          }} />
      </label>
    </div>)}
    </div>}
    {view === 'network' && <div className="space-y-3" aria-label="Irrigation network">
      <p className="text-xs text-muted-foreground">Select equipment in Objects, then connect compatible sockets here. Review supply capacity and authored connection issues below.</p>
    <div className="flex"><ActionButton label="Route supply to valve" disabled={readOnly || selectedSources.length !== 1 || selectedValves.length !== 1 || selectedSources.some(source => connectedIrrigationRunIds(source.id, nodes).length) || selectedValves.some(valve => connectedIrrigationRunIds(valve.id, nodes, 'inlet').length) || !canRouteSourceToValve(selectedSources[0]!, selectedValves[0]!, depth)} onClick={() => {
      const state = useScene.getState(), level = useViewer.getState().selection.levelId
      if (state.readOnly || !level || !state.nodes[level]) return
      const selected = useViewer.getState().selection.selectedIds.map(id => state.nodes[id as AnyNodeId])
      const sources = selected.flatMap(raw => { const parsed = IrrigationSourceNode.safeParse(raw); return parsed.success && parsed.data.parentId === level ? [parsed.data] : [] })
      const valves = selected.flatMap(raw => { const parsed = IrrigationValveNode.safeParse(raw); return parsed.success && parsed.data.parentId === level ? [parsed.data] : [] })
      if (sources.length !== 1 || valves.length !== 1 || connectedIrrigationRunIds(sources[0]!.id, state.nodes).length || connectedIrrigationRunIds(valves[0]!.id, state.nodes, 'inlet').length) return
      const run = routeSourceToValve(sources[0]!, valves[0]!, depth)
      if (!run) return
      state.createNode(run as unknown as AnyNode, level)
      selectLandscapeObjects([run as unknown as AnyNode])
    }} /></div>
    <div className="flex"><ActionButton label="Route valve to head" disabled={readOnly || selectedValves.length !== 1 || selectedHeads.length !== 1 || occupiedInlet || occupiedValveOutlet || !canRouteValveToHead(selectedValves[0]!, selectedHeads[0]!, depth)} onClick={() => {
      const state = useScene.getState()
      const level = useViewer.getState().selection.levelId
      if (state.readOnly || !level || !state.nodes[level]) return
      const selected = useViewer.getState().selection.selectedIds.map(id => state.nodes[id as AnyNodeId])
      const currentValves = selected.flatMap(raw => { const parsed = IrrigationValveNode.safeParse(raw); return parsed.success && parsed.data.parentId === level ? [parsed.data] : [] })
      const currentHeads = selected.flatMap(raw => { const parsed = IrrigationHeadNode.safeParse(raw); return parsed.success && parsed.data.parentId === level ? [parsed.data] : [] })
      if (currentValves.length !== 1 || currentHeads.length !== 1) return
      if (connectedIrrigationRunIds(currentHeads[0]!.id, state.nodes).length || connectedIrrigationRunIds(currentValves[0]!.id, state.nodes, 'outlet').length) return
      const run = routeValveToHead(currentValves[0]!, currentHeads[0]!, depth)
      if (!run) return
      state.createNode(run as unknown as AnyNode, level)
      selectLandscapeObjects([run as unknown as AnyNode])
    }} /></div>
    <div className="flex"><ActionButton label="Route valve to dripline" disabled={readOnly || selectedValves.length !== 1 || selectedDriplines.length !== 1 || occupiedValveOutlet || selectedDriplines.some(drip => connectedIrrigationRunIds(drip.id, nodes).length) || !canRouteValveToDripline(selectedValves[0]!, selectedDriplines[0]!, depth)} onClick={() => {
      const state = useScene.getState(), level = useViewer.getState().selection.levelId
      if (state.readOnly || !level || !state.nodes[level]) return
      const selection = useViewer.getState().selection.selectedIds.map(id => state.nodes[id as AnyNodeId])
      const valves = selection.flatMap(raw => { const parsed = IrrigationValveNode.safeParse(raw); return parsed.success && parsed.data.parentId === level ? [parsed.data] : [] })
      const drips = selection.flatMap(raw => { const parsed = DriplineNode.safeParse(raw); return parsed.success && parsed.data.parentId === level ? [parsed.data] : [] })
      if (valves.length !== 1 || drips.length !== 1 || connectedIrrigationRunIds(valves[0]!.id, state.nodes, 'outlet').length || connectedIrrigationRunIds(drips[0]!.id, state.nodes).length) return
      const run = routeValveToDripline(valves[0]!, drips[0]!, depth)
      if (!run) return
      state.createNode(run as unknown as AnyNode, level)
      selectLandscapeObjects([run as unknown as AnyNode])
    }} /></div>
    <p className="text-xs text-muted-foreground">Select a valve and dripline with matching zone and nominal size. Routing meets the first vertex inlet; filtration, regulation and water supply still need design.</p>
    <p className="text-xs leading-5 text-muted-foreground">Select one valve and one head with matching zone and nominal size to route the valve outlet. The valve inlet still needs a supply connection.</p>
    <p className="text-xs leading-5 text-muted-foreground">Select two heads on this level with matching zone and inlet size to draft a buried centerline. Supply, fittings, clearance and pressure are not yet designed.</p>
    <MetricControl label="Route depth below outlets" value={depth} unit="m" precision={2} min={0.05} max={3} step={0.05} onChange={setDepth} />
    <div className="flex"><ActionButton label="Route selected heads" disabled={readOnly || selectedHeads.length !== 2 || occupiedInlet || !canRouteHeads(selectedHeads[0]!, selectedHeads[1]!, depth)} onClick={route} /></div>
    {occupiedInlet && <p role="status" className="text-xs leading-5 text-muted-foreground">A selected inlet already has a run. Use a branch fitting before adding another connection.</p>}
    {runs.map((run) => <div key={run.id} className="space-y-1 border-b border-border pb-2">
      <div className="flex"><ActionButton label={`${run.name || 'Irrigation run'} · ${irrigationRunLength(run).toFixed(2)} m · ${run.zone}`} onClick={() => selectLandscapeObjects([run as unknown as AnyNode])} /></div>
      <div aria-label={`Connection checks for ${run.name || 'Irrigation run'}`} className="text-xs leading-5 text-muted-foreground">
        {irrigationRunIssues(run, nodes).length ? irrigationRunIssues(run, nodes).map(issue => <p key={issue}>{issue}</p>) : <p>Endpoints match outlet position, direction, diameter and zone. Supply and hydraulics remain unchecked.</p>}
      </div>
      <div className="flex"><ActionButton label={`Delete ${run.name || 'irrigation run'}`} disabled={readOnly} onClick={() => {
        const state = useScene.getState()
        if (!state.readOnly && state.nodes[run.id as AnyNodeId]) state.deleteNode(run.id as AnyNodeId)
      }} /></div>
    </div>)}
    {sources.map(source => { const review = sourceReadiness(source, nodes); return <div key={`readiness:${source.id}`} aria-label={`Supply readiness for ${source.name || 'Water supply'}`} className="space-y-1 rounded-md border border-border p-2 text-xs">
      <p>{source.name || 'Water supply'} · {review.outlets} connected outlets</p>
      <p className="tabular-nums">Installed demand {review.demand.toFixed(3)} L/min · available {source.availableFlow.toFixed(2)} L/min · margin {review.margin.toFixed(3)} L/min</p>
      {review.issues.map(issue => <p key={issue} className="text-muted-foreground">{issue}</p>)}
      <p className="text-muted-foreground">Includes hidden outlets and closed valves when sockets match. Assumes all connected outlets operate together. Pressure loss, controllers and hydraulic performance are not evaluated.</p>
    </div> })}
      {!sources.length && <p className="text-xs text-muted-foreground">Add a water supply in Design to review connected demand.</p>}
    </div>}
    {view === 'schedule' && <div className="space-y-3" aria-label="Irrigation schedule">
    <div className="flex"><ActionButton label="Export irrigation schedule" disabled={!(sources.length + heads.length + driplines.length + valves.length + controllers.length + runs.length)} onClick={exportSchedule} /></div>
    <div className="flex"><ActionButton label={showExportPreview ? 'Hide irrigation CSV preview' : 'Preview irrigation CSV'} disabled={!(sources.length + heads.length + driplines.length + valves.length + controllers.length + runs.length)} aria-expanded={showExportPreview} onClick={() => setShowExportPreview(value => !value)} /></div>
    {showExportPreview && <PanelSection title="CSV export preview">
      <p className="text-xs text-muted-foreground">Exact generated CSV content before download. Supply reviews compare installed demand; hydraulic performance remains unchecked.</p>
      <textarea aria-label="Irrigation CSV content" readOnly spellCheck={false} value={irrigationScheduleCsv(heads, { sources, driplines, valves, controllers, runs, fittings })} rows={8} className="w-full resize-y rounded-md border border-border bg-background p-2 font-mono text-xs text-foreground" />
    </PanelSection>}
    <p className="text-xs text-muted-foreground" aria-label="Irrigation export contents">CSV includes {sources.length} supplies, {heads.length} heads, {driplines.length} driplines, {valves.length} valves, {runs.length} runs, and {controllers.length} controllers with all station settings. Times describe the configured watering program; supply and hydraulic performance are not calculated.</p>
    {sources.length + heads.length + driplines.length + valves.length + controllers.length + runs.length > 0 && <div className="overflow-x-auto rounded-md border border-border">
      <table aria-label="Irrigation equipment schedule" className="w-full text-left text-xs tabular-nums">
        <caption className="px-2 py-2 text-left text-muted-foreground">Equipment schedule · authored values</caption>
        <thead className="border-b border-border text-muted-foreground"><tr>
          <th scope="col" className="p-2">Equipment</th><th scope="col" className="p-2">Size (in)</th><th scope="col" className="p-2">Details</th>
        </tr></thead>
        <tbody>
          {sources.map(source => <tr key={source.id} className="border-t border-border/50"><td className="p-2">{source.name || 'Water supply'}<span className="block text-muted-foreground">Supply</span></td><td className="p-2">{source.diameter.toFixed(2)}</td><td className="p-2">{source.enabled ? `${source.pressureBar.toFixed(2)} bar` : 'Off'}<span className="block text-muted-foreground">{source.availableFlow.toFixed(2)} L/min available</span></td></tr>)}
          {heads.map(head => <tr key={head.id} className="border-t border-border/50">
            <td className="p-2">{head.name || 'Irrigation head'}<span className="block text-muted-foreground">{head.zone || 'Unassigned'}</span></td>
            <td className="p-2">{head.inletDiameter.toFixed(2)}</td><td className="p-2">{head.flow.toFixed(2)} L/min<span className="block text-muted-foreground">{head.radius.toFixed(2)} m reach</span></td>
          </tr>)}
          {driplines.map(drip => { const metrics = driplineMetrics(drip); return <tr key={drip.id} className="border-t border-border/50">
            <td className="p-2">{drip.name || 'Dripline'}<span className="block text-muted-foreground">{drip.zone || 'Unassigned'}</span></td>
            <td className="p-2">{drip.diameter.toFixed(2)}</td><td className="p-2">{metrics.flow.toFixed(3)} L/min<span className="block text-muted-foreground">{metrics.length.toFixed(2)} m · {metrics.emitters} emitters</span></td>
          </tr> })}
          {valves.map(valve => <tr key={valve.id} className="border-t border-border/50">
            <td className="p-2">{valve.name || 'Zone valve'}<span className="block text-muted-foreground">{valve.zone || 'Unassigned'}</span></td>
            <td className="p-2">{valve.diameter.toFixed(2)}</td><td className="p-2">{valve.isOpen ? 'Open' : 'Closed'}</td>
          </tr>)}
          {runs.map(run => <tr key={run.id} className="border-t border-border/50">
            <td className="p-2">{run.name || 'Irrigation run'}<span className="block text-muted-foreground">{run.zone || 'Unassigned'}</span></td>
            <td className="p-2">{run.diameter.toFixed(2)}</td><td className="p-2">{irrigationRunLength(run).toFixed(2)} m<span className="block text-muted-foreground">{irrigationRunIssues(run, nodes).length ? 'Needs connection review' : 'Endpoints match'}</span></td>
          </tr>)}
          {controllers.map(controller => <tr key={controller.id} className="border-t border-border/50">
            <td className="p-2">{controller.name || 'Irrigation controller'}<span className="block text-muted-foreground">Controller</span></td>
            <td className="p-2">—</td><td className="p-2">{controller.enabled ? controller.startTime : 'Off'}<span className="block text-muted-foreground">{controller.stations.filter(station => station.valveId).length} assigned stations · {controller.seasonalPercent}%</span></td>
          </tr>)}
        </tbody>
      </table>
    </div>}
    </div>}
  </PanelSection>
}
