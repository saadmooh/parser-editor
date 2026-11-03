'use client'
import { ActionButton, PanelSection } from './panel-controls'
import { type AnyNode, useScene } from '@pascal-app/core'
import { MetricControl, SegmentedControl, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GROUND_AREA_KIND, GroundAreaNode } from '../ground-areas/domain/schema'
import { PathwayNode, type Point } from '../pathways/domain/schema'
import { PLANT_PRESETS, PLANT_PRESET_BY_KEY } from '../plant/domain/catalog'
import { PlantNode } from '../plant/domain/schema'
import { areaPlanting, containsPoint, pathPlanting } from './planting-layout'
import { normalizePlantMix, setPlantShare, weightedPlantMix, type PlantMixEntry } from './planting-mix'
import { initialPlantingBatch, plantingBatch, savePlantingBatch, type PlantingBatchSettings } from './planting-batches'
import { selectLandscapeObjects } from './objects-panel'

import { subtractPoolCutouts } from '../shared/pool-cutouts'
import type { GeometryContext } from '@pascal-app/core'
import { GroundAreaPanel } from '../ground-areas/editor/panel'
import { PanelSelect } from './panel-select'

export function PlantingLayoutPanel() {
  const drawingBed = useEditor(state => state.tool === GROUND_AREA_KIND && state.toolDefaults[GROUND_AREA_KIND]?.plantingBed === true)
  const nodes = useScene((state) => state.nodes)
  const levelId = useViewer((state) => state.selection.levelId)
  const [batchId, setBatchId] = useState('')
  const readOnly = useScene((state) => state.readOnly)
  const [sourceId, setSourceId] = useState('')
  const [plants, setPlants] = useState<PlantMixEntry[]>([{ preset: 'fab:daisy', weight: 100 }])
  const [spacing, setSpacing] = useState(1)
  const [setback, setSetback] = useState(0.5)
  const [seed, setSeed] = useState(1)
  const [natural, setNatural] = useState(false)
  const [side, setSide] = useState<'left' | 'right' | 'both'>('both')
  const [status, setStatus] = useState('')
  const sources = Object.values(nodes).filter((node) => node.parentId === levelId && ['landscape:ground-area', 'landscape:pathway'].includes(node.type as string))
  const batches = new Map(Object.values(nodes).filter((node) => node.parentId === levelId).flatMap((node) => {
    const batch = plantingBatch(node)
    return batch ? [[batch.batchId, batch] as const] : []
  }))
  const openedLevel = useRef<string | null>(null)
  const openLayout = useCallback((settings: PlantingBatchSettings | null) => {
    setBatchId(settings?.batchId ?? ''); setStatus('')
    setSourceId(settings?.sourceId ?? ''); setPlants(normalizePlantMix(settings?.plants ?? [{ preset: 'fab:daisy', weight: 100 }]))
    setSpacing(settings?.spacing ?? 1); setSetback(settings?.setback ?? 0.5)
    setSeed(settings?.seed ?? 1); setNatural(settings?.natural ?? false); setSide(settings?.side ?? 'both')
  }, [])
  useEffect(() => {
    if (!levelId || !nodes[levelId] || openedLevel.current === levelId) return
    openedLevel.current = levelId
    openLayout(initialPlantingBatch(Object.values(nodes), levelId, useViewer.getState().selection.selectedIds))
  }, [nodes, levelId, openLayout])
  const existing = Object.values(nodes).filter((node) => node.parentId === levelId && (node.type as string) === 'landscape:plant' && plantingBatch(node)?.batchId === batchId)
  const source = sources.find((node) => node.id === sourceId)
  const layout = useMemo(() => {
    if (!source) return { points: [] as Point[], truncated: false, elevation: 0, elevationOffsets: undefined as number[] | undefined, outline: [] as Point[] }
    const occupied = Object.values(nodes).filter((node) => node.parentId === levelId && (!batchId || plantingBatch(node)?.batchId !== batchId) && ['landscape:plant', 'landscape:tree'].includes(node.type as string))
      .flatMap((node) => { const position = (node as unknown as { position?: number[] }).position; return position ? [[position[0]!, position[2]!] as Point] : [] })
    const options = { spacing, setback, seed, natural, limit: 500 }
    if ((source.type as string) === 'landscape:ground-area') {
      const area = GroundAreaNode.parse(source)
      const footprint = subtractPoolCutouts([[area.outline]], area, { sceneNodes: nodes } as unknown as GeometryContext)
      const generated = areaPlanting(area.outline, options, occupied)
      return { ...generated, points: generated.points.filter(point => footprint.some(polygon => containsPoint(point, polygon[0]!) && !polygon.slice(1).some(hole => containsPoint(point, hole)))), elevation: area.elevation, outline: area.outline }
    }
    const path = PathwayNode.parse(source)
    return { ...pathPlanting(path, options, side, occupied), elevation: path.elevation, outline: path.vertices.map((vertex) => vertex.point) }
  }, [source, nodes, levelId, spacing, setback, seed, natural, side, batchId])
  const speciesMix = weightedPlantMix(layout.points.length, plants, seed)
  const palette = ['#81a763', '#a78bfa', '#f59e0b', '#38bdf8', '#f472b6', '#2dd4bf']
  const plantColor = (preset: string) => palette[plants.findIndex(plant => plant.preset === preset) % palette.length] ?? palette[0]!
  const points = [...layout.outline, ...layout.points]
  const minX = points.length ? Math.min(...points.map((point) => point[0])) : 0, minZ = points.length ? Math.min(...points.map((point) => point[1])) : 0
  const width = points.length ? Math.max(...points.map((point) => point[0])) - minX : 1, depth = points.length ? Math.max(...points.map((point) => point[1])) - minZ : 1
  const add = () => {
    if (!source || !levelId || readOnly || !layout.points.length) return
    const savedBatchId = batchId || crypto.randomUUID()
    const generatedPlants = layout.points.map(([x, z], index) => {
      const key = speciesMix[index]!
      return PlantNode.parse({ preset: key, parentId: levelId, name: PLANT_PRESET_BY_KEY[key]?.name ?? 'Plant',
        position: [x, layout.elevation + (layout.elevationOffsets?.[index] ?? 0), z], rotation: [0, natural ? ((seed * 137.5 + index * 137.5) % 360) * Math.PI / 180 : 0, 0],
        seed: (seed + index) % 100000, metadata: { landscapePlanting: { batchId: savedBatchId, sourceId: source.id, plants, spacing, setback, seed, natural, side } } })
    })
    const settings = { batchId: savedBatchId, sourceId: source.id, plants, spacing, setback, seed, natural, side }
    const saved = savePlantingBatch(generatedPlants, existing, source, settings)
    selectLandscapeObjects(saved as unknown as AnyNode[])
    setBatchId(savedBatchId)
    setStatus(`${existing.length ? 'Regenerated' : 'Added'} ${saved.length} plants.`)
  }
  return <section aria-label="Planting layout"><PanelSection title="Planting layout">
    <ActionButton label="Draw planting bed" disabled={readOnly || !levelId} onClick={() => {
      const editor = useEditor.getState()
      editor.setToolDefaults(GROUND_AREA_KIND, { ...editor.toolDefaults[GROUND_AREA_KIND], surface: 'mulch', plantingBed: true })
      editor.setMode('build'); editor.setTool(GROUND_AREA_KIND)
    }} />
    {drawingBed && <GroundAreaPanel surfaceChoice="mulch" inSidebar />}
    <PanelSelect label="Planting layout" aria-label="Saved planting layout" value={batchId} onChange={event => openLayout(batches.get(event.target.value) ?? null)}>
      <option value="">New layout</option>{[...batches.values()].map((batch, index) => <option key={batch.batchId} value={batch.batchId}>{nodes[batch.sourceId as keyof typeof nodes]?.name || `Layout ${index + 1}`} · {`${batch.plants.length} species`}</option>)}
    </PanelSelect>
    <PanelSelect label="Area or walkway" aria-label="Planting source" value={sourceId} onChange={(event) => { const saved = plantingBatch(nodes[event.target.value as keyof typeof nodes]!); if (saved) openLayout(saved); else { setBatchId(''); setSourceId(event.target.value); setStatus('') } }}>
      <option value="">Choose a shape on this level</option>{sources.map((node) => <option key={node.id} value={node.id}>{node.name ?? node.type}</option>)}
    </PanelSelect>
    {!sources.length && <p className="text-xs text-muted-foreground">Draw a ground area or walkway first.</p>}
    <div className="flex flex-col gap-2" aria-label="Plant mix">
      {plants.map((plant, index) => <div key={index} className="flex flex-col gap-2 rounded-lg border border-border/50 p-2">
        <PanelSelect label={`Plant ${index + 1}`} aria-label={`Layout plant ${index + 1}`} value={plant.preset}
          onChange={event => { setPlants(current => current.map((entry, i) => i === index ? { ...entry, preset: event.target.value } : entry)); setStatus('') }}>
          {PLANT_PRESETS.map(preset => <option key={preset.key} value={preset.key} disabled={plants.some((entry, i) => i !== index && entry.preset === preset.key)}>{preset.name}</option>)}
        </PanelSelect>
        {plants.length > 1 && <div className="flex items-center gap-2">
          <MetricControl label="Share" value={plant.weight} unit="%" precision={1} min={0} max={100} step={5}
            onChange={value => { setPlants(current => setPlantShare(current, index, value)); setStatus('') }} />
          <ActionButton label="Remove" aria-label={`Remove plant ${index + 1}`} className="w-auto shrink-0" onClick={() => { setPlants(current => normalizePlantMix(current.filter((_, i) => i !== index))); setStatus('') }} />
        </div>}
      </div>)}
      <ActionButton label="Add plant" className="flex-none" disabled={plants.length >= PLANT_PRESETS.length} onClick={() => {
        const next = PLANT_PRESETS.find(preset => !plants.some(plant => plant.preset === preset.key))
        if (next) setPlants(current => normalizePlantMix([...current.map(plant => ({ ...plant, weight: plant.weight * current.length / (current.length + 1) })), { preset: next.key, weight: 100 / (current.length + 1) }]))
        setStatus('')
      }} />
    </div>
    <MetricControl label="Plant spacing" value={spacing} onChange={setSpacing} min={0.25} max={50} step={0.25} precision={2} unit="m" />
    <MetricControl label="Plant setback" value={setback} onChange={setSetback} min={0} max={50} step={0.1} precision={2} unit="m" />
    {(source?.type as string) === 'landscape:pathway'
      ? <div role="group" aria-label="Planting path side" className="flex flex-col gap-2"><span className="px-1 text-xs text-muted-foreground">Walkway side</span><SegmentedControl value={side} onChange={setSide} options={[{label:'Left',value:'left'},{label:'Both sides',value:'both'},{label:'Right',value:'right'}]} /></div>
      : <div role="group" aria-label="Planting pattern" className="flex flex-col gap-2"><span className="px-1 text-xs text-muted-foreground">Planting pattern</span><SegmentedControl value={natural ? 'natural' : 'regular'} onChange={(value) => setNatural(value === 'natural')} options={[{label:'Regular spacing',value:'regular'},{label:'Natural spacing',value:'natural'}]} /></div>}
    <MetricControl label="Variation seed" value={seed} onChange={(value) => setSeed(Math.floor(value))} min={0} max={99999} step={1} precision={0} />
    {source && <figure className="space-y-1.5">
      <svg aria-label={`Planting preview: ${layout.points.length} plants`} role="img" viewBox={`${minX - 1} ${minZ - 1} ${width + 2} ${depth + 2}`} className="h-40 w-full rounded bg-secondary/50">
        {(source.type as string) === 'landscape:ground-area' && <polygon points={layout.outline.map((point) => point.join(',')).join(' ')} fill="currentColor" fillOpacity={0.08} stroke="currentColor" strokeWidth={0.04} />}
        {layout.points.map(([x, z], index) => <circle key={index} cx={x} cy={z} r={Math.max(0.08, spacing * 0.16)} fill={plantColor(speciesMix[index]!)} />)}
      </svg>
      <figcaption className="text-xs text-muted-foreground">{layout.points.length} plants{layout.truncated && ' · Preview limit reached. Increase spacing to cover the area.'}</figcaption>
      {layout.elevationOffsets?.length ? <p aria-label="Planting source height range" className="text-xs text-muted-foreground">
        Height: {(layout.elevation + Math.min(...layout.elevationOffsets)).toFixed(2)}–{(layout.elevation + Math.max(...layout.elevationOffsets)).toFixed(2)} m above level.
      </p> : null}
    </figure>}
    {source && <div aria-label="Plant mix counts" className="flex flex-col gap-2">{plants.map(plant => <div key={plant.preset} className="flex items-center gap-2 text-xs text-muted-foreground">
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: plantColor(plant.preset) }} />
      <span>{speciesMix.filter(preset => preset === plant.preset).length} {PLANT_PRESET_BY_KEY[plant.preset]?.name}</span>
    </div>)}</div>}
    <div className="flex"><ActionButton type="button" disabled={readOnly || !source || !layout.points.length} onClick={add} className="w-full disabled:opacity-50" label={existing.length ? `Regenerate ${layout.points.length} plants` : layout.points.length ? `Add ${layout.points.length} plants` : 'Add plants'} /></div>
    {source && <ActionButton label="Save layout settings" disabled={readOnly} onClick={() => {
      const savedBatchId = batchId || crypto.randomUUID()
      const settings = { batchId: savedBatchId, sourceId: source.id, plants, spacing, setback, seed, natural, side }
      const scene = useScene.getState(); if (scene.readOnly) return
      const related = existing.map(node => ({ id: node.id, data: { metadata: { ...node.metadata, landscapePlanting: settings } } }))
      scene.updateNodes([{ id: source.id, data: { metadata: { ...source.metadata, landscapePlanting: settings } } }, ...related])
      setBatchId(savedBatchId); setStatus('Layout settings saved. Regenerate plants to apply changes.')
    }} />}
    {existing.length > 0 && <ActionButton label="Remove layout plants" disabled={readOnly} onClick={() => {
      savePlantingBatch([], existing); setStatus('Layout plants removed. Bed settings retained.')
    }} />}
    {status && <p role="status" className="text-xs text-muted-foreground">{status}</p>}
  </PanelSection></section>
}
