export namespace joshuaTree {
    let name: string;
    let latin: string;
    let bark: string;
    let thatchBark: string;
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
        let leafLen: number;
        let leafLenVar: number;
        let thatchStep: number;
    }
    namespace params {
        let firstForkHeight: number;
        let armLength: number;
        let armFalloff: number;
        let forkGenerations: number;
        let branchiness: number;
        let forkSpread: number;
        let curlUp: number;
        let armBend: number;
        let gnarliness: number;
        let continuationKink: number;
        let forkRadiusKeep: number;
        let trunkRadius: number;
        let radialSegs: number;
        let trunks: number;
        let branchRepel: number;
    }
}
