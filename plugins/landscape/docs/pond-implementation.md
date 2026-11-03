# Pond implementation

## Rock borders

The pond inspector and creation defaults offer Scattered clusters, Continuous rock border, and No border rocks. Existing scenes default to the original clusters. Continuous borders can follow the water's edge, the outside of the bank, or both contours. Rock size, spacing, size variation and a saved pattern seed control the layout. Bank finish remains independent, so a gravel bank can also have a rock border. Underwater stones remain when border rocks are disabled.

The border follows arc length along the actual pond outline; polygon offsets place the outer row around concave shapes without scaling the outline about its origin. The rocks rest on the same terrain field as the pond. Rendering, wave/fish obstacles and plan/PDF symbols share the border placements. Layouts are limited to 384 border rocks; very large ponds with small stones use wider spacing. Rocks are schematic design geometry, rather than a construction specification.

Continuous borders generate a distinct coherent-deformed rock mesh for each saved shape seed. Mixed, rounded and angular shape settings are available, together with independent size, shape, height, position, rotation and colour variations and moss coverage. Seeded channels keep unrelated properties stable when one variation control changes. The Randomize rocks action saves a fresh seed through the canonical scene update, allowing undo and reproducible reloads. At most eight shaded materials are shared across the unique border geometries; all are disposed with the pond. The border panel uses the editor's public SegmentedControl, MetricControl, SliderControl and ActionButton directly, with no custom control components.

