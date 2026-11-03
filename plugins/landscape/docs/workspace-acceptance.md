# Landscape workspace acceptance ledger

Scope remains the complete October 1 workspace audit and generated concepts. This ledger separates implementation from acceptance; tests do not replace rendered behavior. Updated October 2 after inspecting current source and running the complete Landscape suite: **247 pass, 0 fail, 57,218 expectations, 63 files**.

| Requirement | Current evidence | Remaining acceptance work |
| --- | --- | --- |
| Consistent workspace and catalog | landscape-panel.tsx uses shared navigation, responsive grid/list, category/search/recent controls; prior large/small browser evidence | Recheck final composition at large/narrow sizes, keyboard navigation and accessibility after all additions |
| Object management | objects-panel.tsx, object-hierarchy.ts and canonical collections; selection/visibility/rename browser evidence | Deep nested transforms, multi-member collections, drag/reparent and genuine lock capability |
| Plant placement and distribution | Shared family placement engine, brush/erase/repeat, deterministic mixed batches, terrain support; canonical undo tests and browser evidence | In-flight previews, cancellation/touch/read-only, mixed-family isolation, tree perspective erase, point regression, transformed parents and automatic batch regeneration |
| Botanical catalog | Preset/species names and model-height/category filters | Supported botanical attributes and sun-exposure metadata; no inferred biology |
| Paths and grading | Optional junction offsets, sampled grades, shared graded mesh field and public MetricControl authoring; browser edit/Undo and Split evidence | Crossing grade conflict policy, curved junction seams/performance, measured slope checks, terrain support and section geometry |
| Views and presentation | Canonical 2D/3D/Split, camera gallery, capture/first-person integration | Actual thumbnail persistence callback, orthographic framing, section/quad views and final export verification |
| Season and growth comparison | Existing procedural controls change model geometry | Honest authored scenario semantics and comparison UI; biological age predictions require real data |
| Related assets | Installed plugin panel links | Registered asset browsing and placement without copying sibling internals |
| Irrigation | Persisted heads, precise shared inspector, zone assignment/totals, reach union/toggles and CSV generator | Controllers/valves/drip, irrigation runs/fittings, explicit connections, hydraulic/schedule checks, obstruction coverage, nested transforms, direct placement tool and downloaded CSV verification |
| Documentation | Plant symbols/codes, legend UI and host schedule extension | Real drawing-sheet/PDF export, label collision/leader handling and editable codes |
| Quantities and review | Pool cutout/grass net area, authored allowance, CSV, outline/path checks and schematic planting overlaps | Remaining overlap/material rules; world-space/mature/vertical clearances, measured slopes, drainage/accessibility |
| Release validation | Current complete Landscape suite passes | Published minimum host compatibility; resolve/isolate six root baseline failures; final typecheck and runtime regression coverage |

## Next implementation dependency

Graded path geometry is a substantial missing requirement and is independent of the current irrigation routing mismatch. Before changing it, inspect existing Streetscape grading interpolation and the Landscape junction/curve/mesh pipeline. Preserve backwards compatibility for old flat paths, use canonical path edits and one undoable transaction, and verify an actual graded path in plan/perspective/Split before advancing to section views.

Irrigation must retain system `irrigation`: the host PipeSegment drawing tool supports DWV waste/vent, and HVAC uses supply. Pool's waste-tagged programmatic routes cannot be reused unchanged. Reuse its geometric planning approach only through a compatible public connection model.

## Direct irrigation placement

Registered a parametric head tool and 2D extension using public editor grid/node events, snapping, floor-stack preview, canonical createNode, read-only guards and point continuation. The asset placement coordinator was inspected but requires ItemNode/asset draft handles. Split uses the perspective owner alone, matching existing plant tools. Tools provides a shared ActionButton to activate placement; coordinate entry remains available.

Browser verified 2D, 3D and Split plan clicks: each added exactly one head (1→2, zone flow 4→8 L/min); one undo restored each test to the original head. Screenshots outside the repository: /private/tmp/landscape-irrigation-direct-plan.jpg, /private/tmp/landscape-irrigation-direct-3d.jpg, /private/tmp/landscape-irrigation-direct-split.jpg. Repeat, cancellation, transformed levels and pointer-driven support acceptance still pending. Hydraulic routing/controller/drip work remains open.

### Irrigation continuation and cancellation

Added public registered tool hints with a clickable continuation chip and C shortcut, using the host point-continuation preference. Corrected the chip subscription to compare continuationByContext.point: getContinuation on a previous snapshot reads the current store and cannot detect changes. Browser verified the chip switches Place one head↔Repeat heads immediately, C switches modes, two separate Split plan clicks create two heads (1→3, 4→12 L/min), and Escape removes the helper/stops creation on a subsequent empty-scene click. Two undos restored the original head; restored Place one mode. Screenshot /private/tmp/landscape-irrigation-repeat.jpg. Further transformed-level/read-only/pointer support acceptance and routing remain open.

### Authored reach in perspective

Added a local planar reach fill and closed line to head geometry using the same sampled arc as plan. Host supplies position/yaw/floor support once; overlays disable raycast and depth writes. Removed surfaceRole fallback for this diagram node because host replacement discards transparent authored materials. WebGPU rejects LineLoop; browser caught this and implementation uses supported Line with an explicit closing point. Three geometry tests pass (17 expectations), including local quarter-arc bounds, non-interactive reach and hidden-overlay body preservation; typecheck passes.

Browser placed an unobstructed head and displayed its circular reach beside the deck in perspective. Zone Hide reach removed overlays; one undo restored overlays and a second removed the temporary head, retaining the original. Screenshots /private/tmp/landscape-irrigation-reach-3d.jpg and /private/tmp/landscape-irrigation-reach-3d-hidden.jpg. Old LineLoop log entries remain historical; no current LineLoop is emitted. Reach is a flat authored plane, not terrain-conforming or obstacle/hydraulic coverage. Arc/yaw perspective acceptance and remaining irrigation/workspace scope remain open.

## Irrigation run foundation

Inspected host PipeSegment schema/ports and Pool connection-port/routing helpers: DWV systems/sizes are incompatible with authored irrigation. Added persisted landscape:irrigation-run with finite bounded polyline, nominal0.25–4in diameter, zone, endpoint port references, matching irrigation start/end ports, metric physical cylinder geometry and dashed plan centerline. Two selected same-level heads with matching zone/diameter can create an orthogonal route below outlets via public MetricControl/ActionButton and canonical createNode. This is initial centerline drafting, not a complete supply network/fitting/clearance/hydraulic solution. Shared precision-preserving run inspector, Objects/Review inventory and delete action included.

Browser route between two heads showed8.82m and dashed plan route. Registered reference cascade alone did not run on linked host; added public onDeleteCascade hook as used by Pool equipment. Browser deleting the temporary endpoint removed its run and one Undo restored both. Screenshots /private/tmp/landscape-irrigation-run-plan.jpg and /private/tmp/landscape-irrigation-run-inventory.jpg. Objects explicitly showed2heads+1run. Two undos removed each test route and head, restoring original head/deck/wall. Seven manifest/history/route tests pass139 expectations; all5workspace typechecks pass. Connection lifecycle for other edit/delete paths, clone/preset handling, movement validation, fitting/controller/valve/drip models, route editing, supply/pressure/schedule/clearance and full export acceptance remain open. Goal remains active.

### Irrigation connection consistency

Added pure live endpoint checks for missing/unassigned references, changed pose (>1mm), parent mismatch, nominal diameter/reducer mismatch, zone mismatch, same inlet at both ends and zero-length segments. Tools and shared run inspector display these checks; positive state explicitly leaves supply/hydraulics unchecked. Route action revalidates canonical inlet occupancy at commit and disables another run from an occupied head inlet until a branch fitting exists. Split eligibility from route creation to avoid allocating a new node ID during disabled-state rendering.

Browser drafted a route, showed matching position/diameter/zone, selected both heads again and displayed occupied-inlet explanation with disabled Route action. Editing the temporary head inlet0.50→0.75 immediately displayed `End: nominal diameter differs; a reducer is required.` Screenshot /private/tmp/landscape-irrigation-connection-checks.jpg. Three undos restored diameter, removed test run and temporary head. Six manifest/route tests pass27 expectations; typecheck passes. This does not implement reducers, branch fittings, controllers, hydraulic design or auto-repair; full goal remains active.

## Authored irrigation zone valves

Inspected Pool valve sockets/state: physical ports survive closed flow patterns. Added persisted landscape:irrigation-valve with finite position/yaw, nominal0.25–4in size, zone and authored open state; local inline geometry/handle, plan state label and direct-level irrigation inlet/outlet ports. Public floor placement, selection/move/yaw/clone/delete capabilities, precise MetricControl/ToggleControl inspector and zone input. Tools adds at shared coordinates and toggles state; Objects/Review includes valve inventory. Valves are not yet connected by the head-only route action and do not imply calculated flow or controller operation.

Browser added a0.75in valve atX3m, closed it (plan label Zone1·Closed), reassigned zoneCourtyard and rendered it in perspective; Objects listedIrrigation valves1. Three undos restored zone/state then removed the temporary valve. Screenshots /private/tmp/landscape-irrigation-valve-closed.jpg and /private/tmp/landscape-irrigation-valve-3d.jpg. Six manifest/history/socket tests pass141 expectations; all5workspace typechecks pass. Socket tests prove yaw/metric position/nominal inches and identical open/closed physical ports. Routing to valves, inline insertion, controller signals, drip/fittings and hydraulic/clearance/documentation remain pending. Full goal remains active.

