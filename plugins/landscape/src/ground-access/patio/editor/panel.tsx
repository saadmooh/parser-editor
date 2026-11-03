'use client'
import type { AnyNode, AnyNodeId } from '@pascal-app/core'
import { useScene } from '@pascal-app/core'
import { ActionButton, ActionGroup, SliderControl, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useState } from 'react'
import { pergolaDimensions } from '../../../pergola/domain/layout'
import { PergolaNode, PERGOLA_KIND } from '../../../pergola/domain/schema'
import { PatioNode, PATIO_KIND } from '../domain/schema'
import { finishColor } from '../rendering/geometry'
import { useDrawingStatus } from '../../shared/drawing-session'
import { DrawingModeControl } from '../../shared/drawing-mode-control'
import { circleSizePatch, isCurvedSurface } from '../../shared/outline'

export function PatioPanel() {
  const levelId = useViewer((state) => state.selection.levelId)
  const selectedId = useViewer((state) => state.selection.selectedIds.length === 1
    ? state.selection.selectedIds[0] : undefined)
  const placing = useEditor((state) => state.tool === PATIO_KIND)
  const nodes = useScene((state) => state.nodes)
  const selected = !placing && selectedId && (nodes[selectedId as AnyNodeId]?.type as string) === PATIO_KIND
    ? PatioNode.parse(nodes[selectedId as AnyNodeId]) : null
  const defaults = useEditor((state) => state.toolDefaults[PATIO_KIND])
  const patio = selected ?? PatioNode.parse(defaults ?? {})
  const drawingStatus = useDrawingStatus(PATIO_KIND)
  const [margin, setMargin] = useState(0.45)
  const [pergolaId, setPergolaId] = useState('')
  const pergolas = Object.values(nodes).filter((node) =>
    (node.type as string) === PERGOLA_KIND && node.parentId === levelId && node.visible !== false)
  const chosen = pergolas.find((node) => node.id === pergolaId) ?? pergolas[0]
  const fitDimensions = chosen ? pergolaDimensions(PergolaNode.parse(chosen)) : null
  const fitTooLarge = fitDimensions !== null &&
    (fitDimensions[0] + 2 * margin > 30 || fitDimensions[2] + 2 * margin > 30)
  const update = (patch: Partial<PatioNode>) => {
    if (selected) useScene.getState().updateNode(selected.id as AnyNodeId,
      circleSizePatch(selected, patch) as Partial<AnyNode>)
    else useEditor.getState().setToolDefaults(PATIO_KIND, {
      ...useEditor.getState().toolDefaults[PATIO_KIND], ...patch,
    })
  }
  const number = (key: 'width' | 'depth' | 'thickness' | 'elevation' | 'slopePercent' | 'paverWidth' | 'paverDepth' | 'jointWidth' | 'borderWidth',
    title: string, min: number, max: number, step: number) =>
    <SliderControl label={title} min={min} max={max} step={step}
      precision={Math.max(0, Math.ceil(-Math.log10(step)))} unit={key === 'slopePercent' ? '%' : 'm'}
      value={patio[key]} onChange={(value) => update({ [key]: value })} />
  const select = <K extends 'finish' | 'pattern' | 'borderStyle' | 'drainDirection'>(key: K, title: string,
    options: readonly { value: PatioNode[K]; label: string }[]) =>
    <div className="flex items-center justify-between gap-2 px-3 py-2">
      <span className="text-xs text-foreground/80">{title}</span>
      <select className="rounded-md border border-border/50 bg-[#2C2C2E] px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30" value={patio[key]}
        onChange={(event) => {
          const value = event.currentTarget.value as PatioNode[K]
          if (key === 'finish') {
            const previous = finishColor[patio.finish]
            update({ finish: value as PatioNode['finish'],
              fieldColor: patio.fieldColor === previous ? finishColor[value as PatioNode['finish']] : patio.fieldColor })
          } else update({ [key]: value })
        }}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  const fit = () => {
    if (!chosen || !levelId) return
    const pergola = PergolaNode.parse(chosen)
    const [pergolaWidth, , pergolaDepth] = pergolaDimensions(pergola)
    const width = pergolaWidth + 2 * margin
    const depth = pergolaDepth + 2 * margin
    if (width > 30 || depth > 30) return
    const position: [number, number, number] = [
      pergola.position[0], pergola.position[1] - patio.thickness - Math.min(0.045, patio.thickness / 3) + 0.02,
      pergola.position[2],
    ]
    const patch = { width, depth, position, rotation: pergola.rotation, elevation: 0, slopePercent: 0,
      shape: 'rectangle' as const, outline: [] }
    if (selected) update(patch)
    else {
      const { id: _id, ...fields } = PatioNode.parse({ ...patio, ...patch, name: `Patio for ${pergola.name}` })
      const placed = PatioNode.parse(fields)
      useScene.getState().createNode(placed as unknown as AnyNode, levelId as AnyNodeId)
      useViewer.getState().setSelection({ selectedIds: [placed.id] })
      useEditor.getState().setTool(null)
      useEditor.getState().setMode('select')
    }
  }
  return <section aria-label="Patio settings" className="flex flex-col gap-1.5">
    {selected && <h3 style={{ fontSize: 14, margin: '0 0 5px' }}>Selected patio</h3>}
    {selected && patio.shape !== 'freehand' && !isCurvedSurface(patio.shape) && <p style={{ fontSize: 11,
      color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
      Drag points to reshape; double-click a corner to remove it.
    </p>}
    {!selected && <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, marginBottom: 6 }}>Drawing mode</div>
      <DrawingModeControl value={patio.shape} onChange={(shape) => update({ shape })} />
      {placing && drawingStatus.message && <p role="status" style={{ fontSize: 11, color: '#dc6b61' }}>
        {drawingStatus.message}
      </p>}
    </div>}
    {selected && <>{number('width', patio.shape === 'circle' ? 'Diameter (m)' : 'Width (m)', 0.2, 30, 0.1)}
      {patio.shape !== 'circle' && number('depth', 'Depth (m)', 0.2, 30, 0.1)}</>}
    {number('thickness', 'Base thickness (m)', 0.03, 2, 0.01)}
    {number('elevation', 'Base elevation (m)', -2, 2, 0.01)}
    {number('slopePercent', 'Drainage slope (%)', 0, 5, 0.25)}
    {patio.slopePercent > 0 && select('drainDirection', 'Drain toward', [
      { value: 'front', label: 'Front' }, { value: 'back', label: 'Back' },
      { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' },
    ])}
    {select('finish', 'Paver material', [
      { value: 'stone', label: 'Stone' }, { value: 'concrete', label: 'Concrete' }, { value: 'brick', label: 'Brick' },
    ])}
    {select('pattern', 'Laying pattern', [
      { value: 'grid', label: 'Stacked grid' }, { value: 'running-bond', label: 'Running bond' },
    ])}
    {number('paverWidth', 'Paver width (m)', 0.2, 2, 0.05)}
    {number('paverDepth', 'Paver depth (m)', 0.2, 2, 0.05)}
    {number('jointWidth', 'Joint width (m)', 0.003, 0.04, 0.001)}
    <label className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-foreground/80">Paver color
      <input type="color" className="h-7 w-12 cursor-pointer rounded border border-border/50 bg-[#2C2C2E] p-0.5" value={patio.fieldColor}
        onChange={(event) => update({ fieldColor: event.currentTarget.value })} />
    </label>
    {select('borderStyle', 'Border', [
      { value: 'none', label: 'None' }, { value: 'contrast', label: 'Contrasting course' },
    ])}
    {patio.borderStyle !== 'none' && <>
      {number('borderWidth', 'Border width (m)', 0.08, 0.6, 0.01)}
      <label className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-foreground/80">Border color
        <input type="color" className="h-7 w-12 cursor-pointer rounded border border-border/50 bg-[#2C2C2E] p-0.5" value={patio.borderColor}
          onChange={(event) => update({ borderColor: event.currentTarget.value })} />
      </label>
    </>}
    <h4 style={{ fontSize: 12, margin: '20px 0 0' }}>Fit around a pergola</h4>
    <label className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-foreground/80">Pergola
      <select className="rounded-md border border-border/50 bg-[#2C2C2E] px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30" value={chosen?.id ?? ''} disabled={!pergolas.length}
        onChange={(event) => setPergolaId(event.currentTarget.value)}>
        {!pergolas.length && <option value="">No pergola on this level</option>}
        {pergolas.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
      </select>
    </label>
    <SliderControl label="Clearance each side" min={0} max={3} step={0.05} precision={2} unit="m" value={margin} onChange={setMargin} />
    <ActionGroup className="mt-2">
      <ActionButton type="button" label={selected ? 'Fit selected patio' : 'Create patio around pergola'} disabled={!chosen || fitTooLarge} onClick={fit} />
    </ActionGroup>
    {fitTooLarge && <p role="status" style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
      Clearance exceeds the 30 m limit.
    </p>}
  </section>
}
