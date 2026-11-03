import { commitTerrainField, createTerrainField, heightAt, persistedTerrainFieldOf, quantize,
  SiteNode, TerrainData, getLevelElevations, type TerrainField, type AnyNode, type GeometryContext } from '@pascal-app/core'
import { PondNode } from './schema'
import { createPondTerrainField } from './terrain'

export const POND_TERRAIN_METADATA = 'landscape:pond-terrain'
type Nodes = NonNullable<GeometryContext['sceneNodes']>
type TerrainOwner = { version: 1; baseline: TerrainData | null; applied: TerrainData; signature: string }

export function pondSiteFrame(node: Pick<PondNode, 'position' | 'rotation' | 'parentId'>, nodes?: Nodes) {
  if (!nodes) return null
  let x = node.position[0], y = node.position[1], z = node.position[2], yaw = node.rotation[1]
  let id = node.parentId
  const seen = new Set<string>()
  while (id && !seen.has(id)) {
    seen.add(id)
    const parent = nodes[id as keyof Nodes] as AnyNode | undefined
    if (!parent) return null
    if (parent.visible === false) return null
    if (parent.type === 'site') {
      const parsed = SiteNode.safeParse(parent)
      return parsed.success ? { site: parsed.data, x, y, z, yaw } : null
    }
    const transform = parent as unknown as { position?: number[]; rotation?: number[] }
    const angle = transform.rotation?.[1] ?? 0, c = Math.cos(angle), s = Math.sin(angle)
    const nextX = x * c + z * s + (transform.position?.[0] ?? 0)
    z = z * c - x * s + (transform.position?.[2] ?? 0)
    x = nextX
    // LevelSystem supplies computed stack elevation, not a stored position.y.
    y += parent.type === 'level' ? getLevelElevations(nodes).get(parent.id)?.baseY ?? 0 : transform.position?.[1] ?? 0
    yaw += angle
    id = parent.parentId
  }
  return null
}

function ownerOf(site: SiteNode): TerrainOwner | null {
  const raw = site.metadata[POND_TERRAIN_METADATA] as TerrainOwner | undefined
  if (raw?.version !== 1 || !TerrainData.safeParse(raw.applied).success ||
    (raw.baseline !== null && !TerrainData.safeParse(raw.baseline).success)) return null
  return raw
}
const sameTerrain = (a: TerrainData | null | undefined, b: TerrainData | null | undefined) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
export function pondBaselineField(site: SiteNode) {
  const owner = ownerOf(site)
  return owner ? persistedTerrainFieldOf({ terrain: owner.baseline ?? undefined }) : persistedTerrainFieldOf(site)
}

export function pondSiteDesign(node: PondNode, nodes?: Nodes) {
  const frame = pondSiteFrame(node, nodes)
  if (!frame) return { node, frame: null }
  const baseline = pondBaselineField(frame.site)
  const datum = baseline ? heightAt(baseline, frame.x, frame.z) : 0
  return { node: { ...node, elevation: datum + node.elevation - frame.y }, frame }
}

export function pondSiteSurfaceField(node: PondNode, nodes?: Nodes) {
  const { node: design, frame } = pondSiteDesign(node, nodes)
  const profile = createPondTerrainField(design)
  const terrain = frame && persistedTerrainFieldOf(frame.site)
  if (!frame || !terrain) return { design, field: profile }
  const c = Math.cos(frame.yaw), s = Math.sin(frame.yaw)
  return { design, field: { ...profile, height: (x: number, z: number) =>
    heightAt(terrain, frame.x + x * c + z * s, frame.z + z * c - x * s) - frame.y } }
}

