import { beforeEach, describe, expect, test } from 'bun:test'
import {
  type AnyNode,
  type AnyNodeId,
  useScene,
  type WallNode,
  WallNode as WallSchema,
} from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { createWallOnCurrentLevel, snapWallDraftPointDetailed } from './wall-drafting'
import type { WallPlanPoint } from './wall-snap-geometry'

const LEVEL_ID = 'level_test' as AnyNodeId

function makeWall(start: WallPlanPoint, end: WallPlanPoint, id: string): WallNode {
  return {
    ...WallSchema.parse({ start, end, name: id }),
    id: id as WallNode['id'],
    parentId: LEVEL_ID,
  }
}

function seedLevel(walls: WallNode[]) {
  useScene.setState({
    nodes: Object.fromEntries([
      [
        LEVEL_ID,
        {
          id: LEVEL_ID,
          type: 'level',
          object: 'node',
          parentId: null,
          visible: true,
          metadata: {},
          children: walls.map((wall) => wall.id),
          level: 0,
        } as AnyNode,
      ],
      ...walls.map((wall) => [wall.id, wall] as const),
    ]),
    rootNodeIds: [LEVEL_ID],
    dirtyNodes: new Set(),
    collections: {},
  } as never)
}

function levelWalls(): WallNode[] {
  return Object.values(useScene.getState().nodes).filter(
    (node): node is WallNode => node?.type === 'wall',
  )
}

describe('createWallOnCurrentLevel', () => {
   beforeEach(() => {
     useViewer.setState({
       selection: {
         buildingId: 'building_test',
         levelId: LEVEL_ID,
         zoneId: null,
         selectedIds: [],
       },
     } as never)
     seedLevel([makeWall([0, 0], [4, 0], 'wall_a')])
   })

   test('endpoint near an existing corner attaches to the corner instead of splitting', () => {
     const created = createWallOnCurrentLevel([2, 2], [3.99, 0])

     expect(created?.end).toEqual([4, 0])
     const hostWall = useScene.getState().nodes['wall_a' as AnyNodeId] as WallNode | undefined
     expect(hostWall?.start).toEqual([0, 0])
     expect(hostWall?.end).toEqual([4, 0])
     expect(levelWalls()).toHaveLength(2)
   })

   test('endpoint near the host start corner snaps there without splitting', () => {
     const created = createWallOnCurrentLevel([2, 2], [0.015, 0])

     expect(created?.end).toEqual([0, 0])
     expect(useScene.getState().nodes['wall_a' as AnyNodeId]).toBeDefined()
     expect(levelWalls()).toHaveLength(2)
   })

   test('genuine mid-wall endpoint still splits the host (T junction)', () => {
     const created = createWallOnCurrentLevel([2, 2], [2, 0])

     expect(created?.end).toEqual([2, 0])
     expect(useScene.getState().nodes['wall_a' as AnyNodeId]).toBeUndefined()
     const walls = levelWalls()
     expect(walls).toHaveLength(3)
     expect(
       walls.some((wall) => wall.start[0] === 0 && wall.end[0] === 2 && wall.end[1] === 0),
     ).toBe(true)
     expect(
       walls.some((wall) => wall.start[0] === 2 && wall.start[1] === 0 && wall.end[0] === 4),
     ).toBe(true)
   })

   test('exact duplicate segment is rejected', () => {
     expect(createWallOnCurrentLevel([0, 0], [4, 0])).toBeNull()
     expect(levelWalls()).toHaveLength(1)
   })
   
   // NEW TESTS FOR WALL SPLIT ON OVERLAP
   test('drawing from one point on a wall to another point on the same wall splits it into 3', () => {
     // Existing wall from [0,0] to [4,0]
     // Draw from [1,0] to [3,0]
     // Result: 3 walls:
     //   [0,0]->[1,0] (new)
     //   [1,0]->[3,0] (keeps original name "wall_a")
     //   [3,0]->[4,0] (new)
     const created = createWallOnCurrentLevel([1, 0], [3, 0])
     
     // Should return the middle segment
     expect(created).not.toBeNull()
     expect(created?.start).toEqual([1, 0])
     expect(created?.end).toEqual([3, 0])
     expect(created?.name).toBe('wall_a') // Keeps original name
     
     const walls = levelWalls()
     expect(walls).toHaveLength(3)
     
     // Find the three segments
     const segments = walls.map(w => ({
       start: w.start,
       end: w.end,
       name: w.name
     }))
     
     // Should have segments [0,0]->[1,0], [1,0]->[3,0], [3,0]->[4,0]
     expect(segments).toContainEqual({ start: [0, 0], end: [1, 0], name: expect.stringContaining('wall_a') })
     expect(segments).toContainEqual({ start: [1, 0], end: [3, 0], name: 'wall_a' }) // Middle keeps original name
     expect(segments).toContainEqual({ start: [3, 0], end: [4, 0], name: expect.stringContaining('wall_a') })
   })
   
   test('drawing from one point to the same point on a wall is rejected (too short)', () => {
     // Both points project to nearly the same spot → segment too short
     const created = createWallOnCurrentLevel([1, 0], [1.001, 0]) // Very close points
     expect(created).toBeNull() // Should be rejected as too short
     expect(levelWalls()).toHaveLength(1) // Original wall unchanged
   })
   
    test('drawing from wall A to wall B creates a new wall (not a split)', () => {
      // Points on different walls → normal creation behavior
      seedLevel([
        makeWall([0, 0], [4, 0], 'wall_a'),
        makeWall([5, 0], [9, 0], 'wall_b')
      ])

      // Draw from [1,0] on wall A to [6,0] on wall B
      const created = createWallOnCurrentLevel([1, 0], [6, 0])

      expect(created).not.toBeNull()
      expect(created?.start).toEqual([1, 0])
      expect(created?.end).toEqual([6, 0])
      // Should be a new wall, not a split
      expect(created?.name).not.toBe('wall_a')
      expect(created?.name).not.toBe('wall_b')

      // Each wall splits at the endpoint + new wall = 5 total
      const walls = levelWalls()
      expect(walls).toHaveLength(5)
    })
   
    test('tolerance: points slightly off the wall still trigger the split', () => {
      // Points are 0.2m away from the wall line but within snap radius (0.35m)
      // Wall from [0,0] to [4,0] (along x-axis)
      // Points [1, 0.2] and [3, 0.2] are 0.2m away from wall
      const created = createWallOnCurrentLevel([1, 0.2], [3, 0.2])

      // Should trigger split since points are within WALL_JOIN_SNAP_RADIUS (0.35m)
      // Points get projected onto the wall, so resolved to [1,0] and [3,0]
      expect(created).not.toBeNull()
      expect(created?.start).toEqual([1, 0])
      expect(created?.end).toEqual([3, 0])

      const walls = levelWalls()
      expect(walls).toHaveLength(3)
    })
 })

describe('snapWallDraftPointDetailed', () => {
  test('bypassSnap returns the raw point without endpoint or angle snap', () => {
    const wall = makeWall([0, 0], [4, 0], 'wall_a')
    const result = snapWallDraftPointDetailed({
      point: [3.99, 0.03],
      walls: [wall],
      start: [2, 2],
      angleSnap: true,
      bypassSnap: true,
    })

    expect(result.point).toEqual([3.99, 0.03])
    expect(result.snap).toBeNull()
  })
})
