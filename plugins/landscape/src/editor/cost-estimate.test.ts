import { expect, test } from 'bun:test'
import { costEstimate, estimateCsv, estimateSettings } from './cost-estimate'
import { landscapeQuantity, mulchOrder } from './quantities'
import { GroundAreaNode } from '../ground-areas/domain/schema'
import type { AnyNode, GeometryContext } from '@pascal-app/core'
import { estimatePages } from './estimate-pages'

test('mulch uses net footprint, authored depth and whole bags with waste applied once', () => {
  const node = GroundAreaNode.parse({ surface: 'mulch', mulchDepth: .075, mulchBagLitres: 50, outline: [[0,0],[4,0],[4,4],[0,4]] })
  const row = landscapeQuantity(node as unknown as AnyNode, { sceneNodes: {} } as GeometryContext)
  expect(row.volume).toBeCloseTo(1.2)
  expect(mulchOrder(row, 10)).toEqual({ volume: 1.32, bags: 27 })
  expect(mulchOrder(row, -1)).toBeNull()
  expect(GroundAreaNode.safeParse({ mulchDepth: -1 }).success).toBe(false)
})
test('unpriced rates and unknown net measurements never become a complete zero estimate', () => {
  const rows = [{id:'a',label:'Deck',material:'cedar',count:1,area:10,netArea:8,length:null}]
  const settings = estimateSettings(undefined)
  const initial = costEstimate(rows,10,settings)
  expect(initial.unpriced).toBe(1)
  settings.rates[initial.items[0]!.key] = {material:20,labour:5,bags:false}
  expect(costEstimate(rows,10,settings).total).toBeCloseTo(220)
  expect(costEstimate([{...rows[0]!,netArea:null}],10,settings).unpriced).toBe(1)
})
test('mulch bag pricing rounds purchase counts and protects exported user names', () => {
  const row = {id:'a',costKey:'mulch',label:'Mulch',material:'=SUM(A1)',count:1,area:1,netArea:1,length:null,volume:.075,bagLitres:50}
  const settings = estimateSettings({rates:{mulch:{material:10,labour:0,bags:true}}})
  expect(costEstimate([row],0,settings).total).toBe(20)
  expect(estimateCsv([row],0,settings)).toContain("'"+'=SUM(A1)')
  expect(estimateSettings({rates:{mulch:{material:-1,labour:0}}}).rates).toEqual({})
})
test('estimate PDF paginates quantities and repeats cost completeness status', () => {
  const rows = Array.from({length:60},(_,i) => ({id:String(i),costKey:String(i),label:`Plant ${i}`,material:'',count:1,area:null,length:null}))
  const pages = estimatePages(rows,0,estimateSettings(undefined),'Ground floor')
  expect(pages).toHaveLength(6)
  expect(new Set(pages.map(page=>page.number)).size).toBe(6)
  expect(pages.every(page => page.overlay.some(geometry => geometry.kind === 'text' && geometry.text.startsWith('60 unpriced')))).toBe(true)
})
