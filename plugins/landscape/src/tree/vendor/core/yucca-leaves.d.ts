export function makeYuccaMaterial(assets: any): {
    material: MeshSSSNodeMaterial;
    greenTint: import("three/webgpu").UniformNode<"color", Color>;
    dryTint: import("three/webgpu").UniformNode<"color", Color>;
    dryestTint: import("three/webgpu").UniformNode<"color", Color>;
    dryness: import("three/webgpu").UniformNode<"float", number>;
};
/**
 * @param {Array} terminalStems  arms carrying a rosette at each tip
 * @param {Array} [allStems]     full skeleton — older arms get a sparse gray drape
 * @returns {Group} one InstancedMesh per cone layer (userData.shareMaterial)
 */
export function buildYuccaFoliage(terminalStems: any[], cfg: any, rng: any, material: any, allStems?: any[], reuseGroup?: null): Group;
import { MeshSSSNodeMaterial } from 'three/webgpu';
import { Color } from 'three/webgpu';
import { Group } from 'three/webgpu';
