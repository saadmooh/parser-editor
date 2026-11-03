import { expect, test } from 'bun:test'
import { type AnyNode, type AnyNodeId, type AnyNodeDefinition, createSceneApi, LevelNode, nodeRegistry, registerNode, useScene } from '@pascal-app/core'
import { IrrigationSourceNode, irrigationSourceDefinition } from './source'
import { IrrigationValveNode, irrigationValveDefinition } from './valve'
import { IrrigationHeadNode } from './schema'
import { irrigationHeadDefinition } from './definition'
import { irrigationRunDefinition } from './run'
import { irrigationFittingDefinition } from './fitting'
import { irrigationPorts } from './ports'
import { planConnectZone } from './connect-zone'
import { applyIrrigationPlan } from './network'
import { sourceReadiness } from './readiness'

test('zone connection preview leaves the scene unchanged and apply is one undo/redo operation', () => {
  const restoreRegistry = nodeRegistry._snapshot(), original = useScene.getState(), temporal = useScene.temporal.getState()
  const raf = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame'), caf = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame')
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: () => 1 })
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: () => {} })
  try {
    for (const def of [irrigationSourceDefinition, irrigationValveDefinition, irrigationHeadDefinition, irrigationRunDefinition, irrigationFittingDefinition]) registerNode(def as unknown as AnyNodeDefinition)
    const level = LevelNode.parse({}), source = IrrigationSourceNode.parse({ parentId: level.id })
    const valve = IrrigationValveNode.parse({ parentId: level.id, position: [3, 0, 2] })
    const heads = [[8, 0, 2], [8, 0, 6]].map(position => IrrigationHeadNode.parse({ parentId: level.id, position }))
    level.children = [source.id, valve.id, ...heads.map(h => h.id)] as unknown as LevelNode['children']
    const baseline = Object.fromEntries([level, source, valve, ...heads].map(n => [n.id, n])) as Record<string, AnyNode>
    useScene.getState().setScene(baseline, [level.id]); temporal.clear(); temporal.resume()
    const plan = planConnectZone(irrigationPorts(source)[0]!, irrigationPorts(valve)[0]!, irrigationPorts(valve)[1]!, heads.flatMap(irrigationPorts), .3, baseline)
    expect(Object.keys(useScene.getState().nodes)).toHaveLength(5)
    expect(useScene.temporal.getState().pastStates).toHaveLength(0)
    applyIrrigationPlan(createSceneApi(useScene), plan, level.id)
    expect(useScene.temporal.getState().pastStates).toHaveLength(1)
    expect(sourceReadiness(source, useScene.getState().nodes).outlets).toBe(2)
    temporal.undo()
    expect(Object.keys(useScene.getState().nodes)).toHaveLength(5)
    temporal.redo()
    expect(sourceReadiness(source, useScene.getState().nodes).outlets).toBe(2)
    expect(LevelNode.parse(useScene.getState().nodes[level.id]).children).toHaveLength(4 + plan.create.length)
  } finally {
    useScene.getState().setScene(original.nodes, original.rootNodeIds); temporal.clear(); restoreRegistry()
    if (raf) Object.defineProperty(globalThis, 'requestAnimationFrame', raf); else Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
    if (caf) Object.defineProperty(globalThis, 'cancelAnimationFrame', caf); else Reflect.deleteProperty(globalThis, 'cancelAnimationFrame')
  }
})

