import type { CurveNode } from '../../../ground-areas/domain/curve-edit'
import type { EdgingNode } from './schema'

export function edgingCurveNode(node: EdgingNode): CurveNode {
  return { ...node, outline: node.points, shape: 'freehand' }
}
