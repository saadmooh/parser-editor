'use client'
import { landscapeToolColors } from '../shared/tool-colors'
import { type AnyNodeId, nodeRegistry, sceneRegistry, useScene } from '@pascal-app/core'
import { useEditor, useRegistryToolContext } from '@pascal-app/editor'
import { useDistributionRunTool, DistributionRunCursor, findNearestRunBody3D } from '@pascal-app/editor/distribution'
import { useEffect, useMemo, useState } from 'react'
import { Group, Vector3, CylinderGeometry, Mesh, MeshBasicMaterial, Quaternion } from 'three'
import { irrigationPorts, portIsOccupied, type IrrigationPort } from './ports'
import { commitDrawing, planDrawing } from './drawing'
import { IrrigationRunNode } from './run'
import { IrrigationFittingNode } from './fitting'
import type { IrrigationPlan } from './network'
import { useThree } from '@react-three/fiber'
import { createPortal } from 'react-dom'
import { Html } from '@react-three/drei'

function Preview({ plan }: { plan: IrrigationPlan | null }) {
  const group = useMemo(() => {
    const group = new Group(), material = new MeshBasicMaterial({ color: landscapeToolColors.draft, opacity: 0.55, transparent: true, depthTest: false })
    for (const raw of plan?.create ?? []) {
      const run = IrrigationRunNode.safeParse(raw)
      if (run.success) for (let i = 1; i < run.data.path.length; i++) {
        const a = new Vector3(...run.data.path[i - 1]!), b = new Vector3(...run.data.path[i]!), delta = b.clone().sub(a)
        const tube = new Mesh(new CylinderGeometry(run.data.diameter * .0254 / 2, run.data.diameter * .0254 / 2, delta.length(), 12), material)
        tube.position.copy(a).add(b).multiplyScalar(.5); tube.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize())); group.add(tube)
      }
      const fitting = IrrigationFittingNode.safeParse(raw)
      if (fitting.success) {
        const geometry = nodeRegistry.get(fitting.data.type)?.geometry?.(raw, {} as never)
        if (geometry instanceof Group) { geometry.position.set(...fitting.data.position); geometry.traverse(o => { if (o instanceof Mesh) { const old = o.material; (Array.isArray(old) ? old : [old]).forEach(m => m.dispose()); o.material = material } }); group.add(geometry) }
      }
    }
    return group
  }, [plan])
  useEffect(() => () => { group.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()) } }) }, [group])
  return <primitive object={group} raycast={() => null} />
}
export default function IrrigationPipeTool() {
  const view = useEditor(state => state.viewMode)
  return view === '2d' ? null : <PipeDrawing />
}
function PipeDrawing() {
  const { activeLevelId, sceneApi, unit } = useRegistryToolContext()
  const { gl } = useThree()
  const defaults = useEditor(state => state.toolDefaults['landscape:irrigation-run']) as { depth?: number; continuation?: { nodeId: string; portId: string } } | undefined
  const depth = defaults?.depth ?? .3
  const [status, setStatus] = useState<string | null>(null)
  const seed = useMemo(() => defaults?.continuation ? irrigationPorts(sceneApi.get(defaults.continuation.nodeId as AnyNodeId)).find(p => p.id === defaults.continuation!.portId) : undefined, [defaults?.continuation, sceneApi])
  const run = useDistributionRunTool({
    active: !!activeLevelId, levelId: activeLevelId, toolName: 'landscape:irrigation-run',
    initialStart: seed?.position, initialConnection: seed ? { port: { ...seed, nodeId: seed.nodeId as AnyNodeId }, body: null } : undefined,
    getPorts: () => Object.values(sceneApi.nodes()).flatMap(raw => raw.visible !== false && raw.parentId === activeLevelId ? irrigationPorts(raw).filter(p => !portIsOccupied(p, sceneApi.nodes())).map(p => ({ ...p, nodeId: p.nodeId as AnyNodeId })) : []),
    findBody: point => findNearestRunBody3D(point, .3, { kinds: ['landscape:irrigation-run'], levelId: activeLevelId ?? undefined }),
    minimumSegmentLength: .05,
    commit: ({ start, end, startConnection, endConnection }) => {
      if (useScene.getState().readOnly || !activeLevelId) return null
      try { const plan = planDrawing(start, end, startConnection, endConnection, depth, sceneApi.nodes()); setStatus(null); const result = commitDrawing(sceneApi, plan, activeLevelId); if (endConnection.port || endConnection.body) { useEditor.getState().setTool(null); useEditor.getState().setMode('select') }; return result }
      catch (error) { setStatus((error as Error).message); return null }
    },
  })
  let preview: IrrigationPlan | null = null, message = status
  if (run.start && run.cursor) try { preview = planDrawing(run.start, run.cursor, run.startConnection, run.endConnection, depth, sceneApi.nodes()); message = null } catch (error) { message = (error as Error).message }
  const target: IrrigationPort | undefined = run.endConnection.port ? irrigationPorts(sceneApi.get(run.endConnection.port.nodeId)).find(p => p.id === run.endConnection.port!.id) : undefined
  const levelMesh = activeLevelId ? sceneRegistry.nodes.get(activeLevelId) : null
  const y = levelMesh?.position.y ?? 0
  return <group position={[0, y, 0]}>
    <Preview plan={preview} />
    <DistributionRunCursor cursor={run.cursor} start={run.start} snapTarget={run.snapTarget} snapScreen={run.snapScreen} altActive={run.altActive} unit={unit}
      directionMode={run.directionMode} startDirection={run.startConnection.port?.direction} lengthInput={run.lengthInput} onLengthInputChange={run.onLengthInputChange} onDirectionSelect={run.onDirectionSelect} validationMessage={message} extraParts={[{ key: 'depth', prefix: 'Depth', value: depth }]} />
    {gl.domElement.parentElement && <Html>{createPortal(<div className="pointer-events-none absolute left-4 top-28 z-50 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground" role="status">{message || (target ? `${target.name} · ${target.id} · ${target.zone || 'Supply main'} · ${target.diameter} in` : 'Click a socket or pipe to start · click to continue · Esc to finish')}</div>, gl.domElement.parentElement)}</Html>}
  </group>
}