test('auto-connected dripline and generated fittings undo together', async () => {
  const { DriplineNode, driplineDefinition } = await import('./dripline')
  const { planDriplinePlacement } = await import('./dripline-connection')
  const restoreRegistry = nodeRegistry._snapshot(), original = useScene.getState(), temporal = useScene.temporal.getState()
  const raf = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame'), caf = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame')
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: () => 1 })
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: () => {} })
  try {
    for (const def of [irrigationValveDefinition, driplineDefinition, irrigationRunDefinition, irrigationFittingDefinition]) registerNode(def as unknown as AnyNodeDefinition)
    const level = LevelNode.parse({}), valve = IrrigationValveNode.parse({ parentId: level.id })
    level.children = [valve.id] as unknown as LevelNode['children']
    const baseline = Object.fromEntries([level, valve].map(n => [n.id, n])) as Record<string, AnyNode>
    useScene.getState().setScene(baseline, [level.id]); temporal.clear(); temporal.resume()
    const drip = DriplineNode.parse({ parentId: level.id, path: [[1.15, 0, 0], [4, 0, 2]] })
    const plan = planDriplinePlacement(drip, irrigationPorts(valve)[1]!, baseline)
    applyIrrigationPlan(createSceneApi(useScene), plan, level.id)
    expect(useScene.temporal.getState().pastStates).toHaveLength(1)
    expect(useScene.getState().nodes[drip.id as never]).toBeDefined()
    temporal.undo(); expect(Object.keys(useScene.getState().nodes)).toHaveLength(2)
    temporal.redo(); expect(useScene.getState().nodes[drip.id as never]).toBeDefined()
  } finally {
    useScene.getState().setScene(original.nodes, original.rootNodeIds); temporal.clear(); restoreRegistry()
    if (raf) Object.defineProperty(globalThis, 'requestAnimationFrame', raf); else Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
    if (caf) Object.defineProperty(globalThis, 'cancelAnimationFrame', caf); else Reflect.deleteProperty(globalThis, 'cancelAnimationFrame')
  }
})

test('nearby sprinkler placement and generated tee undo together', async () => {
  const { planNearbySprinkler } = await import('./auto-connect')
  const restoreRegistry = nodeRegistry._snapshot(), original = useScene.getState(), temporal = useScene.temporal.getState()
  const raf = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame'), caf = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame')
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: () => 1 })
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: () => {} })
  try {
    for (const def of [irrigationHeadDefinition, irrigationRunDefinition, irrigationFittingDefinition]) registerNode(def as unknown as AnyNodeDefinition)
    const level = LevelNode.parse({}), valve = IrrigationHeadNode.parse({ parentId: level.id })
    level.children = [valve.id] as unknown as LevelNode['children']
    const baseline = Object.fromEntries([level, valve].map(n => [n.id, n])) as Record<string, AnyNode>
    useScene.getState().setScene(baseline, [level.id]); temporal.clear(); temporal.resume()
    const drip = IrrigationHeadNode.parse({ parentId: level.id, position: [3, 0, 2] })
    const { plan, target } = planNearbySprinkler(drip, baseline)
    expect(target).toBeDefined()
    applyIrrigationPlan(createSceneApi(useScene), plan, level.id)
    expect(useScene.temporal.getState().pastStates).toHaveLength(1)
    expect(useScene.getState().nodes[drip.id as never]).toBeDefined()
    temporal.undo(); expect(Object.keys(useScene.getState().nodes)).toHaveLength(2)
    temporal.redo(); expect(useScene.getState().nodes[drip.id as never]).toBeDefined()
  } finally {
    useScene.getState().setScene(original.nodes, original.rootNodeIds); temporal.clear(); restoreRegistry()
    if (raf) Object.defineProperty(globalThis, 'requestAnimationFrame', raf); else Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
    if (caf) Object.defineProperty(globalThis, 'cancelAnimationFrame', caf); else Reflect.deleteProperty(globalThis, 'cancelAnimationFrame')
  }
})

