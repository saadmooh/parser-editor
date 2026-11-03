'use client'
import { ActionButton, SegmentedControl, SliderControl, ToggleControl, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import type { AccessItem } from './shared/items'
import { PatioPanel } from './patio/editor/panel'
import { DeckPanel } from './deck/editor/panel'
import { SurfaceDrawingPanel } from './shared/drawing-panel'
import { isDrawnAccessKind } from './shared/items'
import { useScene, type AnyNode, type AnyNodeId } from '@pascal-app/core'
import { EdgingNode, EDGING_KIND, edgingForms, type EdgingNode as Edging } from './edging/domain/schema'
import { RetainingWallNode } from './retaining-wall/domain/schema'

export function GroundAccessPanel({ item }: { item: AccessItem['kind'] }) {
  const active = useEditor((state) => state.tool)
  const selectedId = useViewer((state) => state.selection.selectedIds.length === 1
    ? state.selection.selectedIds[0] : undefined)
  const selectedNode = useScene((state) => selectedId ? state.nodes[selectedId as AnyNodeId] : undefined)
  const selectedType = selectedNode?.type as string | undefined
  const edgingDefaults = useEditor((state) => state.toolDefaults[EDGING_KIND])
  const selectedEdging = selectedType === EDGING_KIND && selectedNode ? EdgingNode.parse(selectedNode) : null
  const editingEdging = active === EDGING_KIND
  const configuringEdging = item === 'edging'
  const edgingSettings = editingEdging || configuringEdging
    ? EdgingNode.parse(edgingDefaults ?? {}) : selectedEdging
  const updateEdging = (patch: Partial<Edging>) => {
    if (editingEdging || configuringEdging) {
      const editor = useEditor.getState()
      editor.setToolDefaults(EDGING_KIND, { ...editor.toolDefaults[EDGING_KIND], ...patch })
    } else if (selectedEdging) useScene.getState().updateNode(selectedEdging.id as AnyNodeId, patch as Partial<AnyNode>)
  }
  const updateEdgingForm = (form: Edging['form']) => updateEdging({ form,
    ...(edgingSettings?.thickness === 0.18 && (form === 'capped-wall' || form === 'square-posts' || form === 'round-posts')
      ? { thickness: form === 'capped-wall' ? 0.6 : form === 'square-posts' ? 0.45 : 0.3 } : {}),
    ...(form === 'stone' && edgingSettings?.irregularity === 0.2 ? { irregularity: 0.75 } : {}),
    ...(form === 'square-posts' && edgingSettings?.form !== 'square-posts' ? { postHeightPattern: 'staggered' as const } : {}),
    ...(form === 'round-posts' && edgingSettings?.form !== 'round-posts' ? { postHeightPattern: 'even' as const } : {}),
  })
  return <section aria-label="Ground and access">
    {(item === 'patio' || active === 'landscape:patio' || (!isDrawnAccessKind(active ?? '') && selectedType === 'landscape:patio')) && <PatioPanel />}
    {(item === 'deck' || active === 'landscape:deck' || (!isDrawnAccessKind(active ?? '') && selectedType === 'landscape:deck')) && <DeckPanel />}
    {(['landscape:concrete-slab', 'landscape:landing'] as const).map((kind) =>
      ((item === kind.slice('landscape:'.length)) || active === kind || (!isDrawnAccessKind(active ?? '') && selectedType === kind)) &&
        <SurfaceDrawingPanel key={kind} kind={kind} />)}
    {(configuringEdging || active === EDGING_KIND || selectedType === EDGING_KIND) && <div className={configuringEdging ? 'flex flex-col gap-1.5' : 'flex flex-col gap-1.5 py-3'}>
      {configuringEdging && edgingSettings && <>
        <h3 className="px-2 text-xs font-medium text-foreground">Placement defaults</h3>
        <SliderControl label="Run length" value={edgingSettings.width} min={0.2} max={30} step={0.1} precision={1} unit="m" onChange={(value) => updateEdging({ width: value })} />
        <SliderControl label="Border width" value={edgingSettings.depth} min={0.2} max={3} step={0.05} precision={2} unit="m" onChange={(value) => updateEdging({ depth: value })} />
        <SliderControl label="Height" value={edgingSettings.thickness} min={0.03} max={2} step={0.01} precision={2} unit="m" onChange={(value) => updateEdging({ thickness: value })} />
      </>}
      <div className="px-2 pt-2 text-xs font-medium text-foreground">Edging form</div>
      <label className="flex min-h-9 items-center justify-between gap-3 border-b border-border/50 px-2 text-xs text-foreground/80">
        <span>Shape</span>
        <select className="max-w-[58%] rounded-md border border-border/50 bg-[#2C2C2E] px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
          value={edgingSettings?.form ?? 'pavers'} onChange={(event) => updateEdgingForm(event.currentTarget.value as Edging['form'])}>
          {edgingForms.map((form) => <option key={form} value={form}>{({ strip: 'Strip', pavers: 'Pavers', stone: 'Stone', 'square-posts': 'Square posts',
            'round-posts': 'Round posts', 'capped-wall': 'Capped wall' } as const)[form]}</option>)}
        </select>
      </label>
      <div className="px-2 pt-2 text-xs text-foreground/80">Profile</div>
      <SegmentedControl value={edgingSettings?.profile ?? 'low'} options={[
        { label: 'Flush', value: 'flush' }, { label: 'Low', value: 'low' },
        { label: 'Raised', value: 'raised' }, { label: 'Mowing strip', value: 'mowing-strip' },
      ]} onChange={(profile) => updateEdging({ profile })} />
      {edgingSettings?.form === 'pavers' && <>
        <SliderControl label="Unit length" value={edgingSettings.unitLength} min={0.05} max={2} step={0.01} precision={2} unit="m" onChange={(value) => updateEdging({ unitLength: value })} />
        <SliderControl label="Joint width" value={edgingSettings.jointWidth} min={0} max={0.1} step={0.002} precision={3} unit="m" onChange={(value) => updateEdging({ jointWidth: value })} />
      </>}
      {edgingSettings?.form === 'stone' && <SliderControl label="Stone variation" value={edgingSettings.irregularity} min={0} max={1} step={0.05} precision={2}
        onChange={(irregularity) => updateEdging({ irregularity })} />}
      {edgingSettings?.form === 'capped-wall' && <>
        <SliderControl label="Cap overhang" value={edgingSettings.capOverhang} min={0} max={0.3} step={0.01} precision={2} unit="m" onChange={(value) => updateEdging({ capOverhang: value })} />
        <SliderControl label="Cap thickness" value={edgingSettings.capThickness} min={0.02} max={0.3} step={0.01} precision={2} unit="m" onChange={(value) => updateEdging({ capThickness: value })} />
      </>}
      {edgingSettings?.form === 'pavers' && <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, marginBottom: 6 }}>Paver pattern</div>
        <SegmentedControl value={edgingSettings.layout === 'woven' ? 'woven' : 'separated'}
          options={[{ label: 'Separated', value: 'separated' }, { label: 'Woven', value: 'woven' }]}
          onChange={(layout) => updateEdging({ layout })} />
      </div>}
      {(edgingSettings?.form === 'square-posts' || edgingSettings?.form === 'round-posts') && <>
        <SliderControl label="Post length" value={edgingSettings.unitLength} min={0.05} max={2} step={0.01} precision={2} unit="m" onChange={(value) => updateEdging({ unitLength: value })} />
        <SliderControl label="Post spacing" value={edgingSettings.jointWidth} min={0} max={0.1} step={0.002} precision={3} unit="m" onChange={(value) => updateEdging({ jointWidth: value })} />
      </>}
      {(edgingSettings?.form === 'square-posts' || edgingSettings?.form === 'round-posts') && <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, marginBottom: 6 }}>Post heights</div>
        <SegmentedControl value={edgingSettings.postHeightPattern}
          options={[{ label: 'Even', value: 'even' }, { label: 'Staggered', value: 'staggered' }]}
          onChange={(postHeightPattern) => updateEdging({ postHeightPattern })} />
      </div>}
      <div className="px-2 pt-2 text-xs font-medium text-foreground">Drawing mode</div>
      {(() => {
        const selected = selectedType === EDGING_KIND && selectedNode ? EdgingNode.parse(selectedNode) : null
        const current = selected && active !== EDGING_KIND ? selected.drawMode : edgingSettings?.drawMode ?? 'straight'
        const updateMode = (drawMode: 'straight' | 'curve' | 'freehand') => {
          if (selected && active !== EDGING_KIND) {
            const patch = drawMode === 'straight' && selected.curvePoints
              ? { drawMode, points: selected.curvePoints.map((point) => point.anchor), curvePoints: undefined, tangents: undefined }
              : { drawMode }
            useScene.getState().updateNode(selected.id as AnyNodeId, patch as Partial<AnyNode>)
          }
          else {
            const editor = useEditor.getState()
            editor.setToolDefaults(EDGING_KIND, { ...editor.toolDefaults[EDGING_KIND], drawMode })
          }
        }
        return <div role="group" aria-label="Edging drawing mode" className="grid grid-cols-3 gap-1.5">
          {([{ label: 'Straight', value: 'straight' }, { label: 'Curve', value: 'curve' }, { label: 'Freehand', value: 'freehand' }] as const).map((option) =>
            <ActionButton key={option.value} type="button" label={option.label} aria-pressed={current === option.value}
              onClick={() => updateMode(option.value)}
              className={`w-full min-w-0 flex-none justify-center px-1 ${current === option.value ? 'bg-[#3e3e3e] text-foreground ring-1 ring-border/50' : ''}`} />)}
        </div>
      })()}
      <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
        {active === EDGING_KIND && (useEditor.getState().toolDefaults[EDGING_KIND]?.drawMode === 'freehand'
          ? 'Drag to draw; press C to switch or Enter to finish.' : 'Click points; press C to switch or Enter to finish.')}
        {selectedEdging && active !== EDGING_KIND &&
          ' Drag orange points to reshape, purple handles to bend curves, and green dots to add points.'}
      </p>
    </div>}
    {item === 'retaining-wall' && <RetainingWallDefaults />}
  </section>
}

