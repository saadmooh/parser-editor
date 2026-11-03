'use client'

import type { AnyNode, AnyNodeId } from '@pascal-app/core'
import { useScene } from '@pascal-app/core'
import { PanelWrapper, SliderControl } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { ConcreteSlabNode } from '../domain/schema'
import { circleDerivedSize, surfaceOutline } from '../../shared/outline'
import { LANDSCAPE_CATALOG_THUMBNAILS } from '../../../editor/catalog-thumbnails'
import { InspectorChoice, InspectorDeleteButton, InspectorFieldLabel, InspectorNotes,
  InspectorSwatch, InspectorTabBar, useInspectorTab } from '../../shared/inspector-common'

const finishes: { value: ConcreteSlabNode['finish']; label: string; detail: string; color: string }[] = [
  { value: 'broom', label: 'Broom finish', detail: 'Subtle linear texture', color: '#aaa9a2' },
  { value: 'exposed-aggregate', label: 'Exposed aggregate', detail: 'Textured stone blend', color: '#aaa69c' },
  { value: 'polished', label: 'Polished', detail: 'Smooth and refined', color: '#b8b7b1' },
]

function slabArea(node: ConcreteSlabNode) {
  if (node.shape === 'circle') return Math.PI * node.width * node.width / 4
  if (node.shape === 'oval') return Math.PI * node.width * node.depth / 4
  if (node.shape !== 'rectangle' && node.outline.length >= 3) {
    const outline = surfaceOutline(node)
    return Math.abs(outline.reduce((sum, [x, z], index) => {
      const [nextX, nextZ] = outline[(index + 1) % outline.length]!
      return sum + x * nextZ - nextX * z
    }, 0)) / 2
  }
  return node.width * node.depth
}

