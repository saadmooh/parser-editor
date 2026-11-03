/** One-line descriptor per species — the menu an agent picks from. */
export function listSpecies(): {
    key: string;
    name: string;
    latin: string;
    biome: string;
    foliageType: any;
    cactus: boolean;
    generator: string;
}[];
/**
 * The full knob vocabulary for a species: exactly what the UI exposes, as data.
 *   shape    — the species' own headline dials (branch density, fork generations…)
 *   advanced — per-level Weber-Penn dials (temperate, as `paramOverrides.<key>.<lvl>`
 *              paths) OR the flat L-system dials (rosette/cactus)
 *   global   — seed / showLeaves / bark tiling
 *   material — live tint/alpha/flat dials (leaf, bark, frond, spine)
 *   lod      — the LOD/optimization options for generate()'s `lod` arg
 */
export function getSchema(speciesKey: any): {
    species: any;
    name: any;
    latin: any;
    biome: any;
    foliageType: any;
    cactus: boolean;
    generator: string;
    shape: any;
    advanced: any;
    global: ({
        key: string;
        name: string;
        group: string;
        type: string;
        default: boolean;
        min?: undefined;
        max?: undefined;
        step?: undefined;
    } | {
        key: string;
        name: string;
        group: string;
        min: number;
        max: number;
        step: number;
        default: any;
        type?: undefined;
    } | {
        key: string;
        name: string;
        group: string;
        type: string;
        default: number;
        min?: undefined;
        max?: undefined;
        step?: undefined;
    })[];
    lod: ({
        key: string;
        name: string;
        min: number;
        max: number;
        step: number;
        default: number;
        temperateOnly?: undefined;
    } | {
        key: string;
        name: string;
        min: number;
        max: number;
        step: number;
        default: number;
        temperateOnly: boolean;
    })[];
};
/** The default control object for a species (identical to a fresh UI load). */
export function defaultControls(speciesKey: any): {
    seed: number;
    showLeaves: boolean;
    tileWorldSize: any;
    paramOverrides: {};
    forceDirX: any;
    forceDirY: any;
    forceDirZ: any;
    forceStrength: any;
    leafColorize: number;
    leafTintAmount: number;
    leafAngle: any;
    leafStart: any;
    leafSizeVar: any;
    leafAlpha: any;
    leafQuads: any;
    barkTint: any;
    barkFlat: boolean;
    frondGreenTint: number;
    frondDryTint: number;
    frondDryestTint: number;
    frondDryness: number;
    spineTint: number;
    barkDamage: any;
};
/**
 * Text menu for agents. Call with no args for the species list; with a species
 * key for its quick-start + folder index; with (species, folder) to open one
 * folder ('shape' | 'advanced' | 'global' | 'material' | 'lod').
 */
export function describe(speciesKey?: null, folder?: null): string;
/** Per-LOD + summary geometry stats for a built THREE.LOD (or any Object3D). */
export function statsOf(group: any): {
    summary: {
        lod0Triangles: number;
        widthMeters?: number | undefined;
        heightMeters?: number | undefined;
        depthMeters?: number | undefined;
        lodCount: number;
    };
    perLod: {
        name: any;
        distance: any;
        meshes: number;
        instances: number;
        triangles: number;
        verts: number;
        appOnly: boolean;
        hiddenInApp: boolean;
    }[];
    boundingBox: {
        min: import("three").Vector3Tuple;
        max: import("three").Vector3Tuple;
    } | null;
};
/**
 * Raw skeleton for a design (stem/tip counts, levels) — CPU only, no meshing.
 * Uses the SAME rng seed convention as buildTree so counts match the built tree.
 */
export function skeleton({ species, seed, controls }?: {
    seed?: number | undefined;
    controls?: {} | undefined;
}): {
    generator: string;
    stems: any;
    terminals: any;
    tips?: undefined;
    stemsByLevel?: undefined;
} | {
    generator: string;
    stems: number;
    tips: number;
    stemsByLevel: {};
    terminals?: undefined;
};
/**
 * Grow a plant from a design — real branch + leaf geometry at every LOD, with
 * self-constructed node materials (no textures). Runs with no server and no GPU.
 *
 * @param {object} o
 * @param {string} o.species  species key (see listSpecies)
 * @param {number} [o.seed=1]
 * @param {object} [o.controls]  partial override of the species' controls (see getSchema)
 * @param {object} [o.lod]       lodOpts (see LOD_OPTIONS); card/billboard bakes are skipped headless
 * @param {object} [o.assets]    prebuilt material bag (from buildAssets) — else placeholder materials
 * @param {boolean} [o.placeholders=true]  when no material bag is given, self-supply
 *                  placeholder materials so the FULL plant grows (canopy included)
 *                  and stats match the app. false → bare skeleton (branches only).
 * @returns {{ group: THREE.LOD, stems: object[], tips: object[], stats: object, preset: object, shaped: object }}
 */
