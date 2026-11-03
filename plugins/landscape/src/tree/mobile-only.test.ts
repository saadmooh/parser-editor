import { expect, test } from 'bun:test'
import { resolveTreeLod } from './domain/schema'
import { generate, getSchema } from './vendor/api/seedthree.js'

test('older desktop settings resolve to the mobile tree defaults', () => {
  expect(resolveTreeLod({ mobileTarget: false, cardRes: 1024, billboardRes: 2048 })).toMatchObject({
    mobileTarget: true, cardRes: 256, cardVariants: 2, billboardRes: 256,
  })
  expect(getSchema('whiteOak').lod.some((knob: { key: string }) => knob.key === 'mobileTarget')).toBe(false)
})

test.each(['whiteOak', 'joshuaTree'])('%s cannot generate a desktop LOD ladder', (species) => {
  const group = generate({ species, lod: { mobileTarget: false } }).group
  const levels = group.levels.map((level: { object: { userData: Record<string, unknown> } }) => level.object.userData)
  expect(levels.filter((level: Record<string, unknown>) => level.hiddenInApp)
    .map((level: Record<string, unknown>) => level.lodName)).toEqual(['LOD0', 'LOD1'])
  expect(levels.some((level: Record<string, unknown>) => level.lodName === 'LOD4')).toBe(true)
})
