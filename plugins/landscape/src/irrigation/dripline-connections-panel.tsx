'use client'
import { useState } from 'react'
import { createSceneApi, useScene, type AnyNodeId } from '@pascal-app/core'
import { ActionButton } from '@pascal-app/editor'
import { irrigationPorts, portIsOccupied } from './ports'
import { planDriplineFeed } from './dripline-connection'
import { applyIrrigationPlan } from './network'
import type { DriplineNode } from './dripline'

export function DriplineConnectionsPanel({ node }: { node: DriplineNode }) {
  const nodes = useScene(s => s.nodes), readOnly = useScene(s => s.readOnly)
  const [target, setTarget] = useState(''), [message, setMessage] = useState('')
  const inlet = irrigationPorts(node)[0]!
  const connected = portIsOccupied(inlet, nodes)
  const feeds = Object.values(nodes).flatMap(raw => irrigationPorts(raw).filter(p => p.parentId === node.parentId && p.nodeId !== node.id && raw.visible !== false && (!p.zone || p.zone === node.zone) && (
    (raw.type as string) === 'landscape:irrigation-valve' && p.id === 'outlet' || (raw.type as string) === 'landscape:irrigation-source' ||
    ['landscape:irrigation-fitting', 'landscape:irrigation-run'].includes(raw.type) && !portIsOccupied(p, nodes)
  )))
  return <div className="space-y-2 rounded-md border border-border p-3 text-xs">
    <p role="status">{connected ? 'Feed pipe connected' : 'Inlet needs a feed pipe'}</p>
    <p className="text-muted-foreground">Draw from a nearby valve or drag the first point near its outlet. Pipes and fittings are added when you finish. Hold Alt to skip auto-connect.</p>
    {!connected && <>
      <select aria-label="Dripline feed socket" value={target} disabled={readOnly} onChange={e => { setTarget(e.target.value); setMessage('') }} className="w-full rounded border border-border bg-background p-2">
        <option value="">Choose a valve or pipe socket</option>
        {feeds.map(p => <option key={`${p.nodeId}:${p.id}`} value={`${p.nodeId}:${p.id}`}>{p.name} · {p.id}{portIsOccupied(p, nodes) ? ' · add branch' : ''}</option>)}
      </select>
      <ActionButton label="Connect inlet" disabled={readOnly || !target} onClick={() => {
        try {
          const state = useScene.getState()
          if (state.readOnly || !node.parentId) return
          const feed = feeds.find(p => `${p.nodeId}:${p.id}` === target)
          const current = state.nodes[node.id as AnyNodeId]
          if (!feed || !current) throw new Error('Choose an available socket.')
          const latest = irrigationPorts(state.nodes[feed.nodeId as AnyNodeId]).find(p => p.id === feed.id)
          if (!latest) throw new Error('That socket was removed.')
          const plan = planDriplineFeed(current as unknown as DriplineNode, latest, state.nodes)
          applyIrrigationPlan(createSceneApi(useScene), plan, node.parentId as AnyNodeId)
          setMessage('Feed pipe and fittings connected.')
        } catch (error) { setMessage((error as Error).message) }
      }} />
    </>}
    {message && <p role="status">{message}</p>}
  </div>
}
