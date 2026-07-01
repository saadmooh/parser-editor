# خطة: تقسيم الجدار عند الرسم عليه بدلاً من إنشاء جدار جديد

## المشكلة الحالية

عندما يرسم المستخدم جداراً يبدأ من نقطة تنتمي لجدار موجود وينتهي بنقطة أخرى على نفس الجدار، الكود الحالي يقوم بما يلي:
1. يقسم الجدار الأصلي عند نقطة البداية → جداران
2. يقسم الجدار عند نقطة النهاية → جدران إضافية
3. ينشئ جداراً **جديداً** بين النقطتين

النتيجة: جدران متراكبة بدلاً من تقسيم نظيف.

## السلوك المطلوب

عندما تكون كلتا النقطتين (البداية والنهاية) على **نفس الجدار** (ضمن مجال سماح):
- تقسيم الجدار الأصلي إلى **3 أجزاء**:
  1. الجزء الأول (قبل نقطة البداية) → جدار جديد
  2. الجزء الأوسط (بين النقطتين) → **يحتفظ باسم الجدار الأصلي** وخصائصه
  3. الجزء الثالث (بعد نقطة النهاية) → جدار جديد
- **لا يُنشئ جداراً جديداً** (الجزء الأوسط هو نفسه "الجدار الجديد" المطلوب)
- مجال السماح: 0.35م (نفس `WALL_JOIN_SNAP_RADIUS`)

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

**تعديل `onGridClick` لإظهار الـ preview دائماً:**

الكود الحالي يختفي الـ preview بعد النقر الثاني. يجب تعديله لإظهار الـ preview دائماً أثناء الرسم، حتى عند التقسيم.

### 3. `packages/editor/src/components/tools/wall/wall-drafting.test.ts`

**إضافة اختبارات جديدة:**

```typescript
test('drawing from one point on a wall to another point on the same wall splits it into 3', () => {
  // Existing wall from [0,0] to [4,0]
  // Draw from [1,0] to [3,0]
  // Result: 3 walls:
  //   [0,0]->[1,0] (new)
  //   [1,0]->[3,0] (keeps original name "wall_a")
  //   [3,0]->[4,0] (new)
})

test('drawing from one point to the same point on a wall is rejected (too short)', () => {
  // Both points project to nearly the same spot → segment too short
})

test('drawing from wall A to wall B creates a new wall (not a split)', () => {
  // Points on different walls → normal creation behavior
})

test('tolerance: points slightly off the wall still trigger the split', () => {
  // Points are 0.2m away from the wall line but within snap radius
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
// NEW: If both endpoints land on the same wall, split that wall
// instead of creating a new overlapping wall.
const sameWallResult = findWallContainingBothPoints(
  resolvedStart, resolvedEnd, workingWalls,
)
if (sameWallResult) {
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

## ترتيب التنفيذ

1. **الخطوة 1**: إضافة دالة `findWallContainingBothPoints` في `wall-drafting.ts`
2. **الخطوة 2**: إضافة دالة `splitWallAtTwoPoints` في `wall-drafting.ts`
3. **الخطوة 3**: تعديل `createWallOnCurrentLevel` لاستخدام الدالتين الجديدين
4. **الخطوة 4**: إضافة معالجة الـ attachments (أبواب/نوافذ) على الجدار المقسم
5. **الخطوة 5**: تعديل `tool.tsx` لإظهار الـ preview دائماً أثناء الرسم
6. **الخطوة 6**: إضافة اختبارات جديدة في `wall-drafting.test.ts`
7. **الخطوة 7**: تشغيل الاختبارات والتحقق

## الميزة الثانية: إظهار الـ Preview دائماً أثناء الرسم

### المشكلة
الآن، الـ preview (الجدار الأزرق الشفاف) يختفي بعد النقر الثاني إذا لم يتم إنشاء جدار جديد. المستخدم يريد أن يظهر الـ preview دائماً أثناء الرسم، حتى لو كنا سنقوم بتقسيم بدلاً من إنشاء.

### الملف المطلوب تعديله
`packages/nodes/src/wall/tool.tsx`

### التعديل المطلوب

في دالة `onGridClick` (السطر ~712-779)، بعد استدعاء `createWallOnCurrentLevel`:

**الكود الحالي:**
```typescript
const createdWall = createWallOnCurrentLevel(
  [startingPoint.current.x, startingPoint.current.z],
  snappedEnd,
)
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
)

// Keep the preview visible even when splitting (no new wall created)
// The preview shows where the split will happen
if (!createdWall) {
  // Don't return early - keep preview visible for split feedback
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

**الملاحظات:**
- الـ preview يظهر دائماً أثناء الرسم (`buildingState.current === 1`)
- عند التقسيم (لا إنشاء جديد)، الـ preview يظهر إلى أن ينتقل المستخدم للنقطة التالية
- هذا يعطي للمستخدم تغذية بصرية واضحة عما سيحدث

## ملاحظات مهمة

- **مجال السماح**: نستخدم `WALL_JOIN_SNAP_RADIUS` (0.35م) كما في الكود الحالي للتناغم
- **الجدران المنحنية**: لا ندعم التقسيم المزدوج للجدران المنحنية حالياً (نحتفظ بالسلوك الحالي)
- **الاسم**: الجزء الأوسط يحتفظ بالاسم الأصلي، الأجزاء الجانبية تحصل على اسم مع رقم
- **الـ attachments**: يجب نقل الأبواب والنوافذ إلى القطعة الصحيحة بناءً على موقعها الأصلي
- **التحقق من الطول**: الأجزاء الجانبية يجب أن تكون أطول من `WALL_MIN_LENGTH` وإلا تُتجاهل
- **الـ Preview**: يظهر دائماً أثناء الرسم، حتى عند التقسيم بدلاً من الإنشاء
