'use client'
import { landscapeToolColors } from '../../shared/tool-colors'
import { type AnyNode, type AnyNodeId, useLiveNodeOverrides, useScene } from '@pascal-app/core'
import { boundaryReshapeScope, PolygonEditor, useEditor, useInteractionScope } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useCallback, useEffect } from 'react'
import { groundAreaEditPatch } from '../domain/edit'
import { isEllipseShape } from '../domain/ellipse'
import { GROUND_AREA_KIND, GroundAreaNode, type Point } from '../domain/schema'
import { resolveBoundaryEditPoint } from './resolve-edit-point'
import { FreehandCurveEditor } from './freehand-curve-editor'

export default function GroundAreaBoundarySystem() {
  const mode = useEditor((state) => state.mode)
  const selectedIds = useViewer((state) => state.selection.selectedIds)
  const id = selectedIds.length === 1 ? selectedIds[0] : undefined
  const raw = useScene((state) => id ? state.nodes[id as AnyNodeId] : undefined)
  const node = (raw?.type as string | undefined) === GROUND_AREA_KIND && mode === 'select'
    ? GroundAreaNode.parse(raw) : null
  const nodeId = node?.id as AnyNodeId | undefined

  const change = useCallback((points: Point[]) => {
    if (!node) return
    const patch = groundAreaEditPatch(points)
    if (!patch) return
    useScene.getState().updateNode(node.id as AnyNodeId, patch as Partial<AnyNode>)
    useViewer.getState().setSelection({ selectedIds: [node.id as AnyNodeId] })
  }, [node])

  const preview = useCallback((points: ReadonlyArray<readonly [number, number]> | null) => {
    if (!node) return
    if (points) {
      const patch = groundAreaEditPatch(points.map(([x, z]): Point => [x, z]))
      if (patch) useLiveNodeOverrides.getState().set(node.id as AnyNodeId, patch)
    } else useLiveNodeOverrides.getState().clear(node.id as AnyNodeId)
    useScene.getState().markDirty(node.id as AnyNodeId)
  }, [node])

  const dragState = useCallback((dragging: boolean) => {
    if (!nodeId) return
    const scope = useInteractionScope.getState()
    if (dragging) scope.begin(boundaryReshapeScope(nodeId))
    else scope.endIf((state) => state.kind === 'reshaping' && state.reshape === 'boundary')
  }, [nodeId])

  useEffect(() => () => {
    if (!nodeId) return
    useLiveNodeOverrides.getState().clear(nodeId)
    useScene.getState().markDirty(nodeId)
    useInteractionScope.getState().endIf((state) => state.kind === 'reshaping' &&
      state.reshape === 'boundary' && state.nodeId === nodeId)
  }, [nodeId])

  if (!node || isEllipseShape(node.shape) || node.outline.length < 3) return null
  if (node.shape === 'freehand') return <FreehandCurveEditor node={node} height={node.elevation + 0.018} />
  return <PolygonEditor
    allowEdgeMove
    color={landscapeToolColors.spline}
    levelId={node.parentId ?? undefined}
    minVertices={3}
    polygon={node.outline}
    onPolygonChange={change}
    onPolygonPreview={preview}
    onDragStateChange={dragState}
    resolvePlanPoint={(context) => resolveBoundaryEditPoint(context, node)}
    surfaceHeight={node.elevation + 0.018}
  />
}
