import type { BufferGeometry } from 'three'
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js'
import { edgeGradeProfile } from '../domain/grade'
import type { PathwayNode } from '../domain/schema'
import { pathComponents } from '../domain/components'

/** One shared height field keeps backing, border and paving elevations aligned. */
export function pathwayGradeField(path: PathwayNode) {
  const components = pathComponents(path).map((component) => component.edges.map((edge) => {
    const profile = edgeGradeProfile(path, edge)
    return profile.samples.slice(1).map((end, index) => ({ start: profile.samples[index]!, end }))
  }))
  return (x: number, z: number) => {
    const candidates = components.map((edges) => edges.map((segments) => {
      let nearest = Infinity, height = path.elevation
      for (const { start, end } of segments) {
        const dx = end.point[0] - start.point[0], dz = end.point[1] - start.point[1]
        const length2 = dx * dx + dz * dz
        const t = length2 ? Math.max(0, Math.min(1, ((x - start.point[0]) * dx + (z - start.point[1]) * dz) / length2)) : 0
        const distance2 = (x - start.point[0] - dx * t) ** 2 + (z - start.point[1] - dz * t) ** 2
        if (distance2 < nearest) { nearest = distance2; height = start.elevation + (end.elevation - start.elevation) * t }
      }
      return { distance2: nearest, height }
    }))
    const minimum = (items: { distance2: number }[]) => items.reduce((best, item) => Math.min(best, item.distance2), Infinity)
    const component = candidates.reduce<typeof candidates[number] | undefined>((best, items) => !best || minimum(items) < minimum(best) ? items : best, undefined)
    if (!component?.length) return 0
    const nearest = minimum(component)
    if (!Number.isFinite(nearest)) return 0
    if (nearest < 1e-12) return component.find((item) => item.distance2 === nearest)!.height - path.elevation
    // Smooth branch transitions instead of selecting a discontinuous Voronoi
    // height. Normalize by nearest distance to keep weights finite; exact
    // centerlines retain their authored heights. Disconnected routes do not mix.
    let weighted = 0, weights = 0
    for (const item of component) {
      const weight = (nearest / item.distance2) ** 2
      weighted += item.height * weight; weights += weight
    }
    return weighted / weights - path.elevation
  }
}

export function gradePathwayMesh(geometry: BufferGeometry, heightAt: (x: number, z: number) => number) {
  // Refine broad caps before bending them; extrusion's original triangulation
  // alone cannot follow nonlinear grade along curved routes.
  const graded = new TessellateModifier(0.25, 6).modify(geometry)
  const position = graded.getAttribute('position')
  for (let index = 0; index < position.count; index++) position.setY(index, position.getY(index) + heightAt(position.getX(index), position.getZ(index)))
  graded.computeVertexNormals()
  graded.computeBoundingBox()
  graded.computeBoundingSphere()
  return graded
}