test('complete area layout, controller assignment and connections undo and redo as one change', async () => {
  const { GroundAreaNode } = await import('../ground-areas/domain/schema')
  const { groundAreaDefinition } = await import('../ground-areas/definition')
  const { irrigationZoneDefinition } = await import('./zone-model')
  const { irrigationControllerDefinition } = await import('./controller')
  const { proposeAutomaticAreaWatering } = await import('./watering-plan')
  const restoreRegistry = nodeRegistry._snapshot(), original = useScene.getState(), temporal = useScene.temporal.getState()
  const raf = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame'), caf = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame')
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: () => 1 })
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: () => {} })
  try {
    for (const def of [groundAreaDefinition, irrigationZoneDefinition, irrigationControllerDefinition, irrigationSourceDefinition, irrigationValveDefinition, irrigationHeadDefinition, irrigationRunDefinition, irrigationFittingDefinition]) registerNode(def as unknown as AnyNodeDefinition)
    const level = LevelNode.parse({})
    const area = GroundAreaNode.parse({ parentId: level.id, outline: [[0, 0], [6, 0], [6, 4], [0, 4]] })
    level.children = [area.id] as unknown as LevelNode['children']
    const baseline = Object.fromEntries([level, area].map(n => [n.id, n])) as Record<string, AnyNode>
    useScene.getState().setScene(baseline, [level.id]); temporal.clear(); temporal.resume()
    const proposal = proposeAutomaticAreaWatering(area, { method: 'sprinkler', zone: 'Test', radius: 4, fullCircleFlow: 3, rowSpacing: .5, emitterSpacing: .3, emitterFlow: 2 }, useScene.getState().nodes)
    const source = proposal.supply!
    expect(useScene.temporal.getState().pastStates).toHaveLength(0)
    applyIrrigationPlan(createSceneApi(useScene), proposal.plan, level.id)
    expect(useScene.temporal.getState().pastStates).toHaveLength(1)
    expect(sourceReadiness(source, useScene.getState().nodes).outlets).toBe(proposal.layout.devices.length)
    const applied = useScene.getState().nodes
    temporal.undo(); expect(Object.keys(useScene.getState().nodes)).toHaveLength(2)
    temporal.redo(); expect(useScene.getState().nodes).toEqual(applied)
  } finally {
    useScene.getState().setScene(original.nodes, original.rootNodeIds); temporal.clear(); restoreRegistry()
    if (raf) Object.defineProperty(globalThis, 'requestAnimationFrame', raf); else Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
    if (caf) Object.defineProperty(globalThis, 'cancelAnimationFrame', caf); else Reflect.deleteProperty(globalThis, 'cancelAnimationFrame')
  }
})

test('connected movement commits the equipment and following pipes as one undo step', async () => {
  const { commitIrrigationEdit } = await import('./editing')
  const { planIrrigationTranslation } = await import('./movement')
  const { IrrigationRunNode, irrigationRunIssues } = await import('./run')
  const restore = nodeRegistry._snapshot(), original = useScene.getState(), temporal = useScene.temporal.getState()
  const raf = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame')
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: () => 1 })
  try {
    for (const def of [irrigationSourceDefinition, irrigationValveDefinition, irrigationHeadDefinition, irrigationRunDefinition, irrigationFittingDefinition]) registerNode(def as unknown as AnyNodeDefinition)
    const level = LevelNode.parse({}), source = IrrigationSourceNode.parse({ parentId: level.id })
    const valve = IrrigationValveNode.parse({ parentId: level.id, position: [3, 0, 2] })
    const head = IrrigationHeadNode.parse({ parentId: level.id, position: [8, 0, 2] })
    level.children = [source.id, valve.id, head.id] as unknown as LevelNode['children']
    const baseline = Object.fromEntries([level, source, valve, head].map(n => [n.id, n])) as Record<string, AnyNode>
    useScene.getState().setScene(baseline, [level.id])
    applyIrrigationPlan(createSceneApi(useScene), planConnectZone(irrigationPorts(source)[0]!, irrigationPorts(valve)[0]!, irrigationPorts(valve)[1]!, irrigationPorts(head), .3, baseline), level.id)
    const before = useScene.getState().nodes
    temporal.clear(); temporal.resume()
    commitIrrigationEdit(head, planIrrigationTranslation(head, [1, 0, 2], false, before))
    expect(useScene.temporal.getState().pastStates).toHaveLength(1)
    expect(IrrigationHeadNode.parse(useScene.getState().nodes[head.id as AnyNodeId]).position).toEqual([9, 0, 4])
    for (const value of Object.values(useScene.getState().nodes)) { const r = IrrigationRunNode.safeParse(value); if (r.success) expect(irrigationRunIssues(r.data, useScene.getState().nodes)).toEqual([]) }
    temporal.undo(); expect(useScene.getState().nodes).toEqual(before)
    temporal.redo(); expect(IrrigationHeadNode.parse(useScene.getState().nodes[head.id as AnyNodeId]).position).toEqual([9, 0, 4])
  } finally {
    useScene.getState().setScene(original.nodes, original.rootNodeIds); temporal.clear(); restore()
    if (raf) Object.defineProperty(globalThis, 'requestAnimationFrame', raf); else Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
  }
})