### Valve outlet routing

Expanded run endpoint references to named inlet/outlet sockets; compatible mixed selection of one valve and one head routes the valve's outlet to the head's inlet. Route begins with a0.2m straight lead in the rotated outlet direction before descending to authored burial depth. Requires matching direct parent, zone and nominal size; prevents multiple connections to the same valve outlet while allowing its inlet to be connected separately later. Canonical commit revalidates current selection, level, schemas, read-only and socket occupancy. Live checks resolve valve sockets and flag closed state without removing the physical connection. Public valve deletion hook removes connected runs in the same history transaction.

Browser created4.21m route from0.50in valveX3m to original0.50in head, rendered dashed plan centerline and matching endpoint status. Closing valve retained route and showed`Start: connected valve is closed.` Deleting valve removed route; one Undo restored both. Three further undos removed route, size edit and temporary valve. Screenshots /private/tmp/landscape-irrigation-valve-route.jpg and /private/tmp/landscape-irrigation-valve-route-closed.jpg. Ten manifest/history/route/socket tests pass168 expectations and typecheck passes. Tests include yaw-aligned opposing run/outlet direction, exact socket endpoints and closed-state reference preservation. Valve inlet supply, controllers, fittings/reducers/branches/drip, geometry clearance, hydraulic design and full workspace scope remain open.

## Authored irrigation controller programs

No landscape controller program was found in inspected sibling node/Pool sources. Added persisted landscape:irrigation-controller with schematic physical enclosure, plan program label, public placement/move/selection/delete capabilities,8stations, enabled state and valid daily start time. Station config stores optional valve signal reference, integer0–180min duration and enabled state. Typed reference role is control, never flow; deleting controller preserves valves. Shared PanelSection/ToggleControl/MetricControl plus themed native time/select inputs and accessible daily schedule table. One valve can be assigned to one station across canonical controllers, revalidated at commit. Public valve deletion companion clears all links to pending deleted valves in one undoable transaction while retaining station settings.

Browser assigned Zone valve1 to Station1, changed20→30min and displayed06:00–06:30. Station2 disabled the already-assigned valve option. Disabling controller displayedOff/no active station times. Deleting valve cleared the assignment; one Undo restored valve and30min assignment. Objects listedIrrigation controllers1. Four further undos removed duration/assignment/controller/temporary valve, retaining original scene. Screenshot /private/tmp/landscape-irrigation-controller.jpg. Six manifest/history/controller tests pass149 expectations; all5workspace typechecks pass. Schedule test covers unassigned/disabled skipping, overnight rollover and invalid time/nonfinite duration. This is an authored daily sequence, not real hardware actuation, electrical wiring, weather/weekday/season rules or hydraulic simulation. Those and remaining full workspace requirements stay pending; goal remains active.

### Weekly controller days and seasonal duration

Added persisted unique wateringDays0–6 (backwards-compatible defaultdaily) and integerseasonalPercent0–200(default100). Shared ActionButton/ActionGroup weekday buttons expose pressed states; MetricControl adjusts seasonal duration while base station minutes remain intact. Preview-day select drives accessible schedule table; emptydays/zeroadjustment/disabledprogram produceOff. Sequence rounds adjusted durations to seconds and reports accurate+Nday rollovers. Inspector reports missing/other-parent and authored-closed valve assignments, without simulating actuation.

Browser deselectedTuesday and Tuesday preview wentOff; returnedMonday, adjusted100→150% and showed30.00min/06:00–06:30 while base remained20min. Closed-valve notice appeared. Six undos removed test state/assignment/controller/valve, restoring original scene. Screenshot /private/tmp/landscape-irrigation-weekly-seasonal.jpg visually inspected: shared dark controls, weekday grid, clear selected/unselected state, base/adjusted duration and preview day fit host scrollable inspector. Five manifest/controller tests pass25 expectations; Landscape typecheck passes. Tests include excluded/empty days,0%adjustment, duplicate-day rejection and48h/two-day sequence. Weather, conflict analysis, actual calendar/DST/hardware/electrical/hydraulic operation and remaining full workspace requirements stay open.

## Authored dripline laterals

Sibling search found only roof gutter drip-lines, not irrigation emitter laterals. Added persisted landscape:dripline with finite level-relative polyline bounded0.1–300m, nominal size,0.1–5m spacing, authored emitterL/h and zone. Sampling follows3Darc length through bends, places first emitter at start, avoids duplicate junction stations and never overshoots the final station; bounded maximum3001emitters. Geometry uses physical tubes and instanced emitter markers; plan draws line/markers. Shared precise inspector, coordinate/length creation action and Objects/Review inventory. Zones now sum headL/min and drip emitterL/h÷60, including hidden objects and independent drip-only zones. Sprinkler reach controls stay disabled in drip-only zones.

Browser created3m line:11emitters/0.367Lmin, Zone1total4.367. Spacing0.30→0.50 produced7emitters/0.233 and total4.233; rendered plan and3D line. ReassignedCourtyard:0heads/1dripline/0.233, sprinkler reach/head-selection actionsdisabled. ObjectslistedDriplines1. Three undos removed zone/spacing/creation, restoring original scene. Screenshots /private/tmp/landscape-irrigation-dripline-plan.jpg and /private/tmp/landscape-irrigation-dripline-3d.jpg. Nine manifest/history/drip/zone tests pass164 expectations; all5workspace typechecks pass. Drip drawing/path editing, ports/supply/filter/regulator/valve connection, terrain support, full irrigation CSV/PDF and hydraulic/wetting coverage remain open; full goal remains active.

## Irrigation inventory CSV expansion

The existing shared ActionButton now exports heads, driplines, valves, runs, controllers and all eight station settings, including connection IDs, configured weekly days, seasonal adjustment and adjusted start/end times. Drip-only zones contribute to demand totals. The panel previews inventory counts and enables export when any irrigation equipment exists. The sibling editor source search did not reveal an irrigation CSV exporter to reuse; the existing Landscape quoted-cell export was extended.

Validation: manifest and CSV tests passed (6 tests, 22 assertions); all five workspace typechecks passed; git diff --check passed. Live browser creation of a default dripline changed the export summary from zero to one dripline and changed zone demand to 4.367 L/min; undo restored the scene. Evidence: /private/tmp/landscape-irrigation-complete-inventory-export.jpg. The export control was clicked, but the browser download observer timed out after ten seconds, so saved-file completion and file bytes remain unverified. No browser security restriction was bypassed.

Remaining: downloaded-file verification, schedule PDF, supply/fittings/hydraulics, and the remaining full workspace acceptance requirements. Goal remains active.

## Irrigation equipment schedule preview

Replaced the head-only preview with a semantic three-column equipment schedule for heads, driplines, valves, runs and controllers, retaining the existing dark table/panel styles. Shared ActionButton remains the export control; the sibling editor contains no table component to import for this schedule. Size uses nominal inches; details retain explicit flow, reach, length and emitter units, valve state, controller assignments and seasonal percentage. CSV diameter heading now describes every equipment kind correctly.

Browser verified default head, dripline (3 m, 11 emitters, 0.367 L/min), valve (0.75 in, Open), and controller (06:00, zero assigned stations, 100%) rows. All three temporary creations were undone and counts returned to baseline. Screenshot: /private/tmp/landscape-irrigation-equipment-schedule.jpg. Six focused manifest/export tests pass (22 assertions); all five workspace typechecks pass; diff whitespace check passes. Run-row rendering is implemented but remains browser-unverified in this change. Full goal remains active, including remaining connections, drawing, documentation and release acceptance.

## Run schedule connection review

Browser verified a 3.60 m, 0.50 in head-to-head run in the equipment schedule with matching endpoints. Editing the second head zone to Courtyard changed the row to Needs connection review and displayed End: zone differs from the outlet. CSV now retains the same connection review results in an explicit column, using the existing run checker. Seven manifest/export tests passed (25 assertions), all five workspace typechecks passed, and diff whitespace check passed. Evidence: /private/tmp/landscape-irrigation-run-schedule-review.jpg. Three temporary edits (zone, run, added head) were undone, restoring one baseline head and zero runs. CSV downloaded-file bytes remain unverified. Full goal remains active.

## Controller assignment integrity review

Added a pure controller assignment audit for missing/foreign-parent valves, closed authored valves, and duplicate station references across controllers. The existing inspector surfaces review text and CSV includes the same review without mutating configured timing. Current linked host duplication retains controller signal links, so this catches an actual authoring path that the station assignment guard alone cannot prevent.

Browser assigned one valve, duplicated and placed its controller, observed Station 1: valve is assigned to 2 stations; review duplicate control, then cleared the duplicate assignment using the existing select control and observed the warning disappear. Five undo actions restored baseline (one head, zero valves/controllers/runs). Evidence: /private/tmp/landscape-controller-duplicate-assignment-review.jpg. Ten focused manifest/controller/CSV tests passed with 47 assertions. All five workspace typechecks passed; diff whitespace check passed. Missing/foreign-parent cases covered by unit tests; browser duplication and resolution verified. Full goal remains active.

## Dripline path vertex editing

Added a shared PanelSection, MetricControls and ActionButtons for selected vertex X/elevation/Z, midpoint insertion, and vertex removal. Native vertex select follows existing input styling. Edits read canonical state, honor read-only, validate 2–256 vertices and 0.1–300 m length, and use normal scene undo. Geometry, schedule and emitter station sampling consume the same authored path.

