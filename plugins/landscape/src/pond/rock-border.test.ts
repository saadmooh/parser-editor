import { expect, test } from 'bun:test'
import { Group, Mesh } from 'three'
import { PondNode } from './schema'
import { MAX_BORDER_ROCKS, pondRockBorder } from './rock-border'
import { createPondTerrainField } from './terrain'
import { addPondRocks } from './rocks'
import { buildPondFloorplan, disposePondGeometry } from './geometry'
import { borderRockGeometry } from './border-rock-geometry'

test('new ponds use fitted stone; border settings survive saved-data parsing', () => {
  expect(PondNode.parse({}).rockBorder).toBe('stone')
  expect(PondNode.parse({rockBorder:'clusters'}).rockBorder).toBe('clusters')
  const node = PondNode.parse({ rockBorder: 'continuous', rockBorderPlacement: 'both', rockBorderSize: .6, rockBorderSeed: 17 })
  expect(PondNode.parse(JSON.parse(JSON.stringify(node)))).toEqual(node)
  expect(PondNode.safeParse({ rockBorderSize: NaN }).success).toBe(false)
})

test('continuous borders cover all four sides and both contours of a rectangular bank', () => {
  const node = PondNode.parse({ shape: 'rectangle', width: 6, depth: 4, bankWidth: .5, rockBorder: 'continuous', rockBorderPlacement: 'both', rockBorderPositionVariation: 0 })
  const rocks = pondRockBorder(node)
  for (const [axis, values] of [[0, [-3, 3, -3.5, 3.5]], [1, [-2, 2, -2.5, 2.5]]] as const)
    for (const value of values) expect(rocks.some(rock => Math.abs((axis === 0 ? rock.x : rock.z) - value) < .0001)).toBe(true)
  expect(pondRockBorder({ ...node, rockBorderPlacement: 'outer' }).every(rock => Math.abs(rock.x) >= 3.4999 || Math.abs(rock.z) >= 2.4999)).toBe(true)
})

test('curved and concave borders are finite, deterministic and bounded at maximum detail', () => {
  for (const shape of ['circle', 'oval', 'custom', 'freehand'] as const) {
    const node = PondNode.parse({ shape, width: 30, depth: 30, rockBorder: 'continuous', rockBorderPlacement: 'both', rockBorderSize: .15,
      outline: [[-.5,-.5],[.5,-.5],[.5,.5],[0,0],[-.5,.5]] })
    const rocks = pondRockBorder(node)
    expect(rocks.length).toBeGreaterThan(0)
    expect(rocks.length).toBeLessThanOrEqual(MAX_BORDER_ROCKS)
    expect(rocks.every(rock => Object.values(rock).every(Number.isFinite) && rock.size > 0)).toBe(true)
    expect(pondRockBorder(node)).toEqual(rocks)
    expect(pondRockBorder({ ...node, rockBorderSeed: 18 })).not.toEqual(rocks)
  }
})

test('border rendering follows terrain, works over gravel and agrees with plan symbols', () => {
  const node = PondNode.parse({ rockBorder: 'continuous', rockBorderPlacement: 'both', bank: 'gravel' })
  const group = new Group(), field = createPondTerrainField(node)
  addPondRocks(group, node, { ...field, height: () => 2 })
  const border = group.children.filter((object): object is Mesh => object instanceof Mesh && object.userData.pondRockBorder)
  expect(group.userData.pondRockObstacles.filter((rock: { kind: string }) => rock.kind === 'pond-shore-rock').length).toBe(pondRockBorder(node).length)
  expect(border.length).toBeLessThanOrEqual(8)
  expect(border.every(rock => rock.geometry.boundingBox!.min.y > 1.5)).toBe(true)
  const plan = buildPondFloorplan(node, {} as never)
  expect(plan.kind).toBe('group')
  if (plan.kind === 'group') expect(plan.children.filter(child => child.kind === 'circle').length).toBe(pondRockBorder(node).length)
  disposePondGeometry(group)
})

test('turning border rocks off preserves underwater rock detail', () => {
  const node = PondNode.parse({ rockBorder: 'none' }), group = new Group()
  addPondRocks(group, node, createPondTerrainField(node))
  expect(group.children.some(rock => rock.name === 'pond-shore-rock')).toBe(false)
  expect(group.getObjectByName('pond-underwater-pebbles')).toBeDefined()
  disposePondGeometry(group)
})

