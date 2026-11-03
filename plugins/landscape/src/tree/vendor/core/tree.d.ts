export function makeBarkMaterial(assets?: {}): MeshStandardNodeMaterial;
export function makeThatchBarkMaterial(assets?: {}): MeshStandardNodeMaterial;
export function makeCactusBarkMaterial(assets?: {}): MeshStandardNodeMaterial;
export function forestBarkMaterial(srcMat: any): any;
/**
 * @param {object} species  a species preset ({ name, params, ... })
 * @param {string|number} seed
 * @param {object} assets   cached textures + materials from loadSpeciesAssets
 * @param {object} lodOpts  { lod1Dist, lod2Dist, meshQuality }
 * @returns {{ group: LOD, stems: Array, tips: Array }}
 */
export function buildTree(species: object, seed: string | number, assets?: object, lodOpts?: object, reuse?: null): {
    group: LOD;
    stems: any[];
    tips: any[];
};
export const MESHQ_DEFAULT: 0.8;
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { LOD } from 'three/webgpu';