Browser inserted midpoint into 3 m line, changed its Z to 2 m, observed 5 m/17 emitters/0.567 L/min and a bent 2D visualization. Removal restored 3 m/11 emitters/0.367 and disabled removal at two vertices. Four undo actions restored baseline. Evidence: /private/tmp/landscape-dripline-bend-edit.jpg. Five focused manifest/dripline tests pass (17 assertions), all five workspace typechecks pass, diff check passes. Interactive viewport drawing/grips, supply/ports, terrain conforming and remaining full goal requirements are still pending.

## Dripline inlet contract

Added public NodePort inlet at the first authored path vertex with nominal inches, irrigation system, and outward direction opposite the first nonzero path segment. Ports are exposed only for direct level parents as required by host level-local port coordinates. Plan marks the inlet; inspector explains it. Existing run checks now recognize dripline sockets and detect moved inlet/size/zone mismatches; drip deletion cascades connected runs through the existing public lifecycle hook. CSV node lookup includes driplines.

Eleven manifest/run/drip tests pass (50 assertions), including repeated first vertex, inlet units/direction and stale start detection. All five workspace typechecks pass; diff check passes. Browser verified default dripline and inlet marker/explanation in 2D, then undid fixture. Evidence: /private/tmp/landscape-dripline-inlet-plan.jpg. Routing action and browser connected-drip deletion remain pending, alongside full supply/fittings/filter/regulator/drawing/terrain scope. Goal remains active.

## Valve-to-dripline routing

Added shared ActionButton routing for one selected valve plus one selected dripline, reusing the existing buried valve route builder through a structural inlet target. Canonical action checks read-only, direct active-level parents, matching zone/nominal size and occupied sockets. Run references target valve outlet and dripline first-vertex inlet.

Browser created compatible valve (X=3, nominal 0.50 in) and default dripline, Shift-selected both via Objects, routed a 4.21 m supply centerline and observed matching endpoints. Deleting the dripline deleted its run; one undo restored both. Four further undo actions restored baseline head with no valve/drip/run. Evidence: /private/tmp/landscape-valve-to-dripline-route.jpg. Twelve manifest/run/drip tests pass (53 assertions); all five workspace typechecks pass; diff check passes. Filter/regulator/supply source, fittings and hydraulic performance remain pending, along with full workspace scope. Goal active.

## Shared system summary and full Landscape regression

Sibling core system-graph summarizes distributionRole run nodes using their system field, defaulting absent values to refrigerant. IrrigationRunNode now supplies the explicit literal irrigation (defaulted for older parsed nodes) so newly authored runs use the existing shared summary correctly. Browser routed separated heads, switched to 3D, and confirmed Irrigation 3.6m · 1 run; no equipment remains accurate until a source exists. Two undo actions restored baseline. Evidence: /private/tmp/landscape-irrigation-system-label.jpg.

Full Landscape regression before change passed 269 tests/67 files/57130 assertions; after change passed 270 tests/67 files/57132 assertions. All five workspace typechecks and diff whitespace checks pass. Existing unparsed older scene runs without system still need migration review; current authored routing persists the field. Published host minimum, root baseline failures, full browser acceptance and remaining implementation requirements are not complete. Goal remains active.

## Irrigation water supply source

Added a registered supply source with finite parent-local position/yaw, nominal outlet diameter, authored 0–20 bar pressure and 0–1000 L/min available flow, enabled state, shared equipment role and public outlet port. Geometry and plan label are schematic; values are authored measurements, not simulated pressure/flow. Public MetricControl/ToggleControl/PanelSection inspector, canonical add/select Tools actions, equipment schedule and CSV source rows are integrated. Sibling pool equipment uses its own pool/waste sockets and is not an unchanged substitute for irrigation supply.

Browser added default source in 3D, edited pressure 3→2.5 bar, disabled source, checked 2D Supply · Off and schedule Off/30.00 L/min available. Three undo actions restored baseline. Screenshots: /private/tmp/landscape-irrigation-supply.jpg and /private/tmp/landscape-irrigation-supply-schedule.jpg. Eight manifest/source/export tests pass (33 assertions); all five workspace typechecks and diff check pass. Source-to-valve routing, inventory category thumbnail, reducer/filter/regulator, demand/pressure validation and full remaining scope are pending. Goal active.

## Source-to-valve route and source inventory

Added shared routing action for one direct-level source/valve selection with equal nominal diameter, free source outlet/valve inlet and valid depth/separation. Centerline lead and approach align physical socket directions. Run checks recognize source sockets and disabled sources; upstream run zone follows downstream valve while source has no zone assignment. CSV lookup includes sources. Added Water supplies thumbnail category to existing Objects inventory.

Browser verified category, routed default source to valve at X3 (3.29 m), matched endpoints and shared Irrigation summary without no-equipment warning. Disabled source produced Start: water supply is disabled. Deleting source cascaded its run; one undo restored both. Four further undo actions restored baseline. Evidence: /private/tmp/landscape-supply-to-valve-route.jpg. Focused manifest/run/source/schedule tests and all five workspace typechecks pass; diff check passes. Hydraulic losses/demand/regulation/filtration/branch fittings and remaining full workspace scope still pending. Goal active.

## Connected supply capacity readiness

Added graph traversal through matching authored run sockets to count installed connected heads/driplines once, including hidden outlets and closed valves. Supply readiness compares installed demand to authored available flow, reports negative margin, disabled source, zero pressure, missing connected outlets, closed valves and multiple-source ambiguity. Excludes geometrically invalid references/size/zone connections. This assumes simultaneous installed demand; controller operation, hydraulic pressure loss and actual watering remain uncalculated.

Browser routed source→valve→head and observed 4.000 L/min demand and 26.000 margin at 30 L/min available. Editing availability to 3 showed −1.000 margin and exceeds-flow warning. Eight undo actions restored baseline, including the temporary baseline-head size edit. Evidence: /private/tmp/landscape-irrigation-capacity-review.jpg. During QA, equal displayed 0.75-inch sizes failed eligibility because shared numeric conversion introduced roundoff; routing eligibility now uses the same 1e-6 tolerance as socket checks, with regression coverage. Fourteen manifest/run/readiness tests pass (56 assertions); workspace typechecks pass; diff check passes. Full goal remains active, with hydraulics/fittings/regulation/filtering/drawing/documentation/release acceptance still pending.

## Supply readiness CSV and exact content preview

Supply CSV rows now retain connected installed demand, outlet count, available-flow margin and readiness issues alongside authored pressure/availability. Added shared ActionButton/PanelSection preview with themed native read-only textarea (no public editor textarea export found). Download and preview use the same pure CSV generator.

Browser created supply, opened preview, verified readOnly=true, capacity headers and actual source row (3 bar/30 L/min/0 demand/0 outlets/30 margin/unconnected warning), closed preview and undid fixture. Browser textarea normalizes CRLF to LF; generator retains CRLF for export. Screenshot: /private/tmp/landscape-irrigation-csv-preview.jpg. Ten manifest/schedule/readiness tests pass with 35 assertions; all five workspace typechecks and diff check pass. Preview bytes verified; saved download file remains unverified. Full goal remains active.

## Irrigation Design / Network / Schedule views

Split the growing irrigation sidebar using the public shared SegmentedControl inside an accessible named group. Design retains placement/equipment/zone controls; Network contains canonical route actions, run checks and supply readiness; Schedule contains export, exact CSV preview and equipment table. Existing state stays in the panel across these view switches. Overall count includes every irrigation equipment kind. Reuses existing PanelSection and shared input/action styling.

Browser created supply in Design, switched Network and observed readiness, switched Schedule and opened correct export preview, returned Design and observed preserved source values, then undid supply creation. Evidence: /private/tmp/landscape-irrigation-network-view.jpg and /private/tmp/landscape-irrigation-schedule-view.jpg. All five workspace typechecks and diff check pass. No new arithmetic/model changes; previous model tests remain relevant. Full scope and responsive/keyboard acceptance remain active.

## Smaller desktop and keyboard irrigation views

Verified at 1280×800 using supported temporary browser viewport capability, then reset to default. Segmented group measures 280 px client and scroll width (no horizontal overflow); Design/Network/Schedule remain reachable and schedule preview renders. Shared SegmentedControl has native buttons but no selected-state semantics, so option labels expose aria-current=page. Editor viewport Space shortcut prevented native activation; scoped group key capture now activates the appropriate view with Space without invoking viewport navigation. Enter continues native activation.

Browser verified Space Network→Design and Design→Network, Enter back to Design, activeLabel=Design and 280/280 width. No scene objects created or modified. Evidence: /private/tmp/landscape-irrigation-1280-keyboard-design.jpg and /private/tmp/landscape-irrigation-1280-schedule.jpg. All five workspace typechecks and diff check pass. Shared component retained; no sibling editor edit. Broader responsive/accessibility acceptance and full implementation remain active.

## Shared irrigation run path editing

Extracted the existing dripline vertex controls into IrrigationPathControls and reused them in routed run inspectors. Canonical schema/read-only checks guard edits; insertion/removal and precise XYZ controls preserve ordinary editor undo behavior. Endpoint edits retain socket references so connection review reports displacement.

Browser verified dripline midpoint insertion retains 3.00 m and 11 emitters. Created a two-head run, inserted a midpoint, moved an interior vertex and observed length change from 3.60 to 4.62 m with matching endpoint checks. Moving the start Z to 0.5 produced 5.00 m and “Start: centerline no longer meets the outlet.” Five undo actions restored the baseline scene. Evidence: /private/tmp/landscape-run-path-edit.jpg. All five workspace typechecks and diff check pass. Full scope remains active; direct viewport run grips, fittings and hydraulic calculations remain pending.

## Selected object visibility

