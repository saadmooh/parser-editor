import type { AnyNode, GeometryContext } from '@pascal-app/core'
import { useScene } from '@pascal-app/core'
import { createMaterial, resolveMaterialRef } from '@pascal-app/viewer'
import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { archCrownAt, pergolaLayout, postRadiusAt, roofElevation, type Member, type MemberRole } from '../domain/layout'
import type { PergolaNode } from '../domain/schema'
import { pergolaPointFromSupport, pergolaSupportSurfaceTop } from '../domain/support-surface'

function braceGeometry(member: Member): ExtrudeGeometry {
  const brace = member.brace!
  const shoulder = brace.shoulder
  const far = brace.reach - shoulder
  const upperStart = brace.lowerY + shoulder
  const upperEnd = brace.slope * far
  const lowerEnd = brace.slope * brace.reach
  const shape = new Shape()
  shape.moveTo(0, brace.lowerY)
  shape.lineTo(0, upperStart)
  if (brace.style === 'diagonal') shape.lineTo(far, upperEnd)
  else if (brace.style === 'curved-bracket') {
    const curve = brace.curve
    const rise = upperEnd - upperStart
    shape.bezierCurveTo(
      far * (0.12 + curve * 0.12),
      upperStart + rise * (0.65 + curve * 0.25),
      far * (0.55 + curve * 0.25),
      upperEnd,
      far,
      upperEnd,
    )
  } else {
    const bend = Math.min(brace.reach * 0.13, 0.09) * (brace.style === 'arched' ? 1 : -1)
    shape.quadraticCurveTo(far / 2, (upperStart + upperEnd) / 2 + bend, far, upperEnd)
  }
  shape.lineTo(brace.reach, lowerEnd)
  if (brace.style === 'diagonal') shape.lineTo(0, brace.lowerY)
  else if (brace.style === 'curved-bracket') {
    const curve = brace.curve
    const rise = lowerEnd - brace.lowerY
    shape.bezierCurveTo(
      brace.reach * (0.56 + curve * 0.2),
      lowerEnd - rise * curve * 0.12,
      brace.reach * (0.12 + curve * 0.1),
      brace.lowerY + rise * (0.35 + curve * 0.2),
      0,
      brace.lowerY,
    )
  } else {
    const bend = Math.min(brace.reach * 0.13, 0.09) * (brace.style === 'arched' ? 1 : -1)
    shape.quadraticCurveTo(brace.reach / 2, (lowerEnd + brace.lowerY) / 2 + bend, 0, brace.lowerY)
  }
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, {
    depth: brace.section,
    bevelEnabled: false,
    curveSegments: brace.style === 'diagonal' ? 1 : 20,
  })
  geometry.translate(0, 0, -brace.section / 2)
  return geometry
}

function postGeometry(member: Member, node: PergolaNode): CylinderGeometry {
  const height = member.position[1] + member.size[1] / 2
  const geometry = new CylinderGeometry(
    1,
    1,
    member.size[1],
    member.shape === 'round' ? 24 : 4,
    24,
  )
  const positions = geometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    const radius = postRadiusAt(node, height, member.position[1] + positions.getY(i))
    positions.setX(i, positions.getX(i) * radius)
    positions.setZ(i, positions.getZ(i) * radius)
  }
  positions.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

function roofProfileGeometry(member: Member): ExtrudeGeometry {
  const profile = member.roofProfile!
  const shape = new Shape()
  const start = member.position[0] - member.size[0] / 2
  const end = member.position[0] + member.size[0] / 2
  const xPositions = [start, ...Array.from({ length: 33 }, (_, i) =>
    profile.leftX + (profile.rightX - profile.leftX) * i / 32), end]
    .filter((x) => x >= start && x <= end)
    .sort((a, b) => a - b)
  const elevation = (x: number) =>
    roofElevation(profile.form, x, profile.leftX, profile.rightX, profile.rise) - profile.rise / 2
  for (let i = 0; i < xPositions.length; i++) {
    const x = xPositions[i]!
    const y = elevation(x) + member.size[1] / 2
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  const cut = member.endCut
    ? Math.min(member.endCut.depth, member.size[1] * 0.7)
    : 0
  const bottom = (x: number) => elevation(x) - member.size[1] / 2
  shape.lineTo(end, bottom(end) + cut)
  if (cut && member.endCut?.style === 'curved')
    shape.quadraticCurveTo(end - cut * 0.35, bottom(end), end - cut, bottom(end - cut))
  else if (cut) shape.lineTo(end - cut, bottom(end - cut))
  for (let i = xPositions.length - 2; i > 0; i--) {
    const x = xPositions[i]!
    if (x > start + cut && x < end - cut) shape.lineTo(x, bottom(x))
  }
  if (cut) {
    shape.lineTo(start + cut, bottom(start + cut))
    if (member.endCut?.style === 'curved')
      shape.quadraticCurveTo(start + cut * 0.35, bottom(start), start, bottom(start) + cut)
    else shape.lineTo(start, bottom(start) + cut)
  } else shape.lineTo(start, bottom(start))
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, {
    depth: member.size[2],
    bevelEnabled: false,
    curveSegments: 1,
  })
  geometry.translate(0, 0, -member.size[2] / 2)
  return geometry
}

