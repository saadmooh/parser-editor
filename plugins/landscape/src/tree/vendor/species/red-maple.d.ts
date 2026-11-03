export namespace redMaple {
    export let name: string;
    export let latin: string;
    export let bark: string;
    export let leaf: string;
    export let biome: string;
    export let tileWorldSize: number;
    export { broadleafControls as controls };
    export namespace foliage {
        let mode: string;
        let clustersPerBranch: number;
        let clusterSize: number;
        let clusterSizeVar: number;
        let clusterQuads: number;
        let tint: number;
        let leavesPerBranch: number;
        let size: number;
        let downAngle: number;
        let bend: number;
        let trunkClearRadius: number;
    }
    export namespace params {
        export let scale: number;
        export let scaleV: number;
        export let levels: number;
        export let ratio: number;
        export let ratioPower: number;
        export let baseSize: number;
        export let shape: number;
        export let flare: number;
        export let attractionUp: number;
        export let baseSplits: number;
        export let baseSplitAngle: number;
        export let length: number[];
        export let lengthV: number[];
        export let taper: number[];
        export let curveRes: number[];
        export let curve: number[];
        export let curveBack: number[];
        export let curveV: number[];
        let downAngle_1: number[];
        export { downAngle_1 as downAngle };
        export let downAngleV: number[];
        export let rotate: number[];
        export let rotateV: number[];
        export let branches: number[];
        export let radialSegments: number[];
    }
}
import { broadleafControls } from './broadleaf-controls.js';
