export function buildLeafAtlas(size?: number): {
    tex: THREE.DataTexture;
    avg: number[][];
    canvas: HTMLCanvasElement;
};
export function loadLeafAtlas(url: any): Promise<{
    tex: THREE.Texture<ImageBitmap, THREE.TextureEventMap>;
    avg: null;
    canvas: null;
}>;
export namespace TILE {
    let OAK: number;
    let EVERGREEN: number;
    let SAKURA: number;
    let YAMAZAKURA: number;
    let KOBUSHI: number;
    let CEDAR: number;
    let BAMBOO: number;
    let WILLOW: number;
    let KAKI: number;
    let CAMELLIA: number;
    let KEYAKI: number;
    let SHRUB: number;
    let OAK_DENSE: number;
    let SAKURA_DENSE: number;
    let CEDAR_DENSE: number;
    let EVER_DENSE: number;
    let TSUTSUJI: number;
    let FUJI: number;
    let YAMA_DENSE: number;
    let KOBUSHI_DENSE: number;
    let BAMBOO_DENSE: number;
    let SHRUB_DENSE: number;
    let OAK2: number;
    let OAK2_DENSE: number;
    let KEYAKI_DENSE: number;
}
export const ATLAS_N: 5;
import * as THREE from 'three';
