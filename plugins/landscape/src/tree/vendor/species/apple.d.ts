export namespace apple {
    export let name: string;
    export let latin: string;
    export let bark: string;
    export let leaf: string;
    export let biome: string;
    export let tileWorldSize: number;
    export { broadleafControls as controls };
    export let terminalStemsAreGuides: boolean;
    export namespace fruit {
        let mesh: string;
        let perBranch: number;
        let chance: number;
        let startFrac: number;
        let maxCount: number;
    }
    export namespace foliage {
        export let mode: string;
        export let clustersPerBranch: number;
        export let clusterSize: number;
        export let clusterSizeVar: number;
        export let clusterQuads: number;
        export let tint: number;
        export let leavesPerBranch: number;
        export let size: number;
        export let sizeVar: number;
        let startFrac_1: number;
        export { startFrac_1 as startFrac };
        export let downAngle: number;
        export let bend: number;
        export let trunkClearRadius: number;
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
        export let attractionUpMinLevel: number;
        export let baseSplits: number;
        export let baseSplitAngle: number;
        export let decurrentTrunk: boolean;
        export let decurrentTrunkExtension: number;
        export let length: number[];
        export let lengthV: number[];
        export let lengthAbsolute: (number | null)[];
        export let lengthAbsoluteV: number[];
        export let lengthMin: number[];
        export let lengthMax: (number | null)[];
        export let taper: number[];
        export let curveRes: number[];
        export let curve: number[];
        export let curveBack: number[];
        export let curveV: number[];
        let downAngle_1: number[];
        export { downAngle_1 as downAngle };
        export let downAngleV: number[];
        export let downAngleProgress: number[];
        export let rotate: number[];
        export let rotateV: number[];
        export let branches: number[];
        export let radialSegments: number[];
        export let branchStart: number[];
        export let branchEnd: number[];
        export let branchDistPower: number[];
        export let branchJitter: number[];
    }
}
import { broadleafControls } from './broadleaf-controls.js';
