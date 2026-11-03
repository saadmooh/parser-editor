import { Camera, Group, InstancedMesh, LOD, Vector3 } from 'three'

const COVERAGE = [1, 0.7, 0.4, 0] as const
const DISTANCES = [0, 18, 38, 70] as const
const cameraPosition = new Vector3()
const patchPosition = new Vector3()
const cameraSpacePosition = new Vector3()

export function projectedGrassPixels(camera: Camera, worldPosition: Vector3, worldHeight: number, viewportHeight: number) {
  const orthographic = (camera as Camera & { isOrthographicCamera?: boolean }).isOrthographicCamera
  const depth = orthographic ? 1 : Math.max(0.001, -cameraSpacePosition.copy(worldPosition).applyMatrix4(camera.matrixWorldInverse).z)
  return worldHeight * Math.abs(camera.projectionMatrix.elements[5]!) * viewportHeight * 0.5 / depth
}

export function grassDetailDistance(camera: Camera, worldPosition: Vector3) {
  cameraPosition.setFromMatrixPosition(camera.matrixWorld)
  const projectionScale = Math.abs(camera.projectionMatrix.elements[5]!)
  const referenceScale = 1 / Math.tan(25 * Math.PI / 180)
  const orthographic = (camera as Camera & { isOrthographicCamera?: boolean }).isOrthographicCamera
  return (orthographic ? 1 : cameraPosition.distanceTo(worldPosition)) *
    referenceScale / Math.max(projectionScale, 0.0001)
}

/** Instance arrays are sorted by their stable density rank. LOD draws a prefix. */
export function densityCounts(ranks: readonly number[]): number[] {
  return COVERAGE.map((coverage) => {
    let low = 0, high = ranks.length
    while (low < high) {
      const middle = (low + high) >>> 1
      if (ranks[middle]! < coverage) low = middle + 1
      else high = middle
    }
    return coverage > 0 ? Math.max(1, low) : low
  })
}

/** One set of meshes and buffers, including when the camera changes detail level. */
export class Grass2Patch extends LOD {
  maxBladeHeight = 0.6
  viewportHeight = 720
  private detail = -1
  private readonly meshes: InstancedMesh[] = []

  constructor(readonly content: Group) {
    super()
    content.traverse((object) => {
      if (object instanceof InstancedMesh) this.meshes.push(object)
    })
    // Keep Three's LOD metadata for scene tooling; only the first level owns meshes.
    DISTANCES.forEach((distance, index) => this.addLevel(index === 0 ? content : new Group(), distance, 0.1))
    this.setDetail(0)
  }

  override getCurrentLevel() { return this.detail }

  private setDetail(level: number) {
    if (level === this.detail) return
    this.detail = level
    this.content.visible = level < 3
    for (const mesh of this.meshes) {
      mesh.count = (mesh.userData.grass2Counts as number[])[level]!
      mesh.visible = mesh.count > 0
      const ranges = mesh.geometry.userData.grass2Ranges as { start: number; count: number }[] | undefined
      if (ranges && level < 3) mesh.geometry.setDrawRange(ranges[level]!.start, ranges[level]!.count)
    }
    for (const { object } of this.levels.slice(1)) object.visible = false
  }

  override update(camera: Camera) {
    patchPosition.setFromMatrixPosition(this.matrixWorld)
    // Projection scale accounts for zoom and FOV. Orthographic detail must not
    // depend on camera height: dollying does not change its apparent grass size.
    const pixels = projectedGrassPixels(camera, patchPosition,
      this.maxBladeHeight * this.matrixWorld.getMaxScaleOnAxis(), this.viewportHeight)
    let level = 3
    for (const [candidate, threshold] of [24, 10, 0.8].entries()) {
      if (pixels >= threshold * (this.detail <= candidate ? 0.9 : 1.1)) {
        level = candidate
        break
      }
    }
    this.setDetail(level)
  }
}
