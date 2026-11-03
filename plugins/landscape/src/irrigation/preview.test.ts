import { expect, test } from 'bun:test'
import { type AnyNode, type AnyNodeDefinition, type GeometryContext, nodeRegistry, registerNode } from '@pascal-app/core'
import { IrrigationSourceNode } from './source'
import { IrrigationValveNode } from './valve'
import { IrrigationHeadNode } from './schema'
import { irrigationRunDefinition } from './run'
import { irrigationFittingDefinition } from './fitting'
import { irrigationPorts } from './ports'
import { planConnectZone } from './connect-zone'
import { IrrigationPreviewNode, irrigationPlanPreview, irrigationPreviewDefinition } from './preview'

test('a plan preview renders every pipe and fitting using proposed socket references', () => {
  const restore = nodeRegistry._snapshot()
  try {
    registerNode(irrigationRunDefinition as unknown as AnyNodeDefinition)
    registerNode(irrigationFittingDefinition as unknown as AnyNodeDefinition)
    const source = IrrigationSourceNode.parse({ parentId: 'level_test' })
    const valve = IrrigationValveNode.parse({ parentId: source.parentId, position: [3, 0, 2] })
    const head = IrrigationHeadNode.parse({ parentId: source.parentId, position: [8, 0, 2] })
    const nodes = Object.fromEntries([source, valve, head].map(n => [n.id, n])) as unknown as Record<string, AnyNode>
    const plan = planConnectZone(irrigationPorts(source)[0]!, irrigationPorts(valve)[0]!, irrigationPorts(valve)[1]!, irrigationPorts(head), .3, nodes)
    const ghost = IrrigationPreviewNode.parse(irrigationPlanPreview(plan, nodes, 'level_test'))
    const ctx = { resolve: (id: string) => nodes[id], children: [], siblings: [], parent: null, viewState: { selected: true } } as unknown as GeometryContext
    const geometry = irrigationPreviewDefinition.floorplan!(ghost, ctx)
    expect(geometry?.kind).toBe('group')
    if (geometry?.kind !== 'group') throw new Error('Expected a composite preview')
    expect(geometry.children).toHaveLength(plan.create.length)
    expect(geometry.children.some(g => g.kind === 'group' && g.children.some(c => c.kind === 'polyline'))).toBe(true)
    expect(JSON.stringify(geometry)).not.toContain('"text":"!"')
    expect(JSON.stringify(geometry)).not.toContain('endpoint-handle')
    expect(JSON.stringify(geometry)).not.toContain('move-arrow')
    expect(Object.keys(nodes)).toHaveLength(3)
  } finally { restore() }
})
