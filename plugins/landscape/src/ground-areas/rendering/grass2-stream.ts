import { Box3, Camera, Frustum, InstancedMesh, LOD, Matrix4, Mesh, Vector3, WebGPUCoordinateSystem } from 'three'
import { Grass2Patch, grassDetailDistance, projectedGrassPixels } from './grass2-lod'

type Tile = { key: string; x: number; z: number; distance: number }
type Entry = { patch: Grass2Patch | null; lastUsed: number; signature?: string }
export type PatchBuilder = (x: number, z: number) => Generator<void, Grass2Patch | null>
const FRUSTUM_EDGES = [
  [0, 1], [1, 3], [3, 2], [2, 0],
  [4, 5], [5, 7], [7, 6], [6, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
] as const

export function disposeGrassPatch(patch: Grass2Patch) {
  patch.traverse((object) => {
    if (!(object instanceof Mesh)) return
    if (object instanceof InstancedMesh) object.dispose()
    object.geometry.dispose()
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose()
  })
}

/** Renderer-driven loading: no timers, background jobs, or global references to a scene. */
export class Grass2Stream extends LOD {
  private readonly cache = new Map<string, Entry>()
  private queue: Tile[] = []
  private pending: { tile: Tile; work: ReturnType<PatchBuilder> } | undefined
  private readonly lastView = new Matrix4().makeScale(0, 0, 0)
  private readonly lastWorld = new Matrix4().makeScale(0, 0, 0)
  private readonly view = new Matrix4()
  private readonly localView = new Matrix4()
  private readonly clipToLocal = new Matrix4()
  private readonly frustumCorners = Array.from({ length: 8 }, () => new Vector3())
  private readonly frustum = new Frustum()
  private readonly box = new Box3()
  private readonly center = new Vector3()
  private tick = 0
  private signature?: (x: number, z: number) => string
  private viewportHeight = 720
  maxBladeHeight = 1.3

  constructor(
    private readonly bounds: Box3,
    private readonly patchSize: number,
    private build: PatchBuilder,
    private readonly idleCacheSize = 12,
  ) {
    super()
    this.name = 'ground-area-grass2-stream'
    this.raycast = () => {}
  }

  get pendingPatchCount() { return this.queue.length + (this.pending ? 1 : 0) }
  get residentPatchCount() { return this.cache.size }

  setViewportHeight(height: number) {
    if (height <= 0 || height === this.viewportHeight) return
    this.viewportHeight = height
    this.lastView.makeScale(0, 0, 0)
    for (const entry of this.cache.values()) if (entry.patch) entry.patch.viewportHeight = height
  }

  reconfigure(bounds: Box3, build: PatchBuilder, signature: (x: number, z: number) => string,
    update: (patch: Grass2Patch) => void) {
    this.pending?.work.return(null)
    this.pending = undefined
    this.queue = []
    this.bounds.copy(bounds)
    this.build = build
    for (const [key, entry] of this.cache) {
      const [x, z] = key.split(',').map(Number)
      const next = signature(x!, z!)
      if (entry.signature !== next) {
        if (entry.patch) { this.remove(entry.patch); disposeGrassPatch(entry.patch) }
        this.cache.delete(key)
      } else if (entry.patch) update(entry.patch)
    }
    this.signature = signature
    this.lastView.makeScale(0, 0, 0)
  }

  private visibleTileRange(camera: Camera) {
    const size = this.patchSize
    // Clip the camera frustum against the grass height slab. Its X/Z bounds
    // conservatively enclose every tile that can pass the frustum test below.
    const minimumDepth = camera.coordinateSystem === WebGPUCoordinateSystem || camera.reversedDepth ? 0 : -1
    const near = camera.reversedDepth ? 1 : minimumDepth
    const far = camera.reversedDepth ? minimumDepth : 1
    this.clipToLocal.copy(this.localView).invert()
    for (let i = 0; i < 8; i++) {
      const corner = this.frustumCorners[i]!
      corner.set(i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? far : near)
        .applyMatrix4(this.clipToLocal)
      // Infinite camera far planes cannot be bounded by finite clip corners.
      if (!Number.isFinite(corner.x + corner.y + corner.z))
        return { minX: Math.floor(this.bounds.min.x / size), maxX: Math.ceil(this.bounds.max.x / size),
          minZ: Math.floor(this.bounds.min.z / size), maxZ: Math.ceil(this.bounds.max.z / size) }
    }
    const low = this.bounds.min.y - 1.5, high = this.bounds.max.y + 1.5
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    const include = (x: number, z: number) => {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z)
    }
    for (const corner of this.frustumCorners)
      if (corner.y >= low && corner.y <= high) include(corner.x, corner.z)
    for (const [aIndex, bIndex] of FRUSTUM_EDGES) {
      const a = this.frustumCorners[aIndex]!, b = this.frustumCorners[bIndex]!
      if (a.y === b.y) continue
      for (const y of [low, high]) {
        const t = (y - a.y) / (b.y - a.y)
        if (t >= 0 && t <= 1) include(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)
      }
    }
    if (minX === Infinity) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }
    // Include one tile around the footprint: Frustum.intersectsBox uses plane
    // tests, so it can accept edge tiles whose box does not actually overlap
    // the clipped frustum footprint.
    const margin = size + 1.5
    return {
      minX: Math.max(Math.floor(this.bounds.min.x / size), Math.floor((minX - margin) / size)),
      maxX: Math.min(Math.ceil(this.bounds.max.x / size), Math.ceil((maxX + margin) / size)),
      minZ: Math.max(Math.floor(this.bounds.min.z / size), Math.floor((minZ - margin) / size)),
      maxZ: Math.min(Math.ceil(this.bounds.max.z / size), Math.ceil((maxZ + margin) / size)),
    }
  }

  private select(camera: Camera) {
    this.view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    if (this.view.equals(this.lastView) && this.matrixWorld.equals(this.lastWorld)) return
    this.lastView.copy(this.view)
    this.lastWorld.copy(this.matrixWorld)
    this.localView.multiplyMatrices(this.view, this.matrixWorld)
    this.frustum.setFromProjectionMatrix(this.localView, camera.coordinateSystem, camera.reversedDepth)
    const candidates: Tile[] = []
    const wanted = new Set<string>()
    const size = this.patchSize
    const range = this.visibleTileRange(camera)
    for (let z = range.minZ; z < range.maxZ; z++) {
      for (let x = range.minX; x < range.maxX; x++) {
        this.box.min.set(x * size, this.bounds.min.y, z * size)
        this.box.max.set((x + 1) * size, this.bounds.max.y, (z + 1) * size)
        // Include leaning blades and camera-facing cards at the edge of the view.
        this.box.expandByScalar(1.5)
        if (!this.frustum.intersectsBox(this.box)) continue
        this.box.getCenter(this.center).applyMatrix4(this.matrixWorld)
        const distance = grassDetailDistance(camera, this.center)
        // Margin keeps a patch loaded throughout the far LOD's hysteresis band.
        if (projectedGrassPixels(camera, this.center,
          this.maxBladeHeight * this.matrixWorld.getMaxScaleOnAxis(), this.viewportHeight) < 0.65) continue
        const key = `${x},${z}`
        wanted.add(key)
        if (!this.cache.has(key)) candidates.push({ key, x, z, distance })
      }
    }
    this.queue = candidates.sort((a, b) => a.distance - b.distance)
    if (this.pending && !wanted.has(this.pending.tile.key)) {
      this.pending.work.return(null)
      this.pending = undefined
    }
    if (this.pending) this.queue = this.queue.filter((tile) => tile.key !== this.pending!.tile.key)
    for (const [key, entry] of this.cache) {
      const visible = wanted.has(key)
      if (entry.patch) entry.patch.visible = visible
      if (visible) entry.lastUsed = this.tick
    }
    const idle = [...this.cache].filter(([key]) => !wanted.has(key))
      .sort((a, b) => b[1].lastUsed - a[1].lastUsed)
    for (const [key, entry] of idle.slice(this.idleCacheSize)) {
      if (entry.patch) {
        this.remove(entry.patch)
        disposeGrassPatch(entry.patch)
      }
      this.cache.delete(key)
    }
  }

  override update(camera: Camera) {
    this.tick++
    this.select(camera)
    const deadline = performance.now() + 2
    // Placement yields between rows. Finish at most one mesh batch per render;
    // constructing/uploading a completed batch cannot be preempted mid-call.
    do {
      if (!this.pending) {
        const tile = this.queue.shift()
        if (!tile) break
        this.pending = { tile, work: this.build(tile.x, tile.z) }
      }
      const result = this.pending.work.next()
      if (result.done) {
        const patch = result.value
        this.cache.set(this.pending.tile.key, { patch, lastUsed: this.tick,
          signature: this.signature?.(this.pending.tile.x, this.pending.tile.z) })
        this.pending = undefined
        if (patch) {
          if (this.userData.__fromGeometry) patch.traverse((object) => { object.userData.__fromGeometry = true })
          this.add(patch)
          patch.viewportHeight = this.viewportHeight
          // Children are created after the renderer's initial matrix update.
          patch.updateMatrixWorld(true)
          patch.update(camera)
        }
        break
      }
    } while (performance.now() < deadline)
  }
}
