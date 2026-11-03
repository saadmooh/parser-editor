'use client'
import {
  DEFAULT_ANGLE_STEP,
  emitter,
  type GridEvent,
  type NodeEvent,
  type AnyNode,
  type AnyNodeId,
  snapPointAlongAngleRay,
  snapPointToGrid,
  useScene,
  sceneRegistry,
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
import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial } from 'three'
import { advanceFreehandStroke, buildFreehandOutline } from '../domain/freehand'
import { normalizeOutline, rectangleOutline, validateOutline } from '../domain/polygon'
import { ellipseFromPoints, isEllipseShape } from '../domain/ellipse'
import { GROUND_AREA_KIND, GROUND_SURFACES, GroundAreaNode, type GroundSurface, type Point } from '../domain/schema'
import { groundSurfaceColor } from '../rendering/geometry'
import GroundAreaPreview from '../rendering/preview'
import { GROUND_AREA_DRAFT_COLOR, GroundAreaDraftOverlay } from './draft-overlay'
import { onGroundAreaCommand, setGroundAreaStatus, type GroundAreaCommand, type GroundAreaShape } from './session'
import { groundAreaModes } from './drawing-mode'
import { groundDrawingPosition } from './drawing-position'

type DrawingEvent = GridEvent | NodeEvent<AnyNode>

function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function nextAreaName(surface: GroundSurface, levelId: AnyNodeId, bed = false) {
  const label = bed ? 'Planting bed' : `${surface[0]!.toUpperCase()}${surface.slice(1)} area`
  const names = new Set(
    Object.values(useScene.getState().nodes)
      .filter((node) => (node.type as string) === GROUND_AREA_KIND && node.parentId === levelId)
      .map((node) => node.name),
  )
  let number = 1
  while (names.has(`${label} ${number}`)) number += 1
  return `${label} ${number}`
}

