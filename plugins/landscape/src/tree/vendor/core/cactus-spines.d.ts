export function makeSpineMaterial(assets: any, sunLight?: null): MeshSSSNodeMaterial;
/**
 * Build (or rewrite in place) the merged spine mesh for a fluted cactus.
 * @param {Array}  crestAnchors  geometry.userData.ribCrests from buildMergedMesh
 * @param {object} cfg           { size, widthFrac, embed, density, ... }
 * @param {Rng}    rng
 * @param {Material} material     shared spine material (assets.spineMat)
 * @param {Mesh}   [reuseMesh]    rewrite this mesh's geometry buffers in place
 * @returns {Mesh|null}
 */
export function buildCactusSpines(crestAnchors: any[], cfg: object, rng: Rng, material: Material, reuseMesh?: Mesh): Mesh | null;
import { MeshSSSNodeMaterial } from 'three/webgpu';
import { Mesh } from 'three/webgpu';
