'use client'
import { SliderControl, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useScene } from '@pascal-app/core'
import { useEffect, useState } from 'react'
import { PATHWAY_KIND, PathwayNode, pathwayFinishes } from '../domain/schema'
import { pathComponents } from '../domain/components'
import type { AnyNode, AnyNodeId } from '@pascal-app/core'
import { PathwayModeThumbnail, PavingFinishThumbnail } from './thumbnails'
import { sendPathwayCommand, usePathwayStatus } from './session'
import { drawingWidth, hasBorderlessDefault, STONE_WALKWAY_PRESET } from '../domain/settings'
import { finishOptions } from '../rendering/finishes'

export function PathwayPanel() {
  const levelId = useViewer((s) => s.selection.levelId)
  const sceneNodes = useScene((s) => s.nodes)
  // Older scenes stored every route on the level in one node. Separate their
  // disconnected parts once so ordinary selection and Delete affect one item.
  useEffect(() => {
    if (!levelId) return
    const changes: { create: { node: AnyNode; parentId: AnyNodeId }[];
      update: { id: AnyNodeId; data: Partial<AnyNode> }[] } = { create: [], update: [] }
    for (const raw of Object.values(sceneNodes)) {
      if ((raw.type as string) !== PATHWAY_KIND || raw.parentId !== levelId) continue
      const node = PathwayNode.parse(raw)
      const parts = pathComponents(node)
      if (parts.length < 2) {
        if ((raw as { finish?: string }).finish === 'curvedCobbles')
          changes.update.push({ id: node.id as AnyNodeId,
            data: { finish: 'riverStones', borderStyle: 'none' } as Partial<AnyNode> })
        continue
      }
      changes.update.push({ id: node.id as AnyNodeId, data: parts[0] as Partial<AnyNode> })
      for (const part of parts.slice(1)) {
        const sibling = PathwayNode.parse({ ...node, id: undefined, ...part })
        changes.create.push({ node: sibling as unknown as AnyNode, parentId: levelId as AnyNodeId })
      }
    }
    if (changes.create.length || changes.update.length) useScene.getState().applyNodeChanges(changes)
  }, [levelId, sceneNodes])
  const active = useEditor((s) => s.tool === PATHWAY_KIND)
  const defaults = useEditor((s) => s.toolDefaults[PATHWAY_KIND])
  const pathway = PathwayNode.parse(defaults ?? {})
  const selectedIds = useViewer((s) => s.selection.selectedIds)
  const selectedPathway = selectedIds.length === 1 &&
    (sceneNodes[selectedIds[0] as AnyNodeId]?.type as string | undefined) === PATHWAY_KIND
  const status = usePathwayStatus()
  const [mode, setMode] = useState<'straight' | 'curve'>('straight')
  useEffect(() => { if (active) setMode(status.mode) }, [active, status.mode])
  const [stonePreset, setStonePreset] = useState(false)
  const choose = (nextMode: 'straight' | 'curve', stone = false) => {
    if (!levelId) return
    if (active && mode === nextMode && stone === stonePreset) { sendPathwayCommand('cancel'); return }
    if (active) sendPathwayCommand('cancel')
    setMode(nextMode)
    setStonePreset(stone)
    const editor = useEditor.getState()
    const previous = editor.toolDefaults[PATHWAY_KIND]
    editor.setToolDefaults(PATHWAY_KIND, { ...previous,
      defaultWidth: drawingWidth(previous), cornerStyle: 'square',
      ...(stone ? STONE_WALKWAY_PRESET : {}), drawMode: nextMode })
    editor.setMode('build')
    editor.setTool(PATHWAY_KIND)
  }
  const updateDefaults = (patch: Partial<PathwayNode>) => {
    const editor = useEditor.getState()
    const finishColor = patch.finish ? finishOptions[patch.finish].color : undefined
    editor.setToolDefaults(PATHWAY_KIND, { ...editor.toolDefaults[PATHWAY_KIND], ...patch,
      ...(patch.finish && (pathway.color === finishOptions[pathway.finish].color || !editor.toolDefaults[PATHWAY_KIND]?.color)
        ? { color: finishColor } : {}),
    })
  }
  const select = <K extends 'borderStyle' | 'cornerStyle'>(key: K, label: string,
    options: readonly { value: PathwayNode[K]; label: string }[]) => <label className="flex min-h-9 items-center justify-between gap-3 border-b border-border/50 px-2 text-xs text-foreground/80">
      <span>{label}</span>
      <select className="max-w-[58%] rounded-md border border-border/50 bg-[#2C2C2E] px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
        value={pathway[key]} onChange={(event) => updateDefaults({ [key]: event.currentTarget.value } as Pick<PathwayNode, K>)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  return <section aria-label="Pathways and walkways">
    <h3 className="px-2 pb-2 text-xs font-medium text-foreground">Paving finish</h3>
    <div role="group" aria-label="Choose paving finish" className="grid grid-cols-2 gap-2 px-2">
      {pathwayFinishes.map((finish) => {
        const option = finishOptions[finish]
        const selected = pathway.finish === finish
        return <button key={finish} type="button" aria-pressed={selected} disabled={!levelId}
          title={option.description}
          onClick={() => {
            updateDefaults({ finish, ...(hasBorderlessDefault(finish) ? { borderStyle: 'none' } : {}) })
            setStonePreset(false)
            if (!active) choose(mode, false)
          }}
          className={`flex min-h-11 items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] leading-4 transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'border-primary bg-accent/30 ring-1 ring-primary/50' : 'border-border bg-secondary/40 hover:bg-accent/30'}`}>
          <PavingFinishThumbnail finish={finish} />
          <span className="min-w-0">{option.label}</span>
        </button>
      })}
    </div>
    <div className="mb-1.5 text-xs font-medium">Drawing mode and preset</div>
    <div className="grid grid-cols-2 gap-2">
      {([
        { label: 'Straight / polyline', kind: 'straight' as const, selected: active && !stonePreset && status.mode === 'straight', onClick: () => choose('straight') },
        { label: 'Smooth curve', kind: 'curve' as const, selected: active && !stonePreset && status.mode === 'curve', onClick: () => choose('curve') },
        { label: 'Stone walkway · 1.8 m', kind: 'stones' as const, selected: active && stonePreset, onClick: () => choose('curve', true) },
      ]).map((item) => <button key={item.label} type="button" aria-pressed={item.selected} disabled={!levelId}
        onClick={item.onClick}
        className={`flex min-h-12 items-center gap-2 overflow-hidden rounded-md border px-2 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 ${item.selected ? 'border-primary bg-accent/30 ring-1 ring-primary/50' : 'border-border bg-secondary/40 hover:bg-accent/30'}`}>
        <PathwayModeThumbnail kind={item.kind} />
        <span className="min-w-0 text-[11px] leading-4 text-foreground">{item.label}</span>
      </button>)}
    </div>
    <p role="status" className="mt-2 text-xs text-muted-foreground">
      {!levelId ? 'Select a level first.' : active ? status.message || 'Click to draw. C switches modes; Enter finishes; Esc stops drawing.' : 'Select a style to start drawing.'}
    </p>
    <div className="mt-3 flex flex-col gap-1.5 border-t border-border/70 pt-3">
      <h3 className="px-2 text-xs font-medium text-foreground">Placement defaults</h3>
      <SliderControl label="Path width" value={pathway.defaultWidth} min={0.3} max={10} step={0.1} precision={1} unit="m"
        onChange={(defaultWidth) => updateDefaults({ defaultWidth })} />
      <SliderControl label="Thickness" value={pathway.thickness} min={0.02} max={0.5} step={0.01} precision={2} unit="m"
        onChange={(thickness) => updateDefaults({ thickness })} />
      <SliderControl label="Elevation" value={pathway.elevation} min={-2} max={2} step={0.01} precision={2} unit="m"
        onChange={(elevation) => updateDefaults({ elevation })} />
      {select('borderStyle', 'Path border', [
        { value: 'none', label: 'None' }, { value: 'stone', label: 'Stone' }, { value: 'smooth', label: 'Smooth' },
      ])}
      {select('cornerStyle', 'Corners', [
        { value: 'square', label: 'Square' }, { value: 'round', label: 'Round' },
      ])}
    </div>
    {selectedPathway && !active && <p className="mt-2 text-xs text-muted-foreground">
      Drag orange junction dots, purple curve handles, or green insert dots. End arrows change length.
      Choose Smooth or Corner for curved junctions in the settings. Show all edit points to inspect a dense route.
    </p>}
  </section>
}
