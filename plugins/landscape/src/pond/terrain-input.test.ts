import { expect, test } from 'bun:test'
import { SiteNode } from '@pascal-app/core'
import { PondNode } from './schema'
import { pondTerrainInputKey, pondTerrainAppearanceKey } from './terrain-input'

test('terrain invalidation ignores water, rocks and unrelated scene edits', () => {
  const site = SiteNode.parse({}), pond = PondNode.parse({ parentId: site.id })
  const nodes = { [site.id]: site, [pond.id]: pond }
  const key = pondTerrainInputKey(nodes as never)
  expect(pondTerrainInputKey({ ...nodes, [pond.id]: { ...pond, waterClarity: 2, rockBorderSize: 1, fishCount: 6 } } as never)).toBe(key)
  expect(pondTerrainInputKey({ ...nodes, unrelated: { id: 'unrelated', type: 'item', position: [2, 0, 0] } } as never)).toBe(key)
  for (const patch of [{ width: 6 }, { position: [2, 0, 0] }, { visible: false }, { parentId: null }])
    expect(pondTerrainInputKey({ ...nodes, [pond.id]: { ...pond, ...patch } } as never)).not.toBe(key)
  expect(pondTerrainInputKey({ [site.id]: site } as never)).not.toBe(key)
})

test('parent transforms and visibility invalidate pond terrain', () => {
  const site = SiteNode.parse({}), parent = { id: 'parent', type: 'level', parentId: site.id, position: [0, 0, 0], visible: true }
  const pond = PondNode.parse({ parentId: parent.id })
  const nodes = { [site.id]: site, [parent.id]: parent, [pond.id]: pond }
  const key = pondTerrainInputKey(nodes as never)
  expect(pondTerrainInputKey({ ...nodes, parent: { ...parent, position: [2, 0, 0] } } as never)).not.toBe(key)
  expect(pondTerrainInputKey({ ...nodes, parent: { ...parent, visible: false } } as never)).not.toBe(key)
})

test('sibling basement and floor-height changes invalidate the pond parent datum', () => {
  const site = SiteNode.parse({})
  const building = { id:'building_datum',type:'building',parentId:site.id,children:['level_datum'] }
  const ground = { id:'level_datum',type:'level',parentId:building.id,level:0,height:2.5 }
  const pond = PondNode.parse({ parentId:ground.id })
  const nodes = { [site.id]:site,[building.id]:building,[ground.id]:ground,[pond.id]:pond }
  const basement = { id:'level_basement',type:'level',parentId:building.id,level:-1,height:2.5 }
  const key = pondTerrainInputKey(nodes as never)
  const withBasement = { ...nodes,[basement.id]:basement }
  expect(pondTerrainInputKey(withBasement as never)).not.toBe(key)
  expect(pondTerrainInputKey({ ...withBasement,[basement.id]:{ ...basement,height:4 } } as never))
    .not.toBe(pondTerrainInputKey(withBasement as never))
})

test('bed finishes persist and refresh appearance without re-excavating terrain', () => {
  const site=SiteNode.parse({}), first=PondNode.parse({parentId:site.id}), second=PondNode.parse({parentId:site.id,bedSurface:'sand'})
  const nodes={ [site.id]:site,[first.id]:first,[second.id]:second }
  const terrain=pondTerrainInputKey(nodes as never), appearance=pondTerrainAppearanceKey(nodes as never)
  expect(first.bedSurface).toBe('silt')
  for(const bedSurface of ['sand','gravel','river-stone','algae'] as const) {
    const updated=PondNode.parse({...first,bedSurface})
    expect(PondNode.parse(JSON.parse(JSON.stringify(updated))).bedSurface).toBe(bedSurface)
    const next={...nodes,[first.id]:updated}
    expect(pondTerrainInputKey(next as never)).toBe(terrain)
    expect(pondTerrainAppearanceKey(next as never)).not.toBe(appearance)
    expect(PondNode.parse(next[second.id]).bedSurface).toBe('sand')
  }
  expect(PondNode.safeParse({...first,bedSurface:'invalid'}).success).toBe(false)
})