function createDraftStroke(opacity: number) {
  const stroke = new Mesh(new BufferGeometry(), new MeshBasicMaterial({
    color: GROUND_AREA_DRAFT_COLOR,
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

export default function GroundAreaTool() {
  const levelId = useViewer((state) => state.selection.levelId)
  const setSelection = useViewer((state) => state.setSelection)
  const defaults = useEditor((state) => state.toolDefaults[GROUND_AREA_KIND])
  const [preview, setPreview] = useState<GroundAreaNode | null>(null)
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
    if (!levelId) return
    let shape: GroundAreaShape = groundAreaModes.includes(defaults?.shape as GroundAreaShape)
      ? defaults!.shape as GroundAreaShape : defaults?.shape === 'polygon' ? 'custom' : 'rectangle'
    const surface: GroundSurface = GROUND_SURFACES.find((value) => value === defaults?.surface) ?? 'grass'
    const base = GroundAreaNode.parse({ ...defaults, parentId: levelId, surface, shape })
    const overlay = new GroundAreaDraftOverlay()
    let points: Point[] = []
    let current: Point | null = null
    let latestRaw: Point | null = null
    let dragging = false
    let pendingStop = false
    let closedMessage = ''
    let height = 0

    const setStatus = (message = '') =>
      setGroundAreaStatus({ points: points.length, shape, message: closedMessage || message })
    const setPoints = (next: Point[]) => {
      points = next
      setDraftPoints(next)
      useEditor.getState().setDraftVertexCount(shape === 'custom' ? next.length : 0)
      setStatus()
    }
    const rawPointOf = (event: DrawingEvent): Point => {
      const local = groundDrawingPosition(event, sceneRegistry.nodes.get(levelId))
      height = local.y
      setLevelY(height)
      return [local.x, local.z]
    }
    const pointOf = (event: DrawingEvent): Point => {
      const rawPoint = rawPointOf(event)
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
      if (isEllipseShape(shape)) return points[0] && current
        ? ellipseFromPoints(points[0], current, shape).outline : []
      if (shape === 'rectangle') return points[0] && current ? rectangleOutline(points[0], current) : []
      if (shape === 'custom') return current && points.length ? [...points, current] : points
      return points
    }
    const refresh = () => {
      const outline = isEllipseShape(shape) ? draftOutline() : normalizeOutline(draftOutline())
      setPreview(shape !== 'freehand' && outline.length >= 3 &&
        (isEllipseShape(shape) || !validateOutline(outline))
        ? GroundAreaNode.parse({ ...base, ...useEditor.getState().toolDefaults[GROUND_AREA_KIND], id: base.id, parentId: levelId, shape, outline })
        : null)
      overlay.update(shape, isEllipseShape(shape) ? outline : points,
        isEllipseShape(shape) ? null : current, groundSurfaceColor(surface), points[0])
      const main: Point[] = isEllipseShape(shape) ? outline.length ? [...outline, outline[0]!] : []
        : shape === 'rectangle'
        ? outline.length === 4 ? [...outline, outline[0]!] : []
        : shape === 'custom' && current && points.length ? [...points, current] : points
      updateStroke(mainStroke, main, 0.09)
      updateStroke(closingStroke,
        shape === 'custom' && points.length >= 2 && current ? [current, points[0]!] : [],
        0.09)
    }
    const commit = (rawOutline: Point[]) => {
      if (useScene.getState().readOnly) return false
      const outline = isEllipseShape(shape) ? rawOutline : normalizeOutline(rawOutline)
      const error = shape === 'rectangle' && outline.length < 3
        ? 'Choose an opposite corner with both width and depth. Snapping may align nearby clicks.'
        : isEllipseShape(shape)
        ? outline.length < 3 ? 'Draw a circle or oval at least 0.2 m wide and deep.' : null
        : validateOutline(outline)
      if (error) {
        closedMessage = error
        setStatus()
        return false
      }
      const { id: _previewId, ...fields } = GroundAreaNode.parse({
        ...base,
        ...useEditor.getState().toolDefaults[GROUND_AREA_KIND],
        id: base.id, parentId: levelId,
        name: nextAreaName(surface, levelId as AnyNodeId, useEditor.getState().toolDefaults[GROUND_AREA_KIND]?.plantingBed === true),
        shape,
        outline,
      })
      const node = GroundAreaNode.parse(fields)
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
    const onMove = (event: DrawingEvent) => {
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
    const onClick = (event: DrawingEvent) => {
      if (shape === 'freehand' || event.nativeEvent?.button !== 0 || useViewer.getState().cameraDragging) return
      if ('node' in event) event.stopPropagation()
      const point = pointOf(event)
      current = point
      setCursor(point)
      marker.current?.position.set(point[0], 0, point[1])
      if (shape === 'rectangle' || isEllipseShape(shape)) {
        if (!points.length) {
          setPoints([point])
          refresh()
          return
        }
        const outline = isEllipseShape(shape)
          ? ellipseFromPoints(points[0]!, point, shape).outline
          : rectangleOutline(points[0]!, point)
        if (commit(outline)) stop()
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
        closedMessage = 'Draw a wider loop to create an area.'
        setStatus()
        refresh()
      }
    }
    const command = (action: GroundAreaCommand) => {
      if (typeof action === 'object') {
        shape = action.mode
        clearDraft()
        const editor = useEditor.getState()
        editor.setToolDefaults(GROUND_AREA_KIND, { ...editor.toolDefaults[GROUND_AREA_KIND], shape })
        return
      }
      if (action === 'cancel') stop()
      else if (action === 'finish') finish()
      else if (action === 'cycle') {
        const next = groundAreaModes[(groundAreaModes.indexOf(shape) + 1) % groundAreaModes.length]!
        shape = next
        clearDraft()
        const editor = useEditor.getState()
        editor.setToolDefaults(GROUND_AREA_KIND, { ...editor.toolDefaults[GROUND_AREA_KIND], shape: next })
      }
      else if (points.length) {
        closedMessage = ''
        setPoints(shape === 'custom' ? points.slice(0, -1) : [])
        refresh()
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))) return
      if (event.key === 'Enter') {
        finish()
        event.preventDefault()
      } else if (event.key.toLowerCase() === 't') {
        command('cycle')
        event.preventDefault()
        event.stopImmediatePropagation()
      } else if (event.key === 'Escape') {
        stop()
        event.preventDefault()
      } else if (event.key === 'Backspace') {
        command('back')
        event.preventDefault()
      }
    }

    const unsubscribe = onGroundAreaCommand(command)
    emitter.on('grid:move', onMove)
    emitter.on('node:move', onMove)
    emitter.on('grid:click', onClick)
    emitter.on('node:click', onClick)
    emitter.on('grid:double-click', finish)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointerup', onPointerUp, true)
    window.addEventListener('keydown', onKeyDown, true)
    setStatus()
    return () => {
      emitter.off('grid:move', onMove)
      emitter.off('node:move', onMove)
      emitter.off('grid:click', onClick)
      emitter.off('node:click', onClick)
      emitter.off('grid:double-click', finish)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      window.removeEventListener('keydown', onKeyDown, true)
      unsubscribe()
      overlay.dispose()
      updateStroke(mainStroke, [], 0)
      updateStroke(closingStroke, [], 0)
      setPreview(null)
      useEditor.getState().setDraftVertexCount(0)
      setGroundAreaStatus({ points: 0, shape, message: '' })
    }
  // Defaults initialize a newly activated session. While active, mode changes
  // are applied in place by the cycle command so drawing listeners stay live.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelId, setSelection, mainStroke, closingStroke])

  if (!levelId) return null
  return (
    <group layers={EDITOR_LAYER} position={[0, levelY, 0]}>
      {preview && <GroundAreaPreview node={preview} />}
      <primitive object={mainStroke} />
      <primitive object={closingStroke} />
      {draftPoints.map(([x, z], index) => (index === 0 || draftPoints.length < 30) && (
        <CursorSphere
          color={GROUND_AREA_DRAFT_COLOR}
          height={0}
          key={`${index}-${x}-${z}`}
          position={[x, 0.1, z]}
          showTooltip={false}
        />
      ))}
      <CursorSphere color={GROUND_AREA_DRAFT_COLOR} ref={marker} visible={Boolean(cursor)} />
    </group>
  )
}
