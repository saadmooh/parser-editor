import ClipperLib from 'clipper-lib'
import type { MultiPolygon, Polygon } from 'polygon-clipping'

type Geometry = Polygon | MultiPolygon
// Ten micrometres in scene metres. Every operation returns points on this grid,
// including newly calculated intersections, so touching cells stay coincident.
const SCALE = 100_000

function paths(geometry: Geometry): ClipperLib.Paths {
  const polygons: MultiPolygon = typeof geometry[0]?.[0]?.[0] === 'number'
    ? [geometry as Polygon] : geometry as MultiPolygon
  return polygons.flatMap((polygon) => polygon.flatMap((ring, index) => {
    const path = ring.map(([x, y]) => ({ X: Math.round(x * SCALE), Y: Math.round(y * SCALE) }))
      .filter((point, i, all) => i === 0 || point.X !== all[i - 1]!.X || point.Y !== all[i - 1]!.Y)
    if (path.length > 1 && path[0]!.X === path.at(-1)!.X && path[0]!.Y === path.at(-1)!.Y) path.pop()
    if (path.length < 3) return []
    if (ClipperLib.Clipper.Orientation(path) !== (index === 0)) path.reverse()
    return [path]
  }))
}

function run(operation: ClipperLib.ClipType, subject: Geometry, clips: Geometry[]): MultiPolygon {
  const clipper = new ClipperLib.Clipper()
  clipper.StrictlySimple = true
  clipper.AddPaths(paths(subject), ClipperLib.PolyType.ptSubject, true)
  for (const clip of clips) clipper.AddPaths(paths(clip),
    operation === ClipperLib.ClipType.ctUnion ? ClipperLib.PolyType.ptSubject : ClipperLib.PolyType.ptClip, true)
  const tree = new ClipperLib.PolyTree()
  clipper.Execute(operation, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)
  return polygonsFromTree(tree)
}

function polygonsFromTree(tree: ClipperLib.PolyTree): MultiPolygon {
  const result: MultiPolygon = []
  const ring = (node: ClipperLib.PolyNode): Polygon[number] => {
    const points = node.Contour().map(({ X, Y }): [number, number] => [X / SCALE, Y / SCALE])
    if (points.length) points.push([...points[0]!])
    return points
  }
  const visit = (node: ClipperLib.PolyNode) => {
    if (node.Contour().length && !node.IsHole()) {
      result.push([ring(node), ...node.Childs().filter((child) => child.IsHole()).map(ring)])
    }
    for (const child of node.Childs()) visit(child)
  }
  visit(tree)
  return result
}

export const pavingPolygons = {
  intersection: (a: Geometry, b: Geometry): MultiPolygon => run(ClipperLib.ClipType.ctIntersection, a, [b]),
  difference: (a: Geometry, ...b: Geometry[]): MultiPolygon => run(ClipperLib.ClipType.ctDifference, a, b),
  union: (a: Geometry, ...b: Geometry[]): MultiPolygon => run(ClipperLib.ClipType.ctUnion, a, b),
  inset: (a: Geometry, distance: number): MultiPolygon => {
    const offset = new ClipperLib.ClipperOffset(2, 0.01 * SCALE)
    offset.AddPaths(paths(a), ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon)
    const tree = new ClipperLib.PolyTree()
    offset.Execute(tree, -distance * SCALE)
    return polygonsFromTree(tree)
  },
}
