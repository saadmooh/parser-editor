export interface WaveField {
  heights: Float32Array
  texturePixelsRGBA: Float32Array
  update(seconds: number): void
  disturb(x: number, z: number, power?: number): void
  stirSegment(x0: number, z0: number, x1: number, z1: number, power?: number, seconds?: number): void
  heightAt(x: number, z: number): number
  motionAt(x: number, z: number): { vx: number; vz: number; height: number }
  getSettings(): { waveSpeed: number; waveDamping: number; stirRadius: number; stonePower: number }
  setSettings(settings: { waveSpeed?: number; waveDamping?: number; stirRadius?: number; stonePower?: number }): unknown
  setObstacles(obstacles: { x: number; z: number; radius: number }[]): void
  reset(): void
  stats(): { mass: number; energy: number; wetCells: number; stepCount: number; substeps: number; maxAbsHeight: number }
}
export function createWaveField(options?: { width?: number; depth?: number; nx?: number; nz?: number; terrain?: (x: number, z: number) => number }): WaveField
