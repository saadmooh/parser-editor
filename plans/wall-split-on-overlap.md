# خطة: تقسيم الجدار عند الرسم عليه (بمفتاح O)

## المشكلة الحالية

عندما يرسم المستخدم جداراً يبدأ من نقطة تنتمي لجدار موجود وينتهي بنقطة أخرى على نفس الجدار، الكود الحالي يقوم بما يلي:
1. يقسم الجدار الأصلي عند نقطة البداية → جداران
2. يقسم الجدار عند نقطة النهاية → جدران إضافية
3. ينشئ جداراً **جديداً** بين النقطتين

النتيجة: جدران متراكبة بدلاً من تقسيم نظيف.

## السلوك المطلوب — مفتاح O كمحرّك (Toggle)

### كيفية العمل
- الضغط على `O` يحوّل بين وضعين: **مفعّل** و**معطّل**
- عند التفعيل: يظهر في لوحة المساعدة "Split-on-overlap: ON" بلون مميز
- عند التعطيل: يعود للنص الأصلي "Toggle split-on-overlap mode"
- الحالة تبقى محفوظة حتى يضغط `O` مرة أخرى أو يخرج من أداة الجدران

### السيناريو 1: المستخدم يفعّل وضع التقسيم (O) ثم يرسم على نفس الجدار
- تقسيم الجدار الأصلي إلى **3 أجزاء**:
  1. الجزء الأول (قبل نقطة البداية) → جدار جديد
  2. الجزء الأوسط (بين النقطتين) → **يحتفظ باسم الجدار الأصلي** وخصائصه
  3. الجزء الثالث (بعد نقطة النهاية) → جدار جديد
- **لا يُنشئ جداراً جديداً** (الجزء الأوسط هو نفسه "الجدار الجديد" المطلوب)
- مجال السماح: 0.35م (نفس `WALL_JOIN_SNAP_RADIUS`)

### السيناريو 2: المستخدم يرسم على نفس الجدار بدون تفعيل وضع التقسيم
- **لا يُنشئ جداراً جديداً** فوق الجدار القديم
- **لا يقسم الجدار** ولا يعدّل عليه
- **يعرض فقط الـ preview wall** كما هو معتاد
- عند النقر الثاني: **لا يحدث شيء** — سلسلة الرسم تستمر بشكل طبيعي

### السيناريو 3: النقاط على جدران مختلفة (أو لا يوجد جدار)
- السلوك الحالي كما هو — إنشاء جدار جديد عادي بغض النظر عن حالة O

## الملفات المطلوب تعديلها

### 1. `packages/editor/src/components/tools/wall/wall-drafting.ts`

**إضافة دالة مساعدة جديدة:**

```typescript
/**
 * Check if both points project onto the same existing wall segment.
 * Returns the wall and the two projected points, or null.
 */
function findWallContainingBothPoints(
  pointA: WallPlanPoint,
  pointB: WallPlanPoint,
  walls: WallNode[],
  ignoreWallIds?: string[],
): { wall: WallNode; projectedA: WallPlanPoint; projectedB: WallPlanPoint } | null
```

**إضافة دالة تقسيم مزدوج:**

```typescript
/**
 * Split a wall at two points, producing up to 3 segments.
 * The middle segment inherits the original wall's name and properties.
 * The outer segments get new names.
 */
function splitWallAtTwoPoints(
  wall: WallNode,
  splitPointA: WallPlanPoint,
  splitPointB: WallPlanPoint,
): [WallNode | null, WallNode, WallNode | null]
```

**تعديل `createWallOnCurrentLevel()`:**

بعد تحديد `resolvedStart` و `resolvedEnd`، قبل إنشاء الجدار الجديد:

```typescript
// Check if both points are on the same wall → split instead of create
if (isMagneticSnapActive()) {
  const sameWall = findWallContainingBothPoints(resolvedStart, resolvedEnd, workingWalls)
  if (sameWall) {
    return splitExistingWallAtTwoPoints(
      sameWall.wall,
      sameWall.projectedA,
      sameWall.projectedB,
      nodes,
      createNodes,
      updateNodes,
      deleteNode,
    )
  }
}
```

