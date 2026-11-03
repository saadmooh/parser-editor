export class Rng {
    /** @param {string|number} seed */
    constructor(seed: string | number);
    _state: number;
    /** Uniform float in [0, 1). splitmix32. */
    next(): number;
    /** Uniform float in [min, max). */
    range(min: any, max: any): any;
    /** Symmetric variation: base ± spread (spread is the half-range). */
    vary(base: any, spread: any): any;
    /** Uniform integer in [min, max] inclusive. */
    int(min: any, max: any): number;
    /** True with probability p. */
    chance(p: any): boolean;
    /** Pick a random element from an array. */
    pick(arr: any): any;
}
