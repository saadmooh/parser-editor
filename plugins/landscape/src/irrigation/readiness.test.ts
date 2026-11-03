import { expect, test } from 'bun:test'
import { IrrigationSourceNode } from './source'
import { IrrigationValveNode } from './valve'
import { IrrigationHeadNode } from './schema'
import { routeSourceToValve, routeValveToHead } from './run'
import { sourceReadiness } from './readiness'
test('installed demand follows valid connected sockets once, including closed and hidden objects', () => {
  const source = IrrigationSourceNode.parse({ parentId: 'level_test', diameter: 0.5, availableFlow: 3 })
  const valve = IrrigationValveNode.parse({ parentId: 'level_test', position: [3, 0, 0], diameter: 0.5, isOpen: false })
  const head = IrrigationHeadNode.parse({ parentId: 'level_test', position: [5, 0, 0], flow: 4, visible: false })
  const upstream = routeSourceToValve(source, valve, 0.3)!, downstream = routeValveToHead(valve, head, 0.3)!
  const nodes = Object.fromEntries([source, valve, head, upstream, downstream].map(node => [node.id, node]))
  const review = sourceReadiness(source, nodes)
  expect(review.demand).toBe(4)
  expect(review.outlets).toBe(1)
  expect(review.margin).toBe(-1)
  expect(review.issues).toContain('Installed demand exceeds authored available flow.')
  expect(review.issues).toContain('1 connected valve(s) are authored closed.')
  expect(sourceReadiness(source, { ...nodes, [head.id]: { ...head, inletDiameter: 0.75 } }).outlets).toBe(0)
})
test('unconnected disabled source reports unavailable readiness without invented demand', () => {
  const source = IrrigationSourceNode.parse({ enabled: false, pressureBar: 0 })
  expect(sourceReadiness(source, { [source.id]: source }).issues).toEqual(['Supply is disabled.', 'No positive supply pressure is authored.', 'No head or dripline is connected through matching sockets.'])
})