test('combining legacy elbow pieces preserves endpoints and is one reversible scene change', async () => {
 const { consolidateIrrigationRuns } = await import('./consolidate-runs')
 const { IrrigationRunNode, irrigationRunIssues } = await import('./run')
 const { IrrigationFittingNode } = await import('./fitting')
 const restore = nodeRegistry._snapshot(), original = useScene.getState(), temporal = useScene.temporal.getState()
 const raf = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame')
 Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: () => 1 })
 try {
  for (const def of [irrigationSourceDefinition, irrigationHeadDefinition, irrigationRunDefinition, irrigationFittingDefinition]) registerNode(def as unknown as AnyNodeDefinition)
  const level = LevelNode.parse({}), source = IrrigationSourceNode.parse({ parentId: level.id, diameter: .5 })
  const head = IrrigationHeadNode.parse({ parentId: level.id, position: [2, 0, 3] })
  const elbow = IrrigationFittingNode.parse({ parentId: level.id, fittingType: 'elbow', position: [2, .1, 0], directions: [[-1, 0, 0], [0, 0, 1]], diameters: [.5, .5] })
  const ports = irrigationPorts(elbow)
  const a = IrrigationRunNode.parse({ parentId: level.id, path: [irrigationPorts(source)[0]!.position, ports[0]!.position], startConnection: { nodeId: source.id, portId: 'outlet' }, endConnection: { nodeId: elbow.id, portId: 'socket-0' } })
  const b = IrrigationRunNode.parse({ parentId: level.id, path: [ports[1]!.position, [2, .1, 2.5], [2, -.3, 2.5], [2, -.3, 3], head.position], startConnection: { nodeId: elbow.id, portId: 'socket-1' }, endConnection: { nodeId: head.id, portId: 'inlet' } })
  level.children = [source.id, head.id, elbow.id, a.id, b.id] as unknown as LevelNode['children']
  const baseline = Object.fromEntries([level, source, head, elbow, a, b].map(n => [n.id, n])) as Record<string, AnyNode>
  useScene.getState().setScene(baseline, [level.id]); temporal.clear(); temporal.resume()
  const beforeCleanup = useScene.getState().nodes
  applyIrrigationPlan(createSceneApi(useScene), consolidateIrrigationRuns(baseline, level.id), level.id)
  const current = useScene.getState().nodes
  expect(current[a.id as AnyNodeId]).toBeDefined(); expect(current[b.id as AnyNodeId]).toBeUndefined(); expect(current[elbow.id as AnyNodeId]).toBeUndefined()
  expect(irrigationRunIssues(IrrigationRunNode.parse(current[a.id as AnyNodeId]), current)).toEqual([])
  expect(sourceReadiness(source, current).outlets).toBe(1)
  expect(useScene.temporal.getState().pastStates).toHaveLength(1)
  temporal.undo(); expect(useScene.getState().nodes).toEqual(beforeCleanup)
  temporal.redo(); expect(sourceReadiness(source, useScene.getState().nodes).outlets).toBe(1)
 } finally {
  useScene.getState().setScene(original.nodes, original.rootNodeIds); temporal.clear(); restore()
  if (raf) Object.defineProperty(globalThis, 'requestAnimationFrame', raf); else Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
 }
})