Added Show selected / Hide selected using public ActionButton, ActionGroup and PanelSection. Current scene nodes, current viewer selection and read-only state are revalidated on action; updateNodes batches all changes into one undo. Controls appear for selected Landscape objects across Types, Collections and Hierarchy, with already-satisfied actions disabled.

Browser selected Deck 1 and Irrigation head 1, hid both and observed both per-object actions become Show. One undo restored both and disabled Show selected. Evidence: /private/tmp/landscape-selected-visibility.jpg. Workspace typechecks and diff check pass. Sibling editor search found guide locks but no general node lock enforced by scene editing; genuine object locking remains pending rather than exposing a cosmetic plugin-only lock. Full goal remains active.

## Measured walkway grades in Review

Review now lists every valid walkway segment with sampled plan length, signed rise and authored longitudinal grade using the existing edgeGradeProfile calculation. Shared PanelSection and ActionButton retain host styling; semantic table headers carry explicit units. Rows select the existing path. Undefined zero-length grades remain explicit. Segment numbers replace internal UUIDs in visible labels.

Browser drew a temporary 2.11m walkway in 3D, verified flat values, selected its review row, authored 0.20m endpoint rise in Tools and observed Review show 2.11m / 0.20m / 9.47%. Two undo steps removed grade and temporary path, retaining original deck/head. Evidence: /private/tmp/landscape-review-grades.jpg. Full Landscape regression: 276 tests pass, zero fail, 57257 expectations across69 files. All five workspace typechecks pass, including the final label correction. Diff check passes. Pure2D walkway drawing did not create geometry; current pathway tool subscribes only grid events, so drawing parity remains an identified unfinished item. Crossfall/terrain drainage/accessibility compliance and full scope remain pending.

## Walkway drawing activation and 2D/Split parity

Inspected sibling FloorplanRegisteredToolLayer: registered tools mount only in build mode. Existing walkway floorplan adapter already reused grid events, but its panel choose action only selected the tool. It now explicitly enters build mode before selecting the pathway tool. The floorplan adapter runs only in pure2D; Split uses the perspective listener for both canvases, matching the plant/irrigation integration pattern and avoiding duplicate drafting sessions.

Browser drew a2.76m path in pure2D and observed one path/one segment in Review. One undo removed it. Drew a2.48m path from the Split plan pane and again observed one path/one segment, visible in both panes; one undo removed it. Baseline deck/head retained. Evidence: /private/tmp/landscape-2d-path-drawing.jpg and /private/tmp/landscape-split-path-drawing.jpg. All five workspace typechecks and diff check pass. This corrects the previously identified straight-path drawing gap; curved/exact-length/cancel/read-only cases across view changes remain acceptance work. Full goal remains active.

## Curve drafting verification in progress

Corrected keyboard/command mode toggle to merge current toolDefaults instead of the initial captured defaults, preserving finish/width edits made during a drawing session. Workspace typechecks and diff check pass.

Browser pure2D curve drawing committed one visible brick walkway (1.86m). Review initially reported14 segments; undo left a2-segment version, and a second undo removed it. This contradicts single-transaction curve acceptance and requires investigation of duplicate draft listeners or split-to2D lifecycle. Initial C/chip interactions did not visibly change mode, while panel cancellation did. Browser logs contain an HMR module-deletion warning. No shortcut/cancellation/view-switch acceptance claim; mode-toggle source fix has not passed runtime verification. Screenshot /private/tmp/landscape-2d-curve-review.jpg. Baseline deck/head restored after both temporary transactions were undone. Full goal remains active; next work must resolve this observed drafting lifecycle problem.

## Single pathway drafting owner

Sibling ToolManager keeps the perspective tool layer mounted while pure2D is displayed. PathwayTool lacked the plant placement wrapper's view guard, registering a second drafting session alongside its floorplan adapter. Extracted PathwayPlacement for shared draft logic; default perspective wrapper now returns null in pure2D, and floorplan wrapper runs only in pure2D. Split retains perspective ownership.

Browser verified C changes curve→straight once while retaining a newly selected Brick bond finish, then changes back to curve. Three points and Enter created one1.86m brick path with2segments; one undo removed the entire path, retaining baseline deck/head. This resolves the prior observed two-transaction curve and double-toggle failures. Evidence: /private/tmp/landscape-curve-single-session.jpg. All five workspace typechecks and diff check pass. View-switch draft continuity/cancellation and broader full-scope acceptance remain pending. Full goal remains active.

## Curve draft view-switch cancellation

Browser started a two-point uncommitted curve in pure2D, switched to Split and pressed Enter. Review retained only the original deck/head with no walkway. This verifies that relinquishing the pure2D drafting owner clears its unpublished points and that the new Split owner cannot commit the abandoned curve. Evidence: /private/tmp/landscape-view-switch-draft.jpg. No scene changes or undo were necessary. Source inspection confirms draft cleanup clears shared placement/alignment previews on owner unmount. Draft continuity is currently cancellation at the view boundary, not preservation. Split-to3D continuity, exact length/bearing and remaining workspace scope still require work. Full goal remains active.

## Exact length drafting in pure2D

Browser started a straight path, entered L→5→Enter and A→90→Enter, then clicked an unconstrained cursor point. Review measured one5.00m segment and6.00m² gross area at1.20m width. This proves entered length controls saved geometry independently of cursor distance. Bearing entry was exercised, but final angular value lacks an authoritative numeric UI readout, so exact-angle acceptance remains pending. Screenshot /private/tmp/landscape-exact-path-length.jpg. One undo removed the entire temporary route and restored baseline deck/head. No implementation change was needed for this length flow; browser evidence closes a previously unverified requirement. Full goal remains active.

## Numeric walkway bearing review

Review adds endpoint-chord Bearing° using the existing grade profile, clockwise from parent-local−Z (0°) through+X (90°). Curves explicitly report chord rather than tangent direction; coincident endpoints report Undefined. Five cardinal/degenerate assertions cover the calculation. Six manifest/grade tests pass (20 expectations); all five workspace typechecks and diff check pass.

Browser entered L5 and A90 in pure2D, clicked an unconstrained cursor point, and measured Review row5.00m /0.00m rise /0.00% /90.00°. One undo restored baseline deck/head. Evidence: /private/tmp/landscape-path-bearing-review.jpg. Exact length and bearing now have saved-geometry numeric browser evidence. Full goal remains active; table responsiveness with added column and transformed-parent/world bearings remain further acceptance work.

## Irrigation findings in workspace Review

Review now reuses irrigationRunIssues, sourceReadiness and controllerAssignmentIssues against canonical scene data. Findings select their existing equipment with shared ActionButton/PanelSection, while geometry findings remain separately counted. Source connectivity/capacity, run socket mismatches and controller assignments now have a common workspace review entry point. No duplicated hydraulic validator or new simulation claims.

Browser added a supply, opened Review and observed1finding: “No head or dripline is connected through matching sockets.” Clicking its equipment row retained the existing supply inspector. Undo removed the temporary source and finding immediately, retaining baseline deck/head. Evidence: /private/tmp/landscape-irrigation-review-findings.jpg. Workspace typechecks pass; final singular/plural label is rendered and diff check passes. Other finding types reuse previously tested validators but their new Review rows still require separate runtime fixtures. Full goal remains active.

## Controller finding runtime verification

Browser added a valve, authored it closed, added a controller and assigned Station1 to that valve. Review displayed1finding on the controller: “Station1: valve is authored closed; actuation is not simulated.” The same message appeared in the canonical controller inspector, and the Review equipment action selected that controller. Four undo steps removed assignment, controller, closed state and temporary valve, restoring baseline deck/head. Evidence: /private/tmp/landscape-controller-review-findings.jpg. This validates the new Review integration for controller issues without changing the existing validator or UI components. Run socket findings still need a Review-specific runtime fixture; full scope remains active.

## Run connection finding runtime verification

Browser added a second head atX3, routed the selected pair, then moved the run startZ from0 to0.5m. Workspace Review reported “Start: centerline no longer meets the outlet.” Undo repaired the endpoint and the Review findings region count became0. Two further undo steps removed temporary run/head and restored baseline. Evidence: /private/tmp/landscape-run-review-findings.jpg. This completes Review-specific browser fixtures for run sockets, controller assignments and supply readiness; the same existing validators remain shared with their original inspectors. Full scope remains active, including actual hydraulics, drawing/terrain integration and remaining acceptance requirements.

## Shared editor asset browser

Inspected public ItemsPanel and its catalog/placement model. Tools now embeds that exported component in an expandable Asset library section, with its existing categories/search/tiles and placement engine. Source chips and large tag-filter lists are hidden through public props, matching the editor's simpler presentation. Procedural sibling tools retain their existing owner panels.

Browser opened library, chose Outdoor, searched umbrella and observed Patio Umbrella. Selecting the tile activated the existing item-placement helper (Place item/Rotate/Cancel). Esc cancelled placement and Close asset browser hid the embedded panel. No asset was committed. Evidence: /private/tmp/landscape-shared-asset-browser.jpg and /private/tmp/landscape-shared-asset-placement.jpg. Workspace typechecks pass before the final boolean tag-filter prop; whitespace check passes. Actual asset commit/undo, responsive embedded catalog and published-host compatibility remain acceptance work; full goal stays active.

## Shared asset commit and undo

