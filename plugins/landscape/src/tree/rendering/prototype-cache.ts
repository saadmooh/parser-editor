import { Group, InstancedBufferAttribute, InstancedMesh, LOD, Mesh, type Object3D } from 'three'
import type { TreeNode } from '../domain/schema'
import { buildTreeGeometry, disposeTreeGeometry } from './geometry'

type Entry = { prototype: LOD; instances: Set<LOD> }
const prototypes = new Map<string, Entry>()
const owners = new WeakMap<LOD, { key: string; entry: Entry }>()

export function treeDesignKey(node: TreeNode) {
  return JSON.stringify([node.species, node.controls, node.lod])
}

function clonePart(source: Object3D): Object3D {
  let clone: Object3D
  if (source instanceof InstancedMesh) {
    const mesh = new InstancedMesh(source.geometry, source.material, source.instanceMatrix.count)
    mesh.count = source.count
    mesh.instanceMatrix.array.set(source.instanceMatrix.array)
    mesh.instanceMatrix.needsUpdate = true
    if (source.instanceColor) mesh.instanceColor = new InstancedBufferAttribute(
      source.instanceColor.array.slice(), source.instanceColor.itemSize)
    clone = mesh
  } else if (source instanceof Mesh) {
    clone = new Mesh(source.geometry, source.material)
  } else {
    clone = new Group()
  }
  clone.name = source.name
  clone.position.copy(source.position)
  clone.quaternion.copy(source.quaternion)
  clone.scale.copy(source.scale)
  clone.visible = source.visible
  clone.renderOrder = source.renderOrder
  clone.castShadow = source.userData.isBillboardCard ? false : source.castShadow
  clone.receiveShadow = source.receiveShadow
  clone.frustumCulled = source.frustumCulled
  clone.userData = Object.fromEntries(Object.entries(source.userData).filter(([, value]) =>
    value == null || ['string', 'number', 'boolean'].includes(typeof value)))
  for (const child of source.children) clone.add(clonePart(child))
  return clone
}

function clearInstanceBuffers(group: LOD) {
  group.traverse((object) => {
    if (object instanceof InstancedMesh) object.dispose()
  })
  group.clear()
  group.levels.length = 0
}

function refreshInstance(instance: LOD, prototype: LOD) {
  clearInstanceBuffers(instance)
  instance.name = prototype.name
  for (const level of prototype.levels) {
    if (level.object.userData.hiddenInApp) continue
    instance.addLevel(clonePart(level.object), level.distance, level.hysteresis)
  }
}

export function acquireTreeGeometry(node: TreeNode): LOD {
  const key = treeDesignKey(node)
  let entry = prototypes.get(key)
  if (!entry) {
    const created: Entry = { prototype: null as unknown as LOD, instances: new Set() }
    created.prototype = buildTreeGeometry(node, (kind) => {
      if (kind === 'billboard') {
        const level = created.prototype.levels.find((candidate) => candidate.object.userData.isBillboard)
        if (!level) return
        for (const instance of created.instances)
          instance.addLevel(clonePart(level.object), level.distance, level.hysteresis)
        return
      }
      for (const instance of created.instances) refreshInstance(instance, created.prototype)
    })
    entry = created
    prototypes.set(key, entry)
  }
  const instance = new LOD()
  refreshInstance(instance, entry.prototype)
  entry.instances.add(instance)
  owners.set(instance, { key, entry })
  return instance
}

export function releaseTreeGeometry(instance: LOD) {
  const owner = owners.get(instance)
  if (!owner) return
  owners.delete(instance)
  clearInstanceBuffers(instance)
  owner.entry.instances.delete(instance)
  if (owner.entry.instances.size) return
  prototypes.delete(owner.key)
  disposeTreeGeometry(owner.entry.prototype)
}
