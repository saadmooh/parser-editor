import { expect, test } from 'bun:test'
import { commitTerrainField, createTerrainField, heightAt, persistedTerrainFieldOf, SiteNode, type GeometryContext } from '@pascal-app/core'
import { PondNode } from './schema'
import { pondSiteFrame, pondSiteSurfaceField, resolvePondTerrainPatch, POND_TERRAIN_METADATA } from './site-terrain'
import { buildPondGeometry, disposePondGeometry } from './geometry'

const site = SiteNode.parse({ id: 'site_pondtest' })
const pond = PondNode.parse({ id: 'pond_earth', parentId: site.id, width: 5, depth: 4 })
type Nodes = NonNullable<GeometryContext['sceneNodes']>
const nodesOf = (ground: typeof site, ponds: PondNode[] = [pond]) => Object.fromEntries([ground, ...ponds].map(node => [node.id, node])) as Nodes
const apply = (ground: typeof site, ponds: PondNode[]) => {
  const patch = resolvePondTerrainPatch(ground, nodesOf(ground, ponds))
  return patch ? SiteNode.parse({ ...ground, ...patch }) : ground
}

test('pond excavates the actual site field and supplies only water and rocks', () => {
  const excavated = apply(site, [pond])
  const field = persistedTerrainFieldOf(excavated)!
  expect(heightAt(field, 0, 0)).toBeLessThan(-.7)
  expect(heightAt(field, 10, 10)).toBe(0)
  const group = buildPondGeometry(pond, { sceneNodes: nodesOf(excavated) } as GeometryContext)
  expect(group.getObjectByName('pond-terrain')).toBeUndefined()
  expect(group.getObjectByName('pond-water')).toBeDefined()
  expect(group.getObjectByName('pond-rock-border-batch')).toBeDefined()
  disposePondGeometry(group)
  expect(resolvePondTerrainPatch(excavated, nodesOf(excavated))).toBeNull()
})

test('move, resize, hide and delete restore the original site including an untouched flat datum', () => {
  const first = apply(site, [pond])
  const moved = { ...pond, position: [8, 0, 0] as [number, number, number], width: 3 }
  const second = apply(first, [moved])
  const field = persistedTerrainFieldOf(second)!
  expect(heightAt(field, 0, 0)).toBe(0)
  expect(heightAt(field, 8, 0)).toBeLessThan(-.7)
  const hidden = apply(second, [{ ...moved, visible: false }])
  expect(hidden.terrain).toBeUndefined()
  expect(hidden.metadata[POND_TERRAIN_METADATA]).toBeUndefined()
  const deleted = apply(second, [])
  expect(deleted.terrain).toBeUndefined()
  // Undo/redo scene snapshots recompute from the recorded unexcavated baseline.
  const undone = apply(second, [pond])
  expect(heightAt(persistedTerrainFieldOf(undone)!, 0, 0)).toBeLessThan(-.7)
  expect(heightAt(persistedTerrainFieldOf(undone)!, 8, 0)).toBe(0)
})

test('existing slopes and later Terrain brush edits survive excavation removal and saved reload', () => {
  const base = createTerrainField({ origin: [-16, -16], spacing: .5, cols: 65, rows: 65 })
  base.heights.fill(50)
  const original = SiteNode.parse({ ...site, terrain: commitTerrainField(base) })
  const first = apply(original, [pond])
  const sculpt = persistedTerrainFieldOf(first)!
  const edited = { ...sculpt, heights: sculpt.heights.slice() }
  const index = 220 * edited.cols + 220
  edited.heights[index] = edited.heights[index]! + 100
  const withBrush = SiteNode.parse({ ...first, terrain: commitTerrainField(edited) })
  const saved = SiteNode.parse(JSON.parse(JSON.stringify(apply(withBrush, [pond]))))
  const restored = apply(saved, [])
  const restoredField = persistedTerrainFieldOf(restored)!
  const x = edited.origin[0] + 220 * edited.spacing, z = edited.origin[1] + 220 * edited.spacing
  expect(heightAt(restoredField, 0, 0)).toBeCloseTo(.5, 2)
  expect(heightAt(restoredField, x, z)).toBeCloseTo(1, 2)
})

test('multiple ponds compose deterministically and removing one preserves the other', () => {
  const other = PondNode.parse({ ...pond, id: 'pond_other', position: [8, 0, 0] })
  const both = apply(site, [pond, other])
  const reverse = apply(site, [other, pond])
  expect(both.terrain).toEqual(reverse.terrain)
  const remaining = apply(both, [other])
  expect(heightAt(persistedTerrainFieldOf(remaining)!, 0, 0)).toBe(0)
  expect(heightAt(persistedTerrainFieldOf(remaining)!, 8, 0)).toBeLessThan(-.7)
})