Browser opened embedded library, searched umbrella, selected Patio Umbrella and clicked the pure2D floorplan. The host Scene tree listed Patio Umbrella alongside the original wall, deck and irrigation head. One undo removed the Patio Umbrella row; original rows remained. Esc ended repeat placement. Evidence: /private/tmp/landscape-shared-asset-committed.jpg. All five workspace typechecks pass including showTagFilters=false. This proves commit/undo through the reused ItemsPanel and editor placement engine; detailed mesh loading/rendering and asset inclusion in Landscape object/review inventory remain further integration work. Full goal stays active.

### Shared outdoor assets in inventory and Review

Verified the sibling editor catalog stores Patio Umbrella as an ItemNode with asset.category `outdoor`. Landscape now includes active-level outdoor ItemNodes, including nested descendants, in Objects and Review quantities. Objects uses the existing thumbnail, selection, visibility, focus, and collection controls; selection uses the host furnish phase and opens the shared item inspector. No new asset placement implementation was added. Browser verification placed Patio Umbrella in 2D, found Outdoor assets · 1 and the named row, selected it and saw the host Patio Umbrella inspector, then found its Review quantities row. One undo removed the asset and its Review row, preserving Deck 1 and Irrigation head 1. Screenshots: `/private/tmp/landscape-outdoor-asset-inventory.jpg`, `/private/tmp/landscape-outdoor-asset-review.jpg`. Landscape type check and git diff whitespace check passed. Detailed mesh loading, other catalog categories, and multi-asset grouping remain to verify.

### Multiple shared outdoor assets

Objects now aggregates outdoor ItemNodes under one Outdoor assets group and resolves each item thumbnail separately, including collection and hierarchy views. Browser placed Patio Umbrella and Outdoor Playhouse; one Outdoor assets · 2 heading held both named rows. Read-only DOM inspection confirmed distinct official asset thumbnail URLs. Screenshot `/private/tmp/landscape-outdoor-assets-grouped.jpg`. Type check passed. Ctrl+z removed one fixture but repeated keyboard undo unexpectedly restored it; both temporary fixtures were removed through normal selectable-object Delete actions and baseline Deck 1 / Irrigation head 1 was verified. Repeated keyboard undo needs diagnosis; do not claim reliable multi-step undo from this run.

### Shared asset history investigation

Repeated native Ctrl+z with Landscape UI unmounted also restored a Patio Umbrella after a removal. The history includes earlier fixture Delete actions, so returning an identically named older asset can be a valid undo of that deletion; the preceding run did not identify node IDs and cannot establish an undo bug. Switching to native 3D and advancing two more undo operations removed the umbrella and retained Wall 1, Deck 1 and Irrigation head 1. Screenshot `/private/tmp/landscape-history-3d-isolation.jpg`. No code workaround was introduced. A clean, distinct-name sequence is still required before claiming repeated undo reliability or a host defect.

### Clean repeated rename undo

Browser renamed Deck 1 to History check A, then History check B through Objects. Two successive Ctrl+z operations restored A, then Deck 1. This directly verifies repeated rename undo and clarifies the earlier fixture history contained deletions that legitimately restore older assets. An older Outdoor Playhouse was visible during this run and removed with normal Delete; final Objects baseline contains Deck 1 and Irrigation head 1. Screenshot `/private/tmp/landscape-repeated-rename-undo.jpg`. No history code changed; multi-asset repeated undo should still be rechecked with unique names / fresh history before broad reliability claims.

### Review counts include outdoor assets

Review quantities now exposes the existing count value as a semantic Count column. Review total and empty-state gate now use the same object inventory as quantities; an Outdoor assets summary card matches existing card styling. Browser placed Patio Umbrella with baseline Deck 1 and Irrigation head 1; Review showed Structures 1, Irrigation 1, Outdoor assets 1, Total items 3. Quantities showed each named row with Count 1. Temporary umbrella removed through Objects Delete. Screenshots `/private/tmp/landscape-review-outdoor-total.jpg`, `/private/tmp/landscape-quantity-count-column.jpg`. Landscape type check passed. Outdoor-only runtime fixture still pending although the total gate now uses reviewNodes.length.

### Current full Landscape regression

Ran `bun test src/index.test.ts src` from packages/landscape after shared outdoor inventory, grouping, Review summary and Count column changes. Result: 277 pass, 0 fail, 57,264 assertions across 69 files in 4.23 seconds. This suite covers manifest, Landscape item history, pool cutouts, planting placement/distribution/history, path geometry and grades, irrigation geometry/validation/readiness/schedules, quantities and hierarchy. It does not prove full browser workflow coverage, published minimum-host compatibility or the remaining scope in workspace-implementation.md.

### Minimum host API compatibility audit

Used locally installed published @pascal-app core/editor/viewer 1.0.1 caches through an external temporary TypeScript configuration, without changing dependency links or the live editor. Command: packages/landscape/node_modules/.bin/tsc --noEmit -p /private/tmp/landscape-minimum-host-tsconfig.json. Terminal exit 2. Report `/private/tmp/landscape-minimum-host-types.log` shows Landscape-specific incompatibilities: saved view ThumbnailGenerateEvent perspective, inline irrigation InspectorExtension primaryWhen, controller/run Capabilities refs. The published editor cache DOES export ItemsPanel and shared controls, with showSourceFilter/showTagFilters props. Separate cached-editor React type duplication appears in skeleton.tsx; this does not explain the named core API omissions. Current manifest minimum ^1.0.1 is not supported by this implementation. Linked host 1.0.3 passes current types/runtime checks, but availability of a distributable compatible version and dependency/lockfile updates still need verification before release. No host links were changed and no minimum-version success is claimed.

### Host requirement corrected to 1.0.3

Public npm metadata confirmed core/editor/viewer version 1.0.3 exists. Landscape peer requirements now ^1.0.3 and development pins 1.0.3. `bun install --lockfile-only` resolved the published packages and integrity hashes without changing installed host links; editor link still points to sibling editor/packages/editor. Current Landscape type check and whitespace check passed. Browser reopened the shared asset catalog successfully; screenshot `/private/tmp/landscape-host-version-catalog-check.jpg`. Lockfile resolution also reconciled existing Bath Space workspace and Streetscape react-dom declarations; their package source was not modified. Exact published 1.0.3 type/runtime parity against linked source remains to verify; do not treat linked checks as published-package validation.

### Published 1.0.3 contradicts linked-host compatibility

Downloaded official core/editor/viewer 1.0.3 tarballs via npm pack --ignore-scripts into `/private/tmp/landscape-published-host`, leaving installed links unchanged. A temporary TypeScript configuration targeted published core/viewer declarations and editor sources. Third-party dependency/type-resolution diagnostics occur in the extracted package environment, but direct inspection of published core registry/types.d.ts and events/bus.d.ts confirms the specific API omissions independently: Capabilities refs, InspectorExtension primaryWhen, ThumbnailGenerateEvent perspective remain absent. The linked sibling source declares version 1.0.3 but contains newer APIs not present in the published tarball. Therefore the preceding version bump does NOT establish published compatibility; release must wait for or target an actual compatible host release. Current peer minimum 1.0.3 is a lower bound only, not verified support. No casts or feature removals were introduced to conceal this mismatch. Published runtime verification remains outstanding and published type compatibility currently fails.

### Irrigation socket approach validation

Run connection checks now compare the endpoint-adjacent segment with the connected equipment socket direction (dot product >= .999), when the endpoint meets the declared socket. Missing/moved sockets retain their existing findings; zero-length segments retain the separate diagnostic. Applies to heads, sources, valves and dripline inlets. Valve-to-dripline routing now adds an inlet-aligned final approach rather than meeting the horizontal inlet vertically. Focused run/readiness/manifest tests: 15 pass, 0 fail, 58 assertions. Landscape type check passed. Browser created second head and routed both heads; the initial route passed. Editing the first interior vertex sideways while retaining socket endpoints produced Start: centerline approaches against the socket direction; a fitting is required in Network, inspector and Review. Screenshot `/private/tmp/landscape-irrigation-socket-direction.jpg`. Temporary run and second head deleted; baseline Deck 1 and Irrigation head 1 verified. Dripline changed route runtime case remains to verify.

### Dripline route direction browser verification

Created Dripline 1 at X0 and Zone valve 1 at X4 using shared Design controls. Route was disabled with default valve .75in versus dripline .5in. Changed valve nominal size to .5in in shared MetricControl, selected both in Objects, and routed through Network. Generated Dripline supply run 5.47m reported Endpoints match outlet position, direction, diameter and zone. Review had no irrigation finding region. Screenshot `/private/tmp/landscape-dripline-aligned-route.jpg`. Run, valve and dripline deleted through normal object selection/Delete; baseline Deck 1 and Irrigation head 1 verified. This closes the browser verification pending for the revised inlet approach. Filtration, pressure regulation and hydraulic design remain outstanding.

### Irrigation inspector wheel protection

All six irrigation inspector roots now stop wheel propagation during capture, matching Landscape sidebar behavior and retaining native scrolling. This prevents MetricControl wheel listeners from changing authored scene values while scrolling. Shared components are retained. Browser selected existing Irrigation head 1, observed Reach radius 3.00m, scrolled down directly over its metric row and verified it stayed 3.00m. Screenshot `/private/tmp/landscape-irrigation-inspector-scroll.jpg`. Landscape type check passed. Other inspector families use the same wrapper but their individual runtime scroll checks remain pending. Shared MetricControl lacks a disabled prop; read-only update guards exist, but a consistent visibly read-only metric presentation remains to design/verify without replacing host controls.

### Remaining irrigation inspector wheel runtime checks

