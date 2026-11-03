export function defaultParams(): {
    seed: string;
    scale: number;
    scaleV: number;
    levels: number;
    ratio: number;
    ratioPower: number;
    baseSize: number;
    shape: number;
    flare: number;
    lobes: number;
    lobeDepth: number;
    attractionUp: number;
    attractionUpMinLevel: number;
    forceDir: {
        x: number;
        y: number;
        z: number;
    };
    forceStrength: number;
    forceMinLevel: number;
    forceLevelScale: null;
    baseSplits: number;
    baseSplitAngle: number;
    trunkForkHeight: null;
    trunkForkCount: number;
    trunkForkAngle: number;
    trunkForkAngleV: number;
    trunkForkRadiusKeep: number;
    trunkForkBaseTaper: number;
    trunkForkFlareScale: number;
    decurrentTrunk: boolean;
    decurrentTrunkExtension: number;
    forkChance: number;
    length: number[];
    lengthV: number[];
    taper: number[];
    curveRes: number[];
    curve: number[];
    curveBack: number[];
    curveV: number[];
    zigzagAngle: number[];
    zigzagAngleV: number[];
    downAngle: number[];
    downAngleV: number[];
    rotate: number[];
    rotateV: number[];
    whorlSize: number[];
    twist: number[];
    branchStart: null;
    branchEnd: null;
    branchDistPower: null;
    downAngleProgress: number[];
    lengthScaleBase: number[];
    lengthScaleTip: number[];
    branchJitter: null;
    branchSpacing: null;
    branchMin: null;
    branchMax: null;
    lengthAbsolute: null;
    lengthAbsoluteV: null;
    lengthMin: null;
    lengthMax: null;
    terminalFloor: null;
    terminalFloorV: number;
    terminalFloorWave: number;
    terminalFloorLobes: number;
    terminalFloorMin: null;
    terminalFloorMax: null;
    branches: number[];
    tipCluster: number[];
    radialSegments: number[];
};
/**
 * @param {object} userParams  overrides merged onto DEFAULTS
 * @param {import('./rng.js').Rng} rng  threaded RNG (parent-before-children order)
 * @returns {{ stems: Array, tips: Array, params: object }}
 */
export function generateSkeleton(userParams: object, rng: import("./rng.js").Rng): {
    stems: any[];
    tips: any[];
    params: object;
};
