'use client'
import { landscapeToolColors } from '../../shared/tool-colors'
import {
  DEFAULT_ANGLE_STEP,
  emitter,
  type GridEvent,
  type AnyNode,
  type AnyNodeId,
  snapPointAlongAngleRay,
  snapPointToGrid,
  useScene,
} from '@pascal-app/core'
import {
  CursorSphere,
  EDITOR_LAYER,
  isAngleSnapActive,
  isGridSnapActive,
  resolveSlabPlanPointSnap,
  useEditor,
} from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial,
  Shape, ShapeGeometry, Vector2 } from 'three'
import { advanceFreehandStroke, buildFreehandOutline } from '../../ground-areas/domain/freehand'
import { normalizeOutline, rectangleOutline } from '../../ground-areas/domain/polygon'
import type { Point } from '../../ground-areas/domain/schema'
import { curvedSurfaceFields, ellipseOutline, isCurvedSurface, surfaceDrawingFields,
  surfaceOutline, type DrawnSurface } from './outline'
import { drawnAccessItemFor, isDrawnAccessKind } from './items'
import { GroundAreaDraftOverlay } from '../../ground-areas/editor/draft-overlay'
import { setDrawingStatus } from './drawing-session'
import { cycleDrawingMode, drawingMode } from './drawing-mode'
import { snapToHardscape } from './hardscape-snap'

const SURFACE_DRAFT_COLOR = landscapeToolColors.draft

function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function nextSurfaceName(levelId: AnyNodeId, kind: string, label: string) {
  const names = new Set(Object.values(useScene.getState().nodes)
    .filter((node) => (node.type as string) === kind && node.parentId === levelId)
    .map((node) => node.name))
  let number = 1
  while (names.has(`${label} ${number}`)) number++
  return `${label} ${number}`
}

function SurfaceDraftPreview({ node, color }: { node: DrawnSurface; color: string }) {
  const mesh = useMemo(() => {
    const outline = surfaceOutline(node)
    const shape = new Shape(outline.map(([x, z]) => new Vector2(x, -z)))
    const geometry = new ShapeGeometry(shape)
    geometry.rotateX(-Math.PI / 2)
    const material = new MeshBasicMaterial({ color: color, transparent: true,
      opacity: 0.38, depthWrite: false, side: DoubleSide })
    const result = new Mesh(geometry, material)
    result.position.set(node.position[0],
      ((node as DrawnSurface & { elevation?: number }).elevation ?? 0) + node.thickness + 0.02,
      node.position[2])
    result.raycast = () => {}
    return result
  }, [node])
  useEffect(() => () => { mesh.geometry.dispose(); mesh.material.dispose() }, [mesh])
  return <primitive object={mesh} />
}

function createDraftStroke(opacity: number) {
  const stroke = new Mesh(new BufferGeometry(), new MeshBasicMaterial({
    color: SURFACE_DRAFT_COLOR,
    depthTest: false,
    depthWrite: false,
    opacity,
    transparent: true,
    side: DoubleSide,
  }))
  stroke.layers.set(EDITOR_LAYER)
  stroke.raycast = () => {}
  stroke.frustumCulled = false
  stroke.renderOrder = 10
  stroke.visible = false
  return stroke
}

