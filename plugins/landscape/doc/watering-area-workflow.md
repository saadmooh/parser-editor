# Area watering workflow

Use Landscape → Watering → Water an area. Choose an existing ground area, choose lawn sprinklers or bed driplines, and leave Water connection on Automatic. It reuses the nearest enabled supply or proposes a supply point beside a clear corner of the area. Zone valves, feed pipes and device connections are included. The new source is an assumed design connection; move it to the actual tap or main and enter measured data. Preview shows the complete proposed layout before any scene changes. Apply commits devices, zones, connections, drip controls and controller assignments together. Undo removes that transaction.

Choose Devices only to apply devices and zones as a draft without feed pipes. Select a supply later and preview the same area again to connect those devices. Existing positions, zone sizes and protected routes are preserved. Repeating a connected proposal reuses its connections. Changing watering method on an existing area requires reviewing its existing zones first.

Sprinkler layout follows reach-based perimeter spacing, inward perimeter arcs and interior samples. Red dots identify samples outside spray reach. Sample coverage describes geometry, not watering uniformity. The Hunter MP1000 preset uses 4.1 m reach, 3.18 L/min full-circle demand and 2.8 bar required pressure; intermediate arc flows are interpolated.

Drip rows are clipped to the polygon, including concave boundaries. Long rows are divided into separate laterals. Every drip valve receives a reusable filter/regulator assembly. Row spacing, emitter spacing and flow remain editable. Soil wetting width and tubing-specific maximum run length require confirmation.

Automatic pipe routes use real socket references, elbows, reducers and tees. Routes avoid conservative bounds for same-level landscape patios, decks, concrete slabs and landings. Unroutable proposals fail before committing. Other structure types, underground utilities and installation constraints need manual review. Protect a pipe in its inspector to exclude it from automatic tee insertion.

Flow budgeting assumes one zone operates at a time. New layouts split device demand by available flow times the design fraction. Existing layouts retain their zones and report capacity problems. Pipe sizing uses a 1.5 m/s design velocity; nominal inches estimate the bore unless an internal diameter is supplied. Hazen-Williams losses, optional minor losses, elevation and regulator pressure caps estimate outlet pressure. Supply component losses use an editable allowance. Looped networks withhold tree pressure estimates. Supply pressure must be measured while flowing; unmeasured supplies remain drafts, and backflow confirmation is explicit.

Free controller stations receive new valves; occupied station timings, days and start times are preserved. Newly created controllers use a proposed Mon/Wed/Fri schedule with 20-minute stations. Users must adjust these times for their plants, soil and local rules. Preview animation displays connected sprinkler devices; it does not simulate distribution or controller actuation.

## Verification

- Full landscape suite: 423 passing tests across 104 files.
- Irrigation tests cover method isolation, singleton drip controls, obstacle detours, polygon layout/clipping, flow splitting, hydraulic equations and pressure cases, later draft connection, repeat application, controller preservation, and atomic undo/redo.
- Collaborative browser: drew a temporary area; previewed/applied/undid sprinkler and drip layouts, both with and without supply; checked demand/pressure messages and black connection routes. Removed temporary test equipment afterward.
- Browser testing exposed a polygon-clipping numerical failure in overlapping spray unions. Coverage coordinates now use micrometre rounding and failures return unavailable reach area rather than unloading the panel; rotated overlap regression tests pass.
- Package type checking remains blocked by existing shared React/R3F JSX typing errors. New planner, hydraulic and panel files have no remaining reported type errors.

Sources: [Hunter MP Rotator data](https://www.hunterirrigation.com/en-metric/irrigation-product/mp-rotator/standard-mp-rotator-nozzle), [EPA EPANET 2.2 manual](https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P10113EM.txt).

Automatic connection regression tests also verify creation of a corner supply for both methods, nearest enabled supply selection, branching an existing shared main for a second area, repeated proposal reuse, and supply creation in the single undo/redo transaction. Browser verification confirms the Supply → Zone valve → Devices preview and automatic transition to the connected zone review.

## Sidebar organization

Water an area is the primary flow: choose area and method, Preview layout, then Save layout. Supply selection and layout parameters sit in Layout options. The preview keeps its connection diagram and coverage summary visible; Design checks contains detailed warnings and assumptions, with pressure/flow problems also flagged beside Save.

Your watering zones has Review and Times views. Review selects the connected supply by default and offers supply editing. Times shows assigned zones with their durations and watering days. Unused station assignments and seasonal adjustment sit in Controller options. Manual editing is collapsed by default and retains zone creation, assignment, device placement and pipe tools. The former four-step wizard and duplicate equipment panel no longer appear alongside the automatic flow.

Sidebar controls use the shared PanelSection, ActionGroup, ActionButton, SegmentedControl and scene metric/toggle components. Titles use the host's medium 14 px style, actions use medium 12 px, and supporting copy uses normal 12 px with readable line spacing. Native selects and time fields follow the same control heights and borders. Browser checks covered preview/save, Review/Times, hidden station options, manual pipe controls and undo cleanup. Changed sidebar files have no reported type errors; the existing shared React/R3F type-check failures remain.

## Connections and movement

Controller station assignments appear as purple dashed control links to their zone valves in plan and 3D. Inactive assignments appear gray. Black pipes show the water route. Control links follow the controller and valve during movement.

Select an irrigation item and click its tracker handle to reveal the same directional arrows used for ducts and pipes. Pipe and dripline vertices have their own arrows; midpoint handles add bends. Whole-line handles move the route. Connected endpoints carry their attached equipment or fitting and update neighboring pipes while retaining distant sockets. Hold Alt to detach. Escape cancels a drag; a completed drag is one undo operation.

## Continuous water pipes

Generated routes are a single irrigation run with editable bends. Branch tees, manifolds, filter/regulators and reducers remain separate junctions. Branch routing tries the nearest reachable segment first. Connections are checked against socket position, direction, diameter, zone, occupancy and reciprocal run references before committing.

For older layouts, Watering shows **Repair and combine pipes** when cleanup is available. This restores stale endpoints from their existing equipment bindings and combines compatible elbow/coupling chains and straight run joins. It preserves tees, reducers, locked routes and differing pipe specifications. Missing or ambiguous bindings remain visible for review rather than being guessed. Cleanup is one undoable change.

Header cleanup uses one diameter transition at the feed and a continuous bent pipe into the last row. Every generated tee socket has a connection. New area valves reserve separate positions; routing also reserves future risers and avoids shared pipe lengths and unconnected crossings. If needed, a crossing route drops slightly deeper while keeping equipment sockets fixed.

Tracker boxes are smaller and drag directly. Clicking a box reveals its arrows without moving or snapping the item. Midpoint and coverage controls appear on demand rather than covering the full route.

Select a drip filter/regulator to open **Irrigation fitting settings**. The panel edits outlet pressure in bar (0.1–10) and filter mesh (50–300), shows inlet/outlet connection status and opens its assigned zone valve. Pressure settings feed the hydraulic review. Socket diameters remain read-only so editing the filter does not invalidate attached pipes. Read-only scenes show the authored values without editing controls.
