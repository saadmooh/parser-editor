import { freehandCurveAffordance } from '../../../ground-areas/editor/curve-affordance'
import { edgingCurveNode } from '../domain/curve'
import { type AnyNode, type AnyNodeId, type FloorplanAffordance, useLiveNodeOverrides, useScene } from '@pascal-app/core'
import { getSegmentGridStep, snapPointToGrid } from '@pascal-app/editor'
import { levelPoints, localPoints, type Point } from '../domain/route'
import { EdgingNode } from '../domain/schema'
import { clearEdgingSnapFeedback, resolveEdgingSnap } from './snap'
import { edgingCurveTangents } from '../domain/sampling'
import { edgingEditIndices, moveEdgingControls } from '../domain/edit'
import { insertEdgingPoint } from '../domain/insert-point'

type Payload = { index?: number; id?: 'start' | 'end' }

function edit(mode: 'point' | 'end'): FloorplanAffordance<EdgingNode> {
  return {
    start({ node: raw, payload, initialPlanPoint }) {
      const node = EdgingNode.parse(raw)
      const nodeId = node.id as AnyNodeId
      const route = levelPoints(node)
      const controls = edgingEditIndices(node)
      const data = payload as Payload
      const index = mode === 'point' ? data.index : data.id === 'start' ? 0 : route.length - 1
      let patch: Point[] | null = null
      return {
        affectedIds: [nodeId],
        apply({ planPoint }) {
          if (index === undefined || index < 0 || index >= route.length) return
          let destination: Point
          const target: Point = [...snapPointToGrid([planPoint[0], planPoint[1]], getSegmentGridStep())]
          if (mode === 'end') {
            const neighbor = data.id === 'start' ? route[1] : route.at(-2)
            if (!neighbor) return
            const endpoint = route[index]!
            const length = Math.hypot(endpoint[0] - neighbor[0], endpoint[1] - neighbor[1])
            if (length < 1e-5) return
            const direction: Point = [(endpoint[0] - neighbor[0]) / length, (endpoint[1] - neighbor[1]) / length]
            const travel = (target[0] - initialPlanPoint[0]) * direction[0] +
              (target[1] - initialPlanPoint[1]) * direction[1]
            destination = [endpoint[0] + travel * direction[0], endpoint[1] + travel * direction[1]]
          } else destination = resolveEdgingSnap([planPoint[0], planPoint[1]], target, node.parentId, node.id)
          const original = route[index]!
          const next = moveEdgingControls(route, controls, node.closed,
            new Map([[index, [destination[0] - original[0], destination[1] - original[1]] as Point]]))
          if (controls.some((control, segment) => segment > 0 &&
            Math.hypot(next[control]![0] - next[controls[segment - 1]!]![0],
              next[control]![1] - next[controls[segment - 1]!]![1]) < 0.05)) return
          patch = localPoints(node, next)
          useLiveNodeOverrides.getState().set(nodeId, { points: patch })
          useScene.getState().markDirty(nodeId)
        },
        canCommit() { clearEdgingSnapFeedback(); return patch !== null },
        commit() {
          clearEdgingSnapFeedback()
          if (patch) useScene.getState().updateNode(nodeId, { points: patch } as Partial<AnyNode>)
          useLiveNodeOverrides.getState().clear(nodeId)
          useScene.getState().markDirty(nodeId)
        },
      }
    },
  }
}

export const edgingFloorplanAffordances = {
  'edging-insert-point': {
    start({ node: raw, payload }) {
      const node = EdgingNode.parse(raw)
      const id = node.id as AnyNodeId
      const patch = insertEdgingPoint(node, (payload as { segment: number }).segment)
      return { affectedIds: [id], apply() {}, canCommit: () => patch !== null,
        commit() { if (patch) useScene.getState().updateNode(id, patch as Partial<AnyNode>) } }
    },
  } satisfies FloorplanAffordance<EdgingNode>,
  'freehand-curve': {
    start(args) {
      return freehandCurveAffordance.start({ ...args, node: edgingCurveNode(EdgingNode.parse(args.node)) })
    },
  } satisfies FloorplanAffordance<EdgingNode>,
  'edging-move-tangent': {
    start({ node: raw, payload }) {
      const node = EdgingNode.parse(raw)
      const id = node.id as AnyNodeId
      const { index, side } = payload as { index: number; side: number }
      let tangents: Array<Point | null> | null = null
      return {
        affectedIds: [id],
        apply({ planPoint }) {
          if (!node.points[index] || (side !== 1 && side !== -1)) return
          const local = localPoints(node, [[planPoint[0], planPoint[1]]])[0]!
          tangents = node.points.map((_, i) => edgingCurveTangents(node)?.[i] ?? null)
          tangents[index] = [(local[0] - node.points[index]![0]) / (side * 3),
            (local[1] - node.points[index]![1]) / (side * 3)]
          useLiveNodeOverrides.getState().set(id, { tangents })
          useScene.getState().markDirty(id)
        },
        canCommit() { return tangents !== null },
        commit() {
          if (tangents) useScene.getState().updateNode(id, { tangents } as Partial<AnyNode>)
          useLiveNodeOverrides.getState().clear(id)
          useScene.getState().markDirty(id)
        },
      }
    },
  } satisfies FloorplanAffordance<EdgingNode>,
  'edging-move-point': edit('point'),
  'edging-extend-endpoint': edit('end'),
}