### 2. `packages/nodes/src/wall/tool.tsx`

**تعديل `onGridClick` لإظهار الـ preview وتمرير حالة O:**

يجب تتبع مفتاح O في `keyStates` (السطر ~300+) وإضافته كمعامل لـ `createWallOnCurrentLevel`.

**إضافة تتبع مفتاح O:**

في `onKeyDown`، أضف:
```typescript
if (event.code === 'KeyO') {
  keyStates.current.set('KeyO', true)
}
```

في `onKeyUp`، أضف:
```typescript
if (event.code === 'KeyO') {
  keyStates.current.set('KeyO', false)
}
```

**تعديل استدعاء `createWallOnCurrentLevel`:**

```typescript
const createdWall = createWallOnCurrentLevel(
  [startingPoint.current.x, startingPoint.current.z],
  snappedEnd,
  { splitKeyHeld: keyStates.current.get('KeyO') === true },
)
```

**الكود الحالي (بعد الإنشاء):**
```typescript
if (!createdWall) return  // ← هنا يختفي الـ preview

// ... بعد الإنشاء الناجح
if (wallPreviewRef.current) {
  wallPreviewRef.current.visible = false  // ← هنا أيضاً
}
```

**الكود المعدل:**
```typescript
const createdWall = createWallOnCurrentLevel(
  [startingPoint.current.x, startingPoint.current.z],
  snappedEnd,
  { splitKeyHeld: keyStates.current.get('KeyS') === true },
)

// Keep the preview visible even when not creating (no O key or split)
if (!createdWall) {
  // Don't return early - keep preview visible for chain continuation
  refreshAlignmentCandidates()
  useAlignmentGuides.getState().clear()
  useWallSnapIndicator.getState().clear()

  if (useEditor.getState().getContinuation('wall') === 'single') {
    stopDrafting()
    return
  }

  // Reset for next segment
  const nextStart = snappedEnd
  useSegmentDraftChain.getState().setChainStart('wall', [nextStart[0], nextStart[1]])
  startingPoint.current.set(nextStart[0], event.localPosition[1], nextStart[1])
  endingPoint.current.copy(startingPoint.current)
  cursorRef.current?.position.copy(startingPoint.current)
  buildingState.current = 1
  setAxisGuide({ origin: nextStart, y: event.localPosition[1], angleLabel: null })

  // Update preview to show the next segment
  updateWallPreview(
    wallPreviewRef.current,
    startingPoint.current,
    endingPoint.current,
    previewHeightRef.current,
    previewThicknessRef.current,
  )
  return
}

// Existing successful creation flow continues...
```

### 3. `packages/editor/src/components/tools/wall/wall-drafting.test.ts`

**إضافة اختبارات جديدة:**

```typescript
test('O + LMB: drawing from one point on a wall to another point on the same wall splits it into 3', () => {
  // Existing wall from [0,0] to [4,0]
  // User holds O, draws from [1,0] to [3,0]
  // Result: 3 walls:
  //   [0,0]->[1,0] (new)
  //   [1,0]->[3,0] (keeps original name "wall_a")
  //   [3,0]->[4,0] (new)
})

test('LMB without O: drawing on same wall does NOT create or split — returns null', () => {
  // Existing wall from [0,0] to [4,0]
  // User does NOT hold O, draws from [1,0] to [3,0]
  // Result: no new wall created, no split, function returns null
  // Preview continues to show as usual
})

test('O + LMB: drawing from one point to the same point on a wall is rejected (too short)', () => {
  // Both points project to nearly the same spot → segment too short
})

test('drawing from wall A to wall B creates a new wall (not a split) regardless of O', () => {
  // Points on different walls → normal creation behavior
  // O key has no effect when points are on different walls
})

test('tolerance: points slightly off the wall still trigger the split with O held', () => {
  // Points are 0.2m away from the wall line but within snap radius
  // O key is held → split happens
})

test('preview remains visible when LMB without O on same wall', () => {
  // After click, preview wall stays visible
  // No wall is created or split
  // User can continue drawing chain from the click point
})
```

