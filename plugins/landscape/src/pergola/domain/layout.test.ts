import { describe, expect, test } from 'bun:test'
import { Box3, Mesh } from 'three'
import { pergolaBaseHeight, pergolaDimensions, pergolaLayout, pergolaRoofLine, spacedCenters } from './layout'
import { PergolaNode } from './schema'
import { POST_DETAIL_OPTIONS, validPostDetailStyle } from './post-details'
import {
  buildPergolaGeometry,
  disposePergolaGeometry,
} from '../rendering/geometry'
import { buildPergolaFloorplan } from '../rendering/floorplan'
import type { GeometryContext } from '@pascal-app/core'

const context: GeometryContext = {
  resolve: () => undefined,
  children: [],
  siblings: [],
  parent: null,
}

describe('pergola assembly', () => {
  test('has four posts supporting a perimeter beam frame, with rafters seated above it', () => {
    const node = PergolaNode.parse({})
    const members = pergolaLayout(node)
    const posts = members.filter((m) => m.role === 'posts')
    const beams = members.filter((m) => m.role === 'beams')
    expect(posts).toHaveLength(4)
    expect(beams).toHaveLength(4)
    for (const post of posts) {
      expect(post.position[1] - post.size[1] / 2).toBeCloseTo(
        pergolaBaseHeight(node) - 0.001,
      )
      expect(post.position[1] + post.size[1] / 2).toBeCloseTo(
        pergolaRoofLine(node).heightAt(post.position[2]),
      )
      expect(beams.some((b) => b.position[2] === post.position[2])).toBe(true)
    }
    for (const rafter of members.filter((m) => m.role === 'rafters'))
      expect(rafter.position[1] - rafter.size[1] / 2).toBeCloseTo(
        pergolaRoofLine(node).heightAt(rafter.position[2]) + node.beamHeight,
      )
  })
  test('extends each post to its own support height while keeping the roof level', () => {
    const node = PergolaNode.parse({ roofForm: 'flat', postBaseStyle: 'none' })
    const members = pergolaLayout(node, (_x, z) => z * 0.08)
    const posts = members.filter((member) => member.role === 'posts')
    expect(posts).toHaveLength(4)
    for (const post of posts) {
      const ground = post.position[2] * 0.08
      expect(post.position[1] - post.size[1] / 2).toBeCloseTo(ground)
      expect(post.position[1] + post.size[1] / 2).toBeCloseTo(node.height)
    }
    expect(posts.find((post) => post.position[2] < 0)!.size[1]).toBeGreaterThan(
      posts.find((post) => post.position[2] > 0)!.size[1],
    )
    const plan = buildPergolaFloorplan(node, context)
    expect(plan.kind).toBe('group')
    expect(pergolaLayout(node).filter((member) => member.role === 'posts'))
      .toHaveLength(4)

    const terrainContext: GeometryContext = {
      ...context,
      levelBaseAt: (_x, z) => z * 0.08,
    }
    const group = buildPergolaGeometry(node, terrainContext)
    try {
      const postGeometry = (group.children.find((child) => child.name === 'pergola-posts') as Mesh).geometry
      const positions = postGeometry.getAttribute('position')
      for (const post of posts) {
        const localGround = post.position[2] * 0.08
        const vertexYs = Array.from({ length: positions.count }, (_, index) => index)
          .filter((index) =>
            Math.abs(positions.getX(index) - post.position[0]) <= node.postSize / 2 + 1e-6 &&
            Math.abs(positions.getZ(index) - post.position[2]) <= node.postSize / 2 + 1e-6,
          )
          .map((index) => positions.getY(index))
        expect(Math.min(...vertexYs)).toBeCloseTo(localGround)
        expect(Math.max(...vertexYs)).toBeCloseTo(node.height)
      }
    } finally {
      disposePergolaGeometry(group)
    }
  })
  test('fits hosted pergola posts to the slope of their patio support', () => {
    const node = PergolaNode.parse({
      roofForm: 'flat',
      postBaseStyle: 'none',
      supportSurfaceId: 'patio-slope-test',
    })
    const patio = {
      id: 'patio-slope-test',
      type: 'landscape:patio',
      parentId: 'level-test',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      width: 5,
      depth: 5,
      thickness: 0.15,
      slopePercent: 8,
      drainDirection: 'back',
    } as unknown as NonNullable<GeometryContext['parent']>
    const hostedContext: GeometryContext = { ...context, parent: patio }
    const group = buildPergolaGeometry(node, hostedContext)
    try {
      const postGeometry = (group.children.find((child) => child.name === 'pergola-posts') as Mesh).geometry
      const positions = postGeometry.getAttribute('position')
      for (const post of pergolaLayout(node)) {
        if (post.role !== 'posts') continue
        const localGround = -post.position[2] * 0.08
        const vertexYs = Array.from({ length: positions.count }, (_, index) => index)
          .filter((index) =>
            Math.abs(positions.getX(index) - post.position[0]) <= node.postSize / 2 + 1e-6 &&
            Math.abs(positions.getZ(index) - post.position[2]) <= node.postSize / 2 + 1e-6,
          )
          .map((index) => positions.getY(index))
        expect(Math.min(...vertexYs)).toBeCloseTo(localGround)
        expect(Math.max(...vertexYs)).toBeCloseTo(node.height)
      }
    } finally {
      disposePergolaGeometry(group)
    }
  })
  test('distributes rafters symmetrically without exceeding target spacing', () => {
    const centers = spacedCenters(4.435, 0.45)
    expect(centers[0]).toBeCloseTo(-centers.at(-1)!)
    for (let i = 1; i < centers.length; i++)
      expect(centers[i]! - centers[i - 1]!).toBeLessThanOrEqual(0.45 + 1e-10)
  })
  test('open roof retains gaps even at minimum allowed spacing', () => {
    const n = PergolaNode.parse({
      rafterWidth: 0.12,
      rafterSpacing: 0.2,
      slatSpacing: 0.1,
      width: 1.5,
      depth: 1.5,
    })
    for (const role of ['rafters', 'slats'] as const) {
      const parts = pergolaLayout(n).filter((m) => m.role === role)
      const axis = role === 'rafters' ? 0 : 2
      for (let i = 1; i < parts.length; i++)
        expect(
          parts[i]!.position[axis] - parts[i - 1]!.position[axis],
        ).toBeGreaterThan(parts[i]!.size[axis])
    }
  })
  test('optional components disappear without removing the primary frame', () => {
    const parts = pergolaLayout(
      PergolaNode.parse({ shadeSlats: false, braces: false }),
    )
    expect(parts.some((m) => m.role === 'slats' || m.role === 'braces')).toBe(
      false,
    )
    expect(parts.filter((m) => m.role === 'posts')).toHaveLength(4)
  })
  test('knee braces meet both the width and depth beams at every post', () => {
    for (const patch of [
      {},
      { height: 2.1, backHeight: 3.3, leftPostInset: 0.3, backPostInset: 0.2 },
    ]) {
      const n = PergolaNode.parse(patch)
      const braces = pergolaLayout(n).filter((m) => m.role === 'braces')
      expect(braces).toHaveLength(8)
      expect(braces.filter((m) => m.brace?.axis === 'x')).toHaveLength(4)
      expect(braces.filter((m) => m.brace?.axis === 'z')).toHaveLength(4)
      const group = buildPergolaGeometry(n)
      try {
        const bounds = new Box3().setFromObject(group)
        const [width, height, depth] = pergolaDimensions(n)
        expect(bounds.min.x).toBeGreaterThanOrEqual(-width / 2 - 1e-6)
        expect(bounds.max.x).toBeLessThanOrEqual(width / 2 + 1e-6)
        expect(bounds.min.z).toBeGreaterThanOrEqual(-depth / 2 - 1e-6)
        expect(bounds.max.z).toBeLessThanOrEqual(depth / 2 + 1e-6)
        expect(bounds.max.y).toBeLessThanOrEqual(height + 1e-6)
      } finally {
        disposePergolaGeometry(group)
      }
    }
  })
  test('brace controls reshape every post connection across profiles', () => {
    for (const postStyle of ['square', 'chamfered', 'round', 'tapered'] as const) {
      for (const braceStyle of ['diagonal', 'arched', 'swept'] as const) {
        const n = PergolaNode.parse({
          postStyle,
          braceStyle,
          braceThickness: 0.12,
          braceReach: 0.72,
          braceDrop: 0.7,
          height: 2.2,
          backHeight: 3.1,
        })
        const parts = pergolaLayout(n)
        const braces = parts.filter((m) => m.role === 'braces')
        expect(braces).toHaveLength(8)
        for (const member of braces) {
          const brace = member.brace!
          const post = parts.find((m) => m.role === 'posts' &&
            (brace.axis === 'x'
              ? m.position[2] === member.position[2]
              : m.position[0] === member.position[0]) &&
            Math.abs(m.position[brace.axis === 'x' ? 0 : 2] - member.position[brace.axis === 'x' ? 0 : 2]) < n.postSize,
          )!
          expect(post).toBeDefined()
          const axis = brace.axis === 'x' ? 0 : 2
          expect(Math.abs(member.position[axis] - post.position[axis])).toBeLessThan(n.postSize / 2)
          expect(brace.style).toBe(braceStyle)
          expect(brace.section).toBe(0.12)
          expect(brace.reach).toBeCloseTo(0.72)
          expect(post.position[1] + post.size[1] / 2 - (member.position[1] + brace.lowerY)).toBeCloseTo(0.7)
        }
        const group = buildPergolaGeometry(n)
        try {
          const braceMesh = group.children.find((child) => child.name === 'pergola-braces')
          expect(braceMesh).toBeDefined()
          expect(new Box3().setFromObject(group).max.y).toBeLessThanOrEqual(pergolaDimensions(n)[1] + 1e-6)
        } finally {
          disposePergolaGeometry(group)
        }
      }
    }
  })
  test.each([
    {},
    { width: 10, depth: 8, rafterSpacing: 0.2, slatSpacing: 0.1 },
    { width: 1.5, depth: 1.5, overhang: 0, shadeSlats: false },
  ])('geometry stays within declared dimensions: %p', (patch) => {
    const n = PergolaNode.parse({
      ...patch,
      position: [20, 0, 30],
      rotation: [0, 1, 0],
    })
    const group = buildPergolaGeometry(n)
    try {
      const bounds = new Box3().setFromObject(group)
      const [w, h, d] = pergolaDimensions(n)
      expect(bounds.min.x).toBeCloseTo(-w / 2, 5)
      expect(bounds.max.x).toBeCloseTo(w / 2, 5)
      expect(bounds.min.z).toBeCloseTo(-d / 2, 5)
      expect(bounds.max.z).toBeCloseTo(d / 2, 5)
      expect(bounds.min.y).toBeCloseTo(0, 5)
      // Three stores merged member vertices in Float32; curved/angled members
      // can differ slightly from the analytic bounding box.
      expect(Math.abs(bounds.max.y - h)).toBeLessThan(0.011)
      expect(group.children.length).toBeLessThanOrEqual(7)
    } finally {
      disposePergolaGeometry(group)
    }
  })
  test('plan footprint rotates and translates once, matching the 3D bounds', () => {
    const node = PergolaNode.parse({
      position: [10, 0, 20],
      rotation: [0, Math.PI / 2, 0],
    })
    const result = buildPergolaFloorplan(node, context)
    if (result.kind !== 'group' || result.children[0]?.kind !== 'polygon')
      throw new Error('Missing plan footprint')
    const points = result.children[0].points
    const xs = points.map((p) => p[0])
    const zs = points.map((p) => p[1])
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(
      node.depth + 2 * node.overhang,
    )
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(
      node.width + 2 * node.overhang,
    )
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(10)
    expect((Math.min(...zs) + Math.max(...zs)) / 2).toBeCloseTo(20)
  })
  test('independent side heights keep each beam on its posts and pitch the rafters', () => {
    const n = PergolaNode.parse({
      height: 2.2,
      backHeight: 3.1,
      postStyle: 'round',
      leftPostInset: 0.4,
      backPostInset: 0.25,
    })
    const parts = pergolaLayout(n)
    const posts = parts.filter((m) => m.role === 'posts')
    const beams = parts.filter((m) => m.role === 'beams')
    expect(posts).toHaveLength(4)
    expect(posts.every((m) => m.shape === 'round')).toBe(true)
    for (const post of posts) {
      const beam = beams.find((m) => m.position[2] === post.position[2])
      expect(beam).toBeDefined()
      expect(post.position[1] + post.size[1] / 2).toBeCloseTo(
        beam!.position[1] - beam!.size[1] / 2,
      )
    }
    expect(parts.find((m) => m.role === 'rafters')?.rotation?.[0]).not.toBe(0)
    const geometry = buildPergolaGeometry(n)
    try {
      const bounds = new Box3().setFromObject(geometry)
      expect(bounds.min.y).toBeCloseTo(0)
      expect(bounds.max.y).toBeLessThanOrEqual(pergolaDimensions(n)[1] + 1e-6)
    } finally {
      disposePergolaGeometry(geometry)
    }
  })
  test('each post profile offers distinct support details with bounded geometry', () => {
    for (const [postStyle, choices] of Object.entries(POST_DETAIL_OPTIONS)) {
      expect(choices).toHaveLength(3)
      for (const choice of choices) {
        const n = PergolaNode.parse({
          postStyle,
          postDetailStyle: choice.value,
          width: 1.5,
          depth: 1.5,
          overhang: 0,
        })
        expect(validPostDetailStyle(n)).toBe(choice.value)
        const group = buildPergolaGeometry(n)
        try {
          const box = new Box3().setFromObject(group)
          const [width, height, depth] = pergolaDimensions(n)
          expect(box.min.x).toBeGreaterThanOrEqual(-width / 2 - 1e-6)
          expect(box.max.x).toBeLessThanOrEqual(width / 2 + 1e-6)
          expect(box.min.z).toBeGreaterThanOrEqual(-depth / 2 - 1e-6)
          expect(box.max.z).toBeLessThanOrEqual(depth / 2 + 1e-6)
          expect(box.max.y).toBeLessThanOrEqual(height + 1e-6)
        } finally {
          disposePergolaGeometry(group)
        }
      }
    }
  })
  test('rejects invalid or unbounded geometry inputs', () => {
    for (const patch of [
      { width: NaN },
      { depth: Infinity },
      { height: 0 },
      { slatSpacing: 0 },
      { overhang: -1 },
      { width: 500 },
      { rotation: [1, 0, 0] },
    ])
      expect(PergolaNode.safeParse(patch).success).toBe(false)
    expect(PergolaNode.parse({}).id).not.toBe(PergolaNode.parse({}).id)
  })
})
