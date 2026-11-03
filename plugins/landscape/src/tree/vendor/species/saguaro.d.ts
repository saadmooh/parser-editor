export namespace saguaro {
    let name: string;
    let latin: string;
    let bark: string;
    let spine: string;
    let leaf: string;
    let biome: string;
    let groundTexture: string;
    let rockTexture: string;
    let tileWorldSize: number;
    let plantSink: number;
    let foliageType: string;
    let cactus: boolean;
    let barkDamage: number;
    let controls: {
        key: string;
        name: string;
        min: number;
        max: number;
        step: number;
        get: (s: any) => any;
        set: (s: any, v: any) => void;
    }[];
    let advancedControls: ({
        key: string;
        name: string;
        dropdown: {
            'Candelabra (asymmetric)': boolean;
            'Symmetric V': boolean;
        };
        get: (s: any) => any;
        set: (s: any, v: any) => void;
        min?: undefined;
        max?: undefined;
        step?: undefined;
    } | {
        key: string;
        name: string;
        min: number;
        max: number;
        step: number;
        get: (s: any) => any;
        set: (s: any, v: any) => void;
        dropdown?: undefined;
    })[];
    let foliage: boolean;
    namespace spines {
        let density: number;
        let size: number;
        let widthFrac: number;
        let embed: number;
        let sizeVar: number;
        let splay: number;
    }
    namespace params {
        let firstForkHeight: number;
        let armLength: number;
        let armFalloff: number;
        let forkGenerations: number;
        let branchiness: number;
        let armAsymmetric: boolean;
        let armMinHeightFrac: number;
        let armMaxOrder: number;
        let armGenerations: number;
        let forkSpread: number;
        let curlUp: number;
        let armBend: number;
        let gnarliness: number;
        let forkRadiusKeep: number;
        let forkBaseScale: number;
        let trunkRadius: number;
        let trunkFlare: number;
        let trunkPinch: number;
        let trunkSegRes: number;
        let ribCount: number;
        let ribsPerTile: number;
        let ribDepth: number;
        let radialSegs: number;
        let trunks: number;
        let branchRepel: number;
    }
}
