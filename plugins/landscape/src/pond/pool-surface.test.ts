import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

function body(source:string,name:string) {
  const start=source.indexOf(` ${name}(`),open=source.indexOf('{',start)
  let depth=1,end=open+1
  while(depth) {depth+=(source[end]==='{')?1:(source[end]==='}')?-1:0;end++}
  return source.slice(open,end).replaceAll('this.viewportDepth','viewportDepth').replaceAll('this.viewportColor','viewportColor')
}

test('pond retains Pool shading with explicit basin-depth and transmission adaptations',()=>{
  const original=readFileSync(new URL('../../../pool/src/shader/water-effect.ts',import.meta.url),'utf8')
  const adapted=readFileSync(new URL('./pool-surface.ts',import.meta.url),'utf8')
  const normalizePond = (source:string) => source
    .replace(/    \/\/ Bound optical thickness[\s\S]*?const depthDelta = sceneEye\.sub\(fragmentEye\)\.max\(0\)\.min\(basinEyeDepth\)/, '    const depthDelta = sceneEye.sub(fragmentEye).max(0)')
    .replace('this.refractionStrength.mul(attenuation)', 'this.refractionStrength')
    .replace('      .mul(0.96).add(0.04)\n', '')
  for(const method of ['worldWaterUv','normalSample','environmentIllumination','createWaterMaterial'])
    expect(normalizePond(body(adapted,method))).toBe(body(original,method))
})

import { Color, Mesh } from 'three'
import { PondNode } from './schema'
import { pondWaterPresets } from './presets'
import { buildPondGeometry, disposePondGeometry } from './geometry'
import { getPondWaterState, updatePondWaterSettings, setPondWaterQuality } from './water'

test('every preset updates the live Pool uniforms and survives a custom clarity edit', () => {
  const node=PondNode.parse({}), group=buildPondGeometry(node)
  const water=group.getObjectByName('pond-water') as Mesh
  const state=getPondWaterState(water)!, simulation=state.waves
  const palettes=new Set<string>(), ripples=new Set<number>()
  for(const [name, values] of Object.entries(pondWaterPresets)) {
    const selected=PondNode.parse({...node,...values,waterPreset:name})
    updatePondWaterSettings(group,selected)
    palettes.add(state.surface.deepColor.value.getHexString())
    ripples.add(state.surface.normalStrength.value)
    expect(state.surface.normalSpeed.value).toBeCloseTo(.65*selected.waveSpeed)
    const colour=state.surface.deepColor.value.clone() as Color
    updatePondWaterSettings(group,{...selected,waterPreset:'custom',waterClarity:2})
    expect(state.surface.deepColor.value.equals(colour)).toBe(true)
    expect(state.surface.absorption.value).toBeCloseTo(-.31)
    expect(state.waves).toBe(simulation)
    setPondWaterQuality(group,'medium')
    expect(state.surface.deepColor.value.equals(colour)).toBe(true)
    setPondWaterQuality(group,'high')
  }
  const material=water.material, normal=state.surface.normalStrength
  updatePondWaterSettings(group,PondNode.parse({...node,waterPreset:'custom',rippleStrength:0,reflectionStrength:0,refractionStrength:0,sunGlints:0,waterColor:'#226699'}))
  expect(state.surface.normalStrength).toBe(normal)
  for(const name of ['normalStrength','reflectionStrength','refractionStrength','specularStrength','simulationDetail'])
    expect(state.surface[name].value).toBe(0)
  expect(state.surface.deepColor.value.getHexString()).toBe(new Color('#226699').multiplyScalar(.38).getHexString())
  expect(water.material).toBe(material)
  expect(palettes.size).toBe(4)
  expect(ripples.size).toBe(4)
  disposePondGeometry(group)
})
