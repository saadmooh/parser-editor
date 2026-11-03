import { BaseNode, nodeType, objectId, nodeRegistry, type AnyNode, type AnyNodeId, type FloorplanGeometry, type GeometryContext, type NodeDefinition } from '@pascal-app/core'
import { z } from 'zod'
import type { IrrigationPlan } from './network'
/** Transient composite: context nodes alone are not drawn by the host preview layer. */
export const IrrigationPreviewNode = BaseNode.extend({
  id: objectId('irrigation-preview'), type: nodeType('landscape:irrigation-preview'),
  uncoveredPoints: z.array(z.tuple([z.number(), z.number()])).default([]),
  sampleSpacing: z.number().default(.3),
  parts: z.array(z.unknown()).default([]),
})
export const irrigationPreviewDefinition: NodeDefinition<typeof IrrigationPreviewNode> = {
  kind: 'landscape:irrigation-preview', schemaVersion: 1, schema: IrrigationPreviewNode, category: 'utility', dirtyTracking: false, capabilities: {},
  defaults: () => { const { id: _id, type: _type, ...fields } = IrrigationPreviewNode.parse({ parts: [] }); return fields },
  floorplan: (node, ctx) => {
    const parts = node.parts as AnyNode[], proposed = Object.fromEntries(parts.map(n => [n.id, n]))
    const context: GeometryContext = { ...ctx, viewState: ctx.viewState ? { ...ctx.viewState, selected: false } : undefined, resolve: <N = AnyNode>(id: AnyNodeId) => (proposed[id] ?? ctx.resolve(id)) as N | undefined }
    return { kind: 'group', children: parts.flatMap(part => {
      const geometry = nodeRegistry.get(part.type)?.floorplan?.(part, context)
      return geometry ? [geometry as FloorplanGeometry] : []
    }).concat(node.uncoveredPoints.map(([x, z]): FloorplanGeometry => ({ kind: 'circle', cx: x, cy: z, r: node.sampleSpacing * .35, fill: '#ef4444', fillOpacity: .5, pointerEvents: 'none' }))) }
  },
  presentation: { label: 'Pipe preview', icon: { kind: 'iconify', name: 'lucide:route' }, hidden: true },
}
export function irrigationPlanPreview(plan: IrrigationPlan, nodes: Readonly<Record<string, AnyNode>>, parentId: string) {
  const parts = [...plan.create, ...plan.update.flatMap(u => nodes[u.id] ? [{ ...nodes[u.id], ...u.data } as AnyNode] : [])]
  return IrrigationPreviewNode.parse({ parentId, parts }) as unknown as AnyNode
}