## تفاصيل التنفيذ

### الدالة `findWallContainingBothPoints`

```typescript
function findWallContainingBothPoints(
  pointA: WallPlanPoint,
  pointB: WallPlanPoint,
  walls: WallNode[],
  ignoreWallIds?: string[],
): { wall: WallNode; projectedA: WallPlanPoint; projectedB: WallPlanPoint } | null {
  const ignore = new Set(ignoreWallIds ?? [])
  
  for (const wall of walls) {
    if (ignore.has(wall.id)) continue
    if (isCurvedWall(wall)) continue // curved walls handled separately
    
    const projectedA = projectPointOntoWall(pointA, wall)
    const projectedB = projectPointOntoWall(pointB, wall)
    
    if (!projectedA || !projectedB) continue
    
    // Both points must be on this wall (within tolerance)
    const distA = distanceSquared(pointA, projectedA)
    const distB = distanceSquared(pointB, projectedB)
    const toleranceSq = WALL_JOIN_SNAP_RADIUS * WALL_JOIN_SNAP_RADIUS
    
    if (distA <= toleranceSq && distB <= toleranceSq) {
      return { wall, projectedA, projectedB }
    }
  }
  
  return null
}
```

### الدالة `splitWallAtTwoPoints`

```typescript
function splitWallAtTwoPoints(
  wall: WallNode,
  splitPointA: WallPlanPoint,
  splitPointB: WallPlanPoint,
): [WallNode | null, WallNode, WallNode | null] {
  // Ensure order: A is closer to wall.start
  const distToA = Math.hypot(splitPointA[0] - wall.start[0], splitPointA[1] - wall.start[1])
  const distToB = Math.hypot(splitPointB[0] - wall.start[0], splitPointB[1] - wall.start[1])
  
  const [early, late] = distToA <= distToB 
    ? [splitPointA, splitPointB] 
    : [splitPointB, splitPointA]
  
  const { id: _id, parentId: _parentId, children, name, ...rest } = wall
  
  // First segment: wall.start → early
  const first = wallLength(wall.start, early) >= WALL_MIN_LENGTH
    ? WallSchema.parse({ ...rest, name: `${name} (1)`, start: wall.start, end: early, children: [] })
    : null
  
  // Middle segment: early → late (keeps original name)
  const middle = WallSchema.parse({ ...rest, name, start: early, end: late, children: [] })
  
  // Third segment: late → wall.end
  const third = wallLength(late, wall.end) >= WALL_MIN_LENGTH
    ? WallSchema.parse({ ...rest, name: `${name} (2)`, start: late, end: wall.end, children: [] })
    : null
  
  return [first, middle, third]
}
```

### التعديل الرئيسي في `createWallOnCurrentLevel`

في السطر ~417، بعد فحص `isMagneticSnapActive()`، نضيف فحصاً جديداً:

```typescript
// NEW: If both endpoints land on the same wall and O key is held, split that wall.
// If O is NOT held, return null to skip creation (no overlapping wall, no split).
const sameWallResult = findWallContainingBothPoints(
  resolvedStart, resolvedEnd, workingWalls,
)
if (sameWallResult) {
  // O key required for split-on-overlap activation
  if (!isSplitKeyHeld()) {
    // No O key → no creation, no split, just return null
    // (preview stays visible, user can continue drawing chain)
    return null
  }
  
  const { wall: wallToSplit, projectedA, projectedB } = sameWallResult
  
  // Don't split if the two points are essentially the same
  if (pointsEqual(projectedA, projectedB)) return null
  
  const [first, middle, third] = splitWallAtTwoPoints(wallToSplit, projectedA, projectedB)
  
  // Handle attachment migration
  // ... (reuse existing buildAttachmentMigrationPlan logic)
  
  // Create the new segments, delete the original
  const newNodes = [first, middle, third].filter(Boolean)
  createNodes(newNodes.map(node => ({
    node: node!,
    parentId: wallToSplit.parentId as AnyNodeId | undefined,
  })))
  deleteNode(wallToSplit.id as AnyNodeId)
  
  return middle // Return the middle segment
}
```

