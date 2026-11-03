import { expect,spyOn,test } from 'bun:test'
import { Mesh } from 'three'
import { buildPondGeometry,disposePondGeometry } from './geometry'
import { PondNode } from './schema'
import { getPondWaterState,setPondWaterQuality,updatePondWaterSettings } from './water'
import { pondWaterQuality } from './water-quality'

test('screen-size quality switches use hysteresis and lower quality while editing',()=>{
  expect(pondWaterQuality('high',100,false)).toBe('medium')
  expect(pondWaterQuality('high',170,false)).toBe('high')
  expect(pondWaterQuality('medium',170,false)).toBe('medium')
  expect(pondWaterQuality('medium',250,false)).toBe('high')
  expect(pondWaterQuality('high',1000,true)).toBe('medium')
})

test('Pool quality variants reuse uniforms and simulation, are cached, and dispose once',()=>{
  const node=PondNode.parse({fishCount:0}),group=buildPondGeometry(node)
  const water=group.getObjectByName('pond-water') as Mesh,state=getPondWaterState(water)!
  const high=state.material,waves=state.waves
  setPondWaterQuality(group,'medium')
  const medium=state.material
  expect(medium).not.toBe(high)
  expect(state.surface.settings.waterQuality).toBe('medium')
  expect(state.waves).toBe(waves)
  updatePondWaterSettings(group,{...node,waterClarity:2})
  expect(state.surface.absorption.value).toBeCloseTo(-.31)
  expect(state.surface.settings.waterQuality).toBe('medium')
  setPondWaterQuality(group,'high');expect(state.material).toBe(high)
  setPondWaterQuality(group,'medium');expect(state.material).toBe(medium)
  const disposals=[spyOn(high,'dispose'),spyOn(medium,'dispose')]
  disposePondGeometry(group)
  for(const disposal of disposals){expect(disposal).toHaveBeenCalledTimes(1);disposal.mockRestore()}
})
