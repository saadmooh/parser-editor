'use client'
import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { MetricControl, SliderControl, ToggleControl, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useState } from 'react'
import { ellipseBounds, ellipseOutline, isEllipseShape } from '../domain/ellipse'
import { GROUND_AREA_KIND, GROUND_SURFACES, GroundAreaNode, type Grass2Settings, type GroundSurface } from '../domain/schema'
import { groundAreaDrawingMode, setGroundAreaDrawingMode } from './drawing-mode'
import { DrawingModeControl } from '../../ground-access/shared/drawing-mode-control'
import { GROUND_SURFACE_THUMBNAILS } from '../../editor/catalog-thumbnails'
import { CatalogListRow } from '../../editor/catalog-list-row'
import { PanelSelect } from '../../editor/panel-select'
import { useGroundAreaStatus } from './session'

const surfaces: { value: GroundSurface; label: string; color: string }[] = [
  { value: 'grass', label: 'Grass', color: '#718451' },
  { value: 'soil', label: 'Soil', color: '#5b5841' },
  { value: 'mulch', label: 'Mulch', color: '#76523b' },
  { value: 'gravel', label: 'Gravel', color: '#918f83' },
  { value: 'sand', label: 'Sand', color: '#cbb78d' },
  { value: 'mud', label: 'Mud', color: '#614533' },
]

function groundAreaBounds(outline: readonly [number, number][]) {
  if (outline.length < 3) return null
  if (outline.length >= 32) return ellipseBounds(outline)
  const xs = outline.map(([x]) => x)
  const zs = outline.map(([, z]) => z)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minZ = Math.min(...zs), maxZ = Math.max(...zs)
  return { center: [(minX + maxX) / 2, (minZ + maxZ) / 2] as [number, number],
    width: maxX - minX, depth: maxZ - minZ }
}