/** Derived excavation is saved with a recoverable, unexcavated site baseline. */
export function resolvePondTerrainPatch(site: SiteNode, nodes: Nodes) {
  const ponds = Object.values(nodes).flatMap(raw => {
    if ((raw.type as string) !== 'landscape:pond' || raw.visible === false) return []
    const parsed = PondNode.safeParse(raw)
    if (!parsed.success) return []
    const frame = pondSiteFrame(parsed.data, nodes)
    return frame?.site.id === site.id ? [{ node: parsed.data, frame }] : []
  }).sort((a, b) => a.node.id.localeCompare(b.node.id))
  const owner = ownerOf(site)
  if (!ponds.length && !owner) return null
  const signature = JSON.stringify([2, site.polygon, ponds.map(({ node, frame }) => [node.id, frame.x, frame.y, frame.z, frame.yaw,
    node.width, node.depth, node.outline, node.shape, node.elevation, node.basinDepth, node.bankWidth, node.thickness])])
  if (owner?.signature === signature && sameTerrain(site.terrain, owner.applied)) return null
  let baselineData = owner ? owner.baseline : site.terrain ?? null
  // A Terrain brush/import since our last application is an edit to the baseline.
  if (owner && !sameTerrain(site.terrain, owner.applied)) {
    const current = persistedTerrainFieldOf(site)
    const applied = persistedTerrainFieldOf({ terrain: owner.applied })
    const original = persistedTerrainFieldOf({ terrain: owner.baseline ?? undefined })
    if (current && applied) {
      const restored = { ...current, heights: current.heights.slice() }
      for (let row = 0; row < current.rows; row++) for (let col = 0; col < current.cols; col++) {
        const x = current.origin[0] + col * current.spacing, z = current.origin[1] + row * current.spacing
        const old = original ? heightAt(original, x, z) : 0
        restored.heights[row * current.cols + col] = quantize(current, old + heightAt(current, x, z) - heightAt(applied, x, z))
      }
      baselineData = commitTerrainField(restored)
    } else baselineData = site.terrain ?? null
  }
  const metadata = { ...site.metadata }
  if (!ponds.length) {
    delete metadata[POND_TERRAIN_METADATA]
    return { terrain: baselineData ?? undefined, metadata }
  }
  const baseline = persistedTerrainFieldOf({ terrain: baselineData ?? undefined })
  const points = [...site.polygon.points]
  const profiles = ponds.map(({ node, frame }) => {
    const datum = baseline ? heightAt(baseline, frame.x, frame.z) : 0
    const profile = createPondTerrainField({ ...node, elevation: datum + node.elevation })
    const c = Math.cos(frame.yaw), s = Math.sin(frame.yaw)
    for (const [x, z] of [[profile.bounds.minX, profile.bounds.minZ], [profile.bounds.maxX, profile.bounds.minZ],
      [profile.bounds.maxX, profile.bounds.maxZ], [profile.bounds.minX, profile.bounds.maxZ]])
      points.push([frame.x + x! * c + z! * s, frame.z + z! * c - x! * s])
    return { profile, frame, c, s }
  })
  const pad = 1, minX = Math.min(Math.min(...points.map(p => p[0])) - pad, baseline?.origin[0] ?? Infinity)
  const minZ = Math.min(Math.min(...points.map(p => p[1])) - pad, baseline?.origin[1] ?? Infinity)
  const maxX = Math.max(Math.max(...points.map(p => p[0])) + pad, baseline ? baseline.origin[0] + (baseline.cols - 1) * baseline.spacing : -Infinity)
  const maxZ = Math.max(Math.max(...points.map(p => p[1])) + pad, baseline ? baseline.origin[1] + (baseline.rows - 1) * baseline.spacing : -Infinity)
  const span = Math.max(maxX - minX, maxZ - minZ)
  const field = createTerrainField({ cols: 257, rows: 257, spacing: span / 256, origin: [minX, minZ], step: .005 })
  for (let row = 0; row < field.rows; row++) for (let col = 0; col < field.cols; col++) {
    const x = minX + col * field.spacing, z = minZ + row * field.spacing
    let y = baseline ? heightAt(baseline, x, z) : 0
    let excavated = false
    for (const { profile, frame, c, s } of profiles) {
      const dx = x - frame.x, dz = z - frame.z, px = dx * c - dz * s, pz = dz * c + dx * s
      if (px < profile.bounds.minX || px > profile.bounds.maxX || pz < profile.bounds.minZ || pz > profile.bounds.maxZ) continue
      const blend = profile.blendAt(px, pz)
      if (blend <= 0) continue
      const target = profile.height(px, pz)
      if (profile.radial(px, pz) <= 1) { y = excavated ? Math.min(y, target) : target; excavated = true }
      else if (!excavated) y = y * (1 - blend) + target * blend
    }
    field.heights[row * field.cols + col] = quantize(field, y)
  }
  const terrain = commitTerrainField(field)
  metadata[POND_TERRAIN_METADATA] = { version: 1, baseline: baselineData, applied: terrain, signature } satisfies TerrainOwner
  return { terrain, metadata }
}
