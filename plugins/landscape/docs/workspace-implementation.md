# Landscape workspace implementation

Scope: implement the workspace, library, object management, review, planting distribution, views, presentation, terrain integration, related assets, irrigation, and documentation proposed in the October 1 UI audit. Completion requires runtime verification as well as source checks. This is an ongoing implementation, not a completed feature list.

## Reuse decisions from sibling projects

Inspected `../editor/apps/editor/lib/bootstrap.ts`, the editor/core/viewer public exports, built-in node registrations, registered plugin manifests and related source, and the five packages in this repository. Also inspected sibling `weather-pascal-plugin` and Mint's installed integration documentation.

| Owner | Existing capability | Decision |
| --- | --- | --- |
| Editor | 2D, 3D, synchronized split view; first-person walk/drone; snapshots and capture; scene tree; contextual parametric inspector; measurement; terrain sculpting | Use public stores, controls, and events. Do not recreate these engines. |
| Editor sheets | Headless plan collection, vector PDF export, per-kind schedule extension | Supply Landscape schedule contributions. Do not introduce another PDF engine. |
| Built-in nodes | Fences, stairs, measurements, sheets, buildings | Reuse registered tools. |
| Environment plugin | Sky/daylight presets, time-of-day and manual sun, clouds; terrain materials/ground cover; ponds and terrain-carved rivers | Link to the installed panel; retain its ownership of presentation settings and water geometry. |
| Nature plugin | Additional procedural trees, flowers, grasses | Link to its installed panel; avoid duplicate catalogs and node kinds. |
| Streetscape | Garden/bollard lights, gates, driveways, drainage, roads, terrain grading and earthworks | Integrate existing assets and terrain operations rather than copy implementations. |
| Pool | Water features, systems, pipe routing, interactive pool section, design readiness checks | Reuse for pools. Pool pipes do not substitute for landscape irrigation/hydraulic zoning. |
| WebXR | Immersive viewing and human-scale navigation | Link to installed panel; desktop walkthrough uses the editor's first-person controls. |
| Weather sibling | Rain, snow, wind and wet surfaces | Reuse when installed. Not registered by the inspected editor bootstrap. |
| Bones | Framing and engineering views | Existing specialist tools; not a landscape irrigation or grading engine. |
| Mint | Asset generation/import | Existing external asset source; not a landscape design engine. |
| Bath Space | Fixture sections and plumbing | Useful section interaction precedent, not landscape node geometry. |

The linked host source declares 1.0.3 but includes APIs absent from the published 1.0.3 tarball. Landscape now declares a 1.0.3 lower bound; this does not establish published compatibility. Release requires a published host providing irrigation reference capabilities, inspector priority and saved-preview perspective events. See the latest acceptance audit.

## Current work

- Individual object browser, multi-selection, focus, rename, and visibility using existing scene/viewer APIs.
- Inventory traversal includes descendants, with protection against malformed cycles.
- Review rows select existing objects and include plant inventories.
- Adaptive thumbnail grid, list view, thumbnail sizing, persisted Recently Used, Used in Project filter, category-aware search.
- Direct 2D/3D/Split controls through the editor's canonical view state.
- Plant category and model-height filters; procedural-tree search also includes botanical name and biome. No sun-exposure data is invented.
- Tree/plant plan symbols and placement layers; split view uses one placement listener to avoid duplicate commits.
- Area and along-path planting with spacing, setback, seed, alternating species, an SVG preview and overlap avoidance against direct-level plant centers. Actual plants persist with source metadata and one batch undo step.
- Geometry review uses the existing outline validator and detects empty/short/disconnected path networks and unused junctions.
- Gross plan area and centerline quantity table; CSV with escaping and spreadsheet formula neutralization.
- Per-kind plant/tree and hardscape schedules through the host PDF extension.
- Tools page reuses terrain controls, first-person viewing and capture; links installed related plugin panels.

Current acceptance status and next substantial dependency are tracked in [workspace-acceptance.md](./workspace-acceptance.md).

## Remaining requirements and verification

- Validate all new UI flows with actual placed landscape objects, nested objects, hidden objects, and undo/redo.
- Object browser hierarchy, scene grouping/layers and lock semantics must reuse real host mechanisms. Do not add cosmetic lock flags.
- Sun-exposure filters require supported botanical data. Additional botanical metadata and recent ordering remain.
- Brush/erase and repeat placement. Saved planting batches now restore settings and explicitly regenerate through the host applyNodeChanges transaction while retaining existing IDs. Current layouts support two species with a configurable weighted percentage and deterministic seeded distribution; automatic regeneration after source edits, nested transformed sources and mature-canopy collision checks remain unsupported.
- Extend 2D/3D parity verification to trees, nested objects and slabs; extend paths with gradients and section geometry where absent. Direct-level plant/tree terrain support now uses the shared host floor elevation capability.
- Section/quad views and saved-camera thumbnails where host APIs support them; avoid separate competing camera state.
- Seasonal/growth comparison requires honest model semantics. Procedural size knobs are not biological age predictions.
- Expand related-asset browsing beyond panel links using registered assets without importing sibling internals.
- Irrigation node models, equipment, zones, pipes, coverage, hydraulic calculations, validation and schedules.
- Plant labels/legends, drawing-sheet integration, net quantities/cutouts and material takeoff/waste rules.
- Extend Review checks beyond outline integrity and path continuity to clearances and measured slopes.
- Browser verification at large and narrow viewport sizes; keyboard interactions, accessibility and persistence.
- Published host-version compatibility and complete relevant checks before release.

## Validation observed so far

Landscape typechecking passes. The Landscape suite passes 212 tests across 48 files, including batch planting undo/redo, deterministic spacing, setbacks, mixed layout geometry, quantity calculations, schedules and scene traversal. `git diff --check` passes for Landscape. Browser checks at 1920×907 and 1280×800 verified object selection opens the existing inspector, review selection does not add objects, recent items persist across reload and model-height filters work. A temporary plant was created in 2D and removed with Ctrl+Z; Review then confirmed only the original deck remained. Large/smaller screen screenshots are saved outside the repo under `/private/tmp/landscape-workspace-*.jpg`. No scene content from QA was retained. A monorepo test run passed 2182 tests and failed 6 in Streetscape OSM import, Bath Space split-view placement, and Pool navigation. Those failures are outside the modified Landscape code; baseline isolation is still needed before calling them pre-existing.

## Shared-control migration verification

Workspace presentation/terrain/related tools now use the public ActionButton, ActionGroup and PanelSection components. Planting uses PanelSection, MetricControl and SegmentedControl, including the host measurement parser and display-unit conversion. Browser verification opened the existing Environment panel through its related-tool action and changed planting spacing from 1.00 m to 2.00 m by entering `2m` in MetricControl. Typechecking passed. Screenshot: `/private/tmp/landscape-shared-controls.jpg`. Other new panels still need their shared-control migration; the overall scope remains active.

## Saved planting layout verification

Added validated saved-batch settings and explicit regeneration. Uses the host applyNodeChanges action for a single undo step; updates retained IDs, creates additional plants and removes surplus plants from the selected batch. Existing plants from other batches participate in spacing checks. Read-only scenes disable the operation. Browser verification drew a temporary grass source, created 44 daisies, changed spacing from 0.25 m to 0.50 m, regenerated 11 plants, and confirmed one Ctrl+Z restored 44 through Review. Two more undo operations removed all temporary QA content; Review showed the original deck only. Integration test covers retained IDs, counts and species restoration through undo/redo. Screenshot outside repo: `/private/tmp/landscape-regenerated-layout.jpg`.

## Weighted planting mix verification