function RetainingWallDefaults() {
  const defaults = useEditor((state) => state.toolDefaults['landscape:retaining-wall'])
  const active = useEditor((state) => state.tool === 'wall' &&
    (state.toolDefaults.wall?.metadata as { landscapeRetainingWall?: boolean } | undefined)?.landscapeRetainingWall === true)
  const wall = RetainingWallNode.parse(defaults ?? {})
  const update = (patch: Partial<RetainingWallNode>) => {
    const editor = useEditor.getState()
    editor.setToolDefaults('landscape:retaining-wall', { ...editor.toolDefaults['landscape:retaining-wall'], ...patch })
    if (active) editor.setToolDefaults('wall', { ...editor.toolDefaults.wall,
      ...(patch.depth !== undefined ? { thickness: patch.depth } : {}),
      ...(patch.thickness !== undefined ? { height: patch.thickness } : {}),
    })
  }
  const number = (key: 'depth' | 'thickness' | 'courseHeight' | 'unitLength' | 'jointWidth' | 'capHeight' | 'capOverhang', title: string, min: number, max: number, step: number) =>
    <SliderControl label={title} value={wall[key]} min={min} max={max} step={step}
      precision={Math.max(0, Math.ceil(-Math.log10(step)))} unit="m"
      onChange={(value) => update({ [key]: value })} />
  const drawConnectedWall = () => {
    const editor = useEditor.getState()
    const existing = editor.toolDefaults.wall ?? {}
    const metadata = existing.metadata as Record<string, unknown> | undefined
    editor.setToolDefaults('wall', {
      ...existing,
      thickness: wall.depth,
      height: wall.thickness,
      metadata: {
        ...metadata,
        landscapeRetainingWall: true,
        roomBoundary: false,
      },
    })
    editor.setPhase('building')
    editor.armToolMode({ mode: 'build', tool: 'wall' })
  }
  return <div aria-label="Retaining wall settings" className="flex flex-col gap-1.5">
    <h3 className="px-2 text-xs font-medium text-foreground">Placement defaults</h3>
    {!active && <ActionButton label="Draw connected wall" onClick={drawConnectedWall} />}
    {active && <p className="px-2 text-xs text-muted-foreground">
      Click connected points; press Enter to finish. Select a segment to curve it and edit its masonry.
    </p>}
    {number('depth', 'Wall width', 0.2, 3, 0.05)}
    {number('thickness', 'Wall height', 0.03, 2, 0.01)}
    <div className="space-y-1 py-1">
      <div className="px-2 text-xs font-medium text-foreground">Masonry style</div>
      <SegmentedControl value={wall.style} options={[
        { label: 'Block', value: 'stacked-block' }, { label: 'Stone', value: 'fieldstone' }, { label: 'Smooth', value: 'smooth' },
      ]} onChange={(style) => update({ style })} />
    </div>
    {number('courseHeight', 'Course height (m)', 0.08, 0.6, 0.01)}
    {number('unitLength', 'Block length (m)', 0.15, 1.5, 0.01)}
    {number('jointWidth', 'Joint width (m)', 0.002, 0.05, 0.002)}
    <ToggleControl label="Add wall cap" checked={wall.capEnabled} onChange={(capEnabled) => update({ capEnabled })} />
    {wall.capEnabled && <>{number('capHeight', 'Cap height (m)', 0.03, 0.2, 0.005)}{number('capOverhang', 'Cap overhang (m)', 0, 0.15, 0.005)}</>}
  </div>
}
