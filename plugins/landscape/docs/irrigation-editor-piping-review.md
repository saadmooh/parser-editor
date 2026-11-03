# Irrigation compared with the editor's piping interactions

Reviewed October 5, 2026. Editor checkout: `/Users/sudhir/Desktop/work/editor`, HEAD `9a3723965`, including its current local source. Irrigation checkout: this workspace. This review follows source paths and runs existing focused tests; it does not establish live browser interaction feel or complete 2D/3D acceptance.

## Recommendation

Make irrigation another consumer of the editor's distribution interaction pattern: click a socket, preview a run, click to continue, branch from a pipe, and drag handles with connected geometry following. Keep irrigation-specific equipment, small nominal sizes, buried routes, zone rules, explicit connections, and demand calculations.

Reuse the shared interaction and transaction machinery through a supported public API. Do not convert irrigation objects to the existing DWV pipe kind or import private files from the editor checkout.

## What the editor already does

| Area | Observed implementation | What irrigation should adopt |
| --- | --- | --- |
| Drawing | `pipe-segment/tool.tsx` adapts `useDistributionRunTool`: start/end selection, ghost geometry, dimensions, typed length, direction guides, repeated continuation | An on-canvas Draw pipe tool, seeded from a supply, valve, fitting, or run endpoint |
| Port discovery | `shared/ports.ts` collects registry ports, excluding invisible owners and filtering by level/system | Use the registered irrigation ports instead of hardcoding equipment pair selection |
| Endpoint snap | `shared/run-port-snap.ts` ranks projected sockets within 16 pixels; source socket is excluded, depth breaks ties. The drawing hook filters clipped/occluded projections | Consistent socket attraction across zoom, with a visible target marker |
| Body snap | The draw adapter uses a 0.3 m body search, followed by a 12 pixel screen acceptance in the shared hook | Branch from a pipe body with both spatial and pointer checks; exact elevation still matters |
| Direction and grid | Surface frames, 45-degree directions, length snapping, exact entry; snapping follows shared editor modes | Use the host's visible snapping controls and conventions; avoid a separate irrigation snap toggle |
| Fitting placement | Fitting tool aligns a collar with a target port, accounting for rotation and collar offset; inline accessories can split runs | Correctly positioned fittings rather than cylinders that only touch visually |
| Automatic joints | Pipe drawing plans elbows, body taps, and crossings; trims/splits runs, previews fittings, checks stub clearance, replaces consumed end caps | Pressure-pipe elbows/tees/reducers with a reviewable preview and one commit |
| Continuation | Endpoint plus handles seed the draw tool with the existing pipe's profile. Existing elbow/tee configurations can be promoted to branch/cross layouts | Continue or branch directly from a selected irrigation pipe |
| Selection editing | 3D directional handles edit vertices, length, sideways position, and elevation; fitting re-aim and added connector plans preserve certain connected moves | Plan bend/endpoint handles first, then optional elevation controls |
| 2D path editing | `shared/path-point-affordance.ts` retains vertex elevation, follows joints, and supports explicit detach via Alt | Matching plan behavior; never accidentally flatten buried paths |
| Preview and undo | Live overrides keep drag frames out of history; drawing uses `sceneApi.applyChanges`, moving commits the node and followers in a batch | A tee insertion, split, or connected move must undo as one action |

The endpoint draw snap is already pixel-based. Other interactions use world-space thresholds: 3D pipe endpoint selection uses 0.4 m in XZ; fitting/body placement has its own searches; generic 2D alignment uses 0.08 m. The editor does not currently provide one universal snap implementation with identical feel everywhere.

## Where irrigation differs today

Irrigation supplies, valves, sprinkler heads, driplines, and runs already expose `NodeDefinition.ports` with `system: 'irrigation'`. Runs already declare `distributionRole: 'run'`. This is useful groundwork; connection rendering does not need an entirely new foundation.

However:

- Runs have neither a draw tool nor selection-time path handles. Their geometry is a path of cylinders, with numeric vertex editing through `IrrigationPathControls`.
- Routing is initiated by sidebar buttons after selecting equipment pairs. It generates orthogonal paths at an entered depth; users cannot steer a live route or branch from a trunk.
- Occupied sockets are rejected. There is no irrigation fitting kind, so the hint to use a branch fitting has no authoring path in this module.
- Run endpoint references currently allow only `inlet`/`outlet`. Pipe-to-pipe and fitting connections need a broader, validated port identity contract.
- Validation and readiness know specific irrigation equipment schemas. Adding a fitting requires updating graph traversal and port resolution, not just drawing a tee mesh.
- The source/valve defaults use 0.75 in while sprinkler/dripline defaults use 0.5 in. Current equal-size routing blocks these combinations; reducers need an explicit insertion path.
- Zone identity is repeated as text. Selection-driven assignment must not accidentally create a pipe in a different zone or join separate controlled zones.