export function generate({ species, seed, controls, lod, assets, placeholders }?: {
    species: string;
    seed?: number | undefined;
    controls?: object | undefined;
    lod?: object | undefined;
    assets?: object | undefined;
    placeholders?: boolean | undefined;
}): {
    group: THREE.LOD;
    stems: object[];
    tips: object[];
    stats: object;
    preset: object;
    shaped: object;
};
/**
 * All SeedThree materials sway via shared wind uniforms (strength defaults to
 * 0.5, speed to 1.0) — in a live render the trees MOVE by default. Set strength
 * to 0 for a perfectly still plant, or tune the gusts per shot.
 */
export function setWind({ strength, speed }?: {}): {
    strength: number;
    speed: number;
};
export function composeMaterials(sp: any, assets: any, sunLight?: null): any;
/**
 * A full material bag over placeholder textures — the plant renders with flat
 * plausible colors (green canopy, brown/green bark) and, more importantly, its
 * GEOMETRY, STATS, and BOUNDS are identical to the textured tree.
 */
export function placeholderAssets(speciesKey: any, { sunLight }?: {
    sunLight?: null | undefined;
}): any;
/**
 * Build the app's real per-species material bag (bark/leaf/rosette/spine + thatch,
 * cactus clean-skin blend) using an injected texture loader — the headless twin of
 * main.js loadSpeciesAssets. Pass the result as generate({ assets }) or createTree.
 *
 * @param {object} o
 * @param {string} o.species
 * @param {(path:string, opts:{srgb:boolean}) => Promise<Texture|null>} o.loadTexture
 * @param {string} [o.assetsDir='assets']  root of the SeedThree assets/ tree
 * @param {object} [o.sunLight]            optional THREE light (cactus spine self-shadow)
 */
export function buildAssets({ species, loadTexture, assetsDir, sunLight }?: {
    species: string;
    loadTexture: (path: string, opts: {
        srgb: boolean;
    }) => Promise<Texture | null>;
    assetsDir?: string | undefined;
    sunLight?: object | undefined;
}): Promise<any>;
/**
 * One-call textured tree for a live scene (eidoverse): load the species' PBR maps
 * through your loader, build the real materials, grow the plant. Returns the group
 * ready to scene.add(). Pass `level` to get just one LOD's Object3D (the common
 * case for a hero plant — 'LOD0' is full detail).
 */
export function createTree({ species, seed, controls, lod, loadTexture, assetsDir, sunLight, level }?: {
    seed?: number | undefined;
    controls?: {} | undefined;
    lod?: {} | undefined;
    assetsDir?: string | undefined;
    sunLight?: null | undefined;
    level?: null | undefined;
}): Promise<{
    group: THREE.LOD;
    stems: object[];
    tips: object[];
    stats: object;
    preset: object;
    shaped: object;
}>;
/** Serialize a design to the exact JSON the app's Save preset writes. */
export function toPreset({ species, seed, controls }: {
    species: any;
    seed?: number | undefined;
    controls?: {} | undefined;
}): {
    format: string;
    species: any;
    controls: {
        seed: number;
        showLeaves: boolean;
        tileWorldSize: any;
        paramOverrides: {};
        forceDirX: any;
        forceDirY: any;
        forceDirZ: any;
        forceStrength: any;
        leafColorize: number;
        leafTintAmount: number;
        leafAngle: any;
        leafStart: any;
        leafSizeVar: any;
        leafAlpha: any;
        leafQuads: any;
        barkTint: any;
        barkFlat: boolean;
        frondGreenTint: number;
        frondDryTint: number;
        frondDryestTint: number;
        frondDryness: number;
        spineTint: number;
        barkDamage: any;
    };
};
/** Parse an app preset back into { species, seed, controls } (defaults-merged). */
export function fromPreset(preset: any): {
    species: any;
    seed: any;
    controls: any;
};
/**
 * Export an object (from generate().group or a single level) to a .glb ArrayBuffer.
 * Node-focused: materials are swapped to plain MeshStandardMaterial on a throwaway
 * scene so the GLB opens cleanly anywhere (the app's TSL/textured look is a live-
 * render feature, not a glTF one). Returns an ArrayBuffer; the caller writes it.
 * Under Deno, pass the exporter class: exportGLB(obj, { exporter: GLTFExporter }).
 */
export function exportGLB(object: any, { binary, exporter }?: {
    binary?: boolean | undefined;
    exporter?: null | undefined;
}): Promise<any>;
export function speciesOrThrow(key: any): any;
export const LOD_OPTIONS: ({
    key: string;
    name: string;
    min: number;
    max: number;
    step: number;
    default: number;
    temperateOnly?: undefined;
} | {
    key: string;
    name: string;
    min: number;
    max: number;
    step: number;
    default: number;
    temperateOnly: boolean;
})[];
import { SPECIES } from '../species/index.js';
import { DEFAULT_SPECIES } from '../species/index.js';
import { CROWN_SHAPES } from '../ui/controls.js';
import { ADVANCED_LEVEL_PARAMS } from '../ui/controls.js';
export { SPECIES, DEFAULT_SPECIES, CROWN_SHAPES, ADVANCED_LEVEL_PARAMS };