export default function ConcreteSlabInspector({ node: rawNode }: { node: ConcreteSlabNode }) {
  const setSelection = useViewer((state) => state.setSelection)
  const [tab, setTab] = useInspectorTab()
  const node = ConcreteSlabNode.parse(rawNode)
  const area = slabArea(node)
  const update = (patch: Partial<ConcreteSlabNode>) => useScene.getState().updateNode(
    node.id as AnyNodeId, { ...patch, ...circleDerivedSize({ ...node, ...patch }, patch) } as Partial<AnyNode>,
  )

  return <PanelWrapper title="Concrete slab" icon={<img alt="" src={LANDSCAPE_CATALOG_THUMBNAILS['concrete-slab']}
    className="h-10 w-12 rounded-md object-cover" />} onClose={() => setSelection({ selectedIds: [] })} width={340}>
    <div className="px-3 pb-3">
      <div className="-mt-1 mb-3 text-[11px] text-muted-foreground">Selected element</div>
      <InspectorTabBar value={tab} onChange={setTab} label="Concrete slab settings" />

      {tab === 'properties' && <div className="flex flex-col gap-2.5">
        <div className="rounded-lg border border-border/70 bg-secondary/25 p-2.5">
          <InspectorFieldLabel>Slab outline</InspectorFieldLabel>
          <div className="grid grid-cols-3 gap-1.5">
            {([{ value: 'rectangle', label: 'Rectangle' }, { value: 'circle', label: 'Circle' }, { value: 'oval', label: 'Oval' }] as const).map((shape) =>
              <button key={shape.value} type="button" aria-label={shape.label} aria-pressed={node.shape === shape.value}
                onClick={() => update({ shape: shape.value })}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-md border text-[10px] ${node.shape === shape.value
                  ? 'border-primary/70 bg-primary/10 text-foreground' : 'border-border/60 text-muted-foreground hover:bg-accent/40'}`}>
                <svg aria-hidden="true" viewBox="0 0 32 22" className="h-6 w-8">
                  {shape.value === 'rectangle' && <rect x="5" y="4" width="22" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />}
                  {shape.value === 'circle' && <circle cx="16" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />}
                  {shape.value === 'oval' && <ellipse cx="16" cy="11" rx="12" ry="7" fill="none" stroke="currentColor" strokeWidth="1.6" />}
                </svg>{shape.label}
              </button>) }
          </div>
          {(node.shape === 'custom' || node.shape === 'freehand') && <p className="mt-2 text-[10px] text-muted-foreground">Custom outline · drag points on the slab to reshape it.</p>}
        </div>
        <SliderControl label={node.shape === 'circle' ? 'Diameter' : 'Width'} value={node.width} min={0.2} max={30} step={0.1} precision={2} unit="m" onChange={(width) => update({ width })} />
        {node.shape !== 'circle' && <SliderControl label="Length" value={node.depth} min={0.2} max={30} step={0.1} precision={2} unit="m" onChange={(depth) => update({ depth })} />}
        <div className="flex flex-col gap-1 rounded-lg border border-border/70 bg-secondary/25 px-2.5 py-2 text-xs">
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Area</span><span>{area.toFixed(1)} m²</span></div>
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Concrete volume</span><span>{(area * node.thickness).toFixed(2)} m³</span></div>
        </div>
        <SliderControl label="Thickness" value={node.thickness} min={0.03} max={2} step={0.01} precision={2} unit="m" onChange={(thickness) => update({ thickness })} />
        <div className="rounded-lg border border-border/70 bg-secondary/25 p-2.5">
          <InspectorFieldLabel>Position and rotation</InspectorFieldLabel>
          <div className="flex flex-col gap-2">
            <SliderControl label="Elevation" value={node.position[1]} min={-5} max={20} step={0.01} precision={2} unit="m"
              onChange={(elevation) => update({ position: [node.position[0], elevation, node.position[2]] })} />
            <SliderControl label="Rotation" value={node.rotation[1] * 180 / Math.PI} min={-180} max={180} step={1} precision={0} unit="°"
              onChange={(degrees) => update({ rotation: [0, degrees * Math.PI / 180, 0] })} />
          </div>
        </div>
        <div className="rounded-lg border border-border/70 bg-secondary/25 p-2.5">
          <InspectorFieldLabel>Control joints</InspectorFieldLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {([{ value: 'none', label: 'None', direction: 'horizontal' }, { value: 'grid', label: 'Grid', direction: 'vertical' }] as const).map((layout) =>
              <button key={layout.value} type="button" aria-pressed={node.jointLayout === layout.value}
                onClick={() => update({ jointLayout: layout.value,
                  ...(layout.value === 'grid' && node.jointLayout === 'none'
                    ? { jointSpacing: 0.5, jointWidth: 0.01 } : {}) })}
                className={`flex flex-col items-center gap-1 rounded-md border p-1.5 text-[10px] ${node.jointLayout === layout.value
                  ? 'border-primary/70 bg-primary/10' : 'border-border/60 text-muted-foreground hover:bg-accent/40'}`}>
                <InspectorSwatch color="#aaa9a2" direction={layout.direction} />{layout.label}
              </button>) }
          </div>
          {node.jointLayout === 'grid' && <div className="mt-2 flex flex-col gap-2">
            <SliderControl label="Joint spacing" value={node.jointSpacing} min={0.5} max={6} step={0.1} precision={1} unit="m" onChange={(jointSpacing) => update({ jointSpacing })} />
            <SliderControl label="Joint width" value={node.jointWidth} min={0.002} max={0.02} step={0.001} precision={3} unit="m" onChange={(jointWidth) => update({ jointWidth })} />
          </div>}
        </div>
        <div className="rounded-lg border border-border/70 bg-secondary/25 p-2.5">
          <InspectorFieldLabel>Edge profile</InspectorFieldLabel>
          <div className="grid grid-cols-2 gap-1.5">{([{ value: 'square', label: 'Square' }, { value: 'chamfered', label: 'Chamfered' }] as const).map((edgeProfile) =>
            <button key={edgeProfile.value} type="button" aria-pressed={node.edgeProfile === edgeProfile.value} onClick={() => update({ edgeProfile: edgeProfile.value })}
              className={`rounded-md border px-2 py-2 text-xs ${node.edgeProfile === edgeProfile.value ? 'border-primary/70 bg-primary/10' : 'border-border/60 text-muted-foreground hover:bg-accent/40'}`}>
              {edgeProfile.label}
            </button>)}</div>
        </div>
      </div>}

      {tab === 'materials' && <div className="flex flex-col gap-2">
        <InspectorFieldLabel>Concrete finish</InspectorFieldLabel>
        {finishes.map((finish) => <InspectorChoice key={finish.value} label={finish.label} selected={node.finish === finish.value}
          onClick={() => update({ finish: finish.value })}>
          <InspectorSwatch color={finish.color} direction={finish.value === 'broom' ? 'horizontal' : 'diagonal'} />
          <span><span className="block text-xs">{finish.label}</span><span className="block text-[10px] text-muted-foreground">{finish.detail}</span></span>
        </InspectorChoice>)}
      </div>}
      {tab === 'notes' && <InspectorNotes item="concrete slab" nodeId={node.id} />}
    </div>
    <div className="flex shrink-0 items-center border-t border-border/50 px-3 py-2">
      <InspectorDeleteButton item="concrete slab" onDelete={() => {
        useScene.getState().deleteNode(node.id as AnyNodeId)
        setSelection({ selectedIds: [] })
      }} />
    </div>
  </PanelWrapper>
}
