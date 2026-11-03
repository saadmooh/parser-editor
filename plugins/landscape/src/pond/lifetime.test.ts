import { expect, spyOn, test } from 'bun:test'
import { Mesh } from 'three'
import { buildPondGeometry, disposePondGeometry, updatePondWater } from './geometry'
import { retainPondGeometry } from './lifetime'
import { PondNode } from './schema'
import { getPondWaterState } from './water'

test('effect replay keeps live scene captures and wave textures; final removal disposes them once', async () => {
  const pond = buildPondGeometry(PondNode.parse({}))
  const water = pond.getObjectByName('pond-water') as Mesh
  const state = getPondWaterState(water)!
  const waveDispose = spyOn(state.waveTexture, 'dispose')
  const terrainDispose = spyOn(state.terrainTexture, 'dispose')
  const captureDisposals = state.sceneCaptures.map(capture => spyOn(capture, 'dispose'))
  const disposals = [waveDispose, terrainDispose, ...captureDisposals]
  const releaseFirst = retainPondGeometry(pond)
  releaseFirst()
  const releaseReplay = retainPondGeometry(pond)
  await Promise.resolve()
  for (const dispose of disposals) expect(dispose).not.toHaveBeenCalled()
  expect(getPondWaterState(water)).toBe(state)
  updatePondWater(pond, .032)
  expect(state.time.value).toBe(.032)
  releaseReplay()
  releaseReplay()
  await Promise.resolve()
  for (const dispose of disposals) {
    expect(dispose).toHaveBeenCalledTimes(1)
    dispose.mockRestore()
  }
  expect(getPondWaterState(water)).toBeUndefined()
})

test('a settings rebuild releases only the replaced pond', async () => {
  const previous = buildPondGeometry(PondNode.parse({ width: 4 }))
  const next = buildPondGeometry(PondNode.parse({ width: 5 }))
  const previousWater = previous.getObjectByName('pond-water') as Mesh
  const nextWater = next.getObjectByName('pond-water') as Mesh
  const releasePrevious = retainPondGeometry(previous)
  const releaseNext = retainPondGeometry(next)
  releasePrevious()
  await Promise.resolve()
  expect(getPondWaterState(previousWater)).toBeUndefined()
  expect(getPondWaterState(nextWater)).toBeDefined()
  updatePondWater(next, .016)
  expect(getPondWaterState(nextWater)!.time.value).toBe(.016)
  releaseNext()
  await Promise.resolve()
  expect(getPondWaterState(nextWater)).toBeUndefined()
})

test('Pool presentation textures survive other pond disposal and release with the last owner', () => {
  const first = buildPondGeometry(PondNode.parse({})), second = buildPondGeometry(PondNode.parse({ width: 5 }))
  const a = getPondWaterState(first.getObjectByName('pond-water') as Mesh)!
  const b = getPondWaterState(second.getObjectByName('pond-water') as Mesh)!
  const textures = [a.layers.normal,a.layers.shoreline,a.layers.noise]
  const disposals = textures.map(texture => spyOn(texture,'dispose'))
  expect(b.layers.normal).toBe(a.layers.normal)
  expect(b.layers.shoreline).toBe(a.layers.shoreline)
  expect(b.layers.noise).toBe(a.layers.noise)
  disposePondGeometry(first)
  disposals.forEach(dispose => expect(dispose).not.toHaveBeenCalled())
  updatePondWater(second,.05)
  expect(b.time.value).toBe(.05)
  disposePondGeometry(second)
  disposals.forEach(dispose => { expect(dispose).toHaveBeenCalledTimes(1); dispose.mockRestore() })
})
