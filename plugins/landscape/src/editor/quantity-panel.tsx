'use client'
import { type AnyNode, type GeometryContext, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useMemo, useState } from 'react'
import { ActionButton, MetricControl, PanelSection } from '@pascal-app/editor'
import { landscapeQuantity, materialTakeoff, materialTakeoffCsv, mulchOrder, orderingArea, quantityExport } from './quantities'
import { selectLandscapeObjects } from './objects-panel'
import { finishOptions } from '../pathways/rendering/finishes'
import { CostPanel } from './cost-panel'
import { ReviewDialog } from './review-dialog'

function materialLabel(value: string) {
  switch (value) {
    case 'laidStone': case 'concreteSlabs': case 'grassFlagstones': case 'riverStones': case 'steppingStones':
      return finishOptions[value].label
    case 'pressure-treated': return 'Pressure treated'
    case 'pvc': return 'PVC'
    case 'grass2': return 'Experimental grass'
    case 'cedar': case 'hardwood': case 'composite': case 'concrete': case 'brick': case 'stone':
    case 'grass': case 'soil': case 'mulch': case 'gravel': case 'sand': case 'mud':
      return value[0]!.toUpperCase() + value.slice(1)
    default: return value || '—'
  }
}

export function QuantityPanel({ nodes }: { nodes: AnyNode[] }) {
  const levelId = useViewer((state) => state.selection.levelId)
  const savedWaste = useScene((state) => {
    const value = levelId ? state.nodes[levelId]?.metadata?.landscapeWastePercent : undefined
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : 0
  })
  const readOnly = useScene((state) => state.readOnly)
  const [wastePercent, setWastePercent] = useState(savedWaste)
  useEffect(() => setWastePercent(savedWaste), [savedWaste, levelId])
  const saveWaste = () => {
    const state = useScene.getState()
    const level = levelId ? state.nodes[levelId] : undefined
    if (!level || state.readOnly || wastePercent === savedWaste) return
    state.updateNode(level.id, { metadata: { ...level.metadata, landscapeWastePercent: wastePercent } })
  }
  const sceneNodes = useScene((state) => state.nodes)
  const rows = useMemo(() => nodes.map((node) => landscapeQuantity(node, {
    sceneNodes, parent: node.parentId ? sceneNodes[node.parentId as keyof typeof sceneNodes] ?? null : null,
    children: [], siblings: [], resolve: ((id) => sceneNodes[id]) as GeometryContext['resolve'],
  })), [nodes, sceneNodes])
  const materials = materialTakeoff(rows, wastePercent)
  const [showQuantityCsv, setShowQuantityCsv] = useState(false)
  const [showMaterialCsv, setShowMaterialCsv] = useState(false)
  const [wideReview, setWideReview] = useState(false)
  const download = (material = false) => {
    const exported = quantityExport(rows, wastePercent, material)
    const url = URL.createObjectURL(new Blob([exported.content], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = exported.filename; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const content = <>
    <PanelSection title="Quantities">
    <div className="flex gap-2"><ActionButton type="button" label="Export CSV" disabled={!rows.length} onClick={() => download()} className="disabled:opacity-50" /><ActionButton label={showQuantityCsv ? 'Hide quantity CSV' : 'Preview quantity CSV'} aria-expanded={showQuantityCsv} disabled={!rows.length} onClick={() => setShowQuantityCsv(value => !value)} /></div>
    {showQuantityCsv && <textarea aria-label="Quantity CSV preview" readOnly value={quantityExport(rows, wastePercent).content.slice(1)} rows={5} className="mt-2 w-full rounded-md border border-border bg-background p-2 font-mono text-[11px] text-foreground" />}
    <p className="my-2 text-[11px] text-muted-foreground">Gross plan area and net modeled plan area. Individual stone paths exclude gaps from net area; footprints are measured before bevels. Net includes pool openings and grass exclusions from slabs and other ground covers. Paths and access surfaces retain grass beneath them. Other overlaps are excluded. Grade reports authored patio slope.</p>
    <div className="overflow-x-auto"><table className="min-w-[480px] w-full text-left text-[11px]">
      <thead><tr className="border-b border-border text-muted-foreground"><th className="py-2">Item</th><th className="px-2 text-right">Count</th><th>Material</th><th className="text-right">Gross m²</th><th className="pl-2 text-right">Net m²</th><th className="text-right">m</th><th className="pl-2 text-right">Grade %</th></tr></thead>
      <tbody>{rows.map((row, index) => <tr key={row.id} className="border-b border-border/50">
        <td className="py-1"><ActionButton type="button" label={row.label} title={row.label} className="max-w-36 justify-start [&>span]:truncate" onClick={() => selectLandscapeObjects([nodes[index]!])} /></td>
        <td className="px-2 text-right tabular-nums">{row.count}</td><td>{materialLabel(row.material)}</td><td className="text-right">{row.area?.toFixed(2) ?? '—'}</td><td className="pl-2 text-right">{row.netArea?.toFixed(2) ?? '—'}</td><td className="text-right">{row.length?.toFixed(2) ?? '—'}</td><td className="pl-2 text-right">{row.slopePercent?.toFixed(2) ?? '—'}</td>
      </tr>)}</tbody>
    </table></div>
    <MetricControl label="Waste allowance" value={wastePercent} min={0} max={100} step={1} precision={1} unit="%" onChange={setWastePercent} />
    <div className="flex"><ActionButton type="button" label="Save allowance to level" disabled={readOnly || !levelId || wastePercent === savedWaste} onClick={saveWaste} /></div>
    <p role="status" className="text-[11px] text-muted-foreground">{wastePercent === savedWaste ? 'Allowance saved for this level.' : 'Unsaved allowance. Save before leaving Review.'}</p>
    <p className="text-[11px] text-muted-foreground">Ordering area adds this allowance to net modeled surface area. Choose it for the material and laying pattern; no allowance is assumed by default.</p>
    <dl className="space-y-1 text-xs">{rows.filter((row) => row.netArea != null).map((row) => <div key={row.id} className="flex justify-between gap-2"><dt className="truncate">{row.label} · ordering</dt><dd className="shrink-0">{orderingArea(row, wastePercent)?.toFixed(2)} m²</dd></div>)}</dl>
    </PanelSection>
    {rows.some(row => row.bagLitres) && <PanelSection title="Mulch quantities">
      {rows.filter(row => row.bagLitres).map(row => { const order = mulchOrder(row,wastePercent); return <div key={row.id} className="flex justify-between gap-2 text-xs"><span>{row.label}</span><span>{order ? `${order.volume.toFixed(3)} m³ · ${order.bags} × ${row.bagLitres} L bags` : 'Net area unavailable'}</span></div> })}
    </PanelSection>}
    <CostPanel rows={rows} waste={wastePercent} />
    {materials.length > 0 && <PanelSection title="Material takeoff">
      <div className="flex gap-2"><ActionButton label="Export material CSV" onClick={() => download(true)} /><ActionButton label={showMaterialCsv ? 'Hide material CSV' : 'Preview material CSV'} aria-expanded={showMaterialCsv} onClick={() => setShowMaterialCsv(value => !value)} /></div>
      {showMaterialCsv && <textarea aria-label="Material CSV preview" readOnly value={materialTakeoffCsv(rows, wastePercent)} rows={5} className="mt-2 w-full rounded-md border border-border bg-background p-2 font-mono text-[11px] text-foreground" />}

      <p className="text-[11px] text-muted-foreground">Grouped by authored material or finish. Areas retain the same overlap exclusions as the object quantities. Ordering is unavailable when any surface lacks a net area.</p>
      <div className="overflow-x-auto"><table aria-label="Material takeoff" className="min-w-[360px] w-full text-left text-[11px]">
        <thead><tr className="border-b border-border text-muted-foreground"><th>Material</th><th className="px-2 text-right">Objects</th><th className="text-right">Gross m²</th><th className="px-2 text-right">Net m²</th><th className="text-right">Order m²</th></tr></thead>
        <tbody>{materials.map(material => <tr key={material.material} className="border-b border-border/50"><td className="py-2"><ActionButton label={materialLabel(material.material)} aria-label={`Select ${materialLabel(material.material)} surfaces`} title={`Select ${material.count} surfaces with ${materialLabel(material.material)}`} onClick={() => selectLandscapeObjects(rows.flatMap((row, index) => row.area !== null && row.material.trim() === material.material ? [nodes[index]!] : []))} /></td><td className="px-2 text-right">{material.count}</td><td className="text-right">{material.grossArea.toFixed(2)}</td><td className="px-2 text-right">{material.netArea?.toFixed(2) ?? '—'}</td><td className="text-right">{material.orderingArea?.toFixed(2) ?? '—'}</td></tr>)}</tbody>
      </table></div>
    </PanelSection>}
  </>
  return <section aria-label="Landscape quantities" className="mt-3 border-t border-border pt-3">
    <div className="mb-2 flex"><ActionButton label="Expand quantity review" aria-haspopup="dialog" onClick={() => setWideReview(true)} /></div>
    {wideReview ? <ReviewDialog onClose={() => setWideReview(false)}>{content}</ReviewDialog> : content}
  </section>
}
