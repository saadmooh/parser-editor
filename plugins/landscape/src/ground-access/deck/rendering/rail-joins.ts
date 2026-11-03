type Point = [number, number]

/** Offset both sides to the same corner bisector; open ends stay square. */
export function railFootprint(vertices: Point[], edge: number, width: number, enabled: boolean[]): Point[] {
  const count = vertices.length
  const direction = (i: number): Point => {
    const a = vertices[(i + count) % count]!, b = vertices[(i + 1 + count) % count]!
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    return length > 1e-8 ? [(b[0] - a[0]) / length, (b[1] - a[1]) / length] : [0, 0]
  }
  const d = direction(edge), normal: Point = [-d[1], d[0]]
  const end = (index: number, neighbor: number, side: number): Point => {
    const p = vertices[index % count]!
    let offset: Point = [normal[0] * width / 2, normal[1] * width / 2]
    if (enabled[(neighbor + count) % count]) {
      const adjacent = direction(neighbor), n: Point = [-adjacent[1], adjacent[0]]
      const denominator = 1 + normal[0] * n[0] + normal[1] * n[1]
      // A bounded bisector also keeps very sharp or reversing outlines finite.
      if (denominator > 1e-8) {
        const scale = Math.min(width / 2 / denominator, width * 2 / Math.hypot(normal[0] + n[0], normal[1] + n[1]))
        offset = [(normal[0] + n[0]) * scale, (normal[1] + n[1]) * scale]
      }
    }
    return [p[0] + offset[0] * side, p[1] + offset[1] * side]
  }
  return [end(edge, edge - 1, 1), end(edge + 1, edge + 1, 1),
    end(edge + 1, edge + 1, -1), end(edge, edge - 1, -1)]
}
