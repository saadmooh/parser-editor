export function processPixels(pixels: any, size: any, dilatePasses: any, srgb: any, flip: any): Uint8ClampedArray<any>;
export function textureFromProcessedPixels(data: any, size: any, srgb: any): CanvasTexture<HTMLCanvasElement> | DataTexture;
/**
 * Generic multichannel bake: renders `sourceRoot` through each view's camera in
 * albedo/normal/rough/trans channels and returns CanvasTextures per view:
 * { [viewName]: { albedo, normal, rough, trans } }. The root is temporarily
 * reparented into a throwaway flat-lit scene and handed back after.
 * Caller must pause its animation loop — this re-targets the renderer.
 */
export function bakeGroupToTextures(renderer: any, sourceRoot: any, views: any, opts?: {}): Promise<{}>;
/**
 * Bake front + side impostor cards from a tree level (research says bake from
 * LOD1 — matching silhouettes hide the final transition).
 * Caller must pause its animation loop while this runs — it re-targets the renderer.
 *
 * @returns {Promise<Group>} 2 crossed cards, named for export as `<Species>_LOD3`.
 */
export function bakeImpostor(renderer: any, sourceGroup: any, opts?: {}): Promise<Group>;
export function assembleBillboardFromRawBake(res: any, opts?: {}): Group<import("three").Object3DEventMap>;
export function disposeBillboard(group: any): void;
import { CanvasTexture } from 'three/webgpu';
import { DataTexture } from 'three/webgpu';
import { Group } from 'three/webgpu';