function updateStroke(stroke: Mesh<BufferGeometry, MeshBasicMaterial>, points: readonly Point[], y: number) {
  const segments = Math.max(0, points.length - 1)
  if (!segments) {
    stroke.visible = false
    return
  }
  const needed = segments * 18
  let position = stroke.geometry.getAttribute('position') as BufferAttribute | undefined
  if (!position || position.array.length < needed) {
    // BufferAttribute positions are XYZ triples. A power-of-two float count
    // can leave an incomplete final vertex, which makes Three.js compute a
    // NaN bounding sphere when it reads the missing coordinate.
    const capacity = Math.max(12, 2 ** Math.ceil(Math.log2(segments * 6))) * 3
    stroke.geometry.dispose()
    position = new BufferAttribute(new Float32Array(capacity), 3)
    stroke.geometry.setAttribute('position', position)
  }
  const data = position.array as Float32Array
  let offset = 0
  for (let index = 0; index < segments; index += 1) {
    const a = points[index]!
    const b = points[index + 1]!
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const length = Math.hypot(dx, dz)
    if (length < 1e-5) {
      for (let vertex = 0; vertex < 6; vertex += 1) data.set([a[0], y, a[1]], offset + vertex * 3)
      offset += 18
      continue
    }
    const nx = -dz / length * 0.025
    const nz = dx / length * 0.025
    data.set([
      a[0] + nx, y, a[1] + nz,
      a[0] - nx, y, a[1] - nz,
      b[0] + nx, y, b[1] + nz,
      b[0] + nx, y, b[1] + nz,
      a[0] - nx, y, a[1] - nz,
      b[0] - nx, y, b[1] - nz,
    ], offset)
    offset += 18
  }
  position.needsUpdate = true
  stroke.geometry.setDrawRange(0, segments * 6)
  stroke.visible = true
}

