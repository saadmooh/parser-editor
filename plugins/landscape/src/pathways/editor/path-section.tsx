'use client'
import { PanelSection } from '@pascal-app/editor'
import { useState } from 'react'
import { PanelSelect } from '../../editor/panel-select'
import type { PathwayNode } from '../domain/schema'
import { edgeGradeProfile } from '../domain/grade'

/** Unfolded centerline profile: station is plan arc length, ordinate is level height. */
export function PathwaySectionPanel({ path }: { path: PathwayNode }) {
  const [edgeId, setEdgeId] = useState('')
  const edge = path.edges.find((item) => item.id === edgeId) ?? path.edges[0]
  if (!edge) return null
  const profile = edgeGradeProfile(path, edge)
  const low = Math.min(...profile.samples.map((item) => item.elevation)) + 0.005
  const high = Math.max(...profile.samples.map((item) => item.elevation)) + path.thickness + 0.005
  const span = Math.max(0.1, high - low)
  const x = (station: number) => 42 + 210 * station / Math.max(0.001, profile.length)
  const y = (height: number) => 126 - 86 * (height - low) / span
  const upper = profile.samples.map((item) => `${x(item.station)},${y(item.elevation + path.thickness + 0.005)}`)
  const lower = [...profile.samples].reverse().map((item) => `${x(item.station)},${y(item.elevation + 0.005)}`)
  return <PanelSection title="Walkway section">
    <PanelSelect label="Section route" aria-label="Walkway section route" value={edge.id} onChange={(event) => setEdgeId(event.target.value)}>
        {path.edges.map((item, index) => <option key={item.id} value={item.id}>Edge {index + 1}</option>)}
    </PanelSelect>
    <svg viewBox="0 0 290 170" role="img" aria-label={`Longitudinal section, ${profile.length.toFixed(2)} metres, ${profile.slopePercent?.toFixed(2) ?? 'undefined'} percent grade`}
      className="w-full rounded-md border border-border bg-muted/30 text-foreground">
      <path d="M42 28V140H260" fill="none" stroke="currentColor" opacity="0.35" />
      <polygon points={[...upper, ...lower].join(' ')} fill={path.color} stroke="currentColor" strokeWidth="1" />
      <g fill="currentColor" fontSize="10">
        <text x="6" y="35">{high.toFixed(2)} m</text>
        <text x="6" y="130">{low.toFixed(2)} m</text>
        <text x="42" y="155">0 m</text>
        <text x="252" y="155" textAnchor="end">{profile.length.toFixed(2)} m</text>
      </g>
    </svg>
    <p className="text-xs">Rise {profile.rise.toFixed(2)} m · thickness {path.thickness.toFixed(2)} m</p>
    <p className="text-xs text-muted-foreground">Height above level. Vertical scale exaggerated.</p>
  </PanelSection>
}
