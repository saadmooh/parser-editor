import { type AnyNode, getFloorStackedPosition, nodeRegistry, resolveFrozenFloorPlacementPatch } from '@pascal-app/core'
import { surfaceOutline, type DrawnSurface } from './outline'

const SURFACE_KINDS = new Set([
  'landscape:deck', 'landscape:patio', 'landscape:concrete-slab', 'landscape:landing',
])

type Pose = { position: [number, number, number]; rotation: number }
type Surface = AnyNode & {
  position: [number, number, number]
  rotation: [number, number, number]
}
type Stair = AnyNode & Pose & { destinationSurfaceId?: string; stairType: string;
  children: string[]; totalRise?: number; stepCount: number }
type Flight = AnyNode & { segmentType: string; length: number; height: number; stepCount: number }
type AttachmentPatch = Partial<Pose> & { parentId?: string | null;
  destinationSurfaceId?: string; totalRise?: number; stepCount?: number; height?: number; supportSlabId?: string }

function isSurface(node: AnyNode | undefined): node is Surface {
  return !!node && SURFACE_KINDS.has(node.type as string) &&
    Array.isArray((node as Surface).position) && Array.isArray((node as Surface).rotation)
}

function toLevel(pose: Pose, surface: Surface): Pose {
  const angle = surface.rotation[1]
  const c = Math.cos(angle), s = Math.sin(angle)
  const [x, y, z] = pose.position
  return {
    position: [surface.position[0] + c * x + s * z,
      surface.position[1] + y, surface.position[2] - s * x + c * z],
    rotation: pose.rotation + angle,
  }
}

function fromLevel(pose: Pose, surface: Surface): Pose {
  const angle = surface.rotation[1]
  const c = Math.cos(angle), s = Math.sin(angle)
  const dx = pose.position[0] - surface.position[0]
  const dz = pose.position[2] - surface.position[2]
  return {
    position: [c * dx - s * dz, pose.position[1] - surface.position[1],
      s * dx + c * dz],
    rotation: pose.rotation - angle,
  }
}

function surfaceTop(surface: Surface & { thickness: number }, x: number, z: number) {
  if ((surface.type as string) !== 'landscape:patio') return surface.thickness
  const patio = surface as Surface & { thickness: number; elevation?: number;
    slopePercent?: number; drainDirection?: string }
  const gradient = (patio.slopePercent ?? 0) / 100
  const slope = patio.drainDirection === 'front' ? gradient * z
    : patio.drainDirection === 'back' ? -gradient * z
      : patio.drainDirection === 'left' ? gradient * x
        : patio.drainDirection === 'right' ? -gradient * x : 0
  return patio.thickness + (patio.elevation ?? 0) + Math.min(0.045, patio.thickness / 3) + slope
}

/** Carry the high end along the edge it was attached to when the outline changes. */
function resizedStairPosition(stair: Stair, flight: Flight, before: Surface, after: Surface) {
  const oldOutline = surfaceOutline(before as unknown as DrawnSurface)
  const newOutline = surfaceOutline(after as unknown as DrawnSurface)
  if (oldOutline.length !== newOutline.length || oldOutline.length < 3) return null
  const highX = stair.position[0] + Math.sin(stair.rotation) * flight.length
  const highZ = stair.position[2] + Math.cos(stair.rotation) * flight.length
  let nearest: { index: number; t: number; distance: number } | null = null
  for (let index = 0; index < oldOutline.length; index++) {
    const a = oldOutline[index]!, b = oldOutline[(index + 1) % oldOutline.length]!
    const dx = b[0] - a[0], dz = b[1] - a[1]
    const lengthSquared = dx * dx + dz * dz
    if (lengthSquared < 1e-8) continue
    const t = Math.max(0, Math.min(1,
      ((highX - a[0]) * dx + (highZ - a[1]) * dz) / lengthSquared))
    const distance = Math.hypot(highX - a[0] - t * dx, highZ - a[1] - t * dz)
    if (!nearest || distance < nearest.distance) nearest = { index, t, distance }
  }
  if (!nearest || nearest.distance > 0.75) return null
  const oldA = oldOutline[nearest.index]!, oldB = oldOutline[(nearest.index + 1) % oldOutline.length]!
  const newA = newOutline[nearest.index]!, newB = newOutline[(nearest.index + 1) % newOutline.length]!
  const dx = (newA[0] + nearest.t * (newB[0] - newA[0])) -
    (oldA[0] + nearest.t * (oldB[0] - oldA[0]))
  const dz = (newA[1] + nearest.t * (newB[1] - newA[1])) -
    (oldA[1] + nearest.t * (oldB[1] - oldA[1]))
  return [stair.position[0] + dx, stair.position[1], stair.position[2] + dz] as Pose['position']
}