Primary plant share uses the shared MetricControl; the generated counts round to the nearest whole plant, with deterministic seeded shuffling. Preview symbols, count legend and saved plants use the same mix. Settings persist with the saved batch and restore during layout selection. Browser verification used 44 plants at 75% Daisy and 25% Poppy; Review reported 33 daisies and 11 poppies. Temporary plants and source area were removed with Undo, and Review confirmed only the original deck remained. Focused mix tests and typechecking pass. Screenshot: `/private/tmp/landscape-weighted-mix.jpg`.

## Terrain support verification

Plant and tree definitions expose the host floorPlaced capability with non-colliding footprints, reusing terrain/slab support for placement and movement. Authored elevation remains an offset; the host applies the visual lift without persisting it twice. Plant instances clear their dirty state after the shared floor elevation pass. Integration coverage verifies both kinds on raised terrain, unchanged authored elevation, upper-level exclusion and positions outside terrain. Browser verification placed a temporary daisy, raised ground beneath it to about 0.48 m and observed the existing plant follow the hill. Undo restored flat ground and a second undo removed the plant. Review confirmed the original deck only. Screenshot: `/private/tmp/landscape-terrain-support.jpg`. Typechecking passes and the full Landscape suite passes 215 tests across 50 files. Trees, slab support and nested-transform browser cases remain to be verified.

## Review shared-control migration

Geometry review and quantities now use the exported PanelSection and ActionButton controls. Finding messages remain separate readable text and table rows retain measured quantity columns. Browser verification confirmed Quantities collapses and expands, and selecting Deck 1 opens the existing Deck inspector while scene counts remain one. Typechecking and diff whitespace checks pass; no console errors observed. Screenshot: `/private/tmp/landscape-review-shared-controls.jpg`. CSV export was clicked, but the browser download event timed out and the download folder cannot be read under current permissions, so end-to-end download verification remains outstanding. No scene geometry was changed in this verification. Object-browser shared-control migration remains pending.

## Object browser shared-control migration

Category groups use the host PanelSection; object selection, focus, save/restore view and visibility use ActionButton/ActionGroup. Actions have readable labels instead of symbolic glyphs and occupy a separate row beneath the object name. The inline rename field remains native because the host does not publicly export its input primitive. Browser verification selected the original deck and hid it; the action changed to Show. Ctrl+Z restored visibility and the action returned to Hide. Selecting its shared button switched to the canonical selection interaction and retained the existing inspector. Typechecking and diff checks pass. Screenshot: `/private/tmp/landscape-objects-shared-controls.jpg`. Hierarchy, real scene grouping/layers and locks remain pending.

## Camera views integration

Tools exposes shared buttons for host camera reset, top-view toggle and left/right orbit events. Reset uses the host default perspective pose; it is labeled Reset rather than Fit because no public scene-bounds helper is exported. Reset and Top are disabled in 2D-only mode as they operate on the 3D camera. Browser verification confirmed top view and restoration of perspective through Reset. Existing geometry was not changed. Screenshot: `/private/tmp/landscape-camera-top.jpg`. Typechecking and diff checks pass. Section/quad views and saved-camera thumbnails remain outstanding. The Deck inspector appeared empty in this browser session and needs investigation; this is not considered verified inspector behavior.

## Generated concept alignment

The user explicitly requested implementation guided by the generated images, with shared editor components and matching style for any additions. Inspected `landscape-ui/01-dark-editor.png` outside the repository: dark library, segmented view controls, object hierarchy and contextual properties. The overall workspace scope remains unchanged. Root viewport and Library/Objects/Tools navigation now reuse SegmentedControl, list/grid switching uses ActionButton and thumbnail size uses SliderControl rather than custom controls. Existing theme tokens and host dark surfaces are preserved. Browser verification switched to Objects and back to Library, showing existing objects and thumbnail catalogs correctly. Typechecking and diff checks pass. Screenshot: `/private/tmp/landscape-concept-navigation.jpg`. Full concept layout alignment, category tabs, hierarchy and remaining workflows are still pending.

The earlier empty Deck inspector did not reproduce in a fresh browser session: Deck settings, Properties/Materials/Notes, width and other controls were present and console errors were empty. Screenshot: `/private/tmp/landscape-deck-inspector.jpg`. No code fix is claimed for the transient blank rendering.

## Concept category navigation

The layout library now has All/Structures/Surfaces/Paths category segments matching the generated dark concept's category navigation, implemented with the shared SegmentedControl. Collection, search and list/grid filters still apply inside the selected category; All preserves cross-category search including plants. Browser verification selected Paths and saw only Walkways, then Surfaces and saw Grass/Soil/Mulch/Gravel/Sand/Mud. No objects were created. Typechecking and diff checks pass. Screenshot: `/private/tmp/landscape-library-categories.jpg`.

## Persisted inspector notes

Deck, patio, landing and concrete-slab Notes tabs now save text to metadata.landscapeNote through the public scene update action. Existing metadata is preserved by reading the current node at save time. Save uses the shared ActionButton, is disabled when unchanged or read-only, and the status indicates unsaved edits. The host does not export a textarea primitive, so the existing native styled textarea remains. Saved state refreshes on object changes and undo. Browser verification saved a temporary Deck note, switched to Properties and back, confirmed the note remained, then Ctrl+Z restored the original empty note. Typechecking and diff checks pass. Screenshot: `/private/tmp/landscape-saved-notes.jpg`.

## Real scene collections

Object rows now expose the public CollectionsPopover with a shared ActionButton trigger and read-only protection. Membership comes from collection.nodeIds in the canonical collection store, avoiding dependence on kind schemas supporting the denormalized collectionIds field. The host owns creation, membership, color, rename and delete interactions. Browser verification created a temporary collection containing the original deck and showed one member. Ctrl+Z removed the temporary collection; reopening the popover confirmed no collections remained. Typechecking and diff checks pass. Screenshot: `/private/tmp/landscape-collections.jpg`. A collection-based project hierarchy, bulk collection actions and true lock semantics remain pending.

## Collection project browser

Objects can switch between kind groups and real scene collection groups with SegmentedControl. Collections list their Landscape members on the active level and unassigned objects remain accessible. Each group can select its search-matching existing members using canonical selection. Per-object thumbnails are retained in mixed collections. Browser verification selected the unassigned group, created a temporary named collection and observed its project section replace Unassigned, then Ctrl+Z restored Unassigned. No QA collection remains. Typechecking and diff checks pass. Screenshot: `/private/tmp/landscape-project-collections.jpg`. This is collection grouping; nested parent hierarchy and real lock behavior remain outstanding.

## Collection visibility actions

Collection groups expose shared Show matching/Hide matching buttons. They update only search-matching Landscape members on the active level, skip unchanged visibility and submit one public updateNodes transaction. Read-only scenes disable writes. Browser verification hid the single original deck through the group action, observed its per-object action become Show, then Ctrl+Z restored Hide and visibility. The original scene was restored. Typechecking and diff checks pass. Screenshot: `/private/tmp/landscape-group-visibility.jpg`. Multi-member and overlapping-collection browser verification remains outstanding; nested hierarchy and true locks still remain in scope.

## Recent asset ordering

Recently used now combines eligible library categories into one section ordered newest-first from the saved recent keys, instead of keeping catalog/category order. Planting recent results likewise share one section. Search, category and collection filters continue to apply. Browser verification opened Deck then Patio without placing geometry and observed Patio, Deck, Grass in that order. Typechecking and diff checks pass. Screenshot: `/private/tmp/landscape-recent-order.jpg`. Preference history records these UI choices; no QA scene objects were created.

## Authored patio grade reporting

Review quantities and CSV now include authored patio slope percentage. Unsupported object kinds display no grade, rather than inferring a terrain/rotation-adjusted measurement. The UI explicitly states the limitation. Inspected the existing path schema: it supports one uniform elevation and 2D junction coordinates, so per-junction gradients and measured terrain slopes remain unimplemented. Browser verification created a temporary patio using the existing drawing tool at 2.5% and observed 2.50 in Review. Ctrl+Z removed that patio; Review returned to the original single deck. Focused quantity tests (4) and typechecking pass; diff checks pass. Screenshot: `/private/tmp/landscape-grade-report.jpg`. Path gradient geometry, sections and clearance checks remain in scope.

