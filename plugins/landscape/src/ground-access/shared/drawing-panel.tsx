'use client'
import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { SliderControl, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useDrawingStatus } from './drawing-session'
import { drawnAccessItemFor, type DrawnAccessKind } from './items'
import type { DrawingMode } from './drawing-mode'
import { DrawingModeControl } from './drawing-mode-control'
import { circleSizePatch, isCurvedSurface } from './outline'

export function SurfaceDrawingPanel({ kind, minThickness = 0.03 }: {
  kind: DrawnAccessKind; minThickness?: number
}) {
  const item = drawnAccessItemFor(kind)!
  const active = useEditor((state) => state.tool === kind)
  const defaults = useEditor((state) => state.toolDefaults[kind])
  const selectedId = useViewer((state) => state.selection.selectedIds.length === 1
    ? state.selection.selectedIds[0] : undefined)
  const raw = useScene((state) => selectedId ? state.nodes[selectedId as AnyNodeId] : undefined)
  const selected = !active && (raw?.type as string | undefined) === kind ? item.schema.parse(raw) : null
  const node = selected ?? item.schema.parse(defaults ?? {})
  type SlabDetails = { finish?: 'broom' | 'exposed-aggregate' | 'polished';
    jointLayout?: 'none' | 'grid'; jointSpacing?: number; jointWidth?: number; edgeProfile?: 'square' | 'chamfered' }
  const slab = node as typeof node & SlabDetails
  const status = useDrawingStatus(kind)
  const update = (patch: { shape?: DrawingMode; width?: number; depth?: number; thickness?: number } & SlabDetails) => {
    if (selected) useScene.getState().updateNode(selected.id as AnyNodeId,
      circleSizePatch(selected, patch) as Partial<AnyNode>)
    else useEditor.getState().setToolDefaults(kind, { ...useEditor.getState().toolDefaults[kind], ...patch })
  }
  const number = (key: 'width' | 'depth' | 'thickness', title: string, min: number, max: number) =>
    <SliderControl label={title} value={node[key]} min={min} max={max} step={0.01} precision={2} unit="m"
      onChange={(value) => update({ [key]: value })} />
  return <section aria-label={`${item.label} settings`} className="flex flex-col gap-1.5" style={{ marginTop: selected ? 12 : 0 }}>
    {selected && <h3 style={{ fontSize: 14, margin: '0 0 5px' }}>Selected {item.label.toLowerCase()}</h3>}
    {!selected && <>
      <div style={{ fontSize: 12, margin: '12px 0 6px' }}>Drawing mode</div>
      <DrawingModeControl value={node.shape} onChange={(shape) => update({ shape })} />
      {active && status.message && <p role="status" style={{ fontSize: 11, color: '#dc6b61' }}>{status.message}</p>}
    </>}
    {selected && <>
      {node.shape === 'freehand' && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
        Drag orange points to reshape, purple handles to bend curves, and green dots to add points.
      </p>}
      {node.shape !== 'freehand' && !isCurvedSurface(node.shape) && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
        Drag points to reshape; double-click a corner to remove it.
      </p>}
      {number('width', node.shape === 'circle' ? 'Diameter (m)' : 'Width (m)', 0.2, 30)}
      {node.shape !== 'circle' && number('depth', 'Depth (m)', 0.2, 30)}
    </>}
    {number('thickness', kind === 'landscape:deck' ? 'Height (m)' : 'Thickness (m)', minThickness, 2)}
    {kind === 'landscape:concrete-slab' && <>
      <h4 style={{ fontSize: 12, margin: '16px 0 0' }}>Concrete finish</h4>
      <label className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-foreground/80">Surface
        <select aria-label="Concrete surface finish" className="rounded-md border border-border/50 bg-[#2C2C2E] px-2 py-1 text-xs text-foreground"
          value={slab.finish ?? 'broom'} onChange={(event) => update({ finish: event.currentTarget.value as SlabDetails['finish'] })}>
          <option value="broom">Broomed</option><option value="exposed-aggregate">Exposed aggregate</option>
          <option value="polished">Polished</option>
        </select>
      </label>
      <label className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-foreground/80">Saw cuts
        <select aria-label="Concrete saw cut layout" className="rounded-md border border-border/50 bg-[#2C2C2E] px-2 py-1 text-xs text-foreground"
          value={slab.jointLayout ?? 'grid'} onChange={(event) => update({ jointLayout: event.currentTarget.value as SlabDetails['jointLayout'] })}>
          <option value="grid">Grid</option><option value="none">None</option>
        </select>
      </label>
      {(slab.jointLayout ?? 'grid') !== 'none' && <>
        <SliderControl label="Joint spacing (m)" value={slab.jointSpacing ?? 3} min={0.5} max={6} step={0.1}
          precision={1} unit="m" onChange={(jointSpacing) => update({ jointSpacing })} />
        <SliderControl label="Joint width (m)" value={slab.jointWidth ?? 0.006} min={0.002} max={0.02} step={0.001}
          precision={3} unit="m" onChange={(jointWidth) => update({ jointWidth })} />
      </>}
      <label className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-foreground/80">Edge profile
        <select aria-label="Concrete edge profile" className="rounded-md border border-border/50 bg-[#2C2C2E] px-2 py-1 text-xs text-foreground"
          value={slab.edgeProfile ?? 'chamfered'} onChange={(event) => update({ edgeProfile: event.currentTarget.value as SlabDetails['edgeProfile'] })}>
          <option value="square">Square</option><option value="chamfered">Chamfered</option>
        </select>
      </label>
    </>}
  </section>
}