## Movement: revise the earlier assumption

The earlier workflow review described movement as requiring follow/reroute work. The editor investigation qualifies that statement:

**Generic 3D equipment moves already attempt connectivity follow.** `move-registry-node-tool.tsx` snapshots `analyzePortConnectivity` for existing port-bearing nodes, previews `resolveConnectivityUpdates`, and batches follower changes with the moved object. Because irrigation runs declare a run role and expose ports, they can be discovered by this mechanism without a new irrigation-specific mover. This is source-based eligibility, not an irrigation runtime guarantee.

**Generic 2D equipment movement does not call that same service.** `floorplan-registry-move-overlay.tsx` offers a kind-owned move target or generic translation. Irrigation equipment currently has no kind-owned connectivity move target. Built-in pipe vertex affordances do implement connectivity follow in 2D, but our irrigation runs do not register them.

**Following a run is not the same as preserving both equipment endpoints.** The core propagation follows run/fitting partners and deliberately avoids dragging fixed equipment and terminals. From a single driven endpoint, the parallel delta stretches that endpoint; the perpendicular delta translates the entire polyline. Moving a sprinkler sideways relative to its vertical inlet segment can therefore move the far end of its buried path while leaving its valve fixed. A reroute/offset planner or fixed-endpoint constraint is needed for that case.

The correct next step is a representative fixture test in both views, followed by a shared endpoint constraint planner. Do not assume all movement is broken, or that generic follow already solves the complete irrigation network.

## Connection rules must agree

The editor's core movement graph discovers relationships from port proximity: within 0.05 m, with incompatible specified systems excluded. It does not consult irrigation's explicit endpoint references, nominal sizes, socket direction, zone, or parent identity. Candidate traversal scans run/fitting nodes across the scene.

Irrigation checks are substantially stricter: explicit reference, correct owner parent, actual socket existence, endpoint position within 0.001 m, approach direction dot product at least 0.999, diameter equality, and zone matching. Its demand traversal only includes runs that pass these checks, ignoring disabled supply/closed-valve state for installed demand.

For irrigation, distinguish three concepts:

1. **Snap candidate:** a nearby visible target the pointer can acquire.
2. **Proposed connection:** a candidate accepted by system, zone-boundary, size/adapter, occupancy, and direction rules.
3. **Committed connection:** persistent endpoint identities that drive editing, validation, and demand traversal.

Use one acceptance policy for preview, commit, and validation. Preserve explicit identities during movement; do not infer a new connection solely because two pipes happen to approach each other. Scope proximity fallback to the same level and compatible ports. Intentional detach clears the reference; intentional reattach updates it.

A plan crossing is not necessarily a physical joint: pipes at different depths must stay separate, and even equal-depth crossings should join only through an explicit branch/cross operation. The existing crossing planner is a useful pattern, not an irrigation rule to copy blindly.

## What is public and what needs an editor change

Available through public packages:

- Core registry ports, distribution roles, `analyzePortConnectivity`, `resolveConnectivityUpdates`, and pure snapping helpers.
- Core scene API and floorplan affordance contracts.
- Editor registry tool context, interaction scope, preview stores, snapping mode helpers, and unit-aware dimension UI.

Not currently exported as a reusable distribution toolkit:

- `useDistributionRunTool`, `DistributionRunCursor`, port collection/screen ranking helpers, connection compatibility feedback, shared path-point affordance implementation, and fitting planners in `packages/nodes/src/shared`.
- The hook's configuration restricts `toolName` to `duct-segment | pipe-segment`.
- DWV pipe/fitting schemas only accept `waste | vent`, minimum 1.25 in diameter, and DWV material/fitting choices. Irrigation supports smaller sizes and its own system.
- Auto-fitting creation hardcodes DWV types; the elbow planner maps systems other than vent to waste. Direct reuse would give irrigation the wrong system or fail parsing.

Recommended editor extension: a supported distribution-tool API with registered tool kind, port/body providers, connection policy, and preview/commit planners. Keep pure port matching and graph policies in core, editor interaction and feedback in editor, and irrigation schemas/geometry/pressure-pipe fitting plans in the landscape plugin. Existing built-in pipes remain consumers with their DWV policy.

## Proposed user experience

