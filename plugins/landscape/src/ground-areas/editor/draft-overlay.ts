import { landscapeToolColors } from '../../shared/tool-colors'
import { normalizeOutline, rectangleOutline, validateOutline } from '../domain/polygon'
import type { Point } from '../domain/schema'
import type { GroundAreaShape } from './session'

const SVG_NS = 'http://www.w3.org/2000/svg'
export const GROUND_AREA_DRAFT_COLOR = landscapeToolColors.draft

function pointsAttribute(points: readonly Point[]) {
  return points.map(([x, z]) => `${x},${z}`).join(' ')
}

export class GroundAreaDraftOverlay {
  constructor(private readonly color: string = GROUND_AREA_DRAFT_COLOR,
    private readonly attribute = 'data-landscape-ground-draft') {}
  private root: SVGGElement | null = null
  private fill: SVGPolygonElement | null = null
  private path: SVGPolylineElement | null = null
  private closing: SVGLineElement | null = null
  private anchors: SVGGElement | null = null

  update(shape: GroundAreaShape, points: readonly Point[], cursor: Point | null, fillColor: string,
    anchor?: Point, controlPoints?: readonly Point[]) {
    const scene = document.querySelector<SVGGElement>('[data-floorplan-scene]')
    if (!scene) return
    if (!this.root || !this.root.isConnected) {
      this.root = document.createElementNS(SVG_NS, 'g')
      this.root.setAttribute(this.attribute, '')
      this.root.setAttribute('pointer-events', 'none')
      this.fill = document.createElementNS(SVG_NS, 'polygon')
      this.path = document.createElementNS(SVG_NS, 'polyline')
      this.closing = document.createElementNS(SVG_NS, 'line')
      this.anchors = document.createElementNS(SVG_NS, 'g')
      this.root.append(this.fill, this.path, this.closing, this.anchors)
      scene.append(this.root)
    }

    const outline = shape === 'rectangle' && points[0] && cursor
      ? rectangleOutline(points[0], cursor)
      : shape === 'custom' && cursor && points.length
        ? [...points, cursor]
        : [...points]
    const curved = shape === 'circle' || shape === 'oval'
    const normalized = curved ? outline : normalizeOutline(outline)
    const validFill = curved ? outline.length >= 3
      : shape !== 'freehand' && normalized.length >= 3 && !validateOutline(normalized)
    this.fill!.setAttribute('points', validFill ? pointsAttribute(normalized) : '')
    this.fill!.setAttribute('fill', fillColor)
    this.fill!.setAttribute('fill-opacity', '0.2')

    const visibleLine = curved ? outline.length ? [...outline, outline[0]!] : []
      : shape === 'rectangle'
      ? outline.length === 4 ? [...outline, outline[0]!] : []
      : shape === 'custom' && cursor && points.length ? [...points, cursor] : [...points]
    this.path!.setAttribute('points', pointsAttribute(visibleLine))
    this.path!.setAttribute('fill', 'none')
    this.path!.setAttribute('stroke', this.color)
    this.path!.setAttribute('stroke-width', '0.08')
    this.path!.setAttribute('stroke-linecap', 'round')
    this.path!.setAttribute('stroke-linejoin', 'round')

    const first = points[0]
    const showClosing = shape === 'custom' && points.length >= 2 && cursor && first
    this.closing!.setAttribute('x1', String(cursor?.[0] ?? 0))
    this.closing!.setAttribute('y1', String(cursor?.[1] ?? 0))
    this.closing!.setAttribute('x2', String(first?.[0] ?? 0))
    this.closing!.setAttribute('y2', String(first?.[1] ?? 0))
    this.closing!.setAttribute('stroke', showClosing ? this.color : 'none')
    this.closing!.setAttribute('stroke-opacity', '0.6')
    this.closing!.setAttribute('stroke-dasharray', '0.16 0.1')
    this.closing!.setAttribute('stroke-width', '0.05')

    this.anchors!.replaceChildren(...(controlPoints ?? (curved ? anchor ? [anchor] : []
      : shape === 'freehand' ? points.slice(0, 1) : points)).map(([x, z], index) => {
      const circle = document.createElementNS(SVG_NS, 'circle')
      circle.setAttribute('cx', String(x))
      circle.setAttribute('cy', String(z))
      circle.setAttribute('r', index === 0 ? '0.13' : '0.1')
      circle.setAttribute('fill', index === 0 ? '#fff' : this.color)
      circle.setAttribute('stroke', this.color)
      circle.setAttribute('stroke-width', '0.05')
      return circle
    }))
  }

  dispose() {
    this.root?.remove()
    this.root = null
  }
}
