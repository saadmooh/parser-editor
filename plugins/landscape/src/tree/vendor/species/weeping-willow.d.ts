export namespace weepingWillow {
    export let name: string;
    export let latin: string;
    export let bark: string;
    export let leaf: string;
    export let biome: string;
    export let tileWorldSize: number;
    export { willowControls as controls };
    export namespace lodDistanceMultipliers {
        let lod1: number;
        let lod2: number;
        let billboard: number;
    }
    export namespace foliage {
        let mode: string;
        let tint: number;
        let leavesPerBranch: number;
        let size: number;
        let sizeVar: number;
        let widthRatio: number;
        let quads: number;
        let alphaTest: number;
        let vinesPerMeter: number;
        let minPerFeeder: number;
        let maxPerFeeder: number;
        let startFrac: number;
        let endFrac: number;
        let attachmentJitter: number;
        let attachmentMinHeightRatio: number;
        let length: number;
        let lengthVariation: number;
        let minLength: number;
        let curveBuildup: number;
        let curveBuildupVariation: number;
        let tangentInfluence: number;
        let outwardSpread: number;
        let initialLift: number;
        let minLaunchY: number;
        let archLift: number;
        let archLiftVariation: number;
        let curveReach: number;
        let curveReachVariation: number;
        let terminalSweep: number;
        let terminalSweepVariation: number;
        let groupedCardHorizontalScale: number;
        let groupedCardVerticalScale: number;
        let groupedCardVineKeepFraction: number;
        let groupedCardFeederKeepFraction: number;
        let lateralVariation: number;
        let tailPull: number;
        let segments: number;
        let floor: number;
        let floorVariation: number;
        let floorWave: number;
        let floorLobes: number;
        let floorMin: number;
        let floorMax: number;
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
        export namespace forceDir {
            let x: number;
            let y: number;
            let z: number;
        }
        export let forceStrength: number;
        export let baseSplits: number;
        export let baseSplitAngle: number;
        let length_1: number[];
        export { length_1 as length };
        export let lengthV: number[];
        export let lengthScaleBase: number[];
        export let lengthScaleTip: number[];
        export let taper: number[];
        export let curveRes: number[];
        export let curve: number[];
        export let curveBack: number[];
        export let curveV: number[];
        export let downAngle: number[];
        export let downAngleProgress: number[];
        export let downAngleV: number[];
        export let rotate: number[];
        export let rotateV: number[];
        export let whorlSize: number[];
        export let branchStart: number[];
        export let branchEnd: number[];
        export let branchDistPower: number[];
        export let branchJitter: number[];
        export let branchSpacing: number[];
        export let branchMin: number[];
        export let branchMax: number[];
        export let branches: number[];
        export let radialSegments: number[];
    }
}
declare const willowControls: {
    key: string;
    name: string;
    min: number;
    max: number;
    step: number;
    get: (s: any) => any;
    set: (s: any, v: any) => void;
}[];
export {};
