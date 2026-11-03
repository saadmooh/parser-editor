'use client'
import { collectAlignmentAnchors, emitter, type GridEvent, snapPointToGrid, useScene, type AnyNode, type AnyNodeId } from '@pascal-app/core'
import { CursorSphere, EDITOR_LAYER, isAlignmentGuideActive, isAngleSnapActive, isGridSnapActive, isMagneticSnapActive, resolveAlignmentForActiveBuilding, useAlignmentGuides, useEditor, usePlacementPreview } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useRef, useState } from 'react'
import type { Group } from 'three'
import { distance, lerp, splineCurves, type Curve } from '../domain/curves'
import { projectToEdgeNormal, snapAlongAngle } from '../domain/drafting'
import { addCurves, PathwayGradeConflictError, snapToNetwork } from '../domain/network'
import { planPathwayItems } from '../domain/items'
import { PATHWAY_KIND, PathwayNode, type Point } from '../domain/schema'
import { snapToHardscape } from '../../ground-access/shared/hardscape-snap'
import { drawingWidth } from '../domain/settings'
import { buildOutline } from '../rendering/outline'
import PathwayPreview from '../rendering/preview'
import { onPathwayCommand, setPathwayStatus, type PathwayMode } from './session'

const empty = { vertices: [], edges: [] }
const ALIGNMENT_ID = '__pathway_draft__'
function straight(a: Point, b: Point): Curve {
  return [a, lerp(a, b, 1 / 3), lerp(a, b, 2 / 3), b]
}
export default function PathwayTool() {
  const viewMode = useEditor(state => state.viewMode)
  return viewMode === '2d' ? null : <PathwayPlacement render3D />
}
export function PathwayPlacement({ render3D = true }: { render3D?: boolean } = {}) {
  const activeLevelId = useViewer((s) => s.selection.levelId)
  const [preview, setPreview] = useState<PathwayNode | null>(null)
  const [cursor, setCursor] = useState<Point | null>(null)
  const [levelY, setLevelY] = useState(0)
  const [snapKind, setSnapKind] = useState<'vertex' | 'edge' | null>(null)
  const marker = useRef<Group>(null)
  useEffect(() => {
    if (!activeLevelId) return
    const defaults = useEditor.getState().toolDefaults[PATHWAY_KIND]
    let mode: PathwayMode = defaults?.drawMode === 'curve' ? 'curve' : 'straight'
    const configuredWidth = drawingWidth(defaults)
    let base = PathwayNode.parse({ color: defaults?.color, defaultWidth: configuredWidth, finish: defaults?.finish,
      thickness: defaults?.thickness, elevation: defaults?.elevation, borderStyle: defaults?.borderStyle,
      cornerStyle: defaults?.cornerStyle, parentId: activeLevelId, name: 'Walkways' })
    let start: Point | null = null, alignment: Point[] = [], currentCursor: Point | null = null
    let startEdgeDirection: Point | null = null
    let activeNetworkId: string | null = null
    let targetKind: 'vertex' | 'edge' | null = null
    let numericField: 'length' | 'bearing' | null = null, typed = ''
    let length: number | null = null, bearing: number | null = null
    let commitMessage = ''
    const networks = () => Object.values(useScene.getState().nodes)
      .filter((node) => (node.type as string) === PATHWAY_KIND && node.parentId === activeLevelId)
      .map((node) => PathwayNode.parse(node))
    let width = Math.min(10, Math.max(0.3, configuredWidth))
    const status = (message = '') => setPathwayStatus({
      points: (start ? 1 : 0) + alignment.length, mode, snap: targetKind !== null,
      message: numericField ? `${numericField === 'length' ? 'Length' : 'Bearing'}: ${typed || 'type a value'}${numericField === 'bearing' ? '°' : ' m'}` : message || commitMessage,
    })
    const setCursorPoint = (point: Point, kind: 'vertex' | 'edge' | null) => {
      currentCursor = point; targetKind = kind
      setCursor(point); setSnapKind(kind)
      marker.current?.position?.set(point[0], 0.1, point[1])
    }
    const clear = () => {
      start = null; alignment = []; currentCursor = null; targetKind = null
      activeNetworkId = null
      length = null; bearing = null; numericField = null; typed = ''
      commitMessage = ''
      setPreview(null); setCursor(null); setSnapKind(null)
      usePlacementPreview.getState().clear(); useAlignmentGuides.getState().clear(); status()
    }
    const stop = () => { clear(); useEditor.getState().setTool(null); useEditor.getState().setMode('select') }
    const makeCurves = (points: Point[]) => mode === 'curve' ? splineCurves(points) : points.slice(1).map((point, index) => straight(points[index]!, point))
    const renderDraft = () => {
      const points = start ? [start, ...alignment] : []
      if (currentCursor && (!points.length || distance(points.at(-1)!, currentCursor) >= 0.05)) points.push(currentCursor)
      if (points.length < 2) { setPreview(null); usePlacementPreview.getState().clear(); status(); return }
      try {
        const current = networks().find((node) => node.id === activeNetworkId)
        const node = PathwayNode.parse({ ...base, color: current?.color ?? base.color,
          thickness: current?.thickness ?? base.thickness, elevation: current?.elevation ?? base.elevation,
          finish: current?.finish ?? base.finish, cornerStyle: current?.cornerStyle ?? base.cornerStyle,
          ...addCurves(empty, makeCurves(points), width, mode === 'straight' ? 'straight' : 'spline') })
        buildOutline(node)
        setPreview(node); usePlacementPreview.getState().set(node as unknown as AnyNode); status()
      } catch {
        setPreview(null); usePlacementPreview.getState().clear()
        status('This bend cannot be paved at this width. Move the point or undo it.')
      }
    }
    const commit = (curves: Curve[]) => {
      if (!curves.length) return false
      commitMessage = ''
      if (useScene.getState().readOnly) { commitMessage = 'This project is read-only.'; status(); return false }
      try {
        const existing = networks()
        const current = existing.find((node) => node.id === activeNetworkId)
        const template = current ?? base
        const changes = planPathwayItems(existing, curves, width, template, mode === 'straight' ? 'straight' : 'spline')
        if (!changes.create.length && !changes.delete.length && changes.update.every((node) => {
          const before = existing.find((candidate) => candidate.id === node.id)
          return before && JSON.stringify([before.vertices, before.edges]) === JSON.stringify([node.vertices, node.edges])
        })) return false
        for (const node of [...changes.create, ...changes.update]) buildOutline(node)
        useScene.getState().applyNodeChanges({
          create: changes.create.map((node) => ({ node: node as unknown as AnyNode, parentId: activeLevelId as AnyNodeId })),
          update: changes.update.map((node) => ({ id: node.id as AnyNodeId, data: node as unknown as Partial<AnyNode> })),
          delete: changes.delete as AnyNodeId[],
        })
        activeNetworkId = changes.activeId
        return true
      } catch (error) { commitMessage = error instanceof PathwayGradeConflictError ? error.message : 'Could not join this walkway. Move the endpoint and try again.'; status(); return false }
    }
    const resolve = (event: GridEvent) => {
      setLevelY(event.localPosition[1])
      const raw: Point = [event.localPosition[0], event.localPosition[2]]
      const noSnap = event.nativeEvent?.altKey
      const from = alignment.at(-1) ?? start
      const gridStep = useEditor.getState().gridSnapStep
      const graph = networks()
      const firstLegFromEdge = Boolean(start && !alignment.length && startEdgeDirection)
      const surfaceHit = !noSnap && !firstLegFromEdge ? snapToHardscape(raw, useScene.getState().nodes,
        activeLevelId, undefined, Math.max(0.35, width / 2 + 0.1)) : null
      if (surfaceHit) {
        useAlignmentGuides.getState().clear()
        return { point: surfaceHit.point, kind: surfaceHit.kind, nodeId: null,
          surfaceHeight: surfaceHit.height, edgeDirection: surfaceHit.edgeDirection }
      }
      const pathHit = !noSnap && !firstLegFromEdge ? graph.flatMap((node) => {
        const hit = snapToNetwork(node, raw, Math.max(0.5, width / 2 + 0.4))
        return hit ? [{ ...hit, nodeId: node.id }] : []
      }).sort((a, b) => a.distance - b.distance)[0] : null
      if (pathHit) {
        useAlignmentGuides.getState().clear()
        return { point: pathHit.point, kind: pathHit.vertexId ? 'vertex' as const : 'edge' as const,
          surfaceHeight: undefined, edgeDirection: undefined }
      }
      let point = raw
      if (!noSnap) {
        if (isAngleSnapActive() && from) point = snapAlongAngle(from, raw, gridStep)
        else if (isGridSnapActive()) point = [...snapPointToGrid(raw, gridStep)]
        if (isAlignmentGuideActive() || isMagneticSnapActive()) {
          const candidates = collectAlignmentAnchors(useScene.getState().nodes, ALIGNMENT_ID, activeLevelId)
          for (const node of graph) for (const vertex of node.vertices) candidates.push({ nodeId: vertex.id, kind: 'corner', x: vertex.point[0], z: vertex.point[1] })
          const result = resolveAlignmentForActiveBuilding({ candidates,
            moving: [{ nodeId: ALIGNMENT_ID, kind: 'corner', x: point[0], z: point[1] }], threshold: 0.18 })
          if (isAlignmentGuideActive()) useAlignmentGuides.getState().set(result.guides)
          else useAlignmentGuides.getState().clear()
          if (isMagneticSnapActive() && result.snap) point = [point[0] + result.snap.dx, point[1] + result.snap.dz]
        } else useAlignmentGuides.getState().clear()
        if (from && (length !== null || bearing !== null)) {
          const dx = point[0] - from[0], dz = point[1] - from[1]
          const measured = length ?? Math.hypot(dx, dz)
          const angle = bearing !== null ? bearing * Math.PI / 180 : Math.atan2(dx, -dz)
          point = [from[0] + Math.sin(angle) * measured, from[1] - Math.cos(angle) * measured]
        }
      } else useAlignmentGuides.getState().clear()
      if (firstLegFromEdge && from && startEdgeDirection) {
        point = projectToEdgeNormal(from, raw, startEdgeDirection)
        useAlignmentGuides.getState().clear()
      }
      return { point, kind: null, nodeId: null, surfaceHeight: undefined, edgeDirection: undefined }
    }
    const onMove = (event: GridEvent) => {
      commitMessage = ''
      const { point, kind } = resolve(event)
      setCursorPoint(point, kind); renderDraft()
    }
    const onClick = (event: GridEvent) => {
      if (event.nativeEvent?.button !== 0 || useViewer.getState().cameraDragging) return
      const { point, kind, nodeId, surfaceHeight, edgeDirection } = resolve(event)
      setCursorPoint(point, kind)
      if (!start) {
        start = point; startEdgeDirection = kind === 'edge' ? edgeDirection ?? null : null
        activeNetworkId = nodeId ?? null
        const current = networks().find((node) => node.id === activeNetworkId)
        width = current?.defaultWidth ?? configuredWidth
        if (!current && surfaceHeight !== undefined)
          base = PathwayNode.parse({ ...base, elevation: surfaceHeight })
        status(); return
      }
      const previous = alignment.at(-1) ?? start
      if (distance(previous, point) < 0.05) return
      if (mode === 'curve') alignment.push(point)
      else if (commit([straight(start, point)])) { start = point; startEdgeDirection = null }
      length = null; bearing = null; targetKind = null; setSnapKind(null); renderDraft()
    }
    const finish = () => {
      if (mode === 'curve' && start && alignment.length && !commit(splineCurves([start, ...alignment])) && commitMessage) return
      else if (mode === 'straight' && start && currentCursor && distance(start, currentCursor) >= 0.05 && !commit([straight(start, currentCursor)]) && commitMessage) return
      stop()
    }
    const command = (action: 'finish' | 'back' | 'cancel' | 'toggle') => {
      if (action === 'finish') finish()
      else if (action === 'cancel') stop()
      else if (action === 'toggle') {
        const next = mode === 'straight' ? 'curve' : 'straight'
        clear()
        const editor = useEditor.getState()
        editor.setToolDefaults(PATHWAY_KIND, { ...editor.toolDefaults[PATHWAY_KIND], drawMode: next })
      } else {
        if (mode === 'curve' && alignment.length) alignment.pop()
        else start = null // Straight clicks are already in scene history.
        renderDraft()
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return
      const key = event.key.toLowerCase()
      if (numericField) {
        if (key === 'escape') { numericField = null; typed = ''; status(); event.preventDefault(); event.stopImmediatePropagation(); return }
        if (key === 'enter') {
          const value = Number(typed)
          if (typed && Number.isFinite(value)) {
            if (numericField === 'length' && value >= 0.05) length = value
            if (numericField === 'bearing') bearing = ((value % 360) + 360) % 360
          }
          numericField = null; typed = ''; status(); event.preventDefault(); event.stopImmediatePropagation(); return
        }
        if (key === 'backspace') typed = typed.slice(0, -1)
        else if (/^[0-9]$/.test(key) || key === '.' && !typed.includes('.') || key === '-' && !typed) typed += key
        status(); event.preventDefault(); event.stopImmediatePropagation(); return
      }
      if ((key === 'l' || key === 'a') && start) {
        numericField = key === 'l' ? 'length' : 'bearing'; typed = ''; status()
        event.preventDefault(); event.stopImmediatePropagation(); return
      }
      if (key === 't' || key === 'c') { command('toggle'); event.preventDefault(); return }
      if (key === 'enter') { finish(); event.preventDefault(); return }
      if (key === 'escape') { stop(); event.preventDefault(); return }
      if (key === 'backspace') { command('back'); event.preventDefault() }
    }
    const unsubscribeDefaults = useEditor.subscribe((state, previous) => {
      const nextDefaults = state.toolDefaults[PATHWAY_KIND]
      if (nextDefaults === previous.toolDefaults[PATHWAY_KIND]) return
      mode = nextDefaults?.drawMode === 'curve' ? 'curve' : 'straight'
      width = drawingWidth(nextDefaults)
      base = PathwayNode.parse({ ...base, color: nextDefaults?.color, defaultWidth: width,
        finish: nextDefaults?.finish, thickness: nextDefaults?.thickness, elevation: nextDefaults?.elevation,
        borderStyle: nextDefaults?.borderStyle, cornerStyle: nextDefaults?.cornerStyle })
      if (start || alignment.length) renderDraft()
      else status()
    })
    const unsubscribe = onPathwayCommand(command)
    emitter.on('grid:move', onMove); emitter.on('grid:click', onClick)
    emitter.on('grid:double-click', finish)
    window.addEventListener('keydown', onKeyDown, true)
    status()
    return () => {
      emitter.off('grid:move', onMove); emitter.off('grid:click', onClick)
      emitter.off('grid:double-click', finish)
      window.removeEventListener('keydown', onKeyDown, true)
      unsubscribe(); unsubscribeDefaults(); usePlacementPreview.getState().clear(); useAlignmentGuides.getState().clear()
      setPathwayStatus({ points: 0, mode, snap: false, message: '' })
    }
  }, [activeLevelId])
  if (!activeLevelId || !render3D) return null
  return <group layers={EDITOR_LAYER} position={[0, levelY, 0]}>
    {preview && <PathwayPreview node={preview} />}
    <group ref={marker} visible={Boolean(cursor)}>
      <CursorSphere color={snapKind ? '#22c55e' : '#818cf8'} height={2.5} showTooltip={false} />
      {snapKind && <mesh name={`pathway-draft-snap-${snapKind}`} position={[0, 0.09, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.28, 0.045, 8, 28]} />
        <meshBasicMaterial color={snapKind === 'vertex' ? '#06b6d4' : '#22c55e'} depthTest={false} />
      </mesh>}
    </group>
  </group>
}
