# Phase 1: Dynamic Dimension Input

## Goal

Allow users to type exact wall length and angle to place consecutive points, with walls created as previews until final confirmation.

## Problem

Currently, wall length is determined by mouse position only. Architects need precision — typing length and angle directly during drafting to place points at exact coordinates.

## User Flow

```
Click LMB (Point 1 placed)
  → Type length (e.g. 3.5m) + angle (e.g. 45°)
  → Press LMB → Point 2 placed at (length, angle) from Point 1
  → Type length + angle
  → Press LMB → Point 3 placed at (length, angle) from Point 2
  → ... (repeat)
  → Double-click LMB → finish preview, create all walls
```

## User Stories

1. As an architect, I want to type a wall length and angle, then press LMB, so the next point is placed exactly at those dimensions.
2. As an architect, I want to continue placing consecutive points by entering length and angle each time.
3. As an architect, I want to finish by double-clicking LMB, which creates all previewed walls.

## State Machine

```
IDLE → first LMB click → POINT_PLACED (Point 1)
  ↓
POINT_PLACED → type length + angle → DIMENSION_LOCKED (preview line visible)
  ↓
DIMENSION_LOCKED → LMB click → POINT_PLACED (new point placed using locked dimensions)
  ↓
DIMENSION_LOCKED → LMB double-click → WALLS_CREATED (finish, create all walls)
  ↓
Any state → Esc → cancel all, return to IDLE
```

## Implementation Details

### 1. Dimension Input Component

**New file:** `packages/editor/src/components/tools/shared/dimension-input.tsx`

```typescript
interface DimensionInputState {
  active: boolean
  fieldType: 'length' | 'angle'
  lengthValue: string
  angleValue: string
  lockedLength: number | null
  lockedAngle: number | null
}
```

**Key behaviors:**
- Auto-focus length field after Point 1 is placed
- `Tab` switches between length and angle fields
- `LMB click` confirms values and places next point (if dimension values are entered)
- `Double-click LMB` finishes preview and creates all walls
- `Esc` cancels entire drafting session

### 2. Unit Support

**File:** `packages/core/src/lib/units.ts` (extend existing)

- `3.5m` → 3.5 meters
- `12ft` → 12 feet
- `120cm` → 120 centimeters
- `36in` → 36 inches
- `3500mm` → 3500 millimeters (no suffix = project units)

### 3. Wall Drafting Integration

**File:** `packages/editor/src/components/tools/wall/wall-drafting.ts`

```
IDLE
  → LMB click → place Point 1, activate dimension input
  → User types length + angle, LMB click → place Point 2 at locked dimensions
  → User types length + angle, LMB click → place Point 3 at locked dimensions
  → ...
  → Double-click LMB → create all walls from placed points, return to IDLE
  → Esc → discard all points, return to IDLE
```

### 4. Preview Rendering

**New file:** `packages/editor/src/components/editor/dimension-preview.tsx`

- Show preview lines between placed points (not yet created walls)
- Show dimension label on each preview line (length + angle)
- Preview lines are visual-only until final confirmation

### 5. Keyboard Shortcuts

**File:** `packages/editor/src/hooks/use-keyboard.ts`

During wall drafting:
- `D` → focus length field
- `A` → focus angle field
- `Tab` → cycle between fields
- `Esc` → cancel entire session

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `packages/editor/src/components/tools/shared/dimension-input.tsx` | Create | Shared dimension input UI (used by both 3D and 2D) |
| `packages/editor/src/components/tools/wall/wall-drafting.ts` | Modify | Multi-point state machine + dimension lock + double-click |
| `packages/nodes/src/wall/tool.tsx` | Modify | 3D: integrate dimension input + multi-point click flow |
| `packages/nodes/src/wall/floorplan.ts` | Modify | 2D: add ghost wall SVG rendering during draft |
| `packages/nodes/src/wall/floorplan-affordances.ts` | Modify | 2D: add pointer-based dimension input + double-click |
| `packages/editor/src/hooks/use-keyboard.ts` | Modify | Add drafting shortcuts |
| `packages/core/src/lib/units.ts` | Modify | Add unit suffix parsing |

## Testing

1. **Unit tests** for unit parsing: `3.5m` → 3.5, `12ft` → 3.6576, etc.
2. **Unit tests** for dimension lock state machine transitions
3. **Integration test**: Click point 1 → type length+angle → LMB click → verify point 2 is at correct position
4. **Manual test**: Place point 1, type `3.5m` and `45°`, click LMB, verify point 2 at exact distance and angle

## 2D ↔ 3D Parity (Mandatory)

Per architecture rule `wiki/architecture/tools.md §2D ↔ 3D behavioral parity`:
the *felt behavior* must match in both views. The *mechanism* differs (Three.js
meshes in 3D vs SVG overlays in 2D) but the user-facing experience is identical.

### Shared layer (view-agnostic)

**File:** `packages/editor/src/components/tools/wall/wall-drafting.ts`

