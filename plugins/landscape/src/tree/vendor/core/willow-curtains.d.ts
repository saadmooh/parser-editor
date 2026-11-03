/**
 * Build one merged curtain Mesh from real terminal feeder stems.
 *
 * Supported config aliases:
 * - vinesPerMeter or spacing/vineSpacing
 * - minPerFeeder, maxPerFeeder
 * - length/vineLength and lengthVariation/vineLengthVar
 * - curveBuildup, curveBuildupVariation
 * - lateralVariation, segments
 *
 * The supplied material should use foliageWindPosition(false). These are plain
 * tree-space vertices, so the instanced-leaf flutter term's local-Y amplitude is
 * not appropriate; per-ring sway still bends every vine progressively.
 */
export function buildWillowCurtains(feederStems: any, cfg: any, rng: any, material: any): Mesh<BufferGeometry<import("three").NormalBufferAttributes, import("three").BufferGeometryEventMap>, any, import("three").Object3DEventMap> | null;
import { BufferGeometry } from 'three/webgpu';
import { Mesh } from 'three/webgpu';
