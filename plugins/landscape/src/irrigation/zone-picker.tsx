'use client'
import { useScene } from '@pascal-app/core'
import { zoneCatalog } from './zone-model'
export function ZonePicker({ value, onChange, disabled, method, parentId, label = 'Watering zone' }: { value: string; onChange: (value: string) => void; disabled?: boolean; method?: 'sprinkler' | 'drip'; parentId?: string | null; label?: string }) {
  const nodes = useScene(s => s.nodes)
  const names = [...new Set([value, ...zoneCatalog(Object.values(nodes).filter(n => !parentId || n.parentId === parentId)).filter(z => !method || z.method === method).map(z => z.name)])].filter(Boolean)
  return <label className="flex items-center gap-2 text-xs text-muted-foreground">{label}<select aria-label={label} value={value} disabled={disabled} onChange={e => onChange(e.target.value)} className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-foreground">
    <option value="">Unassigned</option>{names.map(name => <option key={name} value={name}>{name}</option>)}
  </select></label>
}

export function zoneAssignment(zone: string) {
  const model = zoneCatalog(Object.values(useScene.getState().nodes)).find(z => z.name === zone)
  return { zone, zoneId: model?.id }
}