test('banks blend into an existing slope without a step at the shoreline', () => {
  const slope = createTerrainField({ origin: [-16, -16], spacing: .5, cols: 65, rows: 65 })
  for (let row = 0; row < slope.rows; row++) for (let col = 0; col < slope.cols; col++)
    slope.heights[row * slope.cols + col] = Math.round((-16 + col * .5) * .1 / slope.step)
  const original = SiteNode.parse({ ...site, terrain: commitTerrainField(slope) })
  const circular = PondNode.parse({ ...pond, shape: 'circle', width: 6, bankWidth: .6 })
  const field = persistedTerrainFieldOf(apply(original, [circular]))!
  expect(heightAt(field, 3.1, 0)).toBeLessThan(.12)
  expect(heightAt(field, 8, 0)).toBeCloseTo(.8, 2)
})

test('excavation and water use the same transformed coordinates and baseline datum', () => {
  const building = { id: 'building_pond', type: 'building', parentId: site.id, position: [5, 1, 3], rotation: [0, Math.PI / 2, 0] }
  const hosted = { ...pond, parentId: building.id, position: [2, 0, 0] as [number, number, number] }
  const nodes = { ...nodesOf(site, [hosted]), [building.id]: building } as unknown as Nodes
  const patch = resolvePondTerrainPatch(site, nodes)!
  const excavated = SiteNode.parse({ ...site, ...patch })
  const next = { ...nodes, [site.id]: excavated }
  const frame = pondSiteFrame(hosted, next)!
  expect(frame.x).toBeCloseTo(5)
  expect(frame.z).toBeCloseTo(1)
  const { design, field } = pondSiteSurfaceField(hosted, next)
  expect(design.elevation + frame.y).toBeCloseTo(0)
  expect(field.height(0, 0) + frame.y).toBeCloseTo(heightAt(persistedTerrainFieldOf(excavated)!, 5, 1))
})

test('pond remains at the site datum when a basement is added, resized or removed', () => {
  const building = { id:'building_basement_pond',type:'building',parentId:site.id,children:['level_ground_pond'] }
  const ground = { id:'level_ground_pond',type:'level',parentId:building.id,level:0,height:2.5,baseElevation:0 }
  const hosted = PondNode.parse({ ...pond,parentId:ground.id })
  const base = { ...nodesOf(site,[hosted]),[building.id]:building,[ground.id]:ground } as unknown as Nodes
  for (const height of [0,2.5,4,0]) {
    const basement = { id:'level_basement_pond',type:'level',parentId:building.id,level:-1,height,baseElevation:0 }
    const nodes = height ? { ...base,[basement.id]:basement } as Nodes : base
    const frame = pondSiteFrame(hosted,nodes)!
    expect(frame.y).toBeCloseTo(height)
    const patch = resolvePondTerrainPatch(site,nodes)!
    const excavated = SiteNode.parse({ ...site,...patch })
    const current = { ...nodes,[site.id]:excavated }
    const { design,field } = pondSiteSurfaceField(hosted,current)
    expect(design.elevation+frame.y).toBeCloseTo(0)
    expect(field.height(0,0)+frame.y).toBeCloseTo(heightAt(persistedTerrainFieldOf(excavated)!,0,0))
    const group = buildPondGeometry(hosted,{ sceneNodes:current } as GeometryContext)
    try {
      expect(group.getObjectByName('pond-water')!.position.y+frame.y).toBeCloseTo(-hosted.waterDrop)
      const rocks = group.getObjectByName('pond-rocks') as import('three').Group
      expect(rocks.userData.pondRockObstacles.every((rock:{ top:number }) => Number.isFinite(rock.top+frame.y))).toBe(true)
    } finally { disposePondGeometry(group) }
  }
})

test('resize arrows share the pond datum above a basement', async () => {
  const { pondDefinition } = await import('./definition')
  const building = { id:'building_arrow_pond',type:'building',parentId:site.id,children:['level_arrow_ground','level_arrow_basement'] }
  const ground = { id:'level_arrow_ground',type:'level',parentId:building.id,level:0,height:2.5 }
  const basement = { id:'level_arrow_basement',type:'level',parentId:building.id,level:-1,height:3 }
  const hosted = PondNode.parse({ ...pond,parentId:ground.id,elevation:.1 })
  const nodes = { ...nodesOf(site,[hosted]),[building.id]:building,[ground.id]:ground,[basement.id]:basement } as unknown as Nodes
  const handles = typeof pondDefinition.handles === 'function' ? pondDefinition.handles(hosted) : pondDefinition.handles!
  const scene = { nodes:()=>nodes } as unknown as import('@pascal-app/core').SceneApi
  const frame = pondSiteFrame(hosted,nodes)!
  for (const handle of handles) {
    if (handle.kind !== 'linear-resize') continue
    const position = handle.placement.position(hosted,scene)
    expect(position[1]+frame.y).toBeCloseTo(hosted.elevation+.2)
  }
  const without = { ...nodes };delete without[basement.id as keyof Nodes]
  for (const handle of handles) {
    if (handle.kind !== 'linear-resize') continue
    expect(handle.placement.position(hosted,{ nodes:()=>without } as unknown as import('@pascal-app/core').SceneApi)[1]).toBeCloseTo(hosted.elevation+.2)
  }
})