Browser created disposable supply, valves, dripline, controller and supply-to-valve run. Wheel directly over each inspector metric left values unchanged: supply pressure 3.00bar, valve diameter .75in, emitter spacing .30m, controller seasonal duration 100%, run diameter .75in. Head radius 3.00m was verified previously. All six inspector root wrappers now have runtime evidence. Same-position supply/valve route was disabled; a separate valve at X3 produced the valid supply run. Screenshots `/private/tmp/landscape-supply-inspector-scroll.jpg`, `/private/tmp/landscape-controller-inspector-scroll.jpg`, `/private/tmp/landscape-run-inspector-scroll.jpg`. All six temporary objects removed through Objects selection/Delete; final baseline Deck 1 and Irrigation head 1 verified. Individual deeper controller station/path coordinate wheel rows inherit wrapper protection; their separate scroll checks and read-only visual treatment remain pending.

### Outdoor-only level Review runtime

Created temporary Floor 1 with the host level selector; Objects confirmed no Landscape objects. Placed Patio Umbrella through shared asset browser in 2D. Review showed Outdoor assets 1 / Total items 1 and quantity Count 1, proving the empty-state gate works with outdoor-only inventory. Screenshot `/private/tmp/landscape-outdoor-only-review.jpg`. First Ctrl+z removed the asset; second restored it on the same temporary level. Unlike the prior deletion-heavy fixture history, this fresh sequence warrants renewed investigation of shared asset placement/history (no broad repeated-undo reliability claim). Removed asset through Objects Delete, then removed empty Floor 1 through native level menu (uses history-backed scene.deleteNode). Fresh AX verified only Ground Floor, Deck 1 and Irrigation head 1 remain. No baseline objects were changed.

### Shared asset undo store isolation

Added shared-assets-history.test.ts covering a preceding level edit, history-paused transient outdoor ItemNode creation/deletion, resumed committed asset transaction, pause/resume, and two successive undos with microtask settlement. The first removes the asset and retains the preceding edit; the second restores the original level name without restoring the asset. Focused manifest + regression result 4 pass, 0 fail, 12 assertions. This narrows browser asset restoration to live placement / interaction / renderer behavior rather than proving a core store failure. Browser defect remains unresolved; no shared host code was changed.

### Unambiguous shared asset live undo reproduction

Changed Deck 1 name to Undo preceding edit, then placed one Patio Umbrella in 2D. First ctrl+z removed the umbrella but retained the distinct deck name. Second ctrl+z restored the umbrella and still retained that name. This disproves the earlier hypothesis that identical older deletion fixtures alone explained the behavior. Native shortcut spelling ctrl+z matches Control_L+z behavior; DOM locator Control+z transport timed out without an action. Screenshot `/private/tmp/landscape-asset-history-reproduction.jpg`. Expanded store regression to call public editor runUndo instead of raw temporal.undo: 4 pass, 0 fail, 12 assertions. Problem therefore remains specific to live placement/interaction/rendering or other mounted subscribers; root cause not established. Removed umbrella with normal Delete and restored Deck 1 through rename; baseline head/deck verified. No host workaround introduced.

### Material takeoff grouping

Added materialTakeoff grouping by trimmed authored material/finish, summing surface count and gross area. Net and ordering totals are withheld if any included surface lacks net area. Waste applies after aggregation without early rounding. Unmeasured assets and empty material names are excluded. Shared PanelSection with semantic accessible table preserves current Review styling and explains overlap limits. Focused manifest/material tests 5 pass, 0 fail, 12 assertions; Landscape type check passed. Browser current tab had expired; opened replacement on the confirmed-live port3002 server without restarting it. Existing Deck 1 remained. Added temporary Deck 2: cedar count2, gross/net24.66m²; entered unsaved waste10%, Order27.13m². Screenshot `/private/tmp/landscape-material-takeoff.jpg`. Deleted Deck 2, left saved allowance unchanged. Grouped export and other material combinations / unknown-net browser cases remain pending.

### Grouped material CSV and exact preview

Added materialTakeoffCsv using the same grouped totals and shared formula-safe CSV cell escaping as object quantities. Columns material/objects/gross/net/waste/ordering use explicit units; unknown ordering leaves both allowance and order blank. Shared ActionButtons export landscape-material-takeoff.csv and toggle a native read-only preview of the exact generator output. Browser preview showed cedar count1 gross/net21.48 allowance0 ordering21.48; DOM confirmed readOnly=true. Export action invoked but browser download event did not arrive in 5 seconds, so disk delivery remains unverified. Screenshot `/private/tmp/landscape-material-csv-preview.jpg`. Focused manifest/material/quantities tests 13 pass, 0 fail, 33 assertions. Landscape type check passed. No scene changes in this verification.

### Takeoff responsive verification and current regression

Verified takeoff at1920×1080 and1024×768 using public viewport override, then reset to default. Fixed cramped quantity columns by assigning object table480px and grouped table360px minimum widths within existing overflow-x-auto containers. Browser confirmed grouped table360px inside280px container and horizontal scrollLeft0→80 via real scroll action, exposing final ordering columns without enlarging sidebar. CSV preview stayed280px and read-only. Screenshots `/private/tmp/landscape-takeoff-1920.jpg`, `/private/tmp/landscape-takeoff-1024.jpg`, `/private/tmp/landscape-takeoff-horizontal-scroll.jpg`. Current full Landscape suite after grouped CSV:282pass0fail57,275assertions71files4.24seconds. Table CSS update type check passed. No scene changes.

### Material takeoff selects contributing surfaces

Grouped material labels now use shared ActionButton with accessible Select <material> surfaces name. Clicking selects only measured rows with that trimmed authored material through existing selectLandscapeObjects, matching the takeoff membership. Browser created a temporary cedar Deck 2 on an empty plan area; grouped cedar count2 / net24.55m². Clicking Select cedar surfaces produced host 2 items selected, and Objects showed Selected objects · 2 with both deck rows. Screenshot `/private/tmp/landscape-material-group-selection.jpg`. Selected Deck 2 alone and deleted it; baseline Deck 1 retained. Landscape type check passed. An earlier drawing attempt over existing geometry did not create a fixture; verified inventory before retrying on empty plan space.

### Current workspace type gate

Ran root bun run check-types after dependency, takeoff/export and selection changes. Turbo result5successful/5total;2cached,3executed,17.175seconds. Log `/private/tmp/landscape-workspace-types.log`. Browser unknown-net material case attempted via temporary 2D path, but no placed path appeared in Review; do not claim that runtime case verified. Review still contained only existing cedar Deck 1. Unknown-net aggregation/export remains covered by focused material tests; browser fixture remains pending.

### Material takeoff unknown-net browser verification

- In the live 2D editor, placed a disposable concrete walkway and opened Review. Its gross area was 7.64 m² and plan length 8.70 m. Object net area and grouped material net/ordering area displayed `—`.
- Exact material CSV preview contained `"concrete","1","7.64","","",""`, withholding net, waste and ordering cells for the uncomputed net area. The cedar deck retained its measured net and ordering values.
- Saved screenshot outside the repository at `/private/tmp/landscape-material-unknown-net.jpg`. Selected the concrete group and deleted the disposable path; Review returned to the single original deck.
- Drawing worked after selecting the polyline tool in the settled 2D view. The initial view/tool transition attempt remains insufficient evidence for a lifecycle regression; no speculative fix was made.

### Continuous walkway net takeoff

- Reused `buildOutline` and `subtractPoolCutouts`, the same continuous backing footprint used by the path renderer, for net quantities of concrete, brick, slab and other continuous finishes. Gross plan area remains unchanged. Individual laid/natural stones keep net and ordering unavailable because their route envelope includes gaps.
- Focused tests cover an intersecting same-parent pool with clearance, hidden pool exclusion, and all four loose stone finishes withholding ordering. Eleven quantity/material tests passed with 36 assertions.
- Live 2D browser placement produced a continuous concrete path with 4.77 m² gross/net/ordering at zero allowance; exact material CSV preview contained `"concrete","1","4.77","4.77","0","4.77"`. Screenshot outside the project: `/private/tmp/landscape-path-net-takeoff.jpg`.
- Selected the material group and deleted the disposable path; Review returned to the original single deck. Pool-overlap browser verification and individual stone material measurement remain outstanding.
- Validation after the change: Landscape typecheck passed; full Landscape suite passed 283 tests across 71 files (57,042 assertions); Landscape whitespace check passed.

### Individual stone footprints and pool parity

- Added a shared stone-footprint helper using the existing laid/natural stone generators and paving polygon operations. It clips every stone against visible same-parent pool openings. Both 3D and 2D renderers now use it; 2D continuous paving also uses the same pool-cutout outline as 3D.
- Net path quantity now measures individual stone rings minus holes, rather than the route envelope, and ordering applies the existing allowance to this area. The UI explains that these are authored plan footprints before bevels. Gross route area is unchanged. This supersedes the earlier unknown-net behavior for individual stones.
- Browser placed a stepping-stone path: gross 4.77 m², net/order 1.26 m². A temporary 8 × 4 m pool covering the path reduced net/order to 0.00 m². Removing the pool restored 1.26 m² and the original deck net 21.48 m². Deleted the temporary path; Review returned to the original single deck.
- Screenshots outside the project: `/private/tmp/landscape-stone-net-takeoff.jpg` and `/private/tmp/landscape-stone-pool-takeoff.jpg`. Browser verification covered the 2D path/pool result; automated rendering coverage checks empty 2D and 3D geometry when fully covered and zero pool intersections for partial coverage across all four loose stone finishes.
- Full Landscape regression passed 284 tests across 72 files (57,252 assertions). Typechecking caught a test fixture accessing a nonstandard node ID through the typed host registry; the fixture now retains its source object before conversion. Typechecking then passed. Landscape diff whitespace check passed.