Design research: [Aquascape pond edging](https://www.aquascapeinc.com/professionals/blog/contractor-articles/creative-pond-edging-ideas) describes boulder/gravel transitions, continuous granite edging, and supported outcroppings. [Belgard pool decks and coping](https://www.belgard.com/outdoor-living/hardscape-ideas/pool-deck-designs/) provides the formal pool-edge comparison. The Landscape implementation uses the natural boulder treatment.

## The revised Landscape implementation

The pond now uses the reference's terrain construction. It has no extruded basin, vertical wall, flat bed plate or coping ring. `terrain.ts` ports the `fs()` shoreline perturbation and `Jn()`'s smooth bed/shelf profile, including its off-centre deeper pocket. The reference's distant hills are replaced by a finite rolling bank that blends into the project's existing ground.

### Ground, bed and shelves

A subdivided plane becomes one continuous heightfield. The inner half is a broad deep floor. Between normalized radius 0.5 and 1, a cubic smoothstep rises to the shoreline with zero endpoint slope. The reference's low-amplitude bed unevenness and fourth-power exponential deeper pocket are retained, scaled to the authored depth. The deepest pocket can reach about 1.12 times the nominal bed depth.

Ovals use the reference's three sinusoidal shoreline terms; circles retain their circular outline. Custom and freehand shapes derive depth from signed distance to their authored boundary. Resolution is bounded to 256 subdivisions per axis. The water mesh is clipped triangle-by-triangle against the actual terrain/water-plane intersection, so a lowered water level reveals shallow shelves instead of covering dry land.

`site-terrain.ts` writes the basin and rolling banks into the site's persisted Terrain heightfield, using the same field format and native terrain renderer as the Terrain tool. There is no replacement ground plane and no pond subtraction in the pool-cutout utility. The pond renderer adds only water and rocks; water clipping and stone placement sample the actual site field. The existing site's material receives mineral, wet-shore and grass blending through `terrain-appearance.tsx`.

The site stores its unexcavated baseline and last applied field in metadata. Pond changes recompute from this baseline, preventing cumulative digging. Moving, hiding or deleting a pond restores the previous ground; overlapping ponds compose deterministically. Terrain brush changes are recovered as differences from the last applied field, preserving manual sculpting when ponds change or are removed. Saved scene metadata retains this baseline across reloads. Derived updates do not add separate undo steps.

The unexcavated site's elevation at the pond centre sets the water datum. Parent translations and yaw are included in site coordinates. Landscape ground surfaces are tessellated and draped onto the site's field, blending their elevation offset away within the basin. Grass blades follow dry terrain and are excluded below the waterline. Building slabs and hard paving still require their own openings. The native Pool feature retains its original cutouts.

### Actual reference stones and materials

`assets/rocks.json` contains five scanned meshes decoded from the downloaded packed vertex/normal/index binary, plus its lower-resolution pebble mesh. Six rounded boulder variants use the reference's sphere displacement. Eight uneven shoreline clusters reproduce the reference's cluster angles/counts and three larger hero rocks. Twelve shelf stones and up to 1,600 instanced underwater pebbles add submerged detail. Stones are embedded into the local terrain and submerged stones stay below the authored waterline. Custom concave outlines reject shelf placements outside their boundary.

The original river-mineral, leafy-grass, dark-rock diffuse/normal/ARM and moss scans are bundled locally. `materials.ts` translates the reference's mineral luminance recolouring, sand/shelf blend, wet shoreline, meadow tint, triplanar stone colour, multiscale moss growth and wet-rock roughness into native Three.js TSL materials. This avoids WebGL-only `onBeforeCompile` patches in Pascal's WebGPU renderer.

### Reference waves and native water optics

`wave-field.js` is the reference's numerical `Hx` function, renamed `createWaveField`, preserved verbatim with a typed declaration. Its staggered velocities, depth-dependent propagation, 1/120-second step, CFL substeps, damping, edge absorption, mass-conserving impacts and drag stirring are retained. Each pond owns a bounded 128 × aspect-adjusted grid, capped at 160 rows, rather than the reference's single 320 × 256 field. Terrain and emergent shoreline rocks constrain the field.

`water.ts` transfers simulation heights/slopes and terrain attenuation/gradients into float textures. It translates the reference's five transverse-modulated wind waves, fading capillary detail when it becomes subpixel. Water height and normals combine wind and the numerical field, attenuated in the shallows.

The native material captures opaque scene colour/depth and a mirrored view. It reconstructs hit positions, bends rays using eta 1/1.333, rejects foreground silhouettes, and uses the reference's absorption coefficients (4.2, 0.45, 0.1), scatter density 0.25 and Fresnel response. These are renderer-native adaptations of the reference optical pass, not a byte-for-byte port of its WebGL shaders. Native reflector nodes manage capture targets and restore renderer state. Targets, float textures, geometry and materials are disposed when the pond is rebuilt or removed.

Animated water uses the host's frame loop. Animation can be disabled. `disturbPondWater` and `stirPondWater` expose world-space interaction APIs; the preview's Make waves checkbox demonstrates impact and drag propagation. The editor keeps its usual object selection/drawing interactions.

Live simulation state is held in private WeakMaps and bound to the water mesh. It is not stored in material `userData`, which Three.js JSON-clones and strips of functions when copying materials. Animation and interactions keep updating the shared shader uniforms and textures after a material replacement; pond cleanup also releases the original material and simulation resources. A regression test reproduces the material-clone crash and verifies continued animation, interaction and disposal.

The renderer retains its geometry for the lifetime of its effect. Release is deferred to the end of the commit and cancelled if React immediately replays the effect with the same geometry. This prevents StrictMode/Fast Refresh cleanup from destroying reflection textures that the retained pond still uses. Final removal and replacement still dispose resources. Tests cover replay and replacement; a native WebGPU preview completed three replays plus shape, width and depth rebuilds with zero GPU validation errors. Applying the previous immediate cleanup to a live pond reproduced a destroyed-resource submission error. Browser proof is saved at `reports/pond-preview/webgpu-lifetime.webp`.

The recurring editor error had a separate cause: `viewportSharedTexture` reused a global refraction framebuffer across differently sized render passes. GPU labels identified that shared color texture as the destroyed resource. `scene-capture.ts` now uses target-specific color/depth captures, each with its own texture source and dimensions. This also avoids Three.js texture clones sharing image metadata. Pond disposal releases every allocated capture. Regression tests alternate 1504 × 964 main and 752 × 482 reflection passes and verify stable texture identities, sources, dimensions and versions.

### Koi, water moods and additional optics

`fish.ts` adapts `Qv`'s body profile, radial mesh rings, curved fin outlines, six marking variants and tail-bending formula to native TSL. Opaque fish are visible through the water's refraction capture. Each pond supports 0–24 koi, with lengths of 0.15–0.8 metres. Existing scenes default to zero fish. Swimming sites and future positions are checked against actual depth, the pond boundary and shoreline/shelf rocks. A basin without enough habitat creates no fish. Fish have independent home positions, turning, separation, depth variation and reactions to local wave flow. Feed koi scatters floating food and gathers the school for up to 16 seconds. Runtime state stays in WeakMaps; original and host-cloned materials are both released on removal.

The animated renderer exclusively owns pond geometry. The definition deliberately omits the generic `geometry` hook: registering both caused the host GeometrySystem to add a second static pond alongside the animated one, first made visible by doubled koi. The standalone `buildPondGeometry` function remains available for previews and tests.

The inspector adds Natural, Glass, Cinematic and Playful water moods, plus custom clarity, reflection, refraction, sun glints and underwater-light settings. Presets adapt the reference's optical and motion settings without changing project lighting. Sun glints use its GGX distribution, pixel-normal variance, Schlick response and bounded highlight. Underwater light is a modest animated bed shimmer derived from captured scene positions, rather than the dedicated photon-caustic pass. Wave speed, settling, rain intensity and koi response are saved per pond. Rain adds small wave-field impacts; Make waves adds an impact in the deepest wet area. Pausing freezes water and fish; bounded time steps avoid teleporting fish when animation resumes.

### Editor integration

Landscape → Layout → Library → Surfaces → Pond creates a persistent `landscape:pond` node. Rectangle, circle, natural oval, custom and freehand drawings remain available. The inspector controls dimensions, height above ground, nominal deep-bed depth, water level, rolling-bank width/rise, stone/gravel treatment, colour, motion and animation. Shared handles, boundary tools, selection, movement, duplication, deletion and read-only checks are retained.

Floorplan rendering includes the bank and shoreline without a rectangular replacement-ground outline. Inventory, selection, recents and quantities recognize ponds. Capacity numerically integrates the shaped bed and shelves; it no longer multiplies footprint area by a flat-tank depth. Water area follows the wet terrain footprint.

### Scope of the match

The corrected feature ports the terrain profile, assets, rock construction, numerical solver, wind model and koi construction and adapts the optical rendering to Pascal. It does not recreate the entire reference composition or promise identical pixels under different project lighting. Reference vegetation scenery, leaves, boats, thrown-stone/splash tools, visible rain droplets, underwater camera treatment, the dedicated photon-caustic pass and contact-occlusion postprocessing are not included.

## Verification

Terrain tests cover smooth shore continuity, all five drawing modes, wet-shelf clipping, existing terrain preservation, transformed coordinates, multiple ponds, movement, hiding, deletion and saved-data restoration. The scene-store integration test verifies create, resize, delete, undo and redo without extra history steps. Ground tests verify that an elevated landscape surface follows the basin and ponds no longer punch rectangular pool holes. Wave and resource tests cover conservation, damping, obstacles, material cloning and capture lifetimes.

The full Landscape suite passes: 341 tests across 84 files, including 34 pond tests. The Landscape TypeScript check passes. Koi tests cover finite geometry, prolonged swimming and feeding, concave and shallow habitat, rock avoidance, world-coordinate interactions, still-water animation, rain, pause/resume and original/host-cloned material disposal. The interactive preview uses persisted site excavation and draped Landscape ground geometry.

The actual editor at port 3004 was tested in Chrome. Drawing and resizing excavate the native terrain, and deletion restores the pre-existing site including an unrelated sculpted feature. Cleanup retains custom vertex buffers until host geometry disposal, because a host material clone can still refer to them during a render pass. This fixes the vertex-buffer validation error reproduced during deletion. Inspector changes and 2D/split/3D checks were performed with console error monitoring. Browser keyboard undo could not be confirmed in the disposable canvas; the underlying scene-store undo/redo is covered by the integration test. Proof is saved at `reports/pond-preview/terrain-pond-editor.webp`.

Preview source and launch instructions: `reports/pond-preview/`.

The koi/water update was checked in the actual WebGPU editor: feeding, water moods, manual reflection and rain values, pause/resume, read-only controls and 2D/split/3D views. A final clean reload verified a single animated school after removing the duplicate generic-geometry registration. No new console/GPU errors were recorded. Browser proof: `reports/pond-preview/koi-water-editor.webp`.
