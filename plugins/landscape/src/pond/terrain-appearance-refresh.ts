import type { Mesh } from 'three'

export function hasPondTerrainAttributes(mesh: Mesh) {
  const count = mesh.geometry.getAttribute('position')?.count
  return count !== undefined && ['pondBlend', 'pondLocalXZ', 'pondDatum', 'pondBedSurface'].every(name =>
    mesh.geometry.getAttribute(name)?.count === count)
}

/** Keep the expensive terrain walk throttled while nothing affecting its shader changed. */
export function shouldRefreshPondTerrainAppearance(
  elapsed: number,
  next: number,
  profiles: unknown,
  previousProfiles: unknown,
  styles: ReadonlyMap<Mesh, { geometryId: string }>,
) {
  if (profiles !== previousProfiles || elapsed >= next) return true
  // Pool openings rebuild the host terrain independently of pond profiles.
  // Never leave its pond shader attached to geometry without its vertex inputs
  // until the next throttled sweep.
  for (const [mesh, state] of styles) {
    if (mesh.geometry.uuid !== state.geometryId || !hasPondTerrainAttributes(mesh)) return true
  }
  return false
}