## Hardscape inspector shared navigation

Deck, patio, landing and concrete-slab Properties/Materials/Notes navigation now uses the public SegmentedControl. The delete action uses the shared ActionButton with a readable label. Browser verification selected the existing Deck, opened Materials and observed material/color controls, then opened Notes and observed persisted-note controls. No scene content was changed. Typechecking and diff checks pass. Screenshot: `/private/tmp/landscape-inspector-shared-tabs.jpg`. Material swatch choices and other custom hardscape controls still need shared-style alignment where public equivalents exist.

## Net hardscape quantities

Patio, deck, landing and concrete-slab net areas reuse the renderer's surface outlines and pool-cutout helper, including coping clearance and same-parent/visible-pool semantics. QuantityPanel supplies all scene nodes so non-Landscape pools participate. Net is blank for unsupported kinds. CSV includes the net hardscape column. Existing gross area remains analytic for circles/ellipses; clipped net area follows tessellated render outlines. Other overlaps, grass exclusion footprints and waste rules remain pending. Focused quantity tests (5) verify pool subtraction and hidden-pool exclusion; typechecking and diff checks pass. Browser Review shows the original deck's gross and net both 21.48 m² with no pool cutout. No scene content changed. Screenshot: `/private/tmp/landscape-net-quantities.jpg`. A browser case with an actual overlapping pool remains to be verified.

## Ordering allowance

Quantities expose a shared MetricControl for a session-local 0–100% allowance, default zero. Ordering area uses net hardscape area without modifying measured area. CSV records allowance and ordering area. Material reporting now includes the authored material field (e.g. cedar). Focused quantity tests (6), typechecking and diff checks pass. Browser accessibility state verified 10.0% and 23.63 m² ordering area for the original 21.48 m² deck. However, the browser screenshot's sidebar became blank while accessibility controls remained functional; visual verification is unresolved and needs investigation before this item is considered fully verified. Agent tab 397905801 is retained for that investigation. Allowance does not persist to the scene yet; project/material-specific rules remain pending. Screenshot diagnostic: `/private/tmp/landscape-waste-allowance.jpg`.

## Level ordering allowance persistence

QuantityPanel now reads and saves `metadata.landscapeWastePercent` on the active host level, preserving unrelated metadata through the public updateNode action. Invalid saved values fall back to zero; read-only and missing-level states disable saving. Draft edits require an explicit Save and saved state follows navigation and undo. Browser verification changed zero to 10%, saved, switched Layout → Review and confirmed 10% / 23.63 m² persisted; Ctrl+Z restored zero / 21.48 m². Original scene content was restored. Typechecking and six focused quantity tests pass. Export and Save buttons now use a horizontal wrapper so ActionButton's flex sizing keeps their intended 36px height inside PanelSection. Browser screenshot `/private/tmp/landscape-allowance-controls.jpg` verifies both full-size actions and the allowance/order controls.

The rendering investigation remains open: reload and a temporary 1440×900 desktop viewport both reproduced missing header pixels although read-only DOM inspection found visible, unobstructed, unclipped elements. The viewport override was reset. Console showed viewer fallback-renderer/deprecated-clock warnings, no application errors. A later capture rendered the entire Landscape sidebar but omitted the host inspector body, so no plugin rendering fix is claimed. Agent tab 397905801 remains retained for further investigation. Material-specific allowances and the remaining full workspace scope still remain pending.

## Parent hierarchy browser

Inspected the sibling editor's internal site-panel tree and public exports. Its TreeNode and tree traversal helpers are not exported for plugin use. Landscape Objects now offers Types/Collections/Hierarchy using shared SegmentedControl. Hierarchy follows saved parentId relationships, retains ancestors of search matches, stops at the active level, reuses public getLevelDisplayName, and uses shared PanelSection/ActionButton with canonical Landscape selection. Non-Landscape parent containers provide context rather than duplicating their inspector routing. Missing parents and cycles remain inspectable without recursive loops. Deep nested layout follows the generated dark concept's hierarchy area; collection/type modes retain rename, visibility and camera actions.

Browser verification on the original single-deck scene checked collapse/expand, Deck search retaining Ground Floor, selection opening the Deck inspector, and an empty search. Cleared search afterward. No scene data changed. Final screenshot `/private/tmp/landscape-parent-hierarchy.jpg` renders the full sidebar and host inspector correctly. Earlier captures during the same flow still omitted elements, so the intermittent rendering issue remains open; no fix is claimed. Two hierarchy tests plus three inventory tests pass, along with typechecking and diff checks. A browser scene with multiple nested containers still needs verification. Hierarchy reparenting, drag/drop and true locks remain pending; the full workspace scope is unchanged.

## Repeat point placement

Inspected the sibling editor's point continuation profile and item placement coordinator. Public useEditor already provides the persisted `point` continuation preference (`once`/`repeat`). Landscape tree and plant settings now expose it through a shared SegmentedControl component. Both placement tools honor it: once selects and finishes; repeat keeps the tool armed and creates a fresh ID per click. A frame guard prevents duplicate grid/node dispatch commits, canceled on cleanup. Read-only scenes reject placement. Escape still finishes. No parallel preference store was introduced.

Browser verification placed two Daisies in 3D while the tool remained active, pressed Escape, then Review showed Plants 2 / Total 3 (original deck plus two plants). Each Ctrl+Z removed one instance; Review returned to the original single deck. Restored the host point preference to Place once and canceled the test tool. Screenshot `/private/tmp/landscape-repeat-placement.jpg` shows both plants and the matching Review count. Typechecking and diff checks pass. Tree repeat placement, 2D/Split repeat behavior and duplicate-hit browser cases remain to verify. Brush and erase workflows remain pending along with the full original scope.

## 2D repeat verification and preset-aware headers

Browser repeat placement in pure 2D produced exactly two Daisy symbols and Review Plants 2 / Total 3. Escape returned to selection; separate Undo actions reduced Plants to one and then removed both, restoring the original deck-only scene. Restored point continuation to Place once. Screenshot `/private/tmp/landscape-repeat-2d.jpg`. Tree and Split repeat cases remain pending.

The same verification exposed a catalog header mismatch: opening Daisy showed the generic tree thumbnail because selectedProduct always selected the first catalog entry by target. Header identity now follows the selected plant/tree node when relevant, otherwise the live tool defaults, including preset/species changes. Existing CatalogThumb assets and theme styling are reused; the readable asset name appears alongside the image. Browser verified Daisy's flower thumbnail, changed the preset to Poppy and observed the matching red-flower thumbnail/name, then restored Daisy. No scene nodes were changed by this check. Screenshot `/private/tmp/landscape-plant-header.jpg`. Typechecking and diff checks pass. Tree header and selected-instance override still need browser coverage. The full workspace goal and remaining requirements are unchanged.

## Split tree repeat and shared placement actions

Browser verification placed one White Oak through the Split floor plan and one through its 3D pane, then Escape finished. Review reported exactly two trees, with two distinct plan symbols and 3D foliage visible. Undo removed one and then the other, restoring the original deck-only scene. Restored the host continuation preference to Place once. This covers repeat trees through both viewport implementations with Split active. Screenshot `/private/tmp/landscape-tree-repeat-split.jpg`; the 13m canopies fill the close 3D camera, so it is evidence of rendering/count rather than a presentation view. Pure 2D/3D tree and Split plant repeat cases remain pending.

