export namespace sagebrush {
    let name: string;
    let latin: string;
    let category: string;
    let bark: string;
    let leaf: string;
    let biome: string;
    let groundTexture: string;
    let rockTexture: string;
    let tileWorldSize: number;
    let plantSink: number;
    let foliageType: string;
    let controls: {
        key: string;
        name: string;
        min: number;
        max: number;
        step: number;
        get: (s: any) => any;
        set: (s: any, v: any) => void;
    }[];
    let advancedControls: {
        key: string;
        name: string;
        min: number;
        max: number;
        step: number;
        get: (s: any) => any;
        set: (s: any, v: any) => void;
    }[];
    namespace foliage {
        let clustersPerBranch: number;
        let clusterSize: number;
        let clusterSizeVar: number;
        let clusterQuads: number;
        let alphaTest: number;
        let tint: number;
        let transmit: number[];
        let downAngle: number;
        let downAngleV: number;
        let droop: number;
        let startFrac: number;
        let parentSprays: number;
        let rotate: number;
    }
    namespace params {
        export let trunks: number;
        export let trunkSplayDeg: number;
        export let firstForkHeight: number;
        export let armLength: number;
        export let armFalloff: number;
        export let forkGenerations: number;
        export let branchiness: number;
        export let forkSpread: number;
        export let forkTriChance: number;
        export let curlUp: number;
        export let armBend: number;
        export let gnarliness: number;
        export let continuationKink: number;
        export let forkRadiusKeep: number;
        export let trunkRadius: number;
        export let trunkFlare: number;
        export let branchRepel: number;
        export let minRadius: number;
        export let radialSegs: number;
        export let segCurveRes: number;
        let tileWorldSize_1: number;
        export { tileWorldSize_1 as tileWorldSize };
        export let windWeightScale: number;
    }
}
