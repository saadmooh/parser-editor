import { Color, type Group, type Material, Mesh, MeshStandardMaterial } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const models = new Map<string, Promise<Group>>()
type TintedAsset = { users: number; model: Promise<Group>; materials: Material[] }
const tinted = new Map<string, TintedAsset>()

function loadModel(url: string) {
  let pending = models.get(url)
  if (!pending) {
    pending = new GLTFLoader().loadAsync(url).then((gltf) => gltf.scene)
    models.set(url, pending)
    pending.catch(() => models.delete(url))
  }
  return pending
}

/** Share tinted materials as well as geometry across identical placements. */
export function acquireFabAsset(url: string, tint?: string) {
  if (!tint) return { model: loadModel(url), release: () => {} }
  const key = `${url}:${tint.toLowerCase()}`
  let entry = tinted.get(key)
  if (!entry) {
    const created: TintedAsset = { users: 0, model: null!, materials: [] }
    created.model = loadModel(url).then((source) => {
      const model = source.clone(true)
      const copies = new Map<Material, Material>()
      const color = new Color(tint)
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return
        const copy = (original: Material) => {
          let material = copies.get(original)
          if (!material) {
            material = original.clone()
            if (material instanceof MeshStandardMaterial) material.color.multiply(color)
            copies.set(original, material)
            created.materials.push(material)
          }
          return material
        }
        object.material = Array.isArray(object.material) ? object.material.map(copy) : copy(object.material)
      })
      if (!created.users) created.materials.forEach((material) => material.dispose())
      return model
    })
    entry = created
    tinted.set(key, entry)
    created.model.catch(() => { if (tinted.get(key) === created) tinted.delete(key) })
  }
  entry.users++
  const owned = entry
  let released = false
  return {
    model: owned.model,
    release() {
      if (released) return
      released = true
      if (--owned.users) return
      if (tinted.get(key) === owned) tinted.delete(key)
      owned.materials.forEach((material) => material.dispose())
    },
  }
}
