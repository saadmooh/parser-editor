'use client'
import { landscapeToolColors } from '../../shared/tool-colors'
import { type AnyNode, type AnyNodeId, useLiveNodeOverrides, useScene } from '@pascal-app/core'
import { boundaryReshapeScope, PolygonEditor, useEditor, useInteractionScope } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useCallback, useEffect } from 'react'
import type { Point } from '../../ground-areas/domain/schema'
import { resolveBoundaryEditPoint } from '../../ground-areas/editor/resolve-edit-point'
import { isCurvedSurface, surfaceEditPatch, surfaceLevelOutline, type DrawnSurface } from './outline'
import { drawnAccessItemFor, type DrawnAccessKind } from './items'
import StairAttachmentSystem from './stair-attachment-system'
import { FreehandCurveEditor } from '../../ground-areas/editor/freehand-curve-editor'
import { PoolCutoutDirtySystem } from '../../shared/pool-cutout-system'

type SurfaceNode = DrawnSurface & { id: string; type: string; parentId: string | null }

export default function SurfaceBoundarySystem({ kind }: { kind: DrawnAccessKind }) {
  return <><BoundaryEditor kind={kind} /></>
}

export function HardscapeConnectionSystem() {
  return <><PoolCutoutDirtySystem /><StairAttachmentSystem /></>
}

function BoundaryEditor({ kind }: { kind: DrawnAccessKind }) {
  const mode = useEditor((state) => state.mode)
  const selectedIds = useViewer((state) => state.selection.selectedIds)
  const id = selectedIds.length === 1 ? selectedIds[0] : undefined
  const raw = useScene((state) => id ? state.nodes[id as AnyNodeId] : undefined)
  const item = drawnAccessItemFor(kind)
  const node = (raw?.type as string | undefined) === kind && mode === 'select' && item
    ? item.schema.parse(raw) as SurfaceNode : null
  const nodeId = node?.id as AnyNodeId | undefined
  const outline = node ? surfaceLevelOutline(node) : []

  const change = useCallback((points: Point[]) => {
    if (!node) return
    const patch = surfaceEditPatch(node, points)
    if (!patch) return
    useScene.getState().updateNode(node.id as AnyNodeId, patch as Partial<AnyNode>)
    useViewer.getState().setSelection({ selectedIds: [node.id as AnyNodeId] })
  }, [node])

  const preview = useCallback((points: ReadonlyArray<readonly [number, number]> | null) => {
    if (!node) return
    if (points) {
      const patch = surfaceEditPatch(node, points.map(([x, z]): Point => [x, z]))
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

  if (!node || isCurvedSurface(node.shape) || outline.length < 3) return null
  if (node.shape === 'freehand') return <FreehandCurveEditor node={node}
    height={node.position[1] + node.thickness + (kind === 'landscape:patio'
      ? ((node as SurfaceNode & { elevation: number }).elevation + Math.min(0.045, node.thickness / 3)) : kind === 'landscape:pond'
        ? (node as SurfaceNode & { elevation: number }).elevation : 0)} />
  return <PolygonEditor
    allowEdgeMove
    color={landscapeToolColors.spline}
    levelId={node.parentId ?? undefined}
    minVertices={3}
    polygon={outline}
    onPolygonChange={change}
    onPolygonPreview={preview}
    onDragStateChange={dragState}
    resolvePlanPoint={(context) => resolveBoundaryEditPoint(context, node)}
    surfaceHeight={node.position[1] + node.thickness + (kind === 'landscape:patio'
      ? ((node as SurfaceNode & { elevation: number }).elevation + Math.min(0.045, node.thickness / 3)) : kind === 'landscape:pond'
        ? (node as SurfaceNode & { elevation: number }).elevation : 0)}
  />
}
