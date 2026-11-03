import { expect, test } from 'bun:test'
import { curveAt, editCurve, fitFreehandCurve, sampleCurve, splitCurve } from './freehand-curve'
import { curveEditPatch, curveInLevel, freehandFloorplanHandles, type CurveNode } from './curve-edit'
import { validateOutline } from './polygon'
import type { Point } from './schema'

const circle = (): Point[] => Array.from({ length: 180 }, (_, i) =>
  [3 * Math.cos(i * Math.PI / 90), 3 * Math.sin(i * Math.PI / 90)])
const near = (a: Point, b: Point) => {
  expect(a[0]).toBeCloseTo(b[0], 8)
  expect(a[1]).toBeCloseTo(b[1], 8)
}
test('dense outlines fit a small smooth set of anchors without mutating the original', () => {
  const points = circle(), original = structuredClone(points)
  const curve = fitFreehandCurve(points)
  expect(curve.length).toBeLessThanOrEqual(12)
  expect(curve.length).toBeGreaterThanOrEqual(3)
  expect(validateOutline(sampleCurve(curve))).toBeNull()
  expect(curve.every(p => Math.hypot(p.outgoing[0] - p.anchor[0], p.outgoing[1] - p.anchor[1]) > 0)).toBe(true)
  expect(points).toEqual(original)
})
test('inserting an anchor preserves the cubic, including the closing segment', () => {
  const curve = fitFreehandCurve(circle())
  for (const index of [0, curve.length - 1]) {
    const split = splitCurve(curve, index)
    expect(split).toHaveLength(curve.length + 1)
    for (let i = 0; i <= 20; i++) {
      const t = i / 20
      near(curveAt(curve, index, t), t <= 0.5
        ? curveAt(split, index, t * 2) : curveAt(split, index + 1, t * 2 - 1))
    }
  }
})
test('anchor movement carries handles and tangent edits keep the opposite handle aligned', () => {
  const curve = fitFreehandCurve(circle()), original = structuredClone(curve), a = curve[0]!
  const moved = editCurve(curve, 0, 'anchor', [a.anchor[0] + 1, a.anchor[1] - 2])[0]!
  near(moved.incoming, [a.incoming[0] + 1, a.incoming[1] - 2])
  near(moved.outgoing, [a.outgoing[0] + 1, a.outgoing[1] - 2])
  const adjusted = editCurve(curve, 0, 'outgoing', [a.anchor[0] + 1, a.anchor[1] + 2])[0]!
  const ix = adjusted.incoming[0] - a.anchor[0], iy = adjusted.incoming[1] - a.anchor[1]
  expect(ix * 2 - iy).toBeCloseTo(0, 8)
  expect(ix).toBeLessThan(0)
  expect(Math.hypot(ix, iy)).toBeCloseTo(Math.hypot(a.incoming[0] - a.anchor[0], a.incoming[1] - a.anchor[1]), 8)
  expect(curve).toEqual(original)
})
test('open routes preserve endpoints and omit closing controls', () => {
  const outline: Point[] = Array.from({ length: 100 }, (_, i) => [i / 10, Math.sin(i / 20)])
  const curve = fitFreehandCurve(outline, false), sampled = sampleCurve(curve, false)
  near(sampled[0]!, outline[0]!)
  near(sampled.at(-1)!, outline.at(-1)!)
  const handles = freehandFloorplanHandles({ id: 'edging', type: 'landscape:edging', parentId: null,
    shape: 'freehand', closed: false, outline, curvePoints: curve })
  expect(handles.filter(h => h.kind === 'midpoint-handle')).toHaveLength(curve.length - 1)
  expect(handles.filter(h => h.kind === 'line')).toHaveLength(2 * curve.length - 2)
})
test('surface edits preserve level coordinates after rotated bounds are recentered', () => {
  const node: CurveNode = { id: 'deck', type: 'landscape:deck', parentId: null, shape: 'freehand',
    width: 8, depth: 5, position: [20, 2, -10], rotation: [0, 0.7, 0],
    outline: circle().map(([x, y]) => [x / 6, y / 6]) }
  const curve = curveInLevel(node)
  const moved = editCurve(curve, 0, 'anchor', [curve[0]!.anchor[0] + 0.5, curve[0]!.anchor[1]])
  const patch = curveEditPatch(node, moved)
  expect(patch).not.toBeNull()
  const restored = curveInLevel({ ...node, ...patch })
  restored.forEach((p, i) => {
    near(p.anchor, moved[i]!.anchor)
    near(p.incoming, moved[i]!.incoming)
    near(p.outgoing, moved[i]!.outgoing)
  })
})
test('crossing boundaries are rejected', () => {
  const outline: Point[] = [[0, 0], [4, 4], [0, 4], [4, 0]]
  const curve = outline.map(anchor => ({ anchor, incoming: anchor, outgoing: anchor }))
  expect(curveEditPatch({ id: 'ground', type: 'landscape:ground-area', parentId: null, outline }, curve)).toBeNull()
})