**إضافة دالة مساعدة `isSplitKeyHeld()`:**

```typescript
/**
 * Check if the O key is currently held down.
 * Used to gate the split-on-overlap feature.
 */
function isSplitKeyHeld(): boolean {
  return keyStates.current.get('KeyO') === true
}
```

**ملاحظة:** `keyStates` هو الـ `Map` الذي يتتبع حالة المفاتيح في `tool.tsx`. يجب تمريره أو الوصول إليه من `createWallOnCurrentLevel`. البديل: تمرير boolean `splitKeyHeld` كمعامل إضافي لدالة `createWallOnCurrentLevel`.

## ترتيب التنفيذ

1. **الخطوة 1**: تتبع حالة مفتاح O في `tool.tsx` (إضافة `KeyO` إلى `keyStates`)
2. **الخطوة 2**: تمرير حالة O إلى `createWallOnCurrentLevel` (معامل `splitKeyHeld?: boolean`)
3. **الخطوة 3**: تعديل `createWallOnCurrentLevel` لفحص `splitKeyHeld` قبل التقسيم
4. **الخطوة 4**: تعديل `onGridClick` في `tool.tsx` لتمرير حالة O وعرض الـ preview عند عدم الإنشاء
5. **الخطوة 5**: إضافة اختبارات جديدة في `wall-drafting.test.ts`
6. **الخطوة 6**: تشغيل الاختبارات والتحقق

## الميزة الثانية: إظهار الـ Preview دائماً أثناء الرسم

### المشكلة
الآن، الـ preview (الجدار الأزرق الشفاف) يختفي بعد النقر الثاني إذا لم يتم إنشاء جدار جديد. المستخدم يريد أن يظهر الـ preview دائماً أثناء الرسم، حتى لو كنا سنقوم بتقسيم بدلاً من إنشاء.

### السلوك المطلوب
- عند LMB بدون O على نفس الجدار: **لا إنشاء، لا تقسيم** — فقط عرض الـ preview واستمرار سلسلة الرسم
- عند O + LMB على نفس الجدار: **تقسيم** — عرض الـ preview ثم تنفيذ التقسيم
- في كلتا الحالتين: الـ preview يظهر دائماً

### الملف المطلوب تعديله
`packages/nodes/src/wall/tool.tsx`

### التعديلات المطلوبة

1. تتبع مفتاح O في `keyStates` (onKeyDown/onKeyUp)
2. تمرير `splitKeyHeld` إلى `createWallOnCurrentLevel`
3. عند `!createdWall`: عدم الإرجاع المبكر، استمرار عرض الـ preview وسلسلة الرسم

**الملاحظات:**
- الـ preview يظهر دائماً أثناء الرسم (`buildingState.current === 1`)
- عند LMB بدون O: لا يحدث شيء، الـ preview يبقى ظاهراً والمستخدم يكمل من النقطة التالية
- عند O + LMB: التقسيم يحدث مع بقاء الـ preview للمرور التالي

## ملاحظات مهمة

- **مفتاح O**: يحوّل بين وضع التقسيم المفعّل والمعطّل. الحالة تظهر في لوحة المساعدة
- **لوحة المساعدة**: تظهر "Split-on-overlap: ON" عندما يكون التقسيم مفعّلاً
- **مجال السماح**: نستخدم `WALL_JOIN_SNAP_RADIUS` (0.35م) كما في الكود الحالي
- **الجدران المنحنية**: لا ندعم التقسيم للجدران المنحنية حالياً
- **الاسم**: الجزء الأوسط يحتفظ بالاسم الأصلي، الأجزاء الجانبية تحصل على اسم مع رقم
- **الـ attachments**: يجب نقل الأبواب والنوافذ إلى القطعة الصحيحة
- **التحقق من الطول**: الأجزاء الجانبية يجب أن تكون أطول من `WALL_MIN_LENGTH` وإلا تُتجاهل