Tree and plant placement buttons now reuse public ActionButton in a horizontal wrapper for intended height. Tree active label correctly says "place tree". Missing-level and read-only states disable starting, and start handlers recheck readOnly. Browser verified the tree action after Escape (Place White Oak), clicked it (active tree placement prompt), and canceled again. No scene geometry changed in that action check. Screenshot `/private/tmp/landscape-shared-tree-placement.jpg`. Typechecking and diff checks pass. Plant action visual verification and read-only browser coverage still need completion. Full workspace scope remains unchanged.

## Plant plan labels and counted legend

Inspected core FloorplanGeometry text/upright/outlined styling and reused it for optional plant/tree catalog-name labels placed outside schematic crowns. The existing plantingSchedule data supplies a counted on-screen legend in Tools; no competing schedule model was introduced. Shared PanelSection, ActionGroup and ActionButton show/hide all planting labels on the active level through one public updateNodes transaction. Existing metadata is preserved, read-only disables writes, and labels default off. Label visibility persists on the individual objects.

Browser verification created one temporary Daisy in 2D (also verifying the migrated shared plant placement action), opened Tools, collapsed Planting layout, and showed labels. A legible upright Daisy label appeared outside its symbol and the legend reported Daisy 1. Ctrl+Z removed the label and restored 0/1 labelled; a second Undo removed the plant and the panel returned to 0/0 with an empty legend. Original scene restored. Screenshot `/private/tmp/landscape-plant-labels.jpg`. Two focused floorplan tests cover optional labels, correct names/position, upright semantics and retained selection handle. Typechecking and diff checks pass. Multi-species/tree labels, export PDF rendering, symbol/code legends, leader-line placement and dense-label collision handling still require work/verification. Full scope remains intact.

## Ground surface net quantities and regression check

The complete Landscape suite before this item passed: 222 tests across 52 files, 0 failures. Inspected host export annotation classification and PDF text rendering; FloorplanGeometry text is supported, but actual Landscape PDF label output remains unverified.

Ground-area net quantity now reuses visibleGrassFootprint for grass/grass2 and subtractPoolCutouts for all ground covers, matching rendered slab/other-ground-cover exclusions and pool openings. Polygon holes and overlapping blockers are counted as a union; access surfaces/pathways intentionally retain grass beneath them, matching the renderer. CSV and ordering-area descriptions now refer to modeled surface area rather than hardscape only. A focused test checks 100 m² gross grass minus overlapping soil/slab blockers gives 94 m² net and soil remains 4 m². All seven quantity tests, typechecking and diff checks pass.

Browser created a temporary grass area: Review showed gross/net/ordering all 1.50 m². Attempting an overlapping soil area did not create an object; ground-area tools listen to grid events and the attempt landed on existing geometry. No exclusion browser proof is claimed. Captured `/private/tmp/landscape-ground-net-quantity.jpg`, then Undo removed the temporary grass; Review returned to the original deck-only scene. Browser blocker-overlap verification and grid/node drawing interaction need follow-up. Other material-specific rules, path net quantities and the full original scope remain pending.

## Ground overlap verification and object-hit drawing

Follow-up browser verification used the known valid rectangle bounds in 2D: grass gross 1.50 m² became net/ordering 0.00 m² when covered by soil gross/net 1.50 m². Screenshot `/private/tmp/landscape-ground-overlap-verified.jpg`. Undo removed soil and grass separately, restoring the original single deck. The earlier smaller rectangle remains consistent with snapping collapsing one dimension; object-hit routing was not the cause in 2D, whose host already emits grid events through plan objects.

Ground drawing now also listens to public node move/click events for 3D surfaces. Node world coordinates are converted through the active level's world transform; grid coordinates stay level-local. Node clicks stop propagation to avoid a second grid commit; read-only scenes reject commits. Two coordinate tests cover grid identity and a translated/rotated nested building/level with unrelated hit-mesh coordinates. Browser clicked twice on the existing 3D deck and created exactly one 1.25 m² soil area; Undo restored the original deck. Screenshot `/private/tmp/landscape-ground-node-drawing.jpg`. The same case passed after extracting the tested coordinate helper.

The existing drawing-session validation messages were never displayed. GroundAreaPanel now shows session guidance/errors using existing theme text styling and a status role. Browser verified the collapsed-rectangle message, then chose a valid second corner and created one area; one Undo removed it. Screenshot `/private/tmp/landscape-ground-drawing-feedback.jpg`. Nested transformed-level browser coverage, freehand/object dispatch edges, missing registry transforms, and all remaining workspace requirements still need completion.

After these changes, the full Landscape suite passes: 225 tests across 53 files, 0 failures, 53,264 expectations. Typechecking and diff checks pass. The overall workspace goal remains active.

## Saved-view gallery and snapshot integration

Inspected sibling editor camera-controls, CameraSchema, ThumbnailGenerator, snapshot events, and the local demo host. Saved camera poses already live on canonical nodes; ThumbnailGenerator publicly supports requested saved perspective poses and snapshot:saved/capture-failed correlation. The local root demo supplies no onThumbnailCapture storage callback. A second renderer/listener was not added.

Tools now contains a saved-view gallery using shared PanelSection/ActionGroup/ActionButton. It lists active-level Landscape nodes with a camera, restores their existing camera view, and requests 640×360 previews through the host snapshot service. Successful correlated results save image URLs and a camera fingerprint in node metadata with one public updateNode; stale-camera results, read-only scenes, deleted objects, and project changes reject attachment. Preview display is invalidated by camera changes. Capture failures and missing host responses release the pending action and show a status message. Existing metadata is preserved. Perspective FOV uses saved fov or the host viewer's 50° default. Orthographic previews are currently unavailable because the host capture action does not save view extent; they still restore. Actual successful thumbnail storage/display, project persistence/undo, host-version compatibility, 2D restore, and orthographic framing remain incomplete requirements.

Browser verification saved a temporary view for Deck 1, observed Saved views · 1, orbited, restored the original camera, and requested capture. The host returned "Snapshot storage is unavailable" and the capture button recovered. Screenshot `/private/tmp/landscape-saved-views.jpg`. Undo removed the saved pose and gallery returned to zero, preserving the original scene. No successful thumbnail output is claimed. Two focused tests verify obsolete-camera rejection and image URL handling; typechecking passes. Objects now disables Save view in 2D/walkthrough/read-only, and rename/visibility writes recheck read-only. Browser confirmed Save view disabled in 2D and enabled again in 3D; read-only browser coverage remains pending.

Terrain and related-tool shared ActionButtons now have flex wrappers to retain their 36px height inside PanelSection. Browser screenshot `/private/tmp/landscape-workspace-actions.jpg` confirms full-height actions. Entering sculpt mode exposed the host sculpt controls; Finish sculpting returned to selection without editing terrain. Full workspace scope remains active, including brush/erase, irrigation, grading/sections, hierarchy locks/reparenting, documentation/export and other tracked items.

## Coded planting labels and legend

Plant/tree plan labels now offer Names/Codes through the public SegmentedControl. A single catalog-code helper supplies both floor-plan labels and planting schedule/legend rows: e.g. Daisy P-DAI and White Oak T-WO. Tree/plant prefixes keep the two catalogs distinct; name-abbreviation collisions receive deterministic suffixes across the full catalog. Codes do not depend on current project count/order. The schedule includes a code column alongside species, botanical name and quantity. Codes currently derive from the installed catalog; user-edited codes and stability across future catalog additions are still pending.

Label style saves to active-level and current planting-node metadata in one public updateNodes transaction, preserving unrelated metadata and rejecting read-only changes. Show labels applies the saved level style. Browser placed a temporary Daisy in 2D, showed labels, switched Codes, and observed P-DAI beside the symbol and P-DAI / Daisy / 1 in the legend. Navigating Objects → Tools retained the code. One Undo restored Daisy's named label, another hid it, and a third removed the plant; the original deck-only scene and level metadata were restored. Screenshot `/private/tmp/landscape-coded-planting-legend.jpg`. Seven focused documentation/schedule tests pass, including full-catalog code uniqueness, code/legend count agreement, and tree/plant coded symbols. Typechecking passes. Actual PDF output, mixed-species/tree browser coverage, dense-label collision/leader placement, editable codes and the remaining full workspace scope remain pending.

