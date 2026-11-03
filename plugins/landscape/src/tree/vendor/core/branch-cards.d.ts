/**
 * Bake 2-4 exemplar branch cards for a species, rooted at a chosen branch level.
 * Caller must pause its animation loop (renderer is re-targeted).
 *
 * @param {object} species  shaped species preset (params + foliage reflect GUI)
 * @param {object} assets   cached species assets (barkMat, leafMat, ...)
 * @param {object} opts     { size, variants, cardLevel } — cardLevel defaults to
 *                          the deepest level (per-twig cards); lower levels bake a
 *                          whole limb (branch + twigs + leaves) into one card.
 * @returns {Promise<{variants: Array, centerUniform} | null>}
 */
export function bakeBranchCards(renderer: any, species: object, assets: object, opts?: object): Promise<{
    variants: any[];
    centerUniform: any;
} | null>;
/**
 * Bake TERMINAL ROSETTE BRANCH cards for a dichotomous species (Joshua/yucca):
 * each exemplar is a terminal arm — tube stub + FULL desktop-quality crown and
 * dead-leaf skirt (texture triangles are free, so the card gets the hero look) —
 * baked in one front view. Rosette crowns are near-rotationally-symmetric, so
 * one view serves a 4-way crossed placement (buildCardFoliage {copies: 4}).
 * The far mobile rung replaces every terminal arm (~600 cone tris) with 8 tris.
 */
export function bakeRosetteCards(renderer: any, species: any, assets: any, opts?: {}): Promise<{
    variants: {
        geometry: BufferGeometry<import("three").NormalBufferAttributes, import("three").BufferGeometryEventMap>;
        material: MeshSSSNodeMaterial;
        textures: any;
        chordLen: number;
    }[];
    centerUniform: import("three/webgpu").UniformNode<"vec3", Vector3>;
    rosette: boolean;
} | null>;
/**
 * Exact low-discrepancy stem subset. Ranking only stable stem identity means
 * every lower keep fraction is a strict subset of every higher one, while the
 * returned array retains source order for deterministic card bucketing.
 */
export function stableStemSubset(stems: any, keepFraction: any): any;
/**
 * Place one baked card per terminal stem (variant round-robin, random roll
 * about the branch axis). LOD2 passes keepFraction < 1 + a bigger growScale —
 * the SpeedTree "fewer and bigger" volume-preserving reduction.
 * stableKeep replaces Bernoulli thinning with an exact, deterministic,
 * low-discrepancy subset whose survivors nest as keepFraction decreases.
 *
 * @returns {Group} one InstancedMesh per variant
 */
export function buildCardFoliage(terminalStems: any, cards: any, rng: any, opts?: {}): Group;
export function forestCardMaterial(srcMat: any): any;
export function disposeBranchCards(cards: any): void;
import { BufferGeometry } from 'three/webgpu';
import { MeshSSSNodeMaterial } from 'three/webgpu';
import { Vector3 } from 'three/webgpu';
import { Group } from 'three/webgpu';
