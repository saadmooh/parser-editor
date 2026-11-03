'use client'
import { getLevelDisplayName, useScene } from '@pascal-app/core'
import { ActionButton, exportSheetsToPdf, MetricControl, PanelSection } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useState } from 'react'
import { costEstimate, estimateCsv, estimateSettings, type EstimateSettings } from './cost-estimate'
import { estimatePages } from './estimate-pages'
import type { QuantityRow } from './quantities'
import { PanelSelect } from './panel-select'

export function CostPanel({ rows, waste }: { rows: QuantityRow[]; waste: number }) {
  const levelId = useViewer(state => state.selection.levelId)
  const level = useScene(state => levelId ? state.nodes[levelId] : undefined)
  const readOnly = useScene(state => state.readOnly)
  const settings = estimateSettings(level?.metadata?.landscapeEstimate)
  const estimate = costEstimate(rows, waste, settings)
  const [active, setActive] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const item = estimate.items.find(row => row.key === active) ?? estimate.items[0]
  const save = (next: EstimateSettings) => {
    const scene = useScene.getState(); const current = levelId ? scene.nodes[levelId] : undefined
    if (scene.readOnly || !current) return
    scene.updateNode(current.id, { metadata: { ...current.metadata, landscapeEstimate: next } })
  }
  const rate = (key: 'material' | 'labour', value: number) => {
    if (!item) return
    save({ ...settings, rates: { ...settings.rates, [item.key]: { ...settings.rates[item.key], material: item.materialRate, labour: item.labourRate, bags: settings.rates[item.key]?.bags ?? false, [key]: value } } })
  }
  return <PanelSection title="Cost estimate" defaultExpanded={false}>
    <fieldset disabled={readOnly || !levelId} className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
      <PanelSelect label="Currency" value={settings.currency} onChange={event => save({ ...settings, currency: event.target.value as EstimateSettings['currency'] })}>
        {['USD','INR','EUR','GBP','AUD','CAD'].map(currency => <option key={currency}>{currency}</option>)}
      </PanelSelect>
      {item && <>
        <PanelSelect label="Item" value={item.key} onChange={event => setActive(event.target.value)}>{estimate.items.map(row => <option key={row.key} value={row.key}>{row.label} · {row.unit}</option>)}</PanelSelect>
        {rows.some(row => row.costKey === item.key && row.bagLitres) && <PanelSelect label="Price by" value={settings.rates[item.key]?.bags ? 'bags' : 'volume'} onChange={event => {
          save({ ...settings, rates: { ...settings.rates, [item.key]: { material: null, labour: null, bags: event.target.value === 'bags' } } })
        }}><option value="volume">Cubic metre</option><option value="bags">Bag</option></PanelSelect>}
        <MetricControl label={`Material / ${item.unit}`} value={item.materialRate ?? 0} min={0} max={1e9} step={1} precision={2} unit={settings.currency} onChange={value => rate('material', value)} />
        <MetricControl label={`Labour / ${item.unit}`} value={item.labourRate ?? 0} min={0} max={1e9} step={1} precision={2} unit={settings.currency} onChange={value => rate('labour', value)} />
        <div className="flex gap-2"><ActionButton label="No labour cost" onClick={() => rate('labour', 0)} /><ActionButton label="Clear rates" onClick={() => {
          const rates = { ...settings.rates }; delete rates[item.key]; save({ ...settings, rates })
        }} /></div>
        <p className="text-xs text-muted-foreground">{item.quantity?.toFixed(3) ?? 'Unknown quantity'} {item.unit} · Material {item.materialRate === null ? 'unpriced' : 'saved'} · Labour {item.labourRate === null ? 'unpriced' : 'saved'}</p>
      </>}
    </fieldset>
    <p className="text-xs">{estimate.unpriced ? 'Priced subtotal' : 'Estimated total'}: {estimate.total.toFixed(2)} {settings.currency}{estimate.unpriced > 0 && ` · ${estimate.unpriced} unpriced items`}</p>
    <p className="text-[11px] text-muted-foreground">Rates are saved to this level. Waste applies to surface and mulch orders. Tax and supplier delivery charges are excluded.</p>
    <div className="flex gap-2">
      <ActionButton label="Export estimate CSV" disabled={!rows.length} onClick={() => {
        const url = URL.createObjectURL(new Blob(['\uFEFF'+estimateCsv(rows,waste,settings)], { type: 'text/csv;charset=utf-8' }))
        const anchor = document.createElement('a'); anchor.href=url; anchor.download='landscape-estimate.csv'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url),1000)
      }} />
      <ActionButton label={busy ? 'Preparing PDF…' : 'Export quantities and estimate PDF'} disabled={busy || !rows.length} onClick={async () => {
        setBusy(true); setStatus('')
        try { await exportSheetsToPdf(estimatePages(rows,waste,settings,level?.type === 'level' ? getLevelDisplayName(level) : 'Landscape level'), 'landscape-estimate.pdf', 'Landscape quantities and estimate'); setStatus('PDF ready. Check your downloads.') }
        catch { setStatus('PDF export failed. Try again.') }
        finally { setBusy(false) }
      }} />
    </div>
    {status && <p role="status" className="text-xs text-muted-foreground">{status}</p>}
  </PanelSection>
}
