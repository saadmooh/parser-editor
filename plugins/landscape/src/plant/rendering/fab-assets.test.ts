import { expect, spyOn, test } from 'bun:test'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { acquireFabAsset } from './fab-assets'

function source() {
  const scene = new Group()
  const material = new MeshStandardMaterial({ color: '#88aa66' })
  const geometry = new BoxGeometry()
  scene.add(new Mesh(geometry, material), new Mesh(geometry, material))
  return { scene } as GLTF
}

test('identical tinted assets share materials and release them only after the last user', async () => {
  const original = source()
  const load = spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(original)
  try {
    const a = acquireFabAsset('test-shared-tint.glb', '#AABBCC')
    const b = acquireFabAsset('test-shared-tint.glb', '#aabbcc')
    const [first, second] = await Promise.all([a.model, b.model])
    expect(first).toBe(second)
    expect(load).toHaveBeenCalledTimes(1)
    const mesh = first.children[0] as Mesh
    const material = mesh.material as MeshStandardMaterial
    expect(material).toBe((first.children[1] as Mesh).material as MeshStandardMaterial)
    expect(material).not.toBe((original.scene.children[0] as Mesh).material)
    expect(mesh.geometry).toBe((original.scene.children[0] as Mesh).geometry)
    const dispose = spyOn(material, 'dispose')
    a.release()
    a.release()
    expect(dispose).not.toHaveBeenCalled()
    b.release()
    expect(dispose).toHaveBeenCalledTimes(1)
    const c = acquireFabAsset('test-shared-tint.glb', '#aabbcc')
    expect((await c.model).children[0]).not.toBe(mesh)
    expect(load).toHaveBeenCalledTimes(1)
    c.release()
  } finally { load.mockRestore() }
})

test('cancelling every tint user while loading disposes the eventual materials', async () => {
  let resolve!: (gltf: GLTF) => void
  const pending = new Promise<GLTF>((done) => { resolve = done })
  const load = spyOn(GLTFLoader.prototype, 'loadAsync').mockReturnValue(pending)
  const dispose = spyOn(MeshStandardMaterial.prototype, 'dispose')
  try {
    const asset = acquireFabAsset('test-cancelled-tint.glb', '#ff0000')
    asset.release()
    resolve(source())
    await asset.model
    expect(dispose).toHaveBeenCalledTimes(1)
  } finally { load.mockRestore(); dispose.mockRestore() }
})

test('unmodified assets keep their shared materials alive after release', async () => {
  const original = source()
  const load = spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(original)
  const dispose = spyOn((original.scene.children[0] as Mesh).material as MeshStandardMaterial, 'dispose')
  try {
    const asset = acquireFabAsset('test-original-material.glb')
    expect(await asset.model).toBe(original.scene)
    asset.release()
    expect(dispose).not.toHaveBeenCalled()
  } finally { load.mockRestore(); dispose.mockRestore() }
})
