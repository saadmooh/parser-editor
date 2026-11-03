import { type AnyNode, type AnyNodeId, type FloorplanAffordance, useLiveNodeOverrides, useScene } from '@pascal-app/core'
import { clearSlabSnapFeedback, useWallSnapIndicator } from '@pascal-app/editor'
import { buildOutline } from '../rendering/outline'
import { alignPathTerminalToEdge, movePathJunction, movePathTerminal, pathTerminalEnds } from '../domain/terminals'
import type { PathwayNode, Point } from '../domain/schema'
import { insertPathCurvePoint, moveInsertedPathPoint, movePathCurveHandle, type CurveSide } from '../domain/edit-curve'
import { snapToHardscape } from '../../ground-access/shared/hardscape-snap'

export const pathwayExtendEndpointAffordance: FloorplanAffordance<PathwayNode> = {
  start({ node, payload, initialPlanPoint }) {
    const vertexId = (payload as { vertexId?: string })?.vertexId
    const terminal = pathTerminalEnds(node).find((end) => end.vertexId === vertexId)
    const nodeId = node.id as AnyNodeId
    let latest: Pick<PathwayNode, 'vertices' | 'edges'> | null = null
    return {
      affectedIds: [nodeId],
      apply({ planPoint }) {
        if (!terminal) return
        const delta: Point = [planPoint[0] - initialPlanPoint[0], planPoint[1] - initialPlanPoint[1]]
        const projected = Math.max(-terminal.maxRetraction,
          delta[0] * terminal.direction[0] + delta[1] * terminal.direction[1])
        const rawTarget: Point = [terminal.point[0] + projected * terminal.direction[0],
          terminal.point[1] + projected * terminal.direction[1]]
        const snap = node.parentId ? snapToHardscape(rawTarget, useScene.getState().nodes,
          node.parentId, node.id, Math.max(0.35, node.defaultWidth / 2 + 0.1)) : null
        if (snap) {
          clearSlabSnapFeedback()
          useWallSnapIndicator.getState().set({ x: snap.point[0], z: snap.point[1],
            kind: snap.kind === 'vertex' ? 'endpoint' : 'wall' })
        } else clearSlabSnapFeedback()
        const target = snap?.point ?? rawTarget
        let graph = movePathTerminal(node, terminal.vertexId, target)
        if (!graph) return
        if (snap?.edgeDirection) graph = alignPathTerminalToEdge(graph, terminal.vertexId, snap.edgeDirection)
        try { buildOutline({ ...node, ...graph }) } catch { return }
        latest = graph
        useLiveNodeOverrides.getState().set(nodeId, graph)
        useScene.getState().markDirty(nodeId)
      },
      canCommit: () => latest !== null,
      commit() {
        if (latest) useScene.getState().updateNode(nodeId, latest as Partial<AnyNode>)
        useLiveNodeOverrides.getState().clear(nodeId); clearSlabSnapFeedback()
      },
    }
  },
}

export const pathwayMoveJunctionAffordance: FloorplanAffordance<PathwayNode> = {
  start({ node, payload }) {
    const vertexId = (payload as { vertexId?: string })?.vertexId
    const nodeId = node.id as AnyNodeId
    let latest: Pick<PathwayNode, 'vertices' | 'edges'> | null = null
    return {
      affectedIds: [nodeId],
      apply({ planPoint }) {
        if (!vertexId) return
        const graph = movePathJunction(node, vertexId, [planPoint[0], planPoint[1]])
        if (!graph) return
        try { buildOutline({ ...node, ...graph }) } catch { return }
        latest = graph
        useLiveNodeOverrides.getState().set(nodeId, graph)
        useScene.getState().markDirty(nodeId)
      },
      canCommit: () => latest !== null,
      commit() {
        if (latest) useScene.getState().updateNode(nodeId, latest as Partial<AnyNode>)
        useLiveNodeOverrides.getState().clear(nodeId)
      },
    }
  },
}

export const pathwayMoveCurveHandleAffordance: FloorplanAffordance<PathwayNode> = {
  start({ node, payload }) {
    const { edgeId, side } = payload as { edgeId?: string; side?: CurveSide }
    const nodeId = node.id as AnyNodeId
    let latest: Pick<PathwayNode, 'vertices' | 'edges'> | null = null
    return {
      affectedIds: [nodeId],
      apply({ planPoint }) {
        if (!edgeId || (side !== 'from' && side !== 'to')) return
        const graph = movePathCurveHandle(node, edgeId, side, [planPoint[0], planPoint[1]])
        if (!graph) return
        try { buildOutline({ ...node, ...graph }) } catch { return }
        latest = graph
        useLiveNodeOverrides.getState().set(nodeId, graph)
        useScene.getState().markDirty(nodeId)
      },
      canCommit: () => latest !== null,
      commit() {
        if (latest) useScene.getState().updateNode(nodeId, latest as Partial<AnyNode>)
        useLiveNodeOverrides.getState().clear(nodeId)
        useScene.getState().markDirty(nodeId)
      },
    }
  },
}

export const pathwayInsertPointAffordance: FloorplanAffordance<PathwayNode> = {
  start({ node, payload, initialPlanPoint }) {
    const edgeId = (payload as { edgeId?: string }).edgeId
    const nodeId = node.id as AnyNodeId
    const inserted = edgeId ? insertPathCurvePoint(node, edgeId) : null
    const vertexId = inserted?.vertices.at(-1)?.id
    let latest = inserted
    return {
      affectedIds: [nodeId],
      apply({ planPoint }) {
        if (!inserted || !vertexId) return
        const anchor = inserted.vertices.at(-1)!.point
        const target: Point = [anchor[0] + planPoint[0] - initialPlanPoint[0],
          anchor[1] + planPoint[1] - initialPlanPoint[1]]
        const graph = moveInsertedPathPoint(inserted, vertexId, target)
        if (!graph) return
        try { buildOutline({ ...node, ...graph }) } catch { return }
        latest = graph
        useLiveNodeOverrides.getState().set(nodeId, graph)
        useScene.getState().markDirty(nodeId)
      },
      canCommit: () => latest !== null,
      commit() {
        if (latest) useScene.getState().updateNode(nodeId, latest as Partial<AnyNode>)
        useLiveNodeOverrides.getState().clear(nodeId)
        useScene.getState().markDirty(nodeId)
      },
    }
  },
}
