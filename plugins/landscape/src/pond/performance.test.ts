import { expect, test } from 'bun:test'
import { Mesh } from 'three'
import { PondNode } from './schema'
import { buildPondGeometry, disposePondGeometry, updatePondDetails } from './geometry'
import { getPondFishState } from './fish'
import { getPondWaterState, pausePondWater, updatePondWater } from './water'

test('rock and fish edits preserve unaffected meshes and GPU resources', async () => {
  const node = PondNode.parse({ rockBorder: 'continuous', fishCount: 6 })
  const group = buildPondGeometry(node), water = group.getObjectByName('pond-water') as Mesh
  const state = getPondWaterState(water)!, fish = getPondFishState(group)!
  const rocks = group.getObjectByName('pond-rocks')
  updatePondDetails(group, { ...node, rockBorderMoss: .8, rockBorderColorVariation: .9 })
  expect(group.getObjectByName('pond-rocks')).toBe(rocks)
  updatePondDetails(group, { ...node, rockBorderSeed: 123 })
  expect(group.getObjectByName('pond-rocks')).not.toBe(rocks)
  expect(getPondFishState(group)).toBe(fish)
  expect(getPondWaterState(water)).toBe(state)
  const replacement = group.getObjectByName('pond-rocks')
  updatePondDetails(group, { ...node, rockBorderSeed: 123, fishCount: 3 })
  expect(group.getObjectByName('pond-rocks')).toBe(replacement)
  expect(getPondFishState(group)!.fish).toHaveLength(3)
  expect(group.getObjectByName('pond-water')).toBe(water)
  await Promise.resolve()
  disposePondGeometry(group)
})

test('lightweight preview restores indexed full detail on commit', () => {
  const node = PondNode.parse({ width: 8, depth: 6 })
  const preview = buildPondGeometry(node, undefined, true), full = buildPondGeometry(node)
  const a = (preview.getObjectByName('pond-water') as Mesh).geometry
  const b = (full.getObjectByName('pond-water') as Mesh).geometry
  expect(a.index).not.toBeNull()
  expect(b.index).not.toBeNull()
  expect(a.getAttribute('position').count).toBeLessThan(b.getAttribute('position').count / 2)
  expect(b.getAttribute('position').count).toBeLessThan(b.index!.count / 2)
  disposePondGeometry(preview); disposePondGeometry(full)
})

test('Pool surface stays live while skipped frames do not advance simulation', () => {
  const group = buildPondGeometry(PondNode.parse({ fishCount: 2 }))
  const water = group.getObjectByName('pond-water') as Mesh, state = getPondWaterState(water)!
  updatePondWater(group, .016)
  const time = state.time.value, positions = getPondFishState(group)!.fish.map(fish => fish.mesh.position.clone())
  pausePondWater(group, 120)
  expect(state.time.value).toBe(time)
  expect(getPondFishState(group)!.fish.every((fish, index) => fish.mesh.position.equals(positions[index]!))).toBe(true)
  updatePondWater(group, 120.016)
  expect(state.time.value).toBeCloseTo(time + .016)
  disposePondGeometry(group)
})

test('wave texture uploads are capped while animation time remains smooth', () => {
  const group = buildPondGeometry(PondNode.parse({})), water = group.getObjectByName('pond-water') as Mesh
  const state = getPondWaterState(water)!, version = state.waveTexture.version
  for (let frame = 1; frame <= 60; frame++) updatePondWater(group, frame / 60)
  expect(state.waveTexture.version - version).toBeLessThanOrEqual(31)
  expect(state.time.value).toBeCloseTo(1)
  expect(state.waves.stats().stepCount).toBeGreaterThanOrEqual(116)
  disposePondGeometry(group)
})
