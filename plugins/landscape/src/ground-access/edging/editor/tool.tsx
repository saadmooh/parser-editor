'use client'
import { landscapeToolColors } from '../../../shared/tool-colors'
import { emitter, type GridEvent, type AnyNode, type AnyNodeId, runAsSingleSceneHistoryStep, snapPointToGrid, useScene } from '@pascal-app/core'
import { CursorSphere, EDITOR_LAYER, isGridSnapActive, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BufferGeometry, Line, LineBasicMaterial, Vector3, Group, Mesh, MeshStandardMaterial } from 'three'
import { EdgingNode, EDGING_KIND, type EdgingNode as Edging } from '../domain/schema'
import { levelPoints, localPoints } from '../domain/route'
import { edgingCurveTangents, edgingRenderPoints, simplifyEdgingStroke } from '../domain/sampling'
import { buildEdgingGeometry } from '../rendering/geometry'
import { clearEdgingSnapFeedback, resolveEdgingSnap } from './snap'
import { GroundAreaDraftOverlay } from '../../../ground-areas/editor/draft-overlay'

type Point = Edging['points'][number]

const closeTo = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.25

function openEdging(levelId: AnyNodeId) {
  return Object.values(useScene.getState().nodes)
    .filter((item) => (item.type as string) === EDGING_KIND && item.parentId === levelId)
    .map((item) => EdgingNode.parse(item))
    .filter((item) => !item.closed && item.points.length >= 2)
}

function Preview({ node }: { node: Edging }) {
  const object = useMemo(() => {
    const group = buildEdgingGeometry(node)
    const draftMaterial = new MeshStandardMaterial({ color: landscapeToolColors.spline, roughness: 0.82,
      emissive: '#302e63', emissiveIntensity: 0.18 })
    const originals = new Set<Mesh['material']>()
    group.traverse((child) => {
      child.raycast = () => {}
      if (!(child instanceof Mesh)) return
      child.castShadow = false
      child.receiveShadow = false
      originals.add(child.material)
      child.material = draftMaterial
    })
    for (const material of originals) {
      if (Array.isArray(material)) material.forEach((item) => item.dispose())
      else material.dispose()
    }
    return group
  }, [node])
  useEffect(() => () => {
    const materials = new Set<Mesh['material']>()
    object.traverse((child) => {
      if (child instanceof Mesh) { child.geometry.dispose(); materials.add(child.material) }
    })
    for (const material of materials) {
      if (Array.isArray(material)) material.forEach((item) => item.dispose())
      else material.dispose()
    }
  }, [object])
  return <primitive object={object} position={[0, 0.02, 0]} />
}

function SplinePreview({ node }: { node: Edging }) {
  const object = useMemo(() => {
    const line = new Line(new BufferGeometry().setFromPoints(edgingRenderPoints(node).map(([x, z]) =>
      new Vector3(x, 0.24, z))),
      new LineBasicMaterial({ color: landscapeToolColors.spline, depthTest: false, depthWrite: false }))
    line.layers.set(EDITOR_LAYER)
    line.renderOrder = 1009
    line.raycast = () => {}
    return line
  }, [node])
  useEffect(() => () => { object.geometry.dispose(); object.material.dispose() }, [object])
  return <primitive object={object} />
}