export function stairAttachmentUpdates(nodes: Readonly<Record<string, AnyNode>>,
  movingStairId?: string, previousNodes?: Readonly<Record<string, AnyNode>>) {
  const updates: { id: string; data: AttachmentPatch }[] = []
  for (const raw of Object.values(nodes)) {
    if (raw.type !== 'stair') continue
    const stair = raw as Stair
    const currentSurface = isSurface(nodes[stair.parentId ?? ''])
      ? nodes[stair.parentId!] as Surface : null
    const target = nodes[stair.id === movingStairId ? '' : stair.destinationSurfaceId ?? '']
    const targetSurface = isSurface(target) && target.parentId ===
      (currentSurface?.parentId ?? stair.parentId) ? target : null
    const targetParentId = targetSurface?.id ?? currentSurface?.parentId
    if (!targetParentId) continue
    const changingParent = targetParentId !== stair.parentId
    const levelPose = currentSurface ? toLevel(stair, currentSurface) : {
      ...stair,
      position: getFloorStackedPosition({ node: stair, nodes, position: stair.position, rotation: stair.rotation }),
    }
    let pose = changingParent
      ? targetSurface ? fromLevel(levelPose, targetSurface) : levelPose : stair
    let supportPatch: { supportSlabId?: string } = {}
    if (changingParent && !targetSurface && nodeRegistry.get(stair.type)?.capabilities.floorPlaced) {
      const detached = { ...stair, parentId: targetParentId }
      const frozen = resolveFrozenFloorPlacementPatch(detached, { ...nodes, [stair.id]: detached }, {
        position: [levelPose.position[0], 0, levelPose.position[2]],
        rotation: levelPose.rotation, elevation: levelPose.position[1],
      })
      pose = { ...pose, position: frozen.position }
      supportPatch = { supportSlabId: frozen.supportSlabId }
    }
    const stairPatch: AttachmentPatch = changingParent ? { parentId: targetParentId, ...pose, ...supportPatch,
      ...(!targetSurface && stair.destinationSurfaceId && stair.id !== movingStairId
        ? { destinationSurfaceId: undefined } : {}) } : {}
    if (targetSurface && stair.id !== movingStairId && stair.stairType === 'straight') {
      const previousSurface = previousNodes?.[targetSurface.id]
      const sameAttachedStair = previousNodes?.[stair.id]?.parentId === targetSurface.id
      const baseY = pose.position[1] + (sameAttachedStair && isSurface(previousSurface)
        ? previousSurface.position[1] - targetSurface.position[1] : 0)
      if (Math.abs(baseY - pose.position[1]) > 1e-6)
        stairPatch.position = [pose.position[0], baseY, pose.position[2]]
      const flight = nodes[stair.children[0] ?? ''] as Flight | undefined
      if (flight?.type === 'stair-segment' && flight.segmentType === 'stair') {
        const previousStair = previousNodes?.[stair.id] as Stair | undefined
        const previousFlight = previousNodes?.[flight.id] as Flight | undefined
        const outlineChanged = isSurface(previousSurface) && (
          (previousSurface as Surface & { width: number }).width !==
            (targetSurface as Surface & { width: number }).width ||
          (previousSurface as Surface & { depth: number }).depth !==
            (targetSurface as Surface & { depth: number }).depth ||
          JSON.stringify((previousSurface as Surface & { outline?: unknown }).outline) !==
            JSON.stringify((targetSurface as Surface & { outline?: unknown }).outline) ||
          (previousSurface as Surface & { shape?: string }).shape !==
            (targetSurface as Surface & { shape?: string }).shape)
        if (sameAttachedStair && outlineChanged && previousStair && previousFlight &&
          previousStair.position[0] === stair.position[0] &&
          previousStair.position[2] === stair.position[2] &&
          previousStair.rotation === stair.rotation && previousFlight.length === flight.length) {
          const resized = resizedStairPosition(stair, flight, previousSurface as Surface, targetSurface)
          if (resized && (Math.abs(resized[0] - pose.position[0]) > 1e-6 ||
            Math.abs(resized[2] - pose.position[2]) > 1e-6))
            stairPatch.position = [resized[0], baseY, resized[2]]
        }
        const position = stairPatch.position ?? pose.position
        const highX = position[0] + Math.sin(pose.rotation) * flight.length
        const highZ = position[2] + Math.cos(pose.rotation) * flight.length
        const rise = surfaceTop(targetSurface as Surface & { thickness: number }, highX, highZ) - baseY
        if (rise > 0.01) {
          const steps = Math.max(1, Math.round(rise / 0.16))
          if (Math.abs((stair.totalRise ?? 0) - rise) > 1e-6) stairPatch.totalRise = rise
          if (stair.stepCount !== steps) stairPatch.stepCount = steps
          const flightPatch: AttachmentPatch = {}
          if (Math.abs(flight.height - rise) > 1e-6) flightPatch.height = rise
          if (flight.stepCount !== steps) flightPatch.stepCount = steps
          if (Object.keys(flightPatch).length) updates.push({ id: flight.id, data: flightPatch })
        }
      }
    }
    if (Object.keys(stairPatch).length) updates.push({ id: stair.id, data: stairPatch })
  }
  return updates
}
