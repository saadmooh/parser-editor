# A simpler visual irrigation workflow

Reviewed October 5, 2026, against the current working-tree implementation. This is a source-based product review and proposed interaction design, not a live editor acceptance test. The accompanying interactive concept uses illustrative garden geometry and values; it does not change the project scene.

Follow-up: [Editor piping investigation](irrigation-editor-piping-review.md) traces existing drawing, snapping, fitting, and movement primitives. It qualifies the movement recommendation below: generic 3D moves can already discover irrigation runs for connectivity follow, while complete endpoint preservation and 2D parity still need verification and integration.

## What the system does today

The physical plan is water supply → pipe → zone valve → distribution pipes → sprinklers or dripline. A controller tells valves when to operate through separate control assignments. A zone is a group intended to water together.

Current implementation supports six equipment types, 2D and 3D sprinkler placement, drawn spray reach, editable pipe/dripline vertices, nominal connection checks, summed zone demand, connected installed-demand review, weekly controller programs, and equipment/program CSV export.

The spray shape is user-entered geometric reach. It does not predict actual irrigation performance, account for obstacles, or compare reach against a chosen planting area. Supply pressure is recorded but pressure losses are not calculated. Supply review assumes all physically connected outlets operate together, including those behind closed valves; it does not use controller timing.

## Where users have to think too much

| Current interaction | User burden | Proposed interaction |
| --- | --- | --- |
| Irrigation lives inside Tools alongside camera, terrain, and other utilities | Finding the workflow requires exploration | A clearly named Watering workspace with a persistent plan |
| Design mixes all equipment lists and coordinate controls | Users must understand equipment before choosing a goal | Start with “What do you want to water?” and select an existing lawn or planting bed |
| Most equipment is created from shared X/Z values | Enter coordinates, create, then move; default objects can overlap | Click to place water supply, valve, and controller; click points to draw dripline |
| Sprinkler radius and arc use numeric inspector fields | Users must translate degrees/metres into geometry | Drag radius and arc handles; offer quarter, half, and full-circle visual presets; retain exact entry |
| Zones are repeated free-text values | Typing errors and renames can split membership | Choose one named zone from a shared picker; select objects on plan to assign membership |
| Connections require multi-select in Objects and then Network | Users must remember selection rules and interpret disabled buttons | Click a start socket, then a compatible destination; preview the route and explain incompatible targets |
| Pipe bends use a vertex dropdown and X/Elevation/Z fields | Shape editing feels like a coordinate table | Drag plan handles; click a segment to add a bend; elevation stays in advanced properties |
| All reach/pipe rendering uses the same blue | Zones are difficult to distinguish spatially | Stable zone colors with labels; dash/shape distinguishes pipe and dripline |
| Connection problems appear as paragraphs in several places | Reading does not tell the user where to act | Issue pins on affected objects, short actionable messages, and a Focus action |
| Controller editing is organized around numbered station slots | Users must translate station numbers into garden zones | Zone-labelled rows and a sequential daily timeline, with weekday buttons |
| Schedule primarily presents equipment and CSV | Equipment inventory and watering times are conflated | Separate Watering times from Parts list; CSV preview stays under export details |

## Recommended default: guided plan

Keep the existing garden drawing central. Show one active step in a compact sidebar and keep earlier steps revisitable. Do not force a completed linear wizard: imported and partially authored plans must remain editable.

1. **Choose areas.** Select an existing lawn/bed on plan. Name the zone, such as Front lawn or Flower bed. Let users draw a watering area if no suitable ground area exists. Associate zones with explicit area references; current zone strings do not provide this association.
2. **Place devices.** Offer Sprinklers and Dripline with visual examples. Reuse current sprinkler placement and reach geometry. Clicking the plan places equipment; clicking a sprinkler reveals reach and arc handles. Drawing a dripline shows length and emitter spacing. A future suggested layout is a preview that users accept, not an unexplained automatic commit.
3. **Connect water.** Place/select the water supply and record measured flow and pressure. Show the route supply → valve → outlets. Preview pipes before applying. Expose valid targets and specific mismatch reasons. Add “Connect zone” only after branches, fittings, and multi-outlet topology exist.
4. **Set times and review.** Show each zone on a daily timeline with named valve assignments. Editing days/start/duration updates the preview. Visually distinguish water pipes from controller assignments. Offer a single Review panel whose checks link to the scene.

An alternate, zone-first workspace is useful for experienced users: select a zone from a compact list, then use Devices, Connections, and Times for that zone. Use the same model and tools in both presentations; avoid maintaining separate authoring systems.

## Visual feedback and wording

