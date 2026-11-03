/**
 * Exact index-triangle count for buildBranchGeometry without allocating vertex
 * buffers. LOD budget solving calls this many times across radialScale's
 * quantized plateaus, then meshes only the selected result once.
 */
export function estimateBranchTriangles(stems: any, opts?: {}): number;
/**
 * @param {Array} stems  from generateSkeleton()
 * @param {object} opts   { tileWorldSize } — world meters per bark tile repeat
 *                        { radialScale }  — LOD: scale ring vertex counts (min 3 sides)
 *                        { ringStride }   — LOD: keep every Nth cross-section
 */
export function buildBranchGeometry(stems: any[], opts?: object): BufferGeometry<import("three").NormalBufferAttributes, import("three").BufferGeometryEventMap>;
import { BufferGeometry } from 'three/webgpu';