The dimension input state machine, point collection, length/angle parsing, and
double-click detection live here. Both 3D and 2D read from and write to this
shared state — no duplication.

```typescript
interface WallDraftingState {
  points: Point[]                          // all confirmed points
  currentPreviewPoint: Point | null        // calculated from length+angle
  ghostWalls: WallSegment[]                // preview segments between confirmed points
  dimensionInput: DimensionInputState      // length/angle values
  doubleClickTimestamp: number             // for double-click detection
}
```

Both views consume:
- `addPoint(point)` — confirm a point
- `setPreview(length, angle)` — update ghost wall from last point
- `finish()` — return all points to create walls
- `cancel()` — discard everything

### 3D view implementation

**File:** `packages/nodes/src/wall/tool.tsx`

The 3D wall tool already handles `grid:click` / `grid:move` events. Modifications:

1. **Click handler** (`onGridClick`):
   - First click → place Point 1, enter dimension input mode
   - Subsequent clicks → use locked length+angle from dimension input to calculate
     next point position (ignore mouse position for placement)
   - Double-click (400ms threshold) → call `finish()`, create all walls

2. **Preview rendering** (existing `<mesh>` + `Html` labels):
   - Ghost wall: semi-transparent `<mesh>` from last confirmed point to
     `currentPreviewPoint`
   - Confirmed segments: same ghost wall style for all segments in `ghostWalls[]`
   - Length label: existing `DraftMeasurementLabel` component via `Html`
   - Angle arc: existing `DraftAngleArc` component

3. **Dimension input UI** (new React component):
   - Rendered via `Html` (from `@react-three/drei`) at cursor position
   - Two input fields: length + angle
   - Auto-focused after each point placement
   - Same `Html`-based floating HUD pattern already used for measurement labels

4. **Mouse cursor follow**:
   - When dimension input is active, cursor sphere (`CursorSphere`) follows the
     calculated `currentPreviewPoint`, not the raw mouse
   - When no values typed, cursor follows mouse freely (existing behavior)

### 2D floorplan implementation

**File:** `packages/nodes/src/wall/floorplan.ts` + new floorplan drafting overlay

The 2D floorplan is SVG-based. Modifications:

1. **SVG overlay for draft points** (new or extend existing floorplan draft layer):
   - Ghost wall: SVG `<line>` from last confirmed point to `currentPreviewPoint`
   - Confirmed segments: SVG `<line>` elements for all `ghostWalls[]`
   - Length label: SVG `<text>` element along the line
   - Angle arc: SVG `<path>` arc element

2. **Dimension input UI** (HTML overlay on SVG):
   - Floating HTML input fields positioned at the 2D cursor coordinates
   - Same component as 3D but without `Html` wrapper (plain DOM positioning)
   - Auto-focused after each point placement

3. **Pointer event handling**:
   - `pointerdown` on `[data-floorplan-scene]` → place point / confirm
   - Gate with `target.closest('[data-floorplan-scene]')` to avoid 3D canvas events
   - Same double-click detection (400ms threshold)
   - `useLiveNodeOverrides` for preview wall geometry during drafting

4. **Shared chain start**:
   - Both 3D and 2D publish resolved chain starts via
     `useSegmentDraftChain.getState().setChainStart('wall', point)` so the other
     view stays in sync if the user switches views mid-draft

### Parity checklist

| Behavior | 3D | 2D |
|----------|----|----|
| First click places Point 1 | `grid:click` | `pointerdown` on floorplan |
| Dimension input auto-focuses | `Html` overlay | DOM overlay |
| Tab switches fields | keyboard handler | keyboard handler |
| Ghost wall preview | Three.js `<mesh>` | SVG `<line>` |
| Length label | `Html` component | SVG `<text>` |
| Angle arc | `DraftAngleArc` | SVG `<path>` |
| LMB confirms point | `grid:click` | `pointerdown` |
| Double-click finishes | 400ms timestamp check | 400ms timestamp check |
| Esc cancels | `tool:cancel` event | `Escape` key handler |
| Cursor follows preview | `CursorSphere` position | SVG cursor position |
| Chain sync | `useSegmentDraftChain` | `useSegmentDraftChain` |

## Acceptance Criteria

- [ ] First LMB click places Point 1
- [ ] Dimension input (length + angle) becomes available after Point 1
- [ ] LMB click places next point at typed length and angle from previous point (ignores mouse position)
- [ ] Preview lines shown between all placed points
- [ ] Double-click LMB finishes preview and creates all walls
- [ ] Esc cancels entire session
- [ ] Tab switches between length and angle fields
- [ ] **3D view**: ghost wall mesh + floating Html dimension input at cursor
- [ ] **3D view**: cursor sphere follows calculated preview point when values entered
- [ ] **2D view**: SVG ghost wall line + HTML dimension input overlay
- [ ] **2D view**: pointer events gated on `[data-floorplan-scene]` target
- [ ] **Both views**: identical user flow — click → type → click → ... → double-click finish
- [ ] **Both views**: chain start synced via `useSegmentDraftChain`
