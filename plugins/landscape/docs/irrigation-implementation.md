# Visual irrigation implementation

Implemented in the local Landscape plugin and sibling editor checkout on October 5, 2026.

## User workflow

Open **Landscape → Watering**. Areas, Devices, Water, and Times remain independently accessible for existing plans.

- Areas: select ground areas, create a stable zone, associate its areas, or rename the zone and all its members. Legacy string zones continue to work. Assigned areas have a zone-colored plan outline.
- Devices: click to place sprinklers, supplies, valves, and controllers; click points to draw a dripline. Use its Finish button or Enter. Sprinkler reach, direction, and spray arc have plan/3D handles and exact inspector controls, including arc presets.
- Water: start a pipe at a free socket or existing pipe body. The tool shares the editor's port-ranking and direction/length helpers. Branching splits the trunk and inserts a tee or supply manifold. Routes insert elbows and nominal size changes insert reducers. Pipe ends retain explicit socket references. Midpoint handles add bends; Alt-dragging an end detaches reciprocal run references. Pipe issues appear on the plan and have Focus actions in the panel.
- Preview connections: choose a supply and zone valve, then preview the full proposed network in 2D. Apply performs one atomic scene change. A repeated request does not duplicate an already connected network. Changing the scene, zone, supply, valve, depth, or workflow step cancels the pending preview.
- Times: select zone valves in controller rows, toggle weekdays, enter start/duration/seasonal adjustment, and review the sequential daily timeline. The existing controller calculation handles off states and midnight rollover. Export includes fittings, equipment, and configured programs.

Dragging connected equipment keeps the far socket fixed and updates attached pipes. Dripline inlet edits update attached pipes too. Drag previews use transient overrides; the final edit commits once. Cancel/unmount clears overrides.

## Shared editor changes

The sibling `/Users/sudhir/Desktop/work/editor` checkout contains changes required by this plugin:

- `packages/nodes/src/shared/distribution-public.ts` and the `@pascal-app/nodes/distribution` public export expose the existing drawing hook, cursor, direction/length helpers, and socket/body acquisition.
- `DistributionRunToolConfig.toolName` accepts registered plugin tools.
- `NodeDefinition.connectedMove` lets a kind resolve followers from explicit connections. Core snapshots affected paths/positions at drag start and delegates preview updates to this pure hook. Built-in duct/pipe behavior is retained when the hook is absent.
- `endpoint-handle.screenSized` lets irrigation request a constant pixel drag target. Existing kinds retain their previous sizing policy.

Use `bun run dev:link` with the modified editor checkout, then build its nodes package and start the editor. The development link shares core, editor, viewer, nodes, React/React DOM, R3F, and Drei singletons with the host.

**Release dependency:** the new distribution export, connected-move hook, and screen-sized handles must ship in coordinated Pascal package releases before publishing this plugin. The cached published nodes dependency in the lockfile does not contain the new distribution export. A fresh published-package-only install is therefore not a supported runtime for this development change; the local editor link is required. No packages were published by this task.

## Validation

Domain tests cover full multi-zone topology, reducers, fitting sockets, installed demand, repeated connection requests, stable-zone renames, drag edits, reciprocal detach, and composite preview rendering. An actual scene/history test verifies that planning does not mutate the scene and applying the whole network is one undo/redo step. Shared editor tests cover custom follower snapshots and existing connectivity/plan affordances.

The disposable browser scene verified the guided entry point, full route preview, Apply, demand changing from 0 to 8.47 L/min for two sprinklers and a dripline, Undo/Redo, repeated connection requests, sprinkler radius dragging, and pipe-body branching. Finish was checked to leave node/pipe counts unchanged after drawing.

The final Landscape suite passes **301 tests** across 78 files, with no failures. Landscape and editor type checks pass. The focused shared editor checks pass 10 connectivity tests and 20 floorplan affordance tests.

Additional browser checks verified that the 3D pipe and dripline controls mount, two physical clicks produce one dripline segment, Finish commits exactly one dripline, Undo removes it, and click placement creates one supply. Adding a second schedule row shows 07:30–07:50 followed by 07:50–08:00. Read-only mode disables placement and schedule edits. The host Fragment/ref warning and hydration mismatch were traced to React aliases overriding Next 16.3’s App Router runtime. Removing the React override in the editor Turbopack configuration and the disposable Webpack host lets Next choose its bundled React. A fresh browser load and Landscape view checks report no console errors.

## Boundaries

- Planned spray reach remains geometric. Area association does not claim coverage, pressure loss, obstacle avoidance, or terrain conformity. Suggested sprinkler layouts and hydraulic analysis remain separate work.
- Routes are schematic and may need to go deeper than entered burial depth to leave room for downward-facing sockets and reducers. Branches retain existing trunk depth rather than subtracting depth again.
- Visual route edits and equipment moves preserve socket approaches using polyline bends. They do not synthesize new corner fittings after every drag; review final fabrication geometry.
- Automatic connection previews are shown in 2D. Manual pipe drawing has 2D and 3D tools. Dense/cramped geometry can be rejected with an explanation instead of producing an invalid tee.
- Exact legacy coordinate controls remain available under Advanced. They can deliberately author incompatible geometry, which the connection checks expose.