- Use “Sprinkler,” “Pipe,” “Water supply,” and “Watering times” in primary UI. Keep technical terms in advanced properties and parts exports.
- Replace repeated “authored” wording with “Planned spray reach” and “Entered flow.” Keep one precise explanation beside the relevant check.
- Zone identity should be consistent across devices, pipes, area highlighting, schedule rows, and selections. Include names and shapes so color is not the only cue.
- A disconnected item gets a marker and “Not connected to water” with Focus. A size mismatch says which two sizes differ. An unavailable action explains the missing prerequisite next to the action.
- Label geometric feedback “Planned reach.” Do not label it “Well watered” or assign a coverage percentage until target-area comparison is implemented. Even geometric intersection is not a hydraulic result.
- Distinguish “Connection checks passed,” “Entered demand within available flow,” and “Pressure performance not evaluated.” Avoid one green “Ready” badge that merges these different claims.
- Keep precise values keyboard-accessible and read-only scene inspection intact. Store view-only overlays separately from authored scene values where practical.

## Structural work required

### Branches and network connectivity

The panel blocks new routes when a head inlet, valve outlet, or source outlet already has a connected run. A source can therefore connect to only one valve through these controls, and that valve can connect to only one outlet. Connecting two heads consumes each head's sole inlet; those heads cannot then be linked to a supply through the same controls. The interface mentions branch fittings, but the irrigation module has no branch authoring flow.

Add explicit tee/manifold connections and graph validation before promising automatic zone wiring. Routing must preserve port identity, nominal size, zone rules, and endpoint alignment. When connected equipment moves, update the attached route or clearly mark it as disconnected and offer repair. Current endpoint validation detects moved endpoints but does not automatically reroute them.

### Zone identity

Today zones are derived by grouping trimmed strings on heads and driplines. Valves and pipes repeat those strings. Introduce shared zone identity, display name, and optional target-area references with backward-compatible migration. Until that exists, a shared picker can reduce typing, but renaming must deliberately update every relevant member; do not simply rename a summary card.

### Calculation boundaries

Reuse the existing geometry, demand, assignment, and connection functions. A later target-area check can identify geometric gaps and overspray. Hydraulic checks require an additional model; current pressure entry cannot support a pressure heatmap. Sequential capacity review needs schedule-aware operation groups and must account for overlap across controllers.

## Build order

1. **Simplify existing UI.** Give irrigation a clear entry point; organize actions by task; use plain labels, shared zone selection, selected-object detail, compact zone summaries, and contextual disabled-action explanations. Keep export details collapsed.
2. **Make editing visual.** Add point placement for other equipment, polyline dripline drawing, sprinkler arc/radius handles, pipe bend handles, stable zone styling, and scene-linked issue markers. Add a zone-labelled controller timeline using the existing schedule function.
3. **Complete connections.** Implement branches/manifolds, editable route previews, and connection-preserving moves with explicit undo/redo. Then add Connect zone with a reviewable preview.
4. **Add assisted design.** Associate target areas, calculate geometric gaps/overspray, and preview suggested layouts. Add schedule-aware demand checks. Treat hydraulic analysis as a separately scoped capability.

## How to verify the redesigned flow

- A new user can select a bed, draw a dripline, and see its zone without entering coordinates.
- A user can place a sprinkler and change its spray direction/reach visually, while exact keyboard entry produces the same geometry.
- A complete fixture has one supply, two zone valves, several sprinklers and a dripline with valid branches; all intended outlets are reachable. Invalid size/zone/socket connections are explained before commit.
- Moving a connected object preserves its connection or visibly exposes the required repair; undo restores the whole action consistently.
- Schedule day, duration, seasonal adjustment, off states, station assignment, and midnight rollover agree with the existing controller schedule calculation.
- Read-only scenes expose understandable geometry and properties without edit handlers. Zone distinctions and issues remain usable without color and on a narrow screen.
- Parts export continues to include existing equipment and configured programs. No geometric or flow check claims pressure performance has passed.

## Implementation anchors

- `src/editor/workspace-panel.tsx`: current Tools placement of IrrigationPanel.
- `src/irrigation/panel.tsx`: coordinate creation, zone assignment, routing prerequisites, summaries, and export UI.
- `src/irrigation/tool.tsx` and `floorplan-tool.tsx`: existing point placement to reuse.
- `src/irrigation/geometry.ts`: current 2D/3D reach representation.
- `src/irrigation/path-controls.tsx`: numeric path editing to supplement with plan handles.
- `src/irrigation/run.ts` and `readiness.ts`: physical connection checks and installed-demand traversal.
- `src/irrigation/zones.ts`: string-derived membership and geometric reach union.
- `src/irrigation/controller-inspector.tsx` and `controller.ts`: existing station assignment and weekly timing.