function cutMemberGeometry(member: Member): ExtrudeGeometry {
  const cut = member.endCut!
  const length = cut.axis === 'x' ? member.size[0] : member.size[2]
  const height = member.size[1]
  const depth = Math.min(cut.depth, height * 0.7, length * 0.2)
  const half = length / 2
  const shape = new Shape()
  shape.moveTo(-half, height / 2)
  shape.lineTo(half, height / 2)
  shape.lineTo(half, -height / 2 + depth)
  if (cut.style === 'curved') shape.quadraticCurveTo(half - depth * 0.35, -height / 2, half - depth, -height / 2)
  else shape.lineTo(half - depth, -height / 2)
  shape.lineTo(-half + depth, -height / 2)
  if (cut.style === 'curved') shape.quadraticCurveTo(-half + depth * 0.35, -height / 2, -half, -height / 2 + depth)
  else shape.lineTo(-half, -height / 2 + depth)
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, {
    depth: cut.axis === 'x' ? member.size[2] : member.size[0],
    bevelEnabled: false,
    curveSegments: 12,
  })
  geometry.translate(0, 0, -(cut.axis === 'x' ? member.size[2] : member.size[0]) / 2)
  if (cut.axis === 'z') geometry.rotateY(-Math.PI / 2)
  return geometry
}

function fullArchGeometry(member: Member): ExtrudeGeometry {
  const arch = member.arch!
  const half = arch.span / 2
  const curve = arch.roofForm === 'gable'
    ? arch.curve
    : Math.min(arch.curve, arch.drop - 0.04)
  const shape = new Shape()
  const crownAt = (x: number) => archCrownAt(arch.style, x / half)
  const topAt = (x: number) => arch.roofForm === 'curved'
    ? roofElevation('curved', member.position[0] + x,
      arch.leftX, arch.rightX, arch.roofRise)
    : arch.roofForm === 'gable'
      ? curve * crownAt(x)
      : 0
  for (let i = 0; i <= 32; i++) {
    const x = -half + arch.span * i / 32
    if (i === 0) shape.moveTo(x, topAt(x))
    else shape.lineTo(x, topAt(x))
  }
  for (let i = 32; i >= 0; i--) {
    const x = -half + arch.span * i / 32
    shape.lineTo(x, topAt(x) - arch.drop +
      (arch.roofForm === 'gable' ? 0 : curve * crownAt(x)))
  }
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, {
    depth: member.size[2],
    bevelEnabled: false,
    curveSegments: 1,
  })
  geometry.translate(0, 0, -member.size[2] / 2)
  return geometry
}

function trussStrutGeometry(member: Member): ExtrudeGeometry {
  const strut = member.trussStrut!
  const dx = strut.upper[0] - strut.lower[0]
  const dy = strut.upper[1] - strut.lower[1]
  const length = Math.hypot(dx, dy)
  const normalX = -dy / length
  const normalY = dx / length
  const point = (side: number, t: number): [number, number] => [
    strut.lower[0] + dx * t + side * normalX * strut.width / 2,
    strut.lower[1] + dy * t + side * normalY * strut.width / 2,
  ]
  const archTop = (x: number) => {
    const globalX = member.position[0] + x
    const center = (strut.leftX + strut.rightX) / 2
    const half = (strut.rightX - strut.leftX) / 2
    return strut.baseY + strut.archRise *
      archCrownAt(strut.archStyle, (globalX - center) / half) - member.position[1]
  }
  const roofBottom = (x: number) =>
    strut.baseY + roofElevation('gable', member.position[0] + x,
      strut.leftX, strut.rightX, strut.roofRise) - member.position[1]
  const intersection = (
    side: number,
    surface: (x: number) => number,
    initial: number,
  ) => {
    let t = initial
    for (let i = 0; i < 10; i++) {
      const [x, y] = point(side, t)
      const error = y - surface(x)
      if (Math.abs(error) < 1e-6) break
      const step = 1e-4
      const [aheadX, aheadY] = point(side, t + step)
      const [behindX, behindY] = point(side, t - step)
      const slope = (aheadY - surface(aheadX) - behindY + surface(behindX)) / (2 * step)
      if (Math.abs(slope) < 1e-6) break
      t = Math.max(initial - 0.65, Math.min(initial + 0.65, t - error / slope))
    }
    return t
  }
  const inset = 0.012 / length
  const lowerA = point(-1, intersection(-1, archTop, 0) - inset)
  const upperA = point(-1, intersection(-1, roofBottom, 1) + inset)
  const upperB = point(1, intersection(1, roofBottom, 1) + inset)
  const lowerB = point(1, intersection(1, archTop, 0) - inset)
  const shape = new Shape()
  shape.moveTo(...lowerA)
  shape.lineTo(...upperA)
  shape.lineTo(...upperB)
  shape.lineTo(...lowerB)
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, {
    depth: strut.depth,
    bevelEnabled: false,
    curveSegments: 1,
  })
  geometry.translate(0, 0, -strut.depth / 2)
  return geometry
}

