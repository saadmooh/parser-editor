import { IrrigationSourceNode } from './source'
import { expect, test } from 'bun:test'
import { IrrigationHeadNode } from './schema'
import { irrigationPorts } from './ports'
import { planConnection } from './network'
import { IrrigationRunNode } from './run'
import { irrigationObstacles, pathHitsObstacle } from './routing-obstacles'

test('automatic route detours around a patio and never crosses its protected footprint', () => {
  const a = IrrigationHeadNode.parse({ parentId: 'level_test' }), b = IrrigationHeadNode.parse({ parentId: a.parentId, position: [8, 0, 0] })
  const patio = { id: 'patio_test', type: 'landscape:patio', parentId: a.parentId, position: [4, 0, 0], rotation: [0, 0, 0], width: 2, depth: 2 }
  const nodes = { [a.id]: a, [b.id]: b, [patio.id]: patio }
  const plan = planConnection(irrigationPorts(a)[0]!, irrigationPorts(b)[0]!, b.position, [], .4, nodes)
  const box = irrigationObstacles(a.parentId!, nodes)[0]!
  for (const raw of plan.create) { const run = IrrigationRunNode.safeParse(raw); if (run.success) expect(pathHitsObstacle(run.data.path, box)).toBe(false) }
})

test('obstructed target reports failure without returning a partial route', () => {
  const source = IrrigationSourceNode.parse({ parentId: 'level_test', position: [-4, 0, 0] })
  const head = IrrigationHeadNode.parse({ parentId: 'level_test', position: [2, 0, 0] })
  const patio = { id: 'patio_test', type: 'landscape:patio', parentId: 'level_test', position: [2, 0, 0], width: 2, depth: 2 }
  const nodes = { [source.id]: source, [head.id]: head, [patio.id]: patio }
  expect(() => planConnection(irrigationPorts(source)[0]!, irrigationPorts(head)[0]!, head.position, [], .3, nodes)).toThrow()
  expect(Object.keys(nodes)).toHaveLength(3)
})
