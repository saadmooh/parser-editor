export function addThicknessAttribute(geo: any, count: any, rng: any): void;
/**
 * @param {Array} terminalStems  deepest-level stems (each has .points and .orients)
 * @param {object} assets  { leafTexture }
 * @param {object} cfg
 * @param {import('./rng.js').Rng} rng
 */
export function makeFoliageMaterial(assets: object, cfg: object): {
    material: MeshSSSNodeMaterial;
    centerUniform: import("three/webgpu").UniformNode<"vec3", Vector3>;
    tintNode: import("three/webgpu").UniformNode<"color", Color>;
    tintAmount: import("three/webgpu").UniformNode<"float", number>;
};
export function buildFoliage(terminalStems: any, cfg: any, rng: any, material: any, centerUniform: any): import("three").Mesh<BufferGeometry<import("three").NormalBufferAttributes, import("three").BufferGeometryEventMap>, any, import("three").Object3DEventMap> | InstancedMesh<BufferGeometry<import("three").NormalBufferAttributes, import("three").BufferGeometryEventMap>, any, import("three").InstancedMeshEventMap> | null;
import { MeshSSSNodeMaterial } from 'three/webgpu';
import { Vector3 } from 'three/webgpu';
import { Color } from 'three/webgpu';
import { BufferGeometry } from 'three/webgpu';
import { InstancedMesh } from 'three/webgpu';