export function buildPergolaGeometry(
  node: PergolaNode,
  ctx?: GeometryContext,
  shading = 'rendered',
): Group {
  const group = new Group()
  const buckets = new Map<MemberRole, BufferGeometry[]>()
  const parent = ctx?.parent as (AnyNode & { position?: [number, number, number]; rotation?: unknown }) | null | undefined
  const hostedSupport = node.supportSurfaceId && parent?.id === node.supportSurfaceId
    ? parent as Parameters<typeof pergolaSupportSurfaceTop>[0] : null
  const yaw = node.rotation[1]
  const cos = Math.cos(yaw), sin = Math.sin(yaw)
  const localCenter: [number, number] = [node.position[0], node.position[2]]
  const levelCenter = hostedSupport ? pergolaPointFromSupport(hostedSupport, localCenter) : localCenter
  const centerSupportHeight = hostedSupport
    ? pergolaSupportSurfaceTop(hostedSupport, levelCenter)
    : ctx?.levelBaseAt?.(levelCenter[0], levelCenter[1]) ?? 0
  const supportOffsetAt = hostedSupport || ctx?.levelBaseAt
    ? (x: number, z: number) => {
        const localX = node.position[0] + x * cos + z * sin
        const localZ = node.position[2] - x * sin + z * cos
        if (hostedSupport) {
          const levelPoint = pergolaPointFromSupport(hostedSupport, [localX, localZ])
          return pergolaSupportSurfaceTop(hostedSupport, levelPoint) - centerSupportHeight
        }
        return (ctx!.levelBaseAt?.(localX, localZ) ?? 0) - centerSupportHeight
      }
    : undefined
  for (const member of pergolaLayout(node, supportOffsetAt)) {
    const sourceGeometry = member.brace
      ? braceGeometry(member)
      : member.roofProfile
        ? roofProfileGeometry(member)
      : member.arch
        ? fullArchGeometry(member)
      : member.trussStrut
        ? trussStrutGeometry(member)
      : member.endCut
        ? cutMemberGeometry(member)
      : member.role === 'posts' && (member.shape === 'round' || member.shape === 'tapered')
        ? postGeometry(member, node)
      : member.shape && member.shape !== 'square'
        ? new CylinderGeometry(
            member.shape === 'tapered'
              ? member.size[0] * 0.38
              : member.size[0] / 2,
            member.size[0] / 2,
            member.size[1],
            member.shape === 'round'
              ? 16
              : member.shape === 'chamfered'
                ? 8
                : 4,
          )
        : new BoxGeometry(...member.size)
    const geometry = sourceGeometry.index
      ? sourceGeometry.toNonIndexed()
      : sourceGeometry
    if (geometry !== sourceGeometry) sourceGeometry.dispose()
    const yaw = member.brace
      ? member.brace.axis === 'x'
        ? member.brace.inward === 1
          ? 0
          : Math.PI
        : member.brace.inward === 1
          ? -Math.PI / 2
          : Math.PI / 2
      : null
    const rotation = new Quaternion().setFromEuler(
      new Euler(
        ...(yaw === null ? (member.rotation ?? [0, 0, 0]) : [0, yaw, 0]),
      ),
    )
    geometry.applyMatrix4(
      new Matrix4().compose(
        new Vector3(...member.position),
        rotation,
        new Vector3(1, 1, 1),
      ),
    )
    const bucket = buckets.get(member.role) ?? []
    bucket.push(geometry)
    buckets.set(member.role, bucket)
  }
  for (const [role, parts] of buckets) {
    const geometry = mergeGeometries(parts)
    for (const part of parts) part.dispose()
    if (!geometry) throw new Error(`Could not build pergola ${role}`)
    const color =
      role === 'feet' || role === 'posts' || role === 'trim'
          ? node.postColor
          : role === 'screens'
            ? node.beamColor
          : role === 'beams' || role === 'braces' || role === 'arches'
            ? node.beamColor
            : node.roofColor
    const metal = node.finish === 'metal'
    const authoredMaterial =
      shading === 'solid'
        ? new MeshLambertMaterial({ color })
        : new MeshStandardMaterial({
            color,
            roughness: metal ? 0.45 : 0.82,
            metalness: metal ? 0.65 : 0,
          })
    const painted = node.paintedMaterials?.[role] ??
      (role === 'screens' ? node.paintedMaterials?.beams : undefined)
    const material = painted?.material
      ? createMaterial(
          painted.material,
          shading === 'solid' ? 'solid' : 'rendered',
        )
      : painted?.materialPreset
        ? (resolveMaterialRef(
            painted.materialPreset,
            useScene.getState().materials,
            shading === 'solid' ? 'solid' : 'rendered',
          ) ?? authoredMaterial)
        : authoredMaterial
    if (material !== authoredMaterial) authoredMaterial.dispose()
    const mesh = new Mesh(geometry, material)
    mesh.name = `pergola-${role}`
    mesh.userData.slotId = role
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }
  return group
}

export function disposePergolaGeometry(group: Group) {
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.geometry.dispose()
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material])
      if (!material.userData.__pascalCachedMaterial) material.dispose()
  })
}
