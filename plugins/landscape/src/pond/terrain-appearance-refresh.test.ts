import { expect, test } from 'bun:test'
import { BoxGeometry, Float32BufferAttribute, Mesh } from 'three'
import { shouldRefreshPondTerrainAppearance } from './terrain-appearance-refresh'

function styledMesh() {
  const mesh = new Mesh(new BoxGeometry())
  const count = mesh.geometry.getAttribute('position').count
  for (const [name, size] of [['pondBlend', 1], ['pondLocalXZ', 2], ['pondDatum', 1], ['pondBedSurface', 1]] as const) {
    mesh.geometry.setAttribute(name, new Float32BufferAttribute(new Float32Array(count * size), size))
  }
  return mesh
}

test('refreshes pond vertex buffers immediately when pool resizing replaces host terrain', () => {
  const mesh = styledMesh()
  const styles = new Map([[mesh, { geometryId: mesh.geometry.uuid }]])
  const profiles = {}
  expect(shouldRefreshPondTerrainAppearance(1, 1.25, profiles, profiles, styles)).toBe(false)
  const previous = mesh.geometry
  mesh.geometry = new BoxGeometry(2, 1, 2)
  expect(mesh.geometry.hasAttribute('pondBlend')).toBe(false)
  expect(shouldRefreshPondTerrainAppearance(1.01, 1.25, profiles, profiles, styles)).toBe(true)
  previous.dispose()
  mesh.geometry.dispose()
})

test('refreshes missing shader attributes even when the geometry identity is retained', () => {
  const mesh = styledMesh()
  const styles = new Map([[mesh, { geometryId: mesh.geometry.uuid }]])
  const profiles = {}
  mesh.geometry.deleteAttribute('pondBedSurface')
  expect(shouldRefreshPondTerrainAppearance(1.01, 1.25, profiles, profiles, styles)).toBe(true)
  mesh.geometry.dispose()
})
