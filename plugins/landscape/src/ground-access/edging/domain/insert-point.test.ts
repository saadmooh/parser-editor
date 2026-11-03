import { expect, test } from 'bun:test'
import { curveAt } from '../../../ground-areas/domain/freehand-curve'
import { edgingCurvePoints, insertEdgingPoint } from './insert-point'
import { EdgingNode } from './schema'
import { buildEdgingFloorplan } from '../rendering/geometry'
import type { GeometryContext } from '@pascal-app/core'

test('straight edging gains an anchor at the segment midpoint', () => {
  const node = EdgingNode.parse({ drawMode: 'straight', points: [[0, 0], [4, 0]] })
  expect(insertEdgingPoint(node, 0)?.points).toEqual([[0, 0], [2, 0], [4, 0]])
})

test('curve edging insertion retains its cubic shape and editable arms', () => {
  const node = EdgingNode.parse({ drawMode: 'curve', points: [[0, 0], [4, 0]],
    tangents: [[1, 2], [1, -2]] })
  const original = edgingCurvePoints(node)
  const patch = insertEdgingPoint(node, 0)!
  const result = edgingCurvePoints(EdgingNode.parse({ ...node, ...patch }))
  expect(result).toHaveLength(3)
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    const old = curveAt(original, 0, t)
    const current = curveAt(result, t <= 0.5 ? 0 : 1, t <= 0.5 ? t * 2 : (t - 0.5) * 2)
    expect(Math.hypot(old[0] - current[0], old[1] - current[1])).toBeLessThan(1e-8)
  }
})

test('selected edging has insertion controls before and after curve subdivision in plan view', () => {
  const node = EdgingNode.parse({ drawMode: 'curve', points: [[0, 0], [4, 0]], tangents: [[1, 2], [1, -2]] })
  const context = { viewState: { selected: true }, siblings: [] } as unknown as GeometryContext
  expect(JSON.stringify(buildEdgingFloorplan(node, context))).toContain('edging-insert-point')
  const inserted = EdgingNode.parse({ ...node, ...insertEdgingPoint(node, 0) })
  expect(JSON.stringify(buildEdgingFloorplan(inserted, context))).toContain('freehand-curve')
})