export default function EdgingTool() {
  const levelId = useViewer((state) => state.selection.levelId)
  const setSelection = useViewer((state) => state.setSelection)
  const [node, setNode] = useState<Edging | null>(null)
  const [anchors, setAnchors] = useState<Point[]>([])
  const [cursor, setCursor] = useState<Point | null>(null)
  const [levelY, setLevelY] = useState(0)
  const marker = useRef<Group>(null)

  useEffect(() => {
    if (!levelId) return
    let base = EdgingNode.parse({ ...useEditor.getState().toolDefaults[EDGING_KIND], parentId: levelId, name: 'Edging' })
    const overlay = new GroundAreaDraftOverlay(landscapeToolColors.spline, 'data-landscape-edging-draft')
    const modes = ['straight', 'curve', 'freehand'] as const
    let mode: Edging['drawMode'] = base.drawMode
    let points: Point[] = []
    let frozen: Point[] = []
    let current: Point | null = null
    let latestRaw: Point | null = null
    let lastPreviewPoint: Point | null = null
    let dragging = false
    let committed = false
    let pendingMode: Edging['drawMode'] | null = null
    const drawn = (route: Point[], closed = false) => {
      const active = mode === 'curve' ? edgingRenderPoints({ ...base, drawMode: 'curve', points: route, closed }) : route
      return frozen.length ? [...frozen.slice(0, -1), ...active] : active
    }
    const redraw = () => {
      setAnchors(mode === 'curve' ? [...points] : [])
      const all = drawn(points)
      const closing = Boolean(mode !== 'freehand' && current && all.length >= 3 &&
        Math.hypot(current[0] - all[0]![0], current[1] - all[0]![1]) < 0.25)
      const route = mode !== 'freehand' && !closing && current && points.length && Math.hypot(current[0] - points.at(-1)![0], current[1] - points.at(-1)![1]) > 0.03
        ? [...points, current] : points
      const visible = frozen.length ? drawn(route, closing) : route
      const draftPath = frozen.length ? visible : mode === 'curve'
        ? edgingRenderPoints({ ...base, drawMode: 'curve', points: visible, closed: closing }) : visible
      overlay.update('freehand', closing && draftPath.length > 2
        ? [...draftPath, draftPath[0]!] : draftPath, null, landscapeToolColors.spline, undefined, mode === 'curve' ? points : undefined)
      setNode(visible.length >= 2 ? EdgingNode.parse({ ...base, points: visible,
        drawMode: frozen.length ? 'freehand' : mode, closed: closing }) : null)
    }
    const switchMode = (next: Edging['drawMode']) => {
      if (dragging) { pendingMode = next; return }
      if (next === mode) return
      const existing = drawn(points)
      if (existing.length >= 2) {
        frozen = existing
        points = [existing.at(-1)!]
      }
      mode = next
      redraw()
    }
    const resolve = (event: GridEvent): Point => {
      setLevelY(event.localPosition[1])
      const raw: Point = [event.localPosition[0], event.localPosition[2]]
      const snapped: Point = mode !== 'freehand' && isGridSnapActive() ? [...snapPointToGrid(raw, useEditor.getState().gridSnapStep)] : raw
      return resolveEdgingSnap(raw, snapped, levelId)
    }
    const onMove = (event: GridEvent) => {
      setLevelY(event.localPosition[1])
      latestRaw = [event.localPosition[0], event.localPosition[2]]
      current = resolve(event)
      if (mode === 'freehand') latestRaw = current
      let added = false
      if (dragging && latestRaw && points.length < 1024 &&
        Math.hypot(latestRaw[0] - points.at(-1)![0], latestRaw[1] - points.at(-1)![1]) >= 0.06) {
        points = [...points, latestRaw]
        added = true
      }
      const route = drawn(points)
      if (route.length >= 3 && current && Math.hypot(current[0] - route[0]![0], current[1] - route[0]![1]) < 0.25)
        current = route[0]!
      setCursor(current)
      marker.current?.position.set(current[0], 0.08, current[1])
      if (added || !lastPreviewPoint || Math.hypot(current[0] - lastPreviewPoint[0],
        current[1] - lastPreviewPoint[1]) >= 0.035) {
        lastPreviewPoint = current
        redraw()
      }
    }
    const onClick = (event: GridEvent) => {
      if (mode === 'freehand' || event.nativeEvent?.button !== 0 || useViewer.getState().cameraDragging) return
      if (event.nativeEvent.detail >= 2) { finish(); return }
      const point = resolve(event)
      const route = drawn(points)
      if (route.length >= 3 && Math.hypot(point[0] - route[0]![0], point[1] - route[0]![1]) < 0.25) {
        finish(true)
        return
      }
      if (!points.length || Math.hypot(point[0] - points.at(-1)![0], point[1] - points.at(-1)![1]) >= 0.05) {
        points = [...points, point]
      }
      current = point
      setCursor(point)
      marker.current?.position.set(point[0], 0.08, point[1])
      redraw()
    }
    const finish = (closed = false) => {
      if (committed) return
      committed = true
      clearEdgingSnapFeedback()
      const finished = drawn(points, closed)
      if (finished.length >= 2) {
        const neighbors = closed ? [] : openEdging(levelId as AnyNodeId)
        let host: Edging | null = null
        let route = mode === 'freehand' || frozen.length ? simplifyEdgingStroke(finished) : finished
        for (const other of neighbors) {
          const existing = levelPoints({ ...other, points: edgingRenderPoints(other) })
          const first = existing[0]!, last = existing.at(-1)!
          if (closeTo(route[0]!, last)) { host = other; route = [...existing, ...route.slice(1)]; break }
          if (closeTo(route[0]!, first)) { host = other; route = [...existing].reverse().concat(route.slice(1)); break }
          if (closeTo(route.at(-1)!, last)) { host = other; route = [...existing, ...[...route].reverse().slice(1)]; break }
          if (closeTo(route.at(-1)!, first)) { host = other; route = [...existing].reverse().concat([...route].reverse().slice(1)); break }
        }
        if (host) {
          runAsSingleSceneHistoryStep(useScene, () => {
            let joinedClosed = false
            for (const other of neighbors) {
              if (other.id === host.id) continue
              const existing = levelPoints({ ...other, points: edgingRenderPoints(other) })
              if (closeTo(route.at(-1)!, existing[0]!)) route = [...route, ...existing.slice(1)]
              else if (closeTo(route.at(-1)!, existing.at(-1)!)) route = [...route, ...existing.slice(0, -1).reverse()]
              else if (closeTo(route[0]!, existing.at(-1)!)) route = [...existing.slice(0, -1), ...route]
              else if (closeTo(route[0]!, existing[0]!)) route = [...existing.slice(1).reverse(), ...route]
              else continue
              useScene.getState().deleteNode(other.id as AnyNodeId)
              break
            }
            if (route.length >= 3 && closeTo(route[0]!, route.at(-1)!)) {
              route = route.slice(0, -1)
              joinedClosed = true
            }
            useScene.getState().updateNode(host.id as AnyNodeId, {
              points: localPoints(host, route), closed: joinedClosed, drawMode: 'freehand', curvePoints: undefined,
            } as Partial<AnyNode>)
          })
          setSelection({ selectedIds: [host.id as AnyNodeId] })
        } else {
          const completed = EdgingNode.parse({ ...base, points: frozen.length || mode === 'freehand' ? route : points,
            drawMode: frozen.length ? 'freehand' : mode, closed,
            tangents: mode === 'curve' && !frozen.length
              ? edgingCurveTangents({ ...base, points, closed }) : undefined,
            name: `Edging ${Object.values(useScene.getState().nodes).filter((item) =>
              (item.type as string) === EDGING_KIND && item.parentId === levelId).length + 1}` })
          useScene.getState().createNode(completed as unknown as AnyNode, levelId as AnyNodeId)
          setSelection({ selectedIds: [completed.id as AnyNodeId] })
        }
      }
      setNode(null)
      setCursor(null)
      useEditor.getState().setTool(null)
      useEditor.getState().setMode('select')
    }
    const onPointerDown = (event: PointerEvent) => {
      if (mode !== 'freehand' || event.button !== 0 || !latestRaw || useViewer.getState().cameraDragging) return
      const target = event.target
      if (!(target instanceof HTMLCanvasElement) &&
        !(target instanceof SVGElement && target.closest('svg[data-pascal-floorplan-2d]'))) return
      event.preventDefault()
      event.stopPropagation()
      dragging = true
      if (points.length && Math.hypot(latestRaw[0] - points.at(-1)![0], latestRaw[1] - points.at(-1)![1]) < 0.05)
        points = [...points]
      else points = [...points, latestRaw]
      current = latestRaw
      redraw()
    }
    const onPointerUp = (event: PointerEvent) => {
      if (mode !== 'freehand' || !dragging) return
      event.preventDefault()
      event.stopPropagation()
      dragging = false
      if (latestRaw && Math.hypot(latestRaw[0] - points.at(-1)![0], latestRaw[1] - points.at(-1)![1]) > 0.02)
        points = [...points, latestRaw]
      const route = drawn(points)
      if (route.length > 3 && closeTo(route[0]!, route.at(-1)!)) {
        points = points.slice(0, -1)
        finish(true)
      } else {
        redraw()
        if (pendingMode) { const next = pendingMode; pendingMode = null; switchMode(next) }
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))) return
      if ((event.key.toLowerCase() === 'c' || event.key.toLowerCase() === 't') && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const next = modes[(modes.indexOf(mode) + 1) % modes.length]!
        const editor = useEditor.getState()
        editor.setToolDefaults(EDGING_KIND, { ...editor.toolDefaults[EDGING_KIND], drawMode: next })
        event.preventDefault()
        event.stopImmediatePropagation()
      } else if (event.key === 'Enter') { finish(); event.preventDefault() }
      else if (event.key === 'Escape') {
        points = []
        setNode(null)
        setCursor(null)
        useEditor.getState().setTool(null)
        useEditor.getState().setMode('select')
        event.preventDefault()
      } else if (event.key === 'Backspace' && points.length) {
        points = points.length > 1 ? points.slice(0, -1) : frozen.length ? [frozen.at(-1)!] : []
        current = points.at(-1) ?? null
        redraw()
        event.preventDefault()
      }
    }
    emitter.on('grid:move', onMove)
    const unsubscribe = useEditor.subscribe((state, previous) => {
      if (state.toolDefaults[EDGING_KIND] === previous.toolDefaults[EDGING_KIND]) return
      const next = state.toolDefaults[EDGING_KIND]?.drawMode
      base = EdgingNode.parse({ ...base, ...state.toolDefaults[EDGING_KIND], parentId: levelId })
      if (next !== previous.toolDefaults[EDGING_KIND]?.drawMode && modes.includes(next as typeof modes[number]))
        switchMode(next as Edging['drawMode'])
      else redraw()
    })
    emitter.on('grid:click', onClick)
    const onDoubleClick = () => finish()
    emitter.on('grid:double-click', onDoubleClick)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointerup', onPointerUp, true)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      emitter.off('grid:move', onMove)
      unsubscribe()
      emitter.off('grid:click', onClick)
      emitter.off('grid:double-click', onDoubleClick)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      window.removeEventListener('keydown', onKeyDown, true)
      overlay.dispose()
      clearEdgingSnapFeedback()
    }
  }, [levelId, setSelection])

  if (!levelId) return null
  return <group layers={EDITOR_LAYER} position={[0, levelY, 0]}>
    {node && <Preview node={node} />}
    {node?.drawMode === 'curve' && <SplinePreview node={node} />}
    {anchors.map((point, index) => <mesh key={index} layers={EDITOR_LAYER}
      position={[point[0], 0.24, point[1]]} raycast={() => null} renderOrder={1010}>
      <sphereGeometry args={[0.07, 16, 12]} />
      <meshBasicMaterial color={landscapeToolColors.spline} depthTest={false} depthWrite={false} />
    </mesh>)}
    <group ref={marker} visible={Boolean(cursor)}>
      <CursorSphere color={landscapeToolColors.spline} height={1.8} showTooltip={false} />
    </group>
  </group>
}