export function GroundAreaPanel({ surfaceChoice = null, inSidebar = false }: {
  surfaceChoice?: GroundSurface | null
  inSidebar?: boolean
}) {
  const levelId = useViewer((state) => state.selection.levelId)
  const active = useEditor((state) => state.tool === GROUND_AREA_KIND)
  const drawingStatus = useGroundAreaStatus()
  const defaults = useEditor((state) => state.toolDefaults[GROUND_AREA_KIND])
  const selectedId = useViewer((state) => state.selection.selectedIds.length === 1
    ? state.selection.selectedIds[0] : undefined)
  const selectedRaw = useScene((state) => selectedId ? state.nodes[selectedId as AnyNodeId] : undefined)
  const selected = (selectedRaw?.type as string | undefined) === GROUND_AREA_KIND
    ? GroundAreaNode.parse(selectedRaw) : null
  const detailSurface = selected?.surface ?? surfaceChoice
  const detailLabel = detailSurface === 'grass2' ? 'Grass' : detailSurface
  const selectedBounds = selected ? groundAreaBounds(selected.outline) : null
  const [surface, setSurface] = useState<GroundSurface>(() =>
    GROUND_SURFACES.find((value) => value === defaults?.surface) ?? 'grass',
  )
  const start = (nextSurface: GroundSurface) => {
    if (!levelId) return
    setSurface(nextSurface)
    const editor = useEditor.getState()
    editor.setToolDefaults(GROUND_AREA_KIND, { ...editor.toolDefaults[GROUND_AREA_KIND], surface: nextSurface, shape: groundAreaDrawingMode() })
    editor.setMode('build')
    editor.setTool(GROUND_AREA_KIND)
  }
  const resizeSelected = (key: 'width' | 'depth', value: number) => {
    if (!selected || !selectedBounds || !Number.isFinite(value) || value < 0.2 || value > 500) return
    const width = selected.shape === 'circle' ? value : key === 'width' ? value : selectedBounds.width
    const depth = selected.shape === 'circle' ? value : key === 'depth' ? value : selectedBounds.depth
    const scaleX = width / Math.max(selectedBounds.width, 1e-6)
    const scaleZ = depth / Math.max(selectedBounds.depth, 1e-6)
    const transform = ([x, z]: [number, number]): [number, number] => [
      selectedBounds.center[0] + (x - selectedBounds.center[0]) * scaleX,
      selectedBounds.center[1] + (z - selectedBounds.center[1]) * scaleZ,
    ]
    const outline = isEllipseShape(selected.shape)
      ? ellipseOutline(selectedBounds.center, width / 2, depth / 2)
      : selected.outline.map(transform)
    const curvePoints = selected.curvePoints?.map((point) => ({
      anchor: transform(point.anchor), incoming: transform(point.incoming), outgoing: transform(point.outgoing),
    }))
    useScene.getState().updateNode(selected.id as AnyNodeId,
      { outline, ...(curvePoints ? { curvePoints } : {}) } as Partial<AnyNode>)
  }
  const resizeLabel = (key: 'width' | 'depth') => selected?.shape === 'circle'
    ? 'Diameter' : key === 'width' ? 'Width' : 'Depth'
  const moveSelected = (axis: 0 | 1, value: number) => {
    if (!selected || !selectedBounds || !Number.isFinite(value) || value < -500 || value > 500) return
    const delta = value - selectedBounds.center[axis]
    const transform = ([x, z]: [number, number]): [number, number] => axis === 0
      ? [x + delta, z] : [x, z + delta]
    const outline = selected.outline.map(transform)
    const curvePoints = selected.curvePoints?.map((point) => ({
      anchor: transform(point.anchor), incoming: transform(point.incoming), outgoing: transform(point.outgoing),
    }))
    useScene.getState().updateNode(selected.id as AnyNodeId,
      { outline, ...(curvePoints ? { curvePoints } : {}) } as Partial<AnyNode>)
  }
  const updateSelectedElevation = (elevation: number) => {
    if (selected) useScene.getState().updateNode(selected.id as AnyNodeId, { elevation } as Partial<AnyNode>)
  }
  const updateGrass2 = (patch: Partial<Grass2Settings>) => {
    if (!selected || selected.surface !== 'grass2') return
    useScene.getState().updateNode(selected.id as AnyNodeId,
      { grass2Settings: { ...selected.grass2Settings, ...patch } } as Partial<AnyNode>)
  }
  const updateGrassVariant = (experimental: boolean) => {
    const nextSurface: GroundSurface = experimental ? 'grass2' : 'grass'
    setSurface(nextSurface)
    if (active && !selected) {
      const editor = useEditor.getState()
      editor.setToolDefaults(GROUND_AREA_KIND, { ...editor.toolDefaults[GROUND_AREA_KIND], surface: nextSurface })
    }
    if (selected && (selected.surface === 'grass' || selected.surface === 'grass2')) {
      useScene.getState().updateNode(selected.id as AnyNodeId, { surface: nextSurface } as Partial<AnyNode>)
    }
  }
  const settings = selected ?? GroundAreaNode.parse({ ...defaults, surface: detailSurface ?? surface })
  const updateSettings = (data: Partial<GroundAreaNode>) => {
    if (useScene.getState().readOnly) return
    if (selected) useScene.getState().updateNode(selected.id as AnyNodeId, data as Partial<AnyNode>)
    else { const editor = useEditor.getState(); editor.setToolDefaults(GROUND_AREA_KIND, { ...editor.toolDefaults[GROUND_AREA_KIND], ...data }) }
  }
  return (
    <section aria-label="Ground areas" className={`flex min-w-0 flex-col gap-4 ${inSidebar ? '' : 'p-3'}`}>
      {detailSurface && <div className="rounded-lg border border-border/50 bg-secondary/30 px-3 py-2.5">
        <h3 className="m-0 text-sm font-medium leading-5">{detailLabel![0]!.toUpperCase() + detailLabel!.slice(1)} area</h3>
        {selected && <p className="mb-0 mt-0.5 text-xs capitalize text-muted-foreground">{selected.shape} ground cover</p>}
      </div>}
      {(selected?.surface === 'grass' || selected?.surface === 'grass2' ||
        !selected && (detailSurface === 'grass' || detailSurface === 'grass2')) && <div className="flex flex-col gap-1.5">
          <ToggleControl label="Experimental grass" checked={detailSurface === 'grass2'} onChange={updateGrassVariant} />
          <p className="m-0 px-1 text-[11px] leading-4 text-muted-foreground">Use the flowering grass renderer for this area.</p>
        </div>}
      {(detailSurface === 'soil' || detailSurface === 'mulch' || settings.plantingBed) && <ToggleControl label="Planting bed" checked={settings.plantingBed} onChange={plantingBed => updateSettings({ plantingBed })} />}
      {settings.plantingBed && <PanelSelect label="Bed surface" value={settings.surface} onChange={event => updateSettings({ surface: event.target.value as GroundSurface })}>
        {surfaces.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
      </PanelSelect>}
      {settings.surface === 'mulch' && <div className="flex flex-col gap-1.5">
        <MetricControl label="Mulch depth" value={settings.mulchDepth} min={0.01} max={0.5} step={0.005} precision={3} unit="m" onChange={mulchDepth => updateSettings({ mulchDepth })} />
        <MetricControl label="Bag size" value={settings.mulchBagLitres} min={1} max={1000} step={5} precision={0} unit="L" onChange={mulchBagLitres => updateSettings({ mulchBagLitres })} />
      </div>}
      {!selected && <div className="flex flex-col gap-2">
        <div className="px-1 text-xs font-medium">Drawing mode</div>
        <DrawingModeControl value={groundAreaDrawingMode()} onChange={setGroundAreaDrawingMode} />
        {active && <p role="status" className="m-0 px-1 text-xs leading-5 text-muted-foreground">
          {drawingStatus.message || (drawingStatus.shape === 'rectangle'
            ? drawingStatus.points ? 'Choose the opposite corner.' : 'Choose the first corner.'
            : 'Draw the outline in the viewport.')}
        </p>}
      </div>}
      {!detailSurface && <>
        <div aria-label="Ground surface" role="group" className="flex flex-col gap-1">
          {surfaces.map((item) => <CatalogListRow key={item.value} label={item.label} disabled={!levelId}
            active={item.value === 'grass' ? surface === 'grass' || surface === 'grass2' : surface === item.value}
            onClick={() => start(item.value)}
            thumbnail={<img src={GROUND_SURFACE_THUMBNAILS[item.value]} alt="" width={36} height={36}
              style={{ width: 36, height: 36, flex: '0 0 36px', objectFit: 'cover', borderRadius: 4,
                border: '1px solid color-mix(in srgb, var(--foreground) 15%, transparent)' }} />} />)}
        </div>
      </>}
      {selected && <div className="flex flex-col gap-1.5 border-t border-border/50 pt-3">
        <div className="px-1 text-xs font-medium">Position</div>
        {selectedBounds && <>
          <SliderControl label="X" value={Number(selectedBounds.center[0].toFixed(2))} min={-500} max={500} step={0.1}
            precision={2} unit="m" onChange={(value) => moveSelected(0, value)} />
          <SliderControl label="Z" value={Number(selectedBounds.center[1].toFixed(2))} min={-500} max={500} step={0.1}
            precision={2} unit="m" onChange={(value) => moveSelected(1, value)} />
        </>}
        <div className="mt-2 px-1 text-xs font-medium">Size</div>
        {selectedBounds && (['width', 'depth'] as const).filter((key) => selected.shape !== 'circle' || key === 'width')
          .map((key) => <SliderControl key={key} label={resizeLabel(key)} min={0.2} max={500} step={0.1} precision={2} unit="m"
            value={Number(Math.max(0.2, selectedBounds[key]).toFixed(2))} onChange={(value) => resizeSelected(key, value)} />)}
        <SliderControl label="Elevation" value={selected.elevation} min={-100} max={100} step={0.1}
          precision={2} unit="m" onChange={updateSelectedElevation} />
      </div>}
      {selected?.shape === 'freehand' && <p className="m-0 px-1 text-xs leading-5 text-muted-foreground">
        Drag orange points to reshape, purple handles to bend curves, and green dots to add points.
      </p>}
      {selected?.surface === 'grass2' && <div className="flex flex-col gap-1.5 border-t border-border/50 pt-3">
        <div className="px-1 text-xs font-medium">Flowering grass</div>
        <label className="flex min-h-10 min-w-0 items-center gap-3 rounded-lg border border-border/50 bg-secondary/40 px-3 text-sm">
          <span className="min-w-0 flex-1">Grass style</span>
          <select aria-label="Grass style" value={selected.grass2Settings.mode ?? 'blades'}
            onChange={(event) => updateGrass2({ mode: event.currentTarget.value as Grass2Settings['mode'] })}
            className="max-w-[55%] min-w-0 rounded-md border border-border/50 bg-background px-2 py-1 text-xs text-foreground">
            <option value="blades">Blades</option>
            <option value="billboards">Billboards</option>
          </select>
        </label>
        <SliderControl label="Grass density" min={0.15} max={2} step={0.05} precision={2}
          value={selected.grass2Settings.density} onChange={(density) => updateGrass2({ density })} />
        {selected.grass2Settings.mode !== 'billboards' && <ToggleControl label="Scene lighting"
          checked={selected.grass2Settings.lighting ?? true} onChange={(lighting) => updateGrass2({ lighting })} />}
        <SliderControl label="Grass height" min={0.35} max={2} step={0.05} precision={2}
          value={selected.grass2Settings.height} onChange={(height) => updateGrass2({ height })} />
        <ToggleControl label="Flowers" checked={selected.grass2Settings.flowers ?? true}
          onChange={(flowers) => updateGrass2({ flowers })} />
        {(selected.grass2Settings.flowers ?? true) && <>
        <SliderControl label="Flower amount" min={0} max={1} step={0.05} precision={2}
          value={selected.grass2Settings.flowerDensity} onChange={(flowerDensity) => updateGrass2({ flowerDensity })} />
        <label className="flex min-h-10 min-w-0 items-center gap-3 rounded-lg border border-border/50 bg-secondary/40 px-3 text-sm">
          <span className="min-w-0 flex-1">Flower mix</span>
          <select aria-label="Flower mix" value={selected.grass2Settings.flowerMix}
            onChange={(event) => updateGrass2({ flowerMix: event.currentTarget.value as Grass2Settings['flowerMix'] })}
            className="max-w-[55%] min-w-0 rounded-md border border-border/50 bg-background px-2 py-1 text-xs text-foreground">
            <option value="mixed">Mixed</option><option value="clover">Clover</option>
            <option value="dandelion">Dandelions</option><option value="wildflowers">Wildflowers</option>
          </select>
        </label>
        </>}
        <SliderControl label="Wind" min={0} max={1} step={0.05} precision={2}
          value={selected.grass2Settings.wind} onChange={(wind) => updateGrass2({ wind })} />
        <label className="flex min-h-10 min-w-0 items-center gap-3 rounded-lg border border-border/50 bg-secondary/40 px-3 text-sm">
          <span className="min-w-0 flex-1">Pattern seed</span>
          <input aria-label="Grass pattern seed" type="number" min={0} max={100000} step={1}
            value={selected.grass2Settings.seed}
            onChange={(event) => {
              const seed = Number(event.currentTarget.value)
              if (Number.isInteger(seed) && seed >= 0 && seed <= 100000) updateGrass2({ seed })
            }}
            className="w-24 rounded-md border border-border/50 bg-background px-2 py-1 text-xs text-foreground" />
        </label>
      </div>}
    </section>
  )
}

export default GroundAreaPanel