### Correct CSV export selection and object preview

- Found an operator-precedence error in the Blob content: concatenating the BOM before the conditional made both export actions always choose material takeoff and dropped the BOM. A pure `quantityExport` now selects the intended generator and filename first and prefixes the UTF-8 BOM to both outputs. The download handler uses that single result.
- Added quantity CSV preview with the public ActionButton and the same native read-only textarea styling as the material preview. It shows exactly the selected export content without the invisible BOM.
- Nine quantity tests passed (39 assertions), including both exact filename/content pairs; Landscape typecheck and diff whitespace checks passed.
- Browser opened both previews and confirmed the object CSV has ID/Item/Count/length/slope columns and the material CSV has grouped Material/Objects columns. Original Deck 1 remained the sole object. Screenshot: `/private/tmp/landscape-distinct-csv-previews.jpg`.
- Clicked Export CSV with a download listener; it timed out after five seconds. File delivery remains unverified; the corrected content/filename and both visible previews are verified. No successful download is claimed.

### Readable material names

- Review object rows and material group buttons now show readable labels. Unique path finish names reuse the existing finish catalog; ordinary supported materials use their existing displayed names, and unknown authored names remain intact. Grouping and CSV retain the authored identifiers.
- Browser placed a temporary stepping-stone path and verified the group button reads `Stepping stones`, while its exact CSV row retains `steppingStones`. Cedar also displays with its inspector capitalization. Group selection remained functional; deleted the test path and confirmed the original single deck.
- Screenshot outside the repository: `/private/tmp/landscape-readable-material-labels.jpg`. Typechecking and Landscape diff whitespace checks passed. No implementation-mirroring tests were added for this display-only change.

### Multi-object visibility browser acceptance

- Rechecked current sibling core schemas and editor controls: general node locking is still not exposed. Guide locks and movement-axis constraints do not implement object locks. Real object locking remains an outstanding host integration requirement.
- Placed a disposable second deck in 2D and used Shift-click in Objects to select both decks. The shared selected-object section reported two objects.
- Hide selected changed both per-object actions to Show, disabled Hide selected and enabled Show selected. One Control+Z restored both per-object Hide actions and visibility, proving the batch is one history step.
- Repeated Hide selected followed by Show selected; both returned to their prior visible state. Selected Deck 2 alone and deleted it. Inventory returned to Deck · 1 with the original Deck 1 visible.
- Evidence screenshot outside the repository: `/private/tmp/landscape-multi-object-hidden.jpg`. No implementation change was needed. Multi-member bulk selection visibility is now runtime verified; overlapping collection membership and true locks remain separate pending checks.

### Expanded quantity Review workspace

- Inspected the host's public PanelWrapper. It automatically swaps content for selected-object inspector extensions, so it cannot safely own a quantity workspace whose rows select objects. No generic dialog is publicly exported. Added a native top-layer dialog with the host theme and public ActionButton/PanelSection/MetricControl content; no inspector internals or duplicate quantity engine were introduced.
- Expand quantity review opens a maximum 960 px view of the existing controls and tables. Content is rendered once, and its allowance/preview state stays in QuantityPanel when opening or closing. The modal is bounded by viewport width and 85dvh with vertical scrolling.
- Browser verified all columns at normal desktop width, a 10% unsaved allowance and 23.63 m² ordering preserved across close/reopen, and viewport fit at 1024 × 768 (960 px wide, 652.8 px high). Native focus and canvas keyboard interactions needed an explicit modal key handler: Escape and Close now both dismiss the modal and restore focus to Expand quantity review.
- Reset the viewport and switched Layout → Review to discard the unsaved allowance; Review returned to 0% and original Deck 1 at 21.48 m². No geometry was changed. Screenshots outside the repository: `/private/tmp/landscape-expanded-review.jpg`, `/private/tmp/landscape-expanded-review-1024.jpg`.
- Typechecking passed after removing an unnecessary React DOM portal (native dialog already uses the top layer). Landscape whitespace checks passed. No implementation-mirroring tests were added for this UI-only layout change.

### Workspace baseline isolation — October 5

- Current root `bun test` completed: 2,275 pass, 5 fail, 2,280 tests across 346 files; log `/private/tmp/landscape-workspace-validation-oct5.log`.
- Archived committed HEAD `11d980634079e493a8153d319be8d9d3e923617d` into `/private/tmp/landscape-baseline-367xuzc_` without changing this checkout. Reused the same installed root/package dependency directories via links, so this isolates repository source differences, not external dependency state.
- Committed baseline reproduces all four `osm-import-placement.test.ts` failures (5 pass, 4 fail): duplicate discriminator value `undefined` from Streetscape's installed core 0.9.2. These are now established baseline failures under the current dependency environment; they were not caused by Landscape changes. Log `/private/tmp/landscape-baseline-osm.log`.
- Committed baseline also reproduces the Pool panel navigation failure when run from root: its spawned eval cannot resolve root React. Running from the Pool package changes the failure to an invalid hook call in the linked editor's React/store implementation. This test is not a passing validation gate in either context. Logs `/private/tmp/landscape-baseline-pool.log` and `/private/tmp/landscape-baseline-pool-package.log`.
- Pool and Streetscape source have no local diff. The previous Bath Space split-view failure did not recur in this full run; no pre-existing claim is made for that earlier transient failure. The unrelated Bath Space working changes were preserved.
- No production implementation changed in this audit, so no new implementation browser check was required. The workspace is not wholly green; release compatibility and the remaining feature/runtime requirements are still outstanding.

### Planting schedule PDF export — October 5

- Rechecked sibling editor sheets and public exports. The host provides `exportSheetsToPdf`, but no mounted SheetsWorkspace UI was found. Added a real schedule export action rather than a navigation action to an unavailable workspace.
- Planting documentation uses the existing canonical plant/tree schedules to create A4 vector pages with matching codes, species, botanical names where supplied, counts, repeated headers and page numbering. Uses the public host PDF exporter and shared ActionButton. Export remains available in read-only scenes because it does not edit geometry.
- Focused schedule/layout tests passed: 4 tests, 77 assertions, including 63-row pagination with no lost/duplicated codes, wrapped names, separate plant/tree sections and page bounds. Landscape typechecking passed.
- Browser verified export preparation for one temporary Daisy and the honest download-requested status. The browser download listener timed out; actual browser file delivery remains unverified. Removed the Daisy, confirmed the original Deck only, and verified the export action disables for an empty planting inventory.
- An external verification harness called the same host exporter implementation with the generated pages and captured the PDF Blob without browser delivery. PDF header check passed; rendered the output with pdftoppm and visually inspected its readable table and footer. The public barrel cannot initialize in the Bun harness because of an unrelated linked Three/Fiber async-module compatibility issue; production still imports the public API.
- Evidence outside the repository: `/private/tmp/landscape-planting-schedule-verification.pdf`, `/private/tmp/landscape-planting-schedule-verification.png`, `/private/tmp/landscape-planting-schedule-ui.jpg`. This completes a schedule-only export; full drawing-sheet plans and browser download delivery remain outstanding.

### Project plans and schedules integration — October 5

- Inspected the existing public `exportFloorplanPdf('full')` implementation and Settings panel usage. It already collects registered geometry/annotation extensions, drawing type, units, annotation settings and per-kind schedules across project levels. Added a shared ActionButton in Landscape documentation to call this same pipeline rather than a competing plan collector or PDF engine.
- The action is explicitly named `Export project plans and schedules`, with project-wide scope and current drawing settings explained. Preparation disables repeat clicks; errors and finished status are distinct. Read-only export does not mutate scene geometry.
- Browser clicked the action with the original Deck and Wall scene. It returned to its available state with `Project export finished`; no floorplan-export warning or console error was recorded. A second attempt with a download listener again timed out. The integration/preparation path is runtime verified; delivered file, rendered plan/label pages and complex project coverage remain unverified.
- Landscape typechecking and whitespace checks passed. No implementation-mirroring test was added for an action that delegates to the existing host exporter. Screenshot outside the repository: `/private/tmp/landscape-project-plan-export-ui.jpg`. Browser fixture remained unchanged.

### Hardscape schedule net quantities — October 5

- Schedule contributions now accept the host's scene nodes and level ID, passing the same geometry context to `landscapeQuantity` as Review. Added net area and ordering area columns without replacing gross area or centerline length. Ordering reads the saved level allowance; unsaved Review drafts are not exported. Missing geometry context yields unknown net/ordering cells rather than fabricated gross equivalents.
- Existing supported deductions include visible same-parent pool openings, grass footprints and individual stone gaps. Notes explicitly retain the limitation that other overlaps require review. Invalid stored allowances fall back to zero, matching Review's saved setting behavior.
- Quantity/schedule/page tests: 14 pass, 0 fail, 126 assertions. Added schedule coverage for pool deductions, hidden pool restoration, saved allowance, unknown net values and invalid allowance; existing quantity cases cover grass/stone deductions. Landscape typechecking and whitespace checks passed.
- Browser reran project export after HMR with the existing scene. Export finished and no console error was recorded. No fixture geometry changed. Screenshot `/private/tmp/landscape-net-schedule-export-ui.jpg` records the live export action only; actual delivered PDF columns and layout remain unverified because download delivery is still unresolved.

### Read-only irrigation property presentation — October 5

