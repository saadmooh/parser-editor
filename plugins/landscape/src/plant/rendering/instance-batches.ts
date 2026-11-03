import { DynamicDrawUsage, Group, InstancedMesh, Matrix4, Mesh, Scene, SkinnedMesh, Vector3,
  type Material, type Object3D } from 'three'

export type PlantPlacement = {
  id: string
  root: Group
  model: Group
  parts: { mesh: Mesh; transform: Matrix4; layerMask: number }[]
}
type Slot = { placement: PlantPlacement; part: Mesh; matrix: Matrix4 }
type Batch = { mesh: InstancedMesh; matrices: Matrix4[] }
const CHUNK_SIZE = 32

export function collectPlantParts(root: Group, model: Group): PlantPlacement['parts'] | null {
  root.updateWorldMatrix(true, true)
  const inverse = root.matrixWorld.clone().invert()
  const parts: PlantPlacement['parts'] = []
  let unsupported = false
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return
    if (object instanceof SkinnedMesh || object instanceof InstancedMesh || object.morphTargetInfluences?.length) {
      unsupported = true
      return
    }
    for (let current: Object3D | null = object; current && current !== model.parent; current = current.parent)
      if (!current.visible) return
    parts.push({ mesh: object, transform: new Matrix4().multiplyMatrices(inverse, object.matrixWorld),
      layerMask: object.layers.mask })
  })
  return unsupported || !parts.length ? null : parts
}

function effectivelyVisible(object: Object3D) {
  for (let current: Object3D | null = object; current; current = current.parent)
    if (!current.visible) return false
  return true
}

export function belongsToScene(object: Object3D, scene: Scene) {
  for (let current: Object3D | null = object; current; current = current.parent)
    if (current === scene) return true
  return false
}

function materialKey(material: Material | Material[]) {
  return Array.isArray(material) ? material.map((part) => part.uuid).join(',') : material.uuid
}

export function restorePlantPlacement(placement: PlantPlacement) {
  placement.model.visible = true
  for (const part of placement.parts) part.mesh.layers.mask = part.layerMask
}

/** Batches static GLB primitives while per-node clones remain available to editor tools. */
export class PlantInstanceBatches {
  readonly root = new Group()
  private batches = new Map<string, Batch>()
  private routes = new WeakMap<InstancedMesh, Slot[]>()
  private placements = new Set<PlantPlacement>()
  private slots = new WeakMap<PlantPlacement, Slot[]>()
  private inverse = new Matrix4()
  private position = new Vector3()

  constructor() {
    this.root.name = 'landscape-plant-batches'
  }

  resolve(object: Object3D, instanceId: number | undefined) {
    return object instanceof InstancedMesh && instanceId !== undefined
      ? this.routes.get(object)?.[instanceId] : undefined
  }

  update(placements: Iterable<PlantPlacement>, promoted: ReadonlySet<string>, exporting = false) {
    const current = new Set(placements)
    for (const previous of this.placements)
      if (!current.has(previous)) restorePlantPlacement(previous)
    this.placements = current
    this.root.updateWorldMatrix(true, false)
    const inverse = this.inverse.copy(this.root.matrixWorld).invert()
    const pending = new Map<string, Slot[]>()
    const position = this.position
    for (const placement of current) {
      const { root, model } = placement
      const individual = exporting || promoted.has(placement.id)
      model.visible = individual
      // Raycaster traverses invisible meshes, so also exclude hidden clones
      // from its layers. Keep their geometry for bounds and editor tools.
      for (const part of placement.parts) part.mesh.layers.mask = individual ? part.layerMask : 0
      if (individual || !effectivelyVisible(root)) continue
      root.updateWorldMatrix(true, false)
      position.setFromMatrixPosition(root.matrixWorld)
      const chunk = `${Math.floor(position.x / CHUNK_SIZE)}:${Math.floor(position.z / CHUNK_SIZE)}`
      let placementSlots = this.slots.get(placement)
      if (!placementSlots) {
        placementSlots = placement.parts.map((part) => ({ placement, part: part.mesh, matrix: new Matrix4() }))
        this.slots.set(placement, placementSlots)
      }
      for (let i = 0; i < placement.parts.length; i++) {
        const part = placement.parts[i]!
        const slot = placementSlots[i]!
        const mesh = slot.part
        const key = `${chunk}:${mesh.geometry.uuid}:${materialKey(mesh.material)}:${mesh.castShadow}:${mesh.receiveShadow}:${mesh.renderOrder}`
        const slots = pending.get(key) ?? []
        slot.matrix.copy(inverse).multiply(root.matrixWorld).multiply(part.transform)
        slots.push(slot)
        pending.set(key, slots)
      }
    }
    for (const [key, batch] of this.batches) {
      if (pending.has(key)) continue
      this.root.remove(batch.mesh)
      batch.mesh.dispose()
      this.batches.delete(key)
    }
    for (const [key, slots] of pending) {
      let batch = this.batches.get(key)
      if (!batch || batch.mesh.instanceMatrix.count < slots.length) {
        if (batch) { this.root.remove(batch.mesh); batch.mesh.dispose() }
        const source = slots[0]!.part
        const capacity = 2 ** Math.ceil(Math.log2(Math.max(1, slots.length)))
        const mesh = new InstancedMesh(source.geometry, source.material, capacity)
        mesh.name = 'landscape-plant-batch'
        mesh.castShadow = source.castShadow
        mesh.receiveShadow = source.receiveShadow
        mesh.renderOrder = source.renderOrder
        mesh.instanceMatrix.setUsage(DynamicDrawUsage)
        batch = { mesh, matrices: [] }
        this.batches.set(key, batch)
        this.root.add(mesh)
      }
      let changed = batch.mesh.count !== slots.length
      slots.forEach((slot, i) => {
        if (batch!.matrices[i]?.equals(slot.matrix)) return
        batch!.mesh.setMatrixAt(i, slot.matrix)
        if (batch!.matrices[i]) batch!.matrices[i]!.copy(slot.matrix)
        else batch!.matrices[i] = slot.matrix.clone()
        changed = true
      })
      batch.mesh.count = slots.length
      this.routes.set(batch.mesh, slots)
      if (changed) {
        batch.mesh.instanceMatrix.needsUpdate = true
        batch.mesh.computeBoundingBox()
        batch.mesh.computeBoundingSphere()
      }
    }
  }

  dispose() {
    for (const placement of this.placements) restorePlantPlacement(placement)
    this.placements.clear()
    for (const batch of this.batches.values()) batch.mesh.dispose()
    this.batches.clear()
    this.root.clear()
  }
}