export default function SurfaceDrawingTool() {
  const levelId = useViewer((state) => state.selection.levelId)
  const setSelection = useViewer((state) => state.setSelection)
  const kind = useEditor((state) => state.tool)
  const item = drawnAccessItemFor(kind ?? '')
  const defaults = useEditor((state) => kind ? state.toolDefaults[kind] : undefined)
  const [preview, setPreview] = useState<DrawnSurface | null>(null)
  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [cursor, setCursor] = useState<Point | null>(null)
  const [levelY, setLevelY] = useState(0)
  const marker = useRef<Group>(null)
  const mainStroke = useMemo(() => createDraftStroke(1), [])
  const closingStroke = useMemo(() => createDraftStroke(0.55), [])

  useEffect(() => () => {
    mainStroke.geometry.dispose()
    mainStroke.material.dispose()
    closingStroke.geometry.dispose()
    closingStroke.material.dispose()
  }, [mainStroke, closingStroke])

  useEffect(() => {
    if (!levelId || !kind || !item || !isDrawnAccessKind(kind)) return
    const shape = drawingMode(kind)
    const base = item.schema.parse({ ...defaults, parentId: levelId, shape }) as DrawnSurface
    const overlay = new GroundAreaDraftOverlay(SURFACE_DRAFT_COLOR, 'data-landscape-surface-draft')
    let points: Point[] = []
    let current: Point | null = null
    let latestRaw: Point | null = null
    let dragging = false
    let pendingStop = false
    let closedMessage = ''
    let height = 0

    const setStatus = (message = '') =>
      setDrawingStatus(kind, { shape, points: points.length, message: closedMessage || message })
    const setPoints = (next: Point[]) => {
      points = next
      setDraftPoints(next)
      useEditor.getState().setDraftVertexCount(shape === 'custom' ? next.length : 0)
      setStatus()
    }
    const rawPointOf = (event: GridEvent): Point => {
      height = event.localPosition[1]
      setLevelY(height)
      return [event.localPosition[0], event.localPosition[2]]
    }
    const pointOf = (event: GridEvent): Point => {
      const rawPoint = rawPointOf(event)
      if (event.nativeEvent?.altKey) return rawPoint
      const hardscapeHit = snapToHardscape(rawPoint, useScene.getState().nodes,
        levelId, undefined, 0.24)
      if (hardscapeHit) return hardscapeHit.point
      if (shape === 'freehand') return rawPoint
      const gridStep = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      const gridPoint: Point = [...snapPointToGrid(rawPoint, gridStep)]
      const last = shape === 'custom' ? points.at(-1) : undefined
      const anglePoint: Point = last && isAngleSnapActive()
        ? [...snapPointAlongAngleRay(last, rawPoint, DEFAULT_ANGLE_STEP, gridStep)]
        : gridPoint
      return resolveSlabPlanPointSnap({ rawPoint, fallbackPoint: anglePoint, levelId }).point
    }
    const draftOutline = (): Point[] => {
      if (isCurvedSurface(shape) && points[0] && current) {
        const fields = curvedSurfaceFields(points[0], current, shape, item.label.toLowerCase())
        if (fields.error) return []
        return ellipseOutline([fields.position[0], fields.position[2]], fields.width / 2, fields.depth / 2)
      }
      if (shape === 'rectangle') return points[0] && current ? rectangleOutline(points[0], current) : []
      if (shape === 'custom') return current && points.length ? [...points, current] : points
      return points
    }
    const refresh = () => {
      const outline = isCurvedSurface(shape) ? draftOutline() : normalizeOutline(draftOutline())
      const fields = isCurvedSurface(shape) && points[0] && current
        ? curvedSurfaceFields(points[0], current, shape, item.label.toLowerCase())
        : shape !== 'freehand' ? surfaceDrawingFields(outline, shape, item.label.toLowerCase()) : null
      setPreview(fields && !fields.error ? item.schema.parse({ ...base, ...fields }) as DrawnSurface : null)
      overlay.update(shape,
        isCurvedSurface(shape) ? outline : points, isCurvedSurface(shape) ? null : current,
        SURFACE_DRAFT_COLOR, points[0])
      const main: Point[] = isCurvedSurface(shape) ? outline.length ? [...outline, outline[0]!] : []
        : shape === 'rectangle'
        ? outline.length === 4 ? [...outline, outline[0]!] : []
        : shape === 'custom' && current && points.length ? [...points, current] : points
      updateStroke(mainStroke, main, 0.09)
      updateStroke(closingStroke,
        shape === 'custom' && points.length >= 2 && current ? [current, points[0]!] : [],
        0.09)
    }
    const commit = (rawOutline: Point[], second?: Point) => {
      if (useScene.getState().readOnly) return false
      const outline = normalizeOutline(rawOutline)
      const fields = isCurvedSurface(shape) && points[0] && second
        ? curvedSurfaceFields(points[0], second, shape, item.label.toLowerCase())
        : surfaceDrawingFields(outline, shape, item.label.toLowerCase())
      if (fields.error) {
        closedMessage = fields.error
        setStatus()
        return false
      }
      const { id: _previewId, ...nodeFields } = item.schema.parse({
        ...base, ...fields, name: nextSurfaceName(levelId as AnyNodeId, kind, item.label),
      })
      const node = item.schema.parse(nodeFields)
      useScene.getState().createNode(node as unknown as AnyNode, levelId as AnyNodeId)
      setSelection({ selectedIds: [node.id] })
      return true
    }
    const clearDraft = () => {
      points = []
      current = null
      latestRaw = null
      dragging = false
      pendingStop = false
      closedMessage = ''
      setDraftPoints([])
      setCursor(null)
      setPreview(null)
      useEditor.getState().setDraftVertexCount(0)
      setDrawingStatus(kind, { shape, points: 0, message: '' })
      refresh()
      setStatus()
    }
    const stop = () => {
      clearDraft()
      useEditor.getState().setTool(null)
      useEditor.getState().setMode('select')
    }
    const finish = () => {
      if (shape === 'custom' && points.length >= 3 && commit(points)) stop()
    }
    const onMove = (event: GridEvent) => {
      latestRaw = rawPointOf(event)
      current = shape === 'freehand' ? latestRaw : pointOf(event)
      setCursor(current)
      marker.current?.position.set(current[0], 0, current[1])
      if (shape === 'freehand' && dragging) {
        const advanced = advanceFreehandStroke(points, latestRaw)
        if (advanced.points.length !== points.length) setPoints(advanced.points)
        if (advanced.closed) {
          const outline = buildFreehandOutline([...advanced.closed, advanced.closed[0]!])
          if (outline && commit(outline)) {
            dragging = false
            pendingStop = true
          }
        }
      }
      refresh()
      setStatus()
    }
    const onClick = (event: GridEvent) => {
      if (shape === 'freehand' || event.nativeEvent?.button !== 0 || useViewer.getState().cameraDragging) return
      const point = pointOf(event)
      current = point
      setCursor(point)
      marker.current?.position.set(point[0], 0, point[1])
      if (shape === 'rectangle' || isCurvedSurface(shape)) {
        if (!points.length) {
          setPoints([point])
          refresh()
          return
        }
        if (commit(shape === 'rectangle' ? rectangleOutline(points[0]!, point) : [], point)) stop()
        return
      }
      if (points.length >= 3 && distance(points[0]!, point) < 0.25) {
        finish()
        return
      }
      if (!points.length || distance(points.at(-1)!, point) >= 0.05) {
        closedMessage = ''
        setPoints([...points, point])
      }
      refresh()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (shape !== 'freehand' || event.button !== 0 || !latestRaw || useViewer.getState().cameraDragging) return
      const target = event.target
      const onCanvas = target instanceof HTMLCanvasElement
      const onFloorplan = target instanceof SVGElement && Boolean(target.closest('svg[data-pascal-floorplan-2d]'))
      if (!onCanvas && !onFloorplan) return
      event.preventDefault()
      event.stopPropagation()
      dragging = true
      closedMessage = ''
      setPoints([latestRaw])
      current = latestRaw
      marker.current?.position.set(current[0], 0, current[1])
      refresh()
    }
    const onPointerUp = (event: PointerEvent) => {
      if (pendingStop) {
        event.preventDefault()
        event.stopPropagation()
        stop()
        return
      }
      if (shape !== 'freehand' || !dragging) return
      event.preventDefault()
      event.stopPropagation()
      dragging = false
      const first = points[0]
      const outline = first ? buildFreehandOutline([...points, first]) : null
      if (outline && commit(outline)) stop()
      else {
        closedMessage = `Draw a wider loop to create a ${item.label.toLowerCase()}.`
        setStatus()
        refresh()
      }
    }
    const command = (action: 'finish' | 'back' | 'cancel') => {
      if (action === 'cancel') stop()
      else if (action === 'finish') finish()
      else if (points.length) {
        closedMessage = ''
        setPoints(shape === 'custom' ? points.slice(0, -1) : [])
        refresh()
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))) return
      if (event.key.toLowerCase() === 't') {
        cycleDrawingMode(kind)
        event.preventDefault()
        event.stopImmediatePropagation()
      } else if (event.key === 'Enter') {
        finish()
        event.preventDefault()
      } else if (event.key === 'Escape') {
        stop()
        event.preventDefault()
      } else if (event.key === 'Backspace') {
        command('back')
        event.preventDefault()
      }
    }

    emitter.on('grid:move', onMove)
    emitter.on('grid:click', onClick)
    emitter.on('grid:double-click', finish)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointerup', onPointerUp, true)
    window.addEventListener('keydown', onKeyDown, true)
    setStatus()
    return () => {
      emitter.off('grid:move', onMove)
      emitter.off('grid:click', onClick)
      emitter.off('grid:double-click', finish)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      window.removeEventListener('keydown', onKeyDown, true)
      overlay.dispose()
      updateStroke(mainStroke, [], 0)
      updateStroke(closingStroke, [], 0)
      setPreview(null)
      useEditor.getState().setDraftVertexCount(0)
    }
  }, [levelId, kind, item, defaults, setSelection, mainStroke, closingStroke])

  if (!levelId) return null
  return (
    <group layers={EDITOR_LAYER} position={[0, levelY, 0]}>
      {preview && item && <SurfaceDraftPreview node={preview} color={SURFACE_DRAFT_COLOR} />}
      <primitive object={mainStroke} />
      <primitive object={closingStroke} />
      {draftPoints.map(([x, z], index) => (index === 0 || draftPoints.length < 30) && (
        <CursorSphere
          color={SURFACE_DRAFT_COLOR}
          height={0}
          key={`${index}-${x}-${z}`}
          position={[x, 0.1, z]}
          showTooltip={false}
        />
      ))}
      <CursorSphere color={SURFACE_DRAFT_COLOR} ref={marker} visible={Boolean(cursor)} />
    </group>
  )
}
