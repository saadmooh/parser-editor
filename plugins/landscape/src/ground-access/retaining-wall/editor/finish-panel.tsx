'use client'

import {
  type AnyNode,
  type AnyNodeId,
  getClampedWallCurveOffset,
  getMaxWallCurveOffset,
  getWallCurveLength,
  normalizeWallCurveOffset,
  type WallNode,
  useScene,
} from '@pascal-app/core'
import {
  ActionButton,
  ActionGroup,
  PanelSection,
  SegmentedControl,
  SliderControl,
  ToggleControl,
} from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { RetainingWallNode, RETAININGWALL_KIND, type RetainingWallNode as Finish } from '../domain/schema'

export default function RetainingWallFinishPanel({ node }: { node?: AnyNode }) {
  const setSelection = useViewer((state) => state.setSelection)
  const selectedFinishId = (node?.type as string) === RETAININGWALL_KIND ? node?.id as AnyNodeId : null
  const hostWallId = node?.type === 'wall' ? node.id as AnyNodeId
    : (node?.type as string) === RETAININGWALL_KIND ? (node as unknown as Finish).hostWallId as AnyNodeId : null
  const wall = useScene((state) => hostWallId ? state.nodes[hostWallId] as WallNode | undefined : undefined) ?? null
  const finish = useScene((state) => Object.values(state.nodes).find((candidate) =>
    (candidate.type as string) === RETAININGWALL_KIND && (selectedFinishId
      ? candidate.id === selectedFinishId
      : (candidate as unknown as Finish).hostWallId === wall?.id)) as unknown as Finish | undefined)
  if (!wall) return null

  const isRetaining = wall.metadata?.landscapeRetainingWall === true
  const settings = finish ?? RetainingWallNode.parse({})
  const updateWall = (patch: Partial<WallNode>) =>
    useScene.getState().updateNode(wall.id as AnyNodeId, patch)
  const updateFinish = (patch: Partial<Finish>) => {
    if (finish) {
      useScene.getState().updateNode(finish.id as AnyNodeId, patch as Partial<AnyNode>)
    } else if (wall.parentId) {
      const created = RetainingWallNode.parse({
        hostWallId: wall.id, parentId: wall.parentId, position: [0, 0, 0],
        name: 'Retaining wall finish', ...patch,
      })
      useScene.getState().createNode(created as unknown as AnyNode, wall.parentId as AnyNodeId)
    }
  }

  if (!isRetaining) return <ActionButton label="Use as retaining wall" onClick={() => updateWall({
    metadata: { ...wall.metadata, landscapeRetainingWall: true, roomBoundary: false },
  })} />

  const length = getWallCurveLength(wall)
  const curveLimit = Math.max(0.01, getMaxWallCurveOffset(wall))
  const changeLength = (next: number) => {
    const dx = wall.end[0] - wall.start[0]
    const dz = wall.end[1] - wall.start[1]
    const straight = Math.hypot(dx, dz)
    if (straight < 0.001) return
    updateWall({ end: [wall.start[0] + dx / straight * next, wall.start[1] + dz / straight * next] })
  }
  const finishNumber = (
    key: 'courseHeight' | 'unitLength' | 'jointWidth' | 'capHeight' | 'capOverhang',
    label: string, min: number, max: number, step: number,
  ) => <SliderControl key={key} label={label} value={settings[key]}
    min={min} max={max} step={step} precision={step < 0.01 ? 3 : 2} unit="m"
    onChange={(value) => updateFinish({ [key]: value })} />

  return <>
    <PanelSection title="Dimensions">
      <SliderControl label="Length" value={length} min={0.1} max={1000}
        step={0.01} precision={2} unit="m" onChange={changeLength} />
      <SliderControl label="Height" value={wall.height ?? 0.9} min={0.15} max={3}
        step={0.01} precision={2} unit="m" onChange={(height) => updateWall({ height })} />
      <SliderControl label="Wall width" value={wall.thickness ?? 0.25} min={0.15} max={1.5}
        step={0.01} precision={2} unit="m" onChange={(thickness) => updateWall({ thickness })} />
      <SliderControl label="Curve" value={getClampedWallCurveOffset(wall)}
        min={-curveLimit} max={curveLimit} step={0.01} precision={2} unit="m"
        onChange={(value) => updateWall({ curveOffset: normalizeWallCurveOffset(wall, value) })} />
    </PanelSection>

    <PanelSection title="Masonry">
      <div className="px-1 font-medium text-[10px] text-muted-foreground/80 uppercase tracking-wider">
        Style
      </div>
      <SegmentedControl value={settings.style} onChange={(style) => updateFinish({ style })}
        options={[
          { label: 'Block', value: 'stacked-block' },
          { label: 'Stone', value: 'fieldstone' },
          { label: 'Concrete', value: 'smooth' },
        ]} />
      {settings.style !== 'smooth' && <>
        {finishNumber('courseHeight', 'Course height', 0.08, 0.6, 0.01)}
        {finishNumber('unitLength', 'Block length', 0.15, 1.5, 0.01)}
        {finishNumber('jointWidth', 'Joint width', 0.002, 0.05, 0.002)}
      </>}
    </PanelSection>

    <PanelSection title="Top cap">
      <ToggleControl label="Top cap" checked={settings.capEnabled}
        onChange={(capEnabled) => updateFinish({ capEnabled })} />
      {settings.capEnabled && <>
        {finishNumber('capHeight', 'Cap height', 0.03, 0.2, 0.005)}
        {finishNumber('capOverhang', 'Cap overhang', 0, 0.15, 0.005)}
      </>}
    </PanelSection>

    <PanelSection title="Actions">
      <ActionGroup>
        <ActionButton label="Remove retaining wall finish" onClick={() => updateWall({
          metadata: { ...wall.metadata, landscapeRetainingWall: false, roomBoundary: true },
        })} />
        <ActionButton label="Delete retaining wall" onClick={() => {
          useScene.getState().deleteNode(wall.id as AnyNodeId)
          setSelection({ selectedIds: [] })
        }} />
      </ActionGroup>
    </PanelSection>
  </>
}
