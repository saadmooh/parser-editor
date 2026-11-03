// Maps friendly UI controls onto Weber-Penn species params, and builds the
// lil-gui panel. Kept separate from main.js so the parameter vocabulary lives in
// one place as we add species and controls.


// Crown-shape dropdown values (Weber-Penn Shape enum) — exported so species
// control schemas can reference it.
export const CROWN_SHAPES = {
  Conical: 0, Spherical: 1, Hemispherical: 2, Cylindrical: 3,
  'Tapered cyl.': 4, Flame: 5, 'Inverse conical': 6, 'Tend flame': 7,
};

// Each species declares its OWN control schema (species.controls: an array of
// { key, name, min, max, step | dropdown, get(species), set(shaped, v) }) so a
// broadleaf's "branch density" and a Joshua tree's "fork generations" are
// different sliders mapped to that species' own params — no shared oak
// vocabulary clobbering another species' branching.

// ez-tree-parity ADVANCED per-level Weber-Penn dials: one slider per level for
// each of these params, mapped straight onto species.params arrays. Only shown
// for the broadleaf/conifer path (rosette/dichotomous species have their own
// vocabulary + generator). `trunk` = whether index 0 (the trunk) gets a dial.
export const ADVANCED_LEVEL_PARAMS = [
  { key: 'downAngle',      name: 'Down angle',  min: 0,    max: 135, step: 1,    trunk: false, dflt: 0 },
  { key: 'branches',       name: 'Children',    min: 0,    max: 60,  step: 1,    trunk: false, dflt: 0 },
  { key: 'curveV',         name: 'Gnarliness',  min: 0,    max: 120, step: 1,    trunk: true,  dflt: 40 },
  { key: 'curve',          name: 'Curve',       min: -90,  max: 90,  step: 1,    trunk: true,  dflt: 0 },
  { key: 'length',         name: 'Length ×', min: 0.02, max: 1.5, step: 0.01, trunk: false, dflt: 0.4 },
  { key: 'taper',          name: 'Taper',       min: 0,    max: 1,   step: 0.01, trunk: true,  dflt: 1 },
  { key: 'twist',          name: 'Twist',       min: -0.5, max: 0.5, step: 0.01, trunk: true,  dflt: 0 },
  { key: 'curveRes',       name: 'Sections',    min: 2,    max: 20,  step: 1,    trunk: true,  dflt: 8 },
  { key: 'radialSegments', name: 'Segments',    min: 3,    max: 16,  step: 1,    trunk: true,  dflt: 6 },
];

// Default friendly-control values, read from the active species' schema.
export function controlsFromSpecies(species) {
  const c = {
    seed: 1, showLeaves: true, tileWorldSize: species.tileWorldSize ?? 1.5,
    // ez-tree parity: raw per-level param overrides ({ paramKey: { level: value } })
    // + a general growth-force tropism (strength 0 = off, tree unchanged).
    paramOverrides: {},
    forceDirX: species.params?.forceDir?.x ?? 0,
    forceDirY: species.params?.forceDir?.y ?? 1,
    forceDirZ: species.params?.forceDir?.z ?? 0,
    forceStrength: species.params?.forceStrength ?? 0,
    // ez-tree parity leaf/bark editing. Geometry ones (angle/start/sizeVar/quads)
    // reshape on rebuild; material ones (tint/alphaTest/flat) update the cached
    // material live. Defaults read from the species so a switch re-seeds them.
    leafColorize: 0xffffff,   // colorize target (interpolated toward, not multiplied)
    leafTintAmount: 0,        // 0 = raw texture, 1 = fully recolored
    leafAngle: species.foliage?.downAngle ?? 52,
    leafStart: species.foliage?.startFrac ?? 0.1,
    leafSizeVar: species.foliage?.sizeVar ?? 0.3,
    leafAlpha: species.foliage?.alphaTest ?? 0.4,
    leafQuads: species.foliage?.quads ?? 2,
    barkTint: species.barkTint ?? 0xffffff, // species may cool/darken its wood
    barkFlat: false,
    // Desert species color editing. Fronds (Joshua/yuccas) have 3 age-stage tints
    // + a dryness bias; cactus spines (saguaro) tint like bark. All default to no
    // change and apply live via the cached material (no rebuild).
    frondGreenTint: 0xffffff,
    frondDryTint: 0xffffff,
    frondDryestTint: 0xffffff,
    frondDryness: 0,
    spineTint: 0xffffff,
    barkDamage: species.barkDamage ?? 0.35, // saguaro: clean↔scarred blend coverage
  };
  for (const d of species.controls ?? []) c[d.key] = d.get(species);
  for (const d of species.advancedControls ?? []) c[d.key] = d.get(species); // L-system Advanced dials
  return c;
}

