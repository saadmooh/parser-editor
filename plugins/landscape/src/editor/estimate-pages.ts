import type { FloorplanGeometry } from '@pascal-app/core'
import type { SheetPdfPage } from '@pascal-app/editor'
import { costEstimate, type EstimateSettings } from './cost-estimate'
import { mulchOrder, type QuantityRow } from './quantities'

/** Reports use the editor's vector PDF pipeline and its paper coordinates. */
export function estimatePages(rows: QuantityRow[], waste: number, settings: EstimateSettings, levelName: string): SheetPdfPage[] {
  const estimate = costEstimate(rows, waste, settings)
  const pages: SheetPdfPage[] = []
  const text = (x: number, y: number, value: string, fontSize = 0.12): FloorplanGeometry => ({ kind: 'text', x, y, text: value, fontSize, fill: '#202020', textAnchor: 'start' })
  const sections = [
    { title: `Cost estimate (${settings.currency})`, headers: ['Item', 'Quantity', 'Material', 'Labour', 'Total'],
      rows: estimate.items.map(item => [item.label, `${item.quantity?.toFixed(3) ?? 'Unknown'} ${item.unit}`, item.materialCost?.toFixed(2) ?? 'Unpriced', item.labourCost?.toFixed(2) ?? 'Unpriced', item.total?.toFixed(2) ?? 'Unpriced']) },
    { title: 'Landscape quantities', headers: ['Item', 'Count', 'Net m²', 'Length m', 'Order m³', 'Bags'],
      rows: rows.map(row => [row.label, String(row.count), row.netArea?.toFixed(2) ?? '—', row.length?.toFixed(2) ?? '—', mulchOrder(row, waste)?.volume.toFixed(3) ?? '—', mulchOrder(row, waste)?.bags.toString() ?? '—']) },
  ]
  for (const section of sections) {
    let page: SheetPdfPage | undefined
    let y = 0
    const xs = section.headers.length === 6 ? [.5,3.35,4.05,4.95,5.95,7.05] : [.5,3.6,4.8,5.85,6.9]
    const nextPage = () => {
      const number = `LE-${pages.length + 1}`
      page = { number, title: section.title, widthIn: 8.27, heightIn: 11.69, plate: [], windows: [], overlay: [
        text(.5,.65,section.title,.2), text(.5,.95,levelName,.14),
        text(.5,1.25,`Waste allowance: ${waste}% · Priced subtotal: ${estimate.total.toFixed(2)} ${settings.currency}`),
        text(.5,1.5,`${estimate.unpriced} unpriced items. Rates exclude tax; verify supplier prices and site conditions.`,.1),
        text(.5,11.25,`${number} · ${section.title}`,.1),
      ] }
      section.headers.forEach((value,index) => page!.overlay.push(text(xs[index]!,1.9,value)))
      pages.push(page); y = 2.25
    }
    for (const row of section.rows) {
      const columns = row.map((value,index) => value.match(new RegExp(`.{1,${index === 0 ? 38 : 14}}`, 'g')) ?? ['—'])
      const height = Math.max(.34, Math.max(...columns.map(lines => lines.length)) * .14 + .08)
      if (!page || y + height > 10.65) nextPage()
      columns.forEach((lines,index) => lines.forEach((line,i) => page!.overlay.push(text(xs[index]!, y+i*.14, line,.105))))
      y += height
    }
  }
  return pages
}