test('saved seed reproduces distinct boulders with different silhouettes and proportions', () => {
  const node = PondNode.parse({ rockBorder: 'continuous' })
  const designs = pondRockBorder(node)
  const signatures = new Set<string>(), families = new Set<string>()
  for (const design of designs.slice(0, 30)) {
    const first = borderRockGeometry(node, design.shapeSeed), second = borderRockGeometry(node, design.shapeSeed)
    expect([...first.getAttribute('position').array]).toEqual([...second.getAttribute('position').array])
    expect([...first.getAttribute('position').array].every(Number.isFinite)).toBe(true)
    const box = first.boundingBox!
    expect(Math.max(box.max.x - box.min.x, box.max.z - box.min.z)).toBeCloseTo(1, 5)
    signatures.add(JSON.stringify([...first.getAttribute('position').array].slice(0, 24)))
    families.add(first.type)
    first.dispose(); second.dispose()
  }
  expect(signatures.size).toBe(Math.min(30, designs.length))
  expect(families.size).toBe(2)
  expect(new Set(designs.map(rock => rock.height)).size).toBeGreaterThan(10)
  expect(new Set(designs.map(rock => rock.aspect)).size).toBeGreaterThan(10)
})

test('variation sliders independently control placement, proportions and rotation', () => {
  const base = PondNode.parse({ rockBorder: 'continuous', rockBorderPositionVariation: 0, rockBorderHeightVariation: 0,
    rockBorderRotationVariation: 0, rockBorderShapeVariation: 0, rockBorderVariation: 0 })
  const uniform = pondRockBorder(base)
  expect(uniform.every(rock => rock.size === base.rockBorderSize && rock.height === .75 && rock.aspect === 1 && rock.tiltX === 0 && rock.tiltZ === 0)).toBe(true)
  const moved = pondRockBorder({ ...base, rockBorderPositionVariation: 1 })
  expect(moved.some((rock, index) => rock.x !== uniform[index]!.x || rock.z !== uniform[index]!.z)).toBe(true)
  expect(moved.every((rock, index) => rock.shapeSeed === uniform[index]!.shapeSeed && rock.size === uniform[index]!.size)).toBe(true)
  const tall = pondRockBorder({ ...base, rockBorderHeightVariation: 1 })
  expect(tall.some(rock => rock.height !== .75)).toBe(true)
  expect(tall.every((rock, index) => rock.x === uniform[index]!.x && rock.z === uniform[index]!.z)).toBe(true)
})

test('unique border silhouettes are baked into at most eight draw calls with local texture coordinates', () => {
  const node = PondNode.parse({ rockBorder: 'continuous' }), group = new Group()
  addPondRocks(group, node, createPondTerrainField(node))
  const border = group.children.filter((object): object is Mesh => object instanceof Mesh && object.userData.pondRockBorder)
  expect(border.length).toBeLessThanOrEqual(8)
  expect(new Set(border.map(rock => rock.geometry)).size).toBe(border.length)
  expect(new Set(border.map(rock => rock.material)).size).toBeGreaterThan(1)
  expect(new Set(border.map(rock => rock.material)).size).toBeLessThanOrEqual(8)
  expect(border.every(rock => rock.geometry.getAttribute('rockLocalPosition').count === rock.geometry.getAttribute('position').count)).toBe(true)
  expect(border.every(rock => rock.geometry.getAttribute('rockLocalNormal').count === rock.geometry.getAttribute('normal').count)).toBe(true)
  disposePondGeometry(group)
})

test('flat stone border owns corners, stays low and follows straight and curved shores', () => {
  const rectangle=PondNode.parse({shape:'rectangle',width:6,depth:4})
  const designs=pondRockBorder(rectangle)
  expect(designs.every(stone=>stone.height<.17&&stone.stoneFootprint!.length>=4)).toBe(true)
  for(const [x,z] of [[-3,-2],[3,-2],[3,2],[-3,2]]){
    const corner=designs.filter(stone=>Math.hypot(stone.x-x!,stone.z-z!)<.001)
    expect(corner).toHaveLength(1)
    expect(corner[0]!.stoneFootprint!.length).toBe(8)
  }
  for(const shape of ['oval','circle','custom'] as const){
    const node=PondNode.parse({shape,width:30,depth:30,rockBorderPlacement:'both',rockBorderSize:.15,
      outline:[[-.5,-.5],[.5,-.5],[.5,.5],[0,0],[-.5,.5]]})
    const border=pondRockBorder(node)
    expect(border.length).toBeLessThanOrEqual(MAX_BORDER_ROCKS)
    expect(border).toEqual(pondRockBorder(node))
    expect(border.every(stone=>stone.stoneFootprint!.flat().every(Number.isFinite))).toBe(true)
  }
  const group=new Group();addPondRocks(group,rectangle,createPondTerrainField(rectangle))
  const batches=group.children.filter((object):object is Mesh=>object instanceof Mesh&&object.userData.pondRockBorder)
  expect(batches.length).toBeLessThanOrEqual(8)
  expect(group.getObjectByName('pond-shore-rock-batch')).toBeUndefined()
  const plan=buildPondFloorplan(rectangle,{} as never)
  if(plan.kind==='group')expect(plan.children.filter(child=>child.kind==='circle')).toHaveLength(0)
  for(const batch of batches)expect(Array.from(batch.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true)
  disposePondGeometry(group)
})
