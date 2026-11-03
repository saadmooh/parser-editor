import { methodConnectionProblem } from './method'
import type { NodePort } from '@pascal-app/core'
import { IrrigationHeadNode } from './schema'
import { IrrigationSourceNode, irrigationSourcePorts } from './source'
import { IrrigationValveNode, irrigationValvePorts } from './valve'
import { DriplineNode, driplinePorts } from './dripline'
import { IrrigationFittingNode, irrigationFittingPorts } from './fitting'
export type Point = [number, number, number]
export type IrrigationPort = Omit<NodePort, 'position' | 'direction'> & { position: Point; direction: Point } & { nodeId: string; parentId: string | null; zone: string | null; zoneId?: string; name: string }
export const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(...a.map((v, i) => v - b[i]!))
export const unit = (a: readonly number[], b: readonly number[]): Point => {
  const length = distance(a, b)
  return a.map((v, i) => length > 1e-9 ? (v - b[i]!) / length : 0) as Point
}
export function irrigationPorts(raw: unknown): IrrigationPort[] {
  if (!raw || typeof raw !== 'object') return []
  const value = raw as { type: string; id: string; parentId: string | null; name?: string; zone?: string; zoneId?: string; path?: Point[]; diameter?: number }
  let ports: NodePort[] = [], zone: string | null = value.zone ?? null
  switch (value.type) {
    case 'landscape:irrigation-head': { const n = IrrigationHeadNode.safeParse(raw); if (n.success) ports = [{ id: 'inlet', position: n.data.position, direction: [0, -1, 0], diameter: n.data.inletDiameter, system: 'irrigation' }]; break }
    case 'landscape:irrigation-source': { const n = IrrigationSourceNode.safeParse(raw); if (n.success) ports = irrigationSourcePorts(n.data); zone = null; break }
    case 'landscape:irrigation-valve': { const n = IrrigationValveNode.safeParse(raw); if (n.success) ports = irrigationValvePorts(n.data); break }
    case 'landscape:dripline': { const n = DriplineNode.safeParse(raw); if (n.success) ports = driplinePorts(n.data); break }
    case 'landscape:irrigation-fitting': { const n = IrrigationFittingNode.safeParse(raw); if (n.success) ports = irrigationFittingPorts(n.data); break }
    case 'landscape:irrigation-run': {
      const path = value.path
      if (path && path.length > 1) ports = [
        { id: 'start', position: path[0]!, direction: unit(path[0]!, path[1]!), diameter: value.diameter ?? 0.5, system: 'irrigation' },
        { id: 'end', position: path.at(-1)!, direction: unit(path.at(-1)!, path.at(-2)!), diameter: value.diameter ?? 0.5, system: 'irrigation' },
      ]; break
    }
  }
  return ports.map(port => ({ ...port, position: [...port.position] as Point, direction: [...port.direction] as Point, nodeId: value.id, parentId: value.parentId, zone: value.type === 'landscape:irrigation-valve' && port.id === 'inlet' || zone === '' ? null : zone, zoneId: value.zoneId, name: value.name || value.type.replace('landscape:', '').replaceAll('-', ' ') }))
}
export function resolveIrrigationPort(connection: { nodeId: string; portId: string }, nodes: Readonly<Record<string, unknown>>) {
  return irrigationPorts(nodes[connection.nodeId]).find(port => port.id === connection.portId)
}
export function portIsOccupied(port: IrrigationPort, nodes: Readonly<Record<string, unknown>>, excludeId?: string) {
  const owner = nodes[port.nodeId] as { type?: string; startConnection?: unknown; endConnection?: unknown } | undefined
  if (owner?.type === 'landscape:irrigation-run' && (port.id === 'start' ? owner.startConnection : owner.endConnection)) return true
  return Object.values(nodes).some(raw => {
    const n = raw as { id?: string; type?: string; startConnection?: { nodeId: string; portId: string }; endConnection?: { nodeId: string; portId: string } } | undefined
    return n?.type === 'landscape:irrigation-run' && n.id !== excludeId && [n.startConnection, n.endConnection].some(c => c?.nodeId === port.nodeId && c.portId === port.id)
  })
}
export function connectionProblem(source: IrrigationPort, target: IrrigationPort, nodes: Readonly<Record<string, unknown>>) {
  if (source.parentId !== target.parentId) return 'Choose a connection on this level.'
  if (source.nodeId === target.nodeId) return 'Choose a different object.'
  if (source.zone && target.zone && source.zone !== target.zone) return 'These connections belong to different zones.'
  const methodProblem = methodConnectionProblem(source, target, nodes)
  if (methodProblem) return methodProblem
  if (portIsOccupied(target, nodes)) return 'This socket is occupied. Add a branch on its pipe.'
  return null
}