Full Landscape regression after documentation and saved-view changes: 230 tests across 55 files pass, 0 failures, 53,281 expectations. Diff checks pass. The workspace goal remains active.

## Planting footprint review

Inspected sibling editor snapping/placement footprint helpers; these handle cursor positioning, not a reusable planting-clearance report. Landscape checks now reuse the exact plan-symbol radius helpers: plants use scaled catalog spread and trees use the existing schematic height-based crown. A plan-bounds sweep checks visible planting pairs within the same parent and reports the first 100 overlaps over 3 cm. Findings include the measured circle overlap and let the user select both objects through the existing canonical selection action. The report explicitly distinguishes current plan footprints from mature growth and vertical clearance; building/nested-parent clearance remains unimplemented. Hidden-ancestor state and transformed cross-parent checks still need coverage.

Browser verification placed two temporary Daisies in 2D, then Review showed Plants 2 / Total 3 and one 0.52 m footprint finding. Selecting the finding selected both objects. One Undo removed a plant and the finding cleared; the second Undo restored the original deck-only scene. Restored point continuation to Place once and cleared search. Screenshot `/private/tmp/landscape-planting-overlap-review.jpg`. Three focused clearance tests cover scaled spread, hidden/different-parent exclusion, schematic trees and bounded findings; eight related clearance/geometry/floorplan tests pass. Typechecking and diff checks pass. Mature canopy/building/vertical clearances, nested transforms and the remaining full workspace scope remain pending.

## Clearance ancestor visibility

Inspected core schema/registry and sibling editor floor-plan parent-frame/group helpers. Generic persistent group transforms are not exposed by a reusable pure helper; host groups are session-only, and arbitrary parent fields cannot safely be interpreted as transforms. Cross-parent world-coordinate clearance remains pending rather than being approximated incorrectly.

Clearance checks now receive the complete canonical scene from DesignChecksPanel and walk parent visibility with a cached, cycle-safe traversal. Plantings beneath hidden ancestors and cyclic parent graphs are excluded. Six focused clearance/design tests pass, including hidden building → visible level → planting, visible ancestors restoring a finding, and cyclic parent exclusion; typechecking/diff checks pass. Browser redo restored the two-Daisy case and the 0.52 m finding still appeared. Inspected both level action menus and the Scene tree: this host exposes no level/building visibility action, so hidden-ancestor browser proof remains unavailable in this flow and is not claimed. Undo removed both temporary plants; Review confirmed the original single deck and zero findings. Screenshot `/private/tmp/landscape-clearance-visibility-regression.jpg`. Full scope remains active; a fixture/import workflow or appropriate parent visibility UI is still needed to verify this edge end-to-end.

## Planting stroke tools

Plant settings now offer Point/Brush/Erase using public SegmentedControl and MetricControl. Existing Point once/repeat semantics remain. Brush paints a row at configurable spacing, interpolating long pointer moves and limiting each stroke to 500 plants. Erase checks the entire swept segment against visible direct-level plant centers within a configurable radius, across plant species; tree nodes are retained. Stroke changes apply on release through the host applyNodeChanges transaction so each stroke has one undo. Escape/tool cleanup, pointer cancellation and window blur discard unfinished strokes; read-only rejects start and commit. 2D and 3D share the existing single placement owner, with Split avoiding a second listener set. Preview remains the existing cursor plant, not a full stroke/radius overlay yet.

Browser in pure 2D painted one four-Daisy row; Review confirmed Plants 4 / Total 5. One erase drag removed all four and Review returned to the original deck. One Undo restored all four erased plants; the next Undo removed the painted row. Restored Point mode and cleared search. Screenshots `/private/tmp/landscape-planting-brush.jpg` and `/private/tmp/landscape-planting-erase.jpg`. Two stroke-geometry tests verify spacing interpolation, limits, and swept erase distance. Typechecking passes. Tree brush/erase, full brush-area/scatter behavior, nested and ancestor visibility erasing, 3D/Split browser verification, radius/full-stroke visualization, Escape/blur/read-only/touch browser coverage and accurate brush HUD instructions remain pending. Full workspace scope remains active.

### 3D stroke startup and mode hints

Tool hints now subscribe to the public editor defaults and show Point placement, Brush drag/release, or Erase radius instructions for the selected mode. Canvas strokes start from the host's fresh grid/node pointer-down hit rather than the preceding cursor move; the 2D SVG capture path remains, with a stroke guard preventing duplicate starts. Browser verified mode hints switching and two 3D five-plant strokes. The first stroke initially appeared absent in a screenshot, but subsequent authoritative Review/Undo evidence proved it had created five plants. Erase removed all ten plants in one action; Undo restored ten, then individual brush undos reduced the count to five and zero. Original deck-only scene restored. Screenshots `/private/tmp/landscape-brush-3d-hud.jpg` and `/private/tmp/landscape-erase-3d-hud.jpg`. Split, post-change 2D regression, full stroke previews and the other listed scope remain pending. No full-goal completion is claimed.

### Split stroke verification

Browser painted from the Split plan pane after the fresh-hit startup change. Review confirmed exactly four Daisies, with no duplicate placement owners. Erase over the same route returned the scene to its original single deck. One Undo restored all four erased plants and another removed the brush row. Point mode restored. Screenshots `/private/tmp/landscape-brush-split.jpg` and `/private/tmp/landscape-brush-split-review.jpg`. Full Landscape suite now passes 236 tests across 57 files, zero failures, 53,381 expectations. Split perspective-pane brush, pure-2D startup regression and full stroke/radius overlays remain pending. Inspected the sibling public placement-preview and floorplan-tool interfaces for overlay reuse: the placement root is one node, contextNodes and geometry construction need further inspection before adopting a multi-symbol preview. Full workspace scope remains active.

### Stroke footprint overlays

Inspected the sibling FloorplanPlacementPreviewLayer: contextNodes provide geometry context but do not render additional roots. Landscape therefore publishes transient stroke footprint metadata only on the host placement ghost, and its own floorplan builder renders all footprint circles through the existing host geometry renderer. Purple circles identify pending brush plants; red circles show erase targets and cursor radius. Perspective renders matching non-interactive rings with the host floor-stack preview positioning. Release clears pending footprints; cancel/unmount clears the ghost. Scene creation still uses original plant fields, not ghost metadata.

Typechecking and six focused tests (19 expectations) pass, including invalid preview-entry rejection. Browser Chrome connection changed from id3 to id4; the old server was authoritatively terminal and restarted on port3002 (session47508). New tab397905883 shows the red 1m erase radius in pure2D after a scene click. Screenshot `/private/tmp/landscape-erase-radius-preview.jpg`. In-flight brush/erase-target overlays, perspective rings, cancellation and persisted metadata absence remain to be verified end-to-end; no broad preview completion claim. Live tab retained for that verification. Full workspace goal remains active.

Perspective browser verification now shows the red 1m erase ring, screenshot `/private/tmp/landscape-erase-radius-3d.jpg`. Switching Brush removed the erase ring; a drag created six Daisies according to Review and one Undo removed all six, restoring the original deck-only inventory. The immediate 3D screenshot did not show plant meshes; captured console has no loading/render errors (only THREE.Clock deprecation). This count/undo evidence does not prove mesh appearance or in-flight stroke rendering. Those checks and the full workspace scope remain pending. The host post-processing pass explicitly renders at frame priority1; Landscape dirty-node cleanup priority2 is therefore not by itself evidence of a missing render loop. No speculative renderer change was made.

