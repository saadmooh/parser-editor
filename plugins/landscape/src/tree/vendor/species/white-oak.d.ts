export namespace whiteOak {
    let name: string;
    let latin: string;
    let bark: string;
    let leaf: string;
    let biome: string;
    let tileWorldSize: number;
    let controls: ({
        key: string;
        name: string;
        min: number;
        max: number;
        step: number;
        get: (s: any) => any;
        set: (s: any, v: any) => void;
        dropdown?: undefined;
    } | {
        key: string;
        name: string;
        dropdown: {
            Conical: number;
            Spherical: number;
            Hemispherical: number;
            Cylindrical: number;
            'Tapered cyl.': number;
            Flame: number;
            'Inverse conical': number;
            'Tend flame': number;
        };
        get: (s: any) => any;
        set: (s: any, v: any) => void;
        min?: undefined;
        max?: undefined;
        step?: undefined;
    })[];
    namespace foliage {
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
    }
    namespace params {
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
