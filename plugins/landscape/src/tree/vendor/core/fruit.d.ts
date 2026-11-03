export function prepareFruitGeometry(geo: any): any;
export function makeFruitMaterial(srcMat: any): MeshStandardNodeMaterial;
/**
 * Place fruit instances on terminal stems (same anchoring as buildFoliage).
 * @param {Array} terminalStems  stems with .points/.orients/.winds/.radii
 * @param {object} cfg           species.fruit config (DEFAULTS above)
 * @param {import('./rng.js').Rng} rng
 * @param {BufferGeometry} geometry  prepared (top-origined) fruit geometry
 * @param {Material} material    makeFruitMaterial result (shared per species)
 * @param {Array} [obstacles]    ALL rendered stems — fruit whose body would
 *                               overlap any branch is rejected (no clipping)
 */
export function buildFruits(terminalStems: any[], cfg: object, rng: import("./rng.js").Rng, geometry: BufferGeometry, material: Material, obstacles?: any[]): InstancedMesh<any, Material, import("three").InstancedMeshEventMap> | null;
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { InstancedMesh } from 'three/webgpu';