### Erase visibility and release validation

Restoring the brush row and selecting one Daisy showed loaded meshes in 3D, resolving the prior immediate-screenshot uncertainty. Screenshot `/private/tmp/landscape-brush-meshes-visible.jpg`; this does not establish visibility of every occluded plant. Extracted the existing cached, cycle-safe ancestor visibility traversal into `scene-visibility.ts` and reused it for both clearance and erase targeting. Release now revalidates target existence, type, active-parent membership and effective visibility, so a plant hidden or moved during the stroke is retained. Existing hidden-ancestor/cycle clearance tests and typechecking pass.

Browser hid one of six test Daisies, erased the original row route in 3D, and Review confirmed exactly one retained plant. Screenshot `/private/tmp/landscape-erase-hidden-plant.jpg`. Undo restored six; another Undo restored visibility; the third removed the brush stroke and Review confirmed the original single deck. Hidden-parent browser coverage remains unavailable through the current parent UI, though the shared traversal has unit coverage. In-flight overlays/cancel/read-only/nested transforms, tree brush, irrigation, grading, presentation and all other full workspace requirements remain active.

### Tree brush and erase

Tree tools now reuse PlantPlacement's stroke engine with a tree family/schema, species name and schematic crown radius. This removes the duplicate tree point-placement implementation while retaining its once/repeat behavior. Tree settings add the same public SegmentedControl and MetricControl modes, defaulting to 5m spacing/radius; erase targets only visible tree nodes in the active parent and retains plants. Both families use mode-specific HUD hints and the shared transient footprint renderer. Shared cancellation, fresh-hit startup, 500-node limit, read-only guards, visibility and release validation apply to trees.

Browser in pure2D painted two White Oaks at default spacing. Review confirmed two placements and the expected schematic-crown overlap finding. Erase on the same route returned inventory to the original deck; one Undo restored both trees and another removed the original stroke. Point mode restored. Screenshots `/private/tmp/landscape-tree-brush.jpg` and `/private/tmp/landscape-tree-brush-review.jpg`. Typechecking and 12 focused geometry/clearance/history tests (129 expectations) pass. Tree3D/Split, mixed plant/tree erasure isolation, point-placement regression after consolidation and in-flight tree overlays remain to be verified. Full workspace requirements remain active.

### Split tree preview ownership

The first perspective-pane Split tree stroke created three trees, but finishing the tool produced WebGPU destroyed-buffer validation errors (captured timestamp 2026-10-02T02:32:02Z). Inspected tree preview and prototype-cache ownership: preview previously generated independent geometry on any node-object change and disposed it on mode changes. Preview now acquires/releases the existing reference-counted prototype cache, keyed by species/controls/LOD, matching committed rendering. Mode and position updates no longer regenerate preview geometry; finishing a brush retains resources owned by placed trees. A new cache test proves preview release does not dispose shared geometry while a placed owner remains and final-owner release disposes once (1 pass, 4 expectations). Typechecking passes.

After restoring the original scene and reloading the failed context, repeated the same Split perspective drag: Review confirmed three trees and screenshot `/private/tmp/landscape-tree-brush-split.jpg` shows the corresponding plan crowns and rendered trees. No new errors appeared after placement/tool finish or one Undo; captured error log still contained only the earlier timestamps. Undo restored the original single deck. This verifies the exercised lifecycle, not all GPU/bake cases. Tree erase in Split/pure3D, mixed erasure isolation, point-placement regression and the remaining full workspace scope stay pending.

### Irrigation head foundation and inventory

Searched sibling editor and plugin sources: the existing sprinkler catalog entry is a ceiling fire-safety fixture, not landscape irrigation. Pool equipment and pipes remain reusable for later routing. Added a persisted irrigation-head definition with floor placement, select/move/rotate/duplicate/delete capabilities, authored radius, arc, flow, zone and optional plan coverage. The host renders the outlet in 3D and sampled reach polygon plus zone label in plan; shared parametric controls edit properties, and public workspace controls add at level coordinates. Coverage is authored geometry, not a hydraulic or obstacle simulation.

Browser created a head, edited its zone to Front garden and arc to 90 degrees, and verified the matching plan label and quarter-circle coverage. Three Undo actions restored the original scene. Screenshot `/private/tmp/landscape-irrigation-arc.jpg`. Irrigation now participates in Objects, Review counts and quantity CSV inventory. Browser confirmed Structures 1, Irrigation 1, Total items 2, a selectable quantity row, and object visibility hiding the coverage/label. Undo restored visibility and removed the test head. Screenshot `/private/tmp/landscape-irrigation-review.jpg`. Seven focused schema/geometry/manifest/history tests pass (127 expectations). Zones/controllers/drip/routes/hydraulics/schedules, direct placement tooling, full release validation and all remaining workspace requirements stay active.

### Irrigation zone summary

Reused public ActionButton and host multi-selection after inspecting editor grouping and Pool flow review controls. Irrigation Tools now summarizes authored head count and flow by trimmed zone name, with a select-all-heads action. Hidden installed heads remain in demand totals; empty assignment remains distinct from an explicitly named Unassigned zone. Pressure and simultaneous operation are not calculated. Unit test covers those distinctions (1 pass, 4 expectations); Landscape typechecking passes.

Browser added two default heads and showed Zone 1, 2 heads, 8.0 L/min. Select heads in Zone 1 opened the shared two-object inspector, confirming both selected. Screenshot `/private/tmp/landscape-irrigation-zones.jpg`. Two Undo actions returned to zero heads and the original scene. Full irrigation routing/controller/coverage analysis and remaining workspace scope are still pending.

### Irrigation schedule export

Added a CSV schedule using the existing Landscape Blob-download pattern and public ActionButton. Records include zone, head ID/name, authored flow, reach, arc and count; each zone includes a flow/count total. Hidden installed heads remain included. CSV quotes and formula prefixes are escaped. Focused test passes (4 expectations); typechecking passes.

Browser verified export enabled with one head and disabled after undo removed it. Screenshot `/private/tmp/landscape-irrigation-export.jpg`. Download event capture timed out and reset the browser connection (Chrome changed from id4 to id1); downloaded file content is unverified. Downloads directory read was denied, so no content claim is made. Original test scene restored, live tab397905883 retained. End-to-end download verification and remaining full workspace scope remain active.

### Batch irrigation zone assignment

Added assignment for selected irrigation heads using public multi-selection and ActionButton. The action revalidates canonical selection, level membership, node schema and read-only status at commit, then calls updateNodes once; unrelated selected objects are excluded. Browser assigned two heads to Courtyard, confirmed the 8.0 L/min grouped summary and both plan labels, then one Undo restored both Zone 1 values. Two more Undo actions removed test heads. Screenshot `/private/tmp/landscape-irrigation-batch-zone.jpg`. Typechecking passes. Full irrigation systems and remaining workspace scope remain active.

### Irrigation reach union

Full Landscape suite before this addition: 242 pass, 0 fail, 53,331 expectations across 61 files. Inspected Pool route creation: it relies on host pipe/fitting sockets, scene-registry transforms and obstacle geometry; irrigation socket definitions and controllers must precede reuse of that flow. Added zone plan reach union using the project's existing polygon-clipping dependency. Same-parent heads union their sampled authored arcs, counting overlaps once; mixed-parent zones return unknown pending transform resolution. This measures modeled plan reach, not hydraulic watering coverage. Tests cover coincident and separated heads (2 zone tests, 7 expectations); typechecking passes.

Browser two coincident 3m heads reported 28.2m² instead of double area and retained the 8.0L/min demand. Screenshot `/private/tmp/landscape-irrigation-reach-union.jpg`. Undo removed both test heads. Nested transforms/height distinctions/obstacles and complete coverage visualization, pipe routing, controllers and remaining workspace scope stay active.