// Produce a species-like object with params/foliage overridden by the controls.
export function applySpeciesControls(species, c) {
  const s = {
    ...species,
    params: structuredClone(species.params),
    foliage: species.foliage === false ? false : { ...(species.foliage ?? {}) },
    tileWorldSize: c.tileWorldSize ?? species.tileWorldSize,
  };
  for (const d of species.controls ?? []) if (d.key in c) d.set(s, c[d.key]);
  for (const d of species.advancedControls ?? []) if (d.key in c) d.set(s, c[d.key]); // L-system Advanced dials
  // Bark tiling: temperate reads s.tileWorldSize (above), but the dichotomous
  // generator reads params.tileWorldSize — mirror the slider into both so the
  // "Bark tiling" dial actually retiles rosette/cactus bark.
  if (c.tileWorldSize !== undefined) s.params.tileWorldSize = c.tileWorldSize;
  // Advanced per-level overrides: write straight into the params arrays. Seed a
  // full 4-length array (shallow param merge in the generator REPLACES arrays, so
  // sparse holes would clobber the DEFAULTS) — missing slots keep the species value
  // or the advanced default.
  if (c.paramOverrides) {
    for (const [key, perLevel] of Object.entries(c.paramOverrides)) {
      if (!perLevel || !Object.keys(perLevel).length) continue;
      const cur = Array.isArray(s.params[key]) ? s.params[key] : [];
      const meta = ADVANCED_LEVEL_PARAMS.find((m) => m.key === key);
      const arr = [];
      for (let i = 0; i < 4; i++) arr[i] = cur[i] !== undefined ? cur[i] : (meta ? meta.dflt : 0);
      for (const [lvl, v] of Object.entries(perLevel)) arr[+lvl] = v;
      s.params[key] = arr;
    }
  }
  // General growth force (ez-tree tropism vector). Always write the strength:
  // a zero on the slider must be able to disable a non-zero species/preset
  // default rather than leaving the cloned source value in place.
  s.params.forceDir = { x: c.forceDirX ?? 0, y: c.forceDirY ?? 1, z: c.forceDirZ ?? 0 };
  s.params.forceStrength = c.forceStrength ?? species.params?.forceStrength ?? 0;
  // Leaf GEOMETRY overrides (ez-tree parity) — reshape the foliage cards on rebuild.
  // Tint/alphaTest are MATERIAL props applied live (cached material), not here.
  if (s.foliage) {
    const isCurtain = s.foliage.mode === 'hangingSprays' || s.foliage.mode === 'willowCurtains';
    if (!isCurtain) {
      if (c.leafAngle !== undefined) s.foliage.downAngle = c.leafAngle;
      if (c.leafStart !== undefined) s.foliage.startFrac = c.leafStart;
      if (c.leafSizeVar !== undefined) s.foliage.sizeVar = c.leafSizeVar;
    } else {
      // Curtain length variation is authored into the floor-clipped guides.
      // Scaling cards afterward can put their hem underground.
      s.foliage.sizeVar = 0;
    }
    if (c.leafQuads !== undefined) s.foliage.quads = c.leafQuads;
  }
  if (c.showLeaves === false) s.foliage = false;
  return s;
}

/**
 * @param {object} opts { speciesList, state, onChange, onRandomize, onExport, stats }
 *   state: { speciesKey, controls }  (mutated live by the GUI)
 *   stats: { species, seed, stems, leaves, triangles } — updated via returned api
 */
