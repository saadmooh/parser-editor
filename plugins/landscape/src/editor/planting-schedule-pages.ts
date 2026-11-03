import type { FloorplanGeometry } from '@pascal-app/core'
import type { FloorplanSchedule, SheetPdfPage } from '@pascal-app/editor'

function wrap(value: string, length: number) {
  const lines: string[] = []
  let remaining = value
  while (remaining.length > length) {
    const boundary = remaining.lastIndexOf(' ', length)
    const end = boundary > length / 2 ? boundary : length
    lines.push(remaining.slice(0, end))
    remaining = remaining.slice(end).trimStart()
  }
  lines.push(remaining || '—')
  return lines
}

/** Paper layout only: schedule codes, names and quantities belong to the host contribution. */
export function plantingSchedulePages(schedules: readonly FloorplanSchedule[], levelName: string): SheetPdfPage[] {
  const pages: SheetPdfPage[] = []
  const text = (x: number, y: number, value: string, fontSize = 0.12): FloorplanGeometry =>
    ({ kind: 'text', x, y, text: value, fontSize, fill: '#202020', textAnchor: 'start' })
  for (const schedule of schedules) {
    let page: SheetPdfPage | undefined
    let y = 0
    const nextPage = () => {
      const number = `LPS-${pages.length + 1}`
      page = { number, title: schedule.title, widthIn: 8.27, heightIn: 11.69,
        plate: [], windows: [], overlay: [text(0.5, 0.65, 'Landscape planting schedule', 0.2),
          text(0.5, 0.95, levelName, 0.14), text(0.5, 1.3, schedule.title, 0.16),
          text(0.5, 1.65, 'Code'), text(1.9, 1.65, 'Species'), text(4.3, 1.65, 'Botanical name'), text(7.15, 1.65, 'Qty'),
          text(0.5, 11.05, 'Counts include planting objects on the selected level. Verify availability and site suitability.', 0.1),
          text(0.5, 11.35, `${number} · ${schedule.title}`, 0.1)] }
      pages.push(page)
      y = 1.95
    }
    for (const row of schedule.rows) {
      const columns = [wrap(String(row.cells.code ?? '—'), 15), wrap(String(row.cells.name ?? '—'), 28),
        wrap(String(row.cells.botanical ?? '—'), 32), wrap(String(row.cells.count ?? '—'), 6)]
      const height = Math.max(...columns.map(lines => lines.length)) * 0.19 + 0.12
      if (!page || y + height > 10.6) nextPage()
      for (const [index, lines] of columns.entries()) {
        const x = [0.5, 1.9, 4.3, 7.15][index]!
        for (const [line, value] of lines.entries()) page!.overlay.push(text(x, y + line * 0.19, value))
      }
      y += height
      page!.overlay.push({ kind: 'line', x1: 0.5, y1: y - 0.12, x2: 7.77, y2: y - 0.12,
        stroke: '#dddddd', strokeWidth: 0.005 })
    }
  }
  return pages
}