### Zone reach overlay controls

Reused editor ActionGroup/ActionButton for show/hide authored reach by zone. Action revalidates current level, canonical head schema, trimmed assignment and read-only state, and updates all changed heads in one updateNodes call. Numeric reach union remains independent of display toggles. Browser hid both coincident heads' reach overlays, retained outlets/labels and 28.2m²/8.0L/min totals, and one Undo restored the show state. Two more Undo actions removed test heads. Screenshot `/private/tmp/landscape-irrigation-reach-hidden.jpg`. Typechecking passes. Remaining full workspace scope stays active.

### Irrigation inlet contract

Inspected core NodePort contract and Pool inlet/connection helpers: ports use level-local metres and nominal inches, and Pool adds its parent transform explicitly. Heads now expose a downward supply inlet for direct level children with authored nominal diameter (default 0.5 inches) and terminal distribution role. Nested heads return no ports until their transforms are resolved, avoiding incorrect level coordinates. Floor head rotation is constrained to yaw. Shared inspector adds inlet diameter; routing remains unimplemented.

Browser edited diameter from 0.5 to 0.75, then undid edit and creation. Host generic inspector displays only one decimal (0.8), so a precision-preserving custom shared MetricControl is still required before considering this property UI complete. Screenshot `/private/tmp/landscape-irrigation-inlet.jpg`. Seven focused manifest/history/geometry tests (127 expectations) and typechecking pass. Running history alone hits the existing Three CJS/async-module loading failure; the manifest-first test run passes. Port connection integration, nested transforms, routing and remaining full scope are pending.

### Irrigation precision inspector in progress

Implemented a primary InspectorExtension using the existing PanelSection, MetricControl, ToggleControl and ActionButton exports; generic per-field customEditor is documented but not implemented by the sibling host. Inlet diameter now requests precision2 and explicit inches; reach and authored flow have two-decimal controls. Canonical read-only/existence checks guard edits/delete. Extension reads current canonical selection and supports the host's optional node prop. Five manifest/geometry tests pass (19 expectations).

Browser verification remains pending: tab397905883 was connected through Chrome1, which disappeared; inventory showed Chrome4 with the same tab, but binding twice returned Debugger unattached. A test head from the first verification attempt may still remain; restore only after canonical browser state is inspected. Do not claim the precision fix verified. Full workspace goal stays active.

### Irrigation precision browser verification

Old tab397905883 disappeared from authoritative browser inventory. Opened fresh Chrome4 tab397905894 at localhost3002; loaded persisted selected irrigation head and the registered primary extension. Browser edited inlet from 0.50 to 0.75, and AX confirmed explicit `0.75 in`, reach `3.00 m`, arc `360 °`, authored flow `4.00 L/min`. Undo restored `0.50 in`. Screenshot `/private/tmp/landscape-irrigation-precise-inlet.jpg`. Existing test head remains from the prior disconnected session; fresh tab history does not contain its creation, so no blind Undo/delete was used. The fresh page also loaded host Wall tool state; retained for further verification without changing unrelated objects. Full scope remains active.

### Irrigation system classification correction

Deeper sibling inspection found the native PipeSegment draw tool collects only DWV waste/vent ports (diameter minimum1.25in); its supply label is HVAC, not water irrigation. Pool programmatic routes use waste sockets and cannot be carried across unchanged. Corrected irrigation inlet system to `irrigation` and removed terminal distributionRole that classified it as an HVAC register. After browser reload the erroneous `Supply 1 register` summary disappeared; host still shows a generic `System, no equipment` orphan badge because the declared inlet is unconnected. Screenshot `/private/tmp/landscape-irrigation-system-corrected.jpg`. Typechecking passed before removal of optional distributionRole; removal does not add a new typed field. Irrigation-compatible runs/controllers/connection semantics remain required; no routing completion claim. Full goal remains active.

### Graded path data foundation in progress

Inspected existing Pathway schema, sampled cubic curves and backing/border/tile extrusion pipeline. Added optional per-junction elevationOffset relative to the existing uniform base elevation, preserving old paths when omitted. New edgeGradeProfile measures sampled arc-length stations and interpolates elevations by physical station rather than raw Bezier parameter; reports authored rise/plan slope. A focused test proves old flat paths and a 10m/1m grade (1 pass,4 expectations). This is an internal foundation only: renderer tessellation, borders/tiles, interactive junction controls, path-edit preservation, slopes/sections and browser verification are not yet implemented. Do not claim graded geometry complete. Full goal remains active.

### Inserted junction grade preservation

Path editing inspection found insertPathCurvePoint created a fresh junction without elevation metadata. It now derives the inserted offset by sampled curve arc length up to the subdivision parameter, keeping both resulting edges on the authored grade. Moving existing junctions already spreads original vertex fields; network intersection insertion still requires grade reconciliation for crossing routes. Eight grade/edit tests pass (37 expectations), including a 25% insertion retaining 2.5m offset and both 20% edge slopes. Typechecking passes. This internal grade work still has no authoring/mesh integration, so browser verification and feature acceptance remain pending. Full goal stays active.

### Graded path mesh integration in progress

Backing, border and paving meshes now share a sampled centerline grade field. Only paths with nonzero authored junction offsets run through this branch; old flat geometry is unchanged. TessellateModifier refines caps before height displacement, then normals and bounds are recomputed and replaced original geometry disposed. New mesh test covers bounded thickness, full rise and finite normals (1 pass,3627 expectations). Typechecking passes. Tessellation is bounded to six iterations; curved/junction seam precision and large-path performance need acceptance checks. Interactive grade controls and actual browser scene verification are still required before this implementation item is complete. Full goal remains active.

### Junction grade controls and Split verification

Added Junction grades to Tools for a single selected walkway, using public PanelSection and MetricControl. Canonical edits revalidate path existence/schema/read-only state. Browser authored a 1.00m endpoint offset on a 6.25m route, displayed 16.01% grade, and showed the path in plan/perspective Split. Undo restored 0.00m/0.00%, then removed the temporary path; existing Deck, wall and irrigation head were retained. Screenshot `/private/tmp/landscape-junction-grade-controls.jpg`; no browser console errors. Typechecking and diff whitespace checks pass.

Network subdivision now carries interpolated offsets to new junctions, preserving existing authored offsets and letting an ungraded branch inherit the route it joins. Profiles are frozen before shared-junction assignment. Seventeen focused grade/network/mesh tests pass (3685 expectations). Browser rechecked authoring and Undo after HMR; actual branch drawing remains to be verified. Differently graded crossing routes need an explicit conflict policy, plus curved seams, large-mesh performance and terrain support checks. Sections and the complete acceptance ledger remain outstanding; the goal stays active.

Complete Landscape suite after grade integration: 247 pass, 0 fail, 57,218 expectations across 63 files.

### Graded branches and crossing conflict guard

Existing route crossings now reject height differences above 0.01m with PathwayGradeConflictError before any scene mutation. Flat legacy routes count as zero offset; matching profiles merge. A new ungraded branch inherits the existing junction elevation. Conflict tests verify unchanged source nodes and successful merging after matching heights. Drawing commit handles the specific message, preserves failed drafts on Finish, retains errors through preview rendering, and checks canonical read-only state.

Browser created a 3.12m route, authored 1.00m endpoint height, then attached a branch at its midpoint. Tools displayed junction3=0.50m and both original halves at32.02%; branch at-24.10%. One Walkways object remained. Undo restored the unbranched graded route, then flat route, then removed the temporary route, retaining existing scene objects. Screenshot `/private/tmp/landscape-graded-branch.jpg`. Scrolling over MetricControl inadvertently changed junction1 by-0.05m; immediately undid that wheel edit and recaptured the correct values. Scrollbar-side scrolling avoided further mutation. Public control wheel behavior still needs a workspace-wide solution.