- Rechecked host MetricControl and ToggleControl: neither publicly accepts a disabled prop. Added shared SceneMetricControl/SceneToggleControl adapters for authored irrigation inspector values. Editable scenes render the original host controls; read-only scenes render static output with theme tokens and the public `useLinearDisplay` conversion. Edit handlers are not mounted in the read-only branch. Existing scene write guards remain.
- Migrated head, supply, valve, dripline, run, controller and path vertex inspector values. Native zone/station assignment inputs retain existing disabled behavior, and non-mutating station/day previews remain available. Workspace placement drafts and Review ordering drafts intentionally remain adjustable because they do not mutate the scene.
- Landscape typechecking and whitespace checks passed. Browser created one disposable head, opened the original host reach editor, entered `4m`, and observed 4.00 m plus plan reach union changing from 28.2 to 50.2 m². Deleted the head; irrigation returned to zero objects and original geometry was preserved. Screenshot `/private/tmp/landscape-property-control-editable.jpg`.
- This verifies editable control delegation only. A live read-only editor session is still needed to verify static rendering, display units and keyboard behavior; no completion claim is made for that mode.

### Current Landscape regression gate — October 5

- Ran the entire Landscape package suite after schedule export, project export, net schedule quantities and scene property adapters: **288 pass, 0 fail, 57,492 assertions across 73 files**, 4.39 seconds. This is the current package regression result; older counts above are historical.
- Coverage includes scene history, geometry/cutouts, planting distributions/placement, quantities, schedule layout, paths/grades and irrigation models. It does not establish live read-only UI behavior, delivered project PDF layout, complex transformed/nested browser scenarios, shared-asset repeated Undo, or published-host compatibility.
- Inspected current host read-only entry points: the core exposes `setReadOnly`, but no visible app UI action for it was found. The next read-only acceptance step requires a dedicated host test session; production debug controls were not added. This is not a blocker to the other outstanding Landscape work.

### Nested planting source integration audit — October 5

- Current `PlantingLayoutPanel` lists direct-level area/path sources, writes generated plants under that level and compares direct-level occupied centers. Current clearance checks compare only objects with the same parent. These restrictions do not satisfy nested/transformed planting support.
- Searched current public core/viewer barrels for world transform/position conversion. `useLiveTransforms` exposes temporary editing transforms, not a scene ancestry conversion service. Host surface-hosting code uses private procedural spatial helpers; its parity tests demonstrate transformed cases but do not make those helpers public. No suitable public hierarchy transform service was identified in this audit.
- Nested sources must preserve their parent coordinate frame, transform occupied objects into that frame, and resolve support heights consistently with the host. Merely adding descendants to the source selector would produce incorrect placement and has not been done. This is a concrete pending integration requirement, not a completed feature or an overall blocker.

### Shared outdoor asset history reproduction — October 5

- Browser baseline Objects contained Deck 1 and no outdoor assets. Renamed Deck to `Asset history audit Oct5`, placed one Patio Umbrella via shared ItemsPanel in 2D, and renamed the new asset to `Asset audit Oct5 new umbrella`.
- Undo 1 reverted the asset name to Patio Umbrella. Undo 2 removed the asset. Undo 3 restored a Patio Umbrella while retaining the Deck audit name. This does not match the expected preceding Deck rename restoration. No intervening fixture deletion was performed in this sequence. The browser behavior is not represented by the passing isolated shared-assets-history test.
- Traced host `useDraftNode`, fresh placement, interaction-scope ownership and `runUndo` paths. No causal fix has been established; no plugin history interception or host modification was introduced.
- During screenshot/cleanup, the live browser switched to Bath Space, 3D, with four placed fixtures. Stopped mutation of that changed scene to preserve external work. Cleanup of the audit Deck name and reappeared umbrella is **not confirmed**. `/private/tmp/landscape-asset-history-reproduction.jpg` was captured after the state changed and must not be used as proof of the Undo reproduction.

### Shared asset history test fidelity

- Corrected the isolated test preview metadata to match `useDraftNode.create`: `isTransient`, without factory-owned `isNew`. Added the uniquely named asset edit and its Undo before creation Undo and preceding edit Undo, matching the browser command sequence. Renamed the test to explicitly identify that mounted placement effects are absent.
- `bun test src/index.test.ts src/editor/shared-assets-history.test.ts`: 4 pass, 0 fail, 13 assertions. Direct isolated invocation still fails to initialize the linked editor public barrel due to Three/Fiber CJS loading an async module; this is a separate environment/bootstrap limitation, not an assertion failure.
- The corrected transaction test still passes, while the browser sequence failed. This narrows the next investigation to mounted placement/history subscribers and state settling rather than proving a core transaction failure. Inspected root-only commit lifecycle, draft re-insertion subscription, scope teardown and history refresh paths; no causal production fix has been established. No browser scene mutation was performed in this source/test audit.

### Real placement hook history isolation

- Created an external harness at `/private/tmp/landscape-real-draft-history.test.tsx`, following the host's SSR hook harness. Calls the actual `useDraftNode.create`, `commit`, `destroy` and public `runUndo` functions rather than manually substituting the commit transaction. Includes preceding level rename, asset placement, unique asset rename, and three Undo operations.
- Harness initially imported source core/viewer barrels while the hook imported their public package runtimes, creating different store instances. Corrected imports to share the hook's public package runtime; the setup error is not a product failure. Final result: **1 pass, 0 fail, 5 assertions**. It does not mount the placement coordinator, renderer or browser event subscriptions.
- Opened a separate test tab. The localhost instance inherited existing session preferences; navigated the disposable tab to the loopback 127.0.0.1 origin for separate browser storage. That page reached the load state but remained a static editor shell without initialized Landscape tools. No test geometry was created and no history claim is made for that tab. The Bath Space session was not changed.
- Actual hook isolation passes; mounted-browser failure and previous fixture cleanup remain unresolved. No production history workaround was added.

### Disposable browser verification host

- Created `/private/tmp/landscape-isolated-editor/apps/editor` from the current sibling app sources, excluding caches, environment secrets, certificates and node_modules. Shared installed dependencies/packages via read-only source links. Configured a separate database at `/private/tmp/landscape-isolated-editor/qa.db` and a loopback-only server on `127.0.0.1:3004`; live exec session 90305 at setup. No original editor app or plugin sources were changed for this setup.
- Inspected the app AGENTS.md and installed Next documentation before adjusting the disposable configuration. Used Webpack with exact root aliases to the public core/viewer built entries and editor source entry; copied shared CSS. Disabled optional react-scan diagnostics in the test copy after its installed package failed compilation.
- Omitted Bath Space registration only in the disposable bootstrap because its current unrelated panel source has an import before `use client`, rejected by Webpack. The original Bath Space changes and active session were preserved. This test host is therefore not evidence of full plugin compatibility or equivalence to the primary Turbopack server.
- Browser initialized the current Landscape UI, opened Objects and showed `No landscape objects on this level yet`. No geometry was created in this setup. Screenshot outside the repository: `/private/tmp/landscape-isolated-editor-ready.jpg`. The isolated tab is retained for the next mounted history/read-only verification steps; those checks remain incomplete.

### Read-only irrigation inspection in Objects — October 5

- The host hides floating inspectors in read-only mode. Added a read-only Objects section that lazily renders the existing head/source/valve/controller/run/dripline inspectors for a single selected irrigation object. Authored controls use static, labelled outputs in read-only mode and public editable controls otherwise; this reuses existing inspector behavior and theme.
- Added disposable host-only buttons for read-only and unit switching; no production debug controls were introduced. Added an explicit Landscape source alias in the disposable Webpack configuration. The app-local Landscape package path was absent, with dependencies resolving through root links; this does not establish that earlier browser checks used outdated code.
- Browser: placed one head, selected it in Objects, enabled read-only, and verified its inline properties appeared. The section contained zero inputs, five labelled outputs, and a disabled Delete head button. Public unit conversion changed reach from 3.00 m to 9.84 ft; nominal inlet stayed 0.50 in, spray arc 360°, authored flow 4.00 L/min, coverage On. Screenshot: `/private/tmp/landscape-readonly-irrigation-properties.jpg`.
- Restored metric/editable mode, verified the floating inspector returned, deleted the disposable head, and confirmed `No landscape objects on this level yet`. Other irrigation inspector variants still require individual mounted acceptance checks.
- Typecheck passed after correcting the node ID index type. Latest full Landscape suite: **288 pass, 0 fail, 57,495 assertions across 73 files**, 5.36 seconds; log `/private/tmp/landscape-validation-readonly-oct5.log`. `git diff --check` passed. Full scope remains active, including mounted shared-asset history and the other documented requirements.

### Clean mounted shared-asset Undo reproduction

- Reproduced on the isolated 127.0.0.1:3004 host with current source. Added an irrigation head, renamed it `Preceding irrigation edit`, placed Patio Umbrella through the shared embedded ItemsPanel in 2D with Place once, and renamed the asset `Mounted umbrella edit`. Undo reverted the asset name; next Undo removed it; third Undo restored a Patio Umbrella and retained the preceding irrigation rename. This corroborates the earlier browser failure without touching the user's Bath Space session.
- Saved valid visible proof outside the repository: `/private/tmp/landscape-mounted-asset-undo.jpg`. Removed the reappeared umbrella using normal selected-object deletion. The named irrigation fixture remains in the disposable host for continuing diagnostics.
- Added temporary scene/history subscription logging only in the disposable QA component. A history snapshot contained a Patio Umbrella with `metadata.isTransient: true` and a different ID from the reappeared item. Current host `useDraftNode.create` adds only `isTransient`; core history excludes `isNew` drafts. This identifies draft contamination as a concrete lead, but the creation/effect ordering still needs tracing before a causal fix is claimed. No production history interception or sibling source edit was made.