1. Select a zone, then choose **Draw pipe**. Clicking a supply/valve port inherits relevant size and zone context; a supply main can feed several controlled zones through a manifold.
2. Moving the pointer shows a ghost run, live length, depth, and an identifiable socket marker. Clicking places a segment and continues. Exact length entry remains available.
3. Hovering an existing pipe offers **Add branch** with a tee preview. Preview shows the split trunk and new branch together. A size mismatch offers a reducer preview if supported; otherwise it gives the exact reason it cannot connect.
4. Selecting a pipe reveals endpoint/bend handles and Continue/Branch actions. Plan dragging keeps depth unchanged. Connected moves reshape the pipe around fixed equipment rather than pulling the entire garden network.
5. Detach is explicit and visible, with a labelled action as well as the host shortcut. Invalid joins remain visibly unconnected and excluded from demand review.

Snap feedback should include text such as “Valve outlet · Zone A · 0.75 in”, “Reducer needed: 0.75 → 0.5 in”, or “Different zone”. The existing feedback component is a colored halo; irrigation should add a short label and shape/state distinction so users do not need to interpret color alone. A green snap means a valid connection proposal, not verified pressure performance.

## Implementation sequence

1. **Prove the shared contracts.** Create a fixture with one supply, valve, sprinkler, dripline, and buried run. Record 2D/3D move, rotation, cancel, undo, and changed-size behavior. Agree on explicit connection and fixed-endpoint rules.
2. **Expose shared drawing interaction.** Generalize/export the distribution hook and pointer snap helpers through a supported API. Implement irrigation pipe drawing, live previews, exact length, depth, and port acquisition in both views.
3. **Add real pressure-pipe joints.** Register irrigation tee/elbow/reducer/manifold ports. Extend run references, validation, and readiness traversal. Plan split/create/update changes atomically. Update external endpoint references when splitting a run.
4. **Add connected visual editing.** Use the host affordance contracts, with irrigation-aware fixed endpoints and rotation/approach constraints. Add Continue/Branch actions and deterministic cancellation/history cleanup.
5. **Apply the guided workflow.** Make these tools the actions behind Areas → Devices → Water → Times. Add Connect zone only when complete branching and routing work.

## Verification performed

Existing focused tests passed: **71 tests, 0 failures, 223 assertions**, across 12 files in the editor's core/nodes packages.

Covered socket screen ranking, rotated/zoomed floorplan projection, profile compatibility, elbow and tee geometry, branch clearance rejection, inline fitting insertion, continuation, connected movement propagation, polyline endpoint constraints, vertical/sideways offset plans, direction/grid math, and two mounted drawing-hook wall-plane cases.

These tests validate existing primitives. They do not prove irrigation integration, browser interaction feel, multi-level proximity behavior, or end-to-end 2D/3D parity. No product code or scene was changed by this review.

## Source map

All paths below are relative to `/Users/sudhir/Desktop/work/editor` unless prefixed Landscape.

- `packages/nodes/src/shared/distribution-run-tool.tsx`: drawing state, snap priority, screen projection, length/direction input, commit and cancel.
- `packages/nodes/src/shared/run-port-snap.ts` and `ports.ts`: projected socket ranking, registry discovery, spatial run-body queries.
- `packages/nodes/src/shared/connection-compatibility.ts` and `connection-feedback.tsx`: match/adapter/incompatible/unknown classification and halo UI.
- `packages/nodes/src/pipe-segment/tool.tsx`: pipe adapter, fitting previews, run split and atomic commit.
- `packages/nodes/src/pipe-segment/continuation.ts`, `selection.tsx`, `move-tool.tsx`, and `floorplan.ts`: continuation, move handles, connected run moves and plan affordances.
- `packages/nodes/src/shared/path-point-affordance.ts`: 2D vertex move and detach behavior.
- `packages/nodes/src/shared/auto-fitting.ts`, `pipe-run-translation-offset.ts`, `pipe-vertical-offset.ts`: fitting and connected offset planners.
- `packages/nodes/src/pipe-fitting/tool.tsx`, `ports.ts`, and `inline-insertion.ts`: collar alignment, port identity, inline accessory split.
- `packages/core/src/services/port-connectivity.ts`: proximity graph and follower resolution.
- `packages/core/src/schema/nodes/pipe-segment.ts` and `pipe-fitting.ts`: DWV schema constraints.
- `packages/editor/src/components/tools/registry/move-registry-node-tool.tsx`: generic 3D equipment move preview/commit integration.
- `packages/editor/src/components/editor-2d/floorplan-registry-move-overlay.tsx`: kind-owned and fallback 2D move paths.
- Landscape `src/irrigation/run.ts`, `readiness.ts`, `definition.ts`, `panel.ts`, and `path-controls.tsx`: current routing, validation, discovery eligibility, and numeric editing.