Twenty-six focused network/item/grade/curve tests pass (107 expectations); typecheck and diff whitespace checks pass. Actual crossing-conflict message and failed-Finish retention still require a browser fixture that can represent separately authored crossing routes. No runtime acceptance claim for that branch. Full workspace goal remains active; sections, curved seams/performance, terrain support and other ledger requirements remain.

### Workspace wheel scrolling correction

Inspected sibling editor MetricControl: its native non-passive wheel handler edits values on hover and exposes no opt-out prop. Landscape panel content now stops wheel propagation during capture without preventing default scrolling. Public controls and styles remain unchanged; drag/type editing remains available. This applies to the full scrollable Landscape sidebar, including product menus and Tools, rather than replacing controls. Floating host inspectors remain outside this scope.

Browser wheeled directly over Plant spacing at1.00m. Its rendered Y moved564→274 (290px scroll), while text remainedPlant spacing1.00m. Screenshot `/private/tmp/landscape-safe-panel-scroll.jpg`. Typecheck and diff whitespace checks pass. No scene objects were created. Full acceptance ledger remains active.

### Walkway longitudinal section

Inspected sibling editor/core/viewer section references and Pool/Streetscape section implementations. No public generic scene-section API found; siblings use their own diagrams. Added PathwaySectionPanel inside shared PanelSection with matching theme styles and a labelled route selector. SVG unfolds each sampled centerline by plan station and plots paving backing underside at base+offset+0.005m and top at thickness above it. Displays rise, thickness and level-relative ordinates; explicitly labels exaggerated vertical scale and exclusions (terrain, individual stones, borders).

Browser created a3.12m route, verified flat section, authored1.00m endpoint rise and confirmed32.02% profile,1.00m rise and0.08m thickness. Rendered diagram inspected at normal sidebar width. Screenshot `/private/tmp/landscape-walkway-section.jpg`. Undo updated section to0.00m rise, then removed temporary route and section. Typecheck and diff checks pass. Multi-edge selection, negative elevations, curves, narrow/large layouts and section export need further verification. This is a longitudinal profile only; transverse terrain sections and scene clipping remain outstanding. Full goal stays active.

### Planting alongside graded routes

Path planting now returns parallel elevationOffsets for accepted points, interpolated by physical centerline station. Rejected occupied candidates do not shift height indexing; capped layouts return corresponding heights. Batch construction adds each offset to source base elevation rather than assigning the same elevation to every plant. Ground area planting retains uniform height behavior. Four focused layout tests pass (251 expectations), including both sides, rejected occupied candidates and caps; typecheck and diff checks pass.

Browser created a3.12m graded route with1.00m endpoint offset, previewed6 plants, saved batch and inspected Split plan/perspective placement. Screenshot `/private/tmp/landscape-graded-path-planting.jpg`. Exact rendered per-plant heights are not legible in the host inspector or captured camera, so numeric renderer acceptance remains pending despite pure height tests. Undo removed all6 plants together, then grade edit, then temporary route; existing scene retained. Full goal remains active.

### Graded planting support and visible source heights

Inspected viewer floor-elevation priority1 application and plant instance priority2 handling: host applies getFloorStackedPosition to canonical stored position; instance pass uses lifted root transforms. Added integration test generating graded station offsets and passing each through the public terrain resolver. Terrain lift2.5m plus sourcebase0.2m plus station grade is applied once; canonical stored heights remain base+grade. Nine manifest/layout/support tests pass (283 expectations). This proves resolver integration, while final instanced render height acceptance still requires numeric visual evidence.

Planting preview now displays minimum/maximum authored source heights before terrain/slab support. Browser confirmed0.16–0.80m for6 proposed plants along a3.12m route with1.00m rise. Corrected placement ActionButton flex shrink with the shared flex wrapper pattern; browser DOM confirms36px button height. Screenshot `/private/tmp/landscape-planting-source-heights.jpg`. Undo changed range to0.00–0.00m, then removed temporary route; no plants were committed in this verification. Typecheck passed before the flex wrapper; whitespace checks pass. Full goal remains active.

### Continuous connected-route grade field

Nearest-edge height selection introduced a real discontinuity when differing branch grades meet away from their shared centerline junction. Replaced that Voronoi selection with inverse-distance-fourth-power blending of each edge's nearest sampled segment within the nearest connected component. Exact centerline samples retain authored height; disconnected components do not blend. Distance-normalized weights avoid overflow; empty/nonfinite candidate sets return zero offset. This changes cross-path interpolation, while centerline slope reports remain authored values. Two mesh tests pass (3632 expectations), including continuity across a branch boundary, exact centerline heights and thickness/normal checks.

Browser created a three-edge loop with junction offsets0,1,0.5m and rendered Split without console errors. Focused/orbited view inspected; screenshots `/private/tmp/landscape-junction-grade-blend.jpg` and `/private/tmp/landscape-junction-grade-blend-focused.jpg`. Selection overlays/current camera do not prove detailed seam quality, so curved/severe junctions and large-route performance remain acceptance work. Undo removed both grade edits and all three temporary drawing transactions, retaining original scene. Typecheck passed before reduction optimization; rerunning current typecheck. Full goal remains active.

### Graded edit handle alignment and renderer verification

Full geometry-builder test confirms paving bounds2.005→3.085m for base2m/rise1m/thickness0.08m, and graded border meshes remain finite and reach raised elevation. Three focused mesh tests pass (3639 expectations). Found 3D editing handles were still anchored to uniform base elevation. Junction handles/drag planes now use vertex offsets; terminal arrows/axis origin use terminal vertex elevation; curve grips/insert grips/tangent guides use the shared grade field at their plan positions. This preserves existing public editing controls and changes their vertical presentation only.

Browser authored2.00m endpoint rise on3.12m route and inspected pure3D. Raised paving and elevated endpoint/arrow visibly match; screenshot `/private/tmp/landscape-graded-handles-3d.jpg`. Cleared selection for surface inspection `/private/tmp/landscape-graded-surface-3d.jpg`. Undo grade and creation restored original scene. Graded handle dragging/cancellation, curve guides and varied junction widths still require acceptance. Workspace typecheck passed all5 packages (4 cached siblings, Landscape fresh); diff checks pass. Full goal remains active.

### Irrigation schedule inlet precision and preview

CSV now includes explicit Inlet diameter (in) column, preserving authored nominal values such as0.75 and leaving zone-total diameter blank. Two schedule tests pass (7 expectations), including quoting/formula escaping and field precision. Added themed accessible head-schedule table in existing shared Irrigation PanelSection showing head/zone, inlet inches, authored flow and reach metres. Browser confirms existing head0.50in/4.00Lmin/3.00m. Screenshot `/private/tmp/landscape-irrigation-schedule-preview.jpg`. Typecheck and diff checks pass.

Clicked Export irrigation schedule. Attempt to inspect chrome://downloads was rejected by browser URL policy (HTTP/HTTPS only). Do not retry via alternate browser surfaces or circumvention. Downloaded file remains unverified. In-app preview is a normal product review surface, not evidence of disk output. No scene mutation occurred. Full goal remains active; export acceptance and remaining irrigation/workspace requirements remain.

Shared outdoor editor ItemNodes now participate in Landscape Objects and Review quantities through the same active-level descendant traversal; host item selection uses furnish phase. Existing shared controls and host asset placement remain the source of behavior. Browser placement, inspector selection, quantities inclusion, and one-step undo verified.

Host compatibility: published 1.0.1 type audit found missing irrigation refs, inspector priority and saved-preview perspective APIs. Public registry confirms 1.0.3 packages; Landscape peer minimum and development pins now 1.0.3 with lockfile resolution. Exact published-package validation remains pending.
