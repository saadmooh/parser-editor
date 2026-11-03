import type { PergolaNode } from './schema'
import { DEFAULT_ARCH_DROP, DEFAULT_ARCH_RISE, DEFAULT_ROOF_RISE } from './schema'
import { validPostDetailStyle } from './post-details'

export type MemberRole =
  | 'posts'
  | 'beams'
  | 'rafters'
  | 'slats'
  | 'braces'
  | 'arches'
  | 'feet'
  | 'trim'
  | 'screens'
export type Member = {
  role: MemberRole
  position: [number, number, number]
  size: [number, number, number]
  rotation?: [number, number, number]
  shape?: PergolaNode['postStyle']
  endCut?: { axis: 'x' | 'z'; style: 'beveled' | 'curved'; depth: number }
  roofProfile?: {
    form: 'gable' | 'curved'
    leftX: number
    rightX: number
    rise: number
  }
  arch?: {
    span: number
    drop: number
    curve: number
    style: PergolaNode['archStyle']
    roofRise: number
    leftX: number
    rightX: number
    roofForm: PergolaNode['roofForm']
  }
  trussStrut?: {
    lower: [number, number]
    upper: [number, number]
    width: number
    depth: number
    baseY: number
    leftX: number
    rightX: number
    roofRise: number
    archRise: number
    archStyle: PergolaNode['archStyle']
  }
  brace?: {
    axis: 'x' | 'z'
    inward: -1 | 1
    reach: number
    section: number
    slope: number
    lowerY: number
    style: PergolaNode['braceStyle']
    shoulder: number
    curve: number
  }
}
export const SLAT_WIDTH = 0.045
export const SLAT_HEIGHT = 0.035

export function archCrownAt(style: PergolaNode['archStyle'], u: number): number {
  const distance = Math.min(1, Math.max(0, Math.abs(u)))
  return style === 'rounded'
    ? Math.sqrt(1 - distance * distance)
    : style === 'pointed'
      ? 1 - distance
      : 1 - distance * distance
}

export function pergolaArchMode(n: PergolaNode): NonNullable<PergolaNode['archMode']> {
  return n.archMode ?? (n.roofForm === 'gable' && (n.gableArch ?? true) ? 'both' : 'none')
}

export function roofElevation(
  form: 'gable' | 'curved',
  x: number,
  leftX: number,
  rightX: number,
  rise: number,
): number {
  if (x <= leftX || x >= rightX) return 0
  const u = (x - leftX) / (rightX - leftX)
  return form === 'gable'
    ? rise * (1 - Math.abs(2 * u - 1))
    : rise * Math.sin(Math.PI * u) ** 2
}

function roofSlope(
  form: 'gable' | 'curved',
  x: number,
  leftX: number,
  rightX: number,
  rise: number,
): number {
  if (x <= leftX || x >= rightX) return 0
  const span = rightX - leftX
  const u = (x - leftX) / span
  return form === 'gable'
    ? (u < 0.5 ? 2 * rise / span : -2 * rise / span)
    : (Math.PI * rise / span) * Math.sin(2 * Math.PI * u)
}

export function pergolaRoofLayout(n: PergolaNode): NonNullable<PergolaNode['roofLayout']> {
  return n.roofLayout ?? (n.shadeSlats ? 'slatted' : 'rafters')
}

function roofCrossSection(n: PergolaNode) {
  const layout = pergolaRoofLayout(n)
  return layout === 'grid'
    ? { width: n.gridCrossWidth ?? 0.09, height: n.gridCrossHeight ?? 0.1, spacing: n.gridCrossSpacing ?? 0.55 }
    : { width: n.slatWidth ?? SLAT_WIDTH, height: n.slatHeight ?? SLAT_HEIGHT, spacing: n.slatSpacing ?? 0.18 }
}

export function postRadiusAt(n: PergolaNode, height: number, y: number): number {
  const t = Math.min(1, Math.max(0, y / height))
  const taper = n.postStyle === 'tapered' ? (n.postTaper ?? 0.24) : 0
  const profile = n.postStyle === 'round' || n.postStyle === 'tapered'
    ? n.postShaftProfile
    : 'straight'
  const curve = profile === 'bulged'
    ? (n.postBulge ?? 0.12) * Math.sin(Math.PI * t)
    : profile === 'hourglass'
      ? -(n.postBulge ?? 0.12) * Math.sin(Math.PI * t)
      : 0
  return n.postSize * Math.max(0.4, 1 - taper * t + curve) / 2
}

export function pergolaBaseHeight(n: PergolaNode): number {
  return n.postBaseStyle === 'none' ? 0 : (n.postBaseHeight ?? 0.18)
}

function pergolaPostHeights(n: PergolaNode): [number, number] {
  return [n.height, n.roofForm === 'single-slope' ? (n.backHeight ?? n.height) : n.height]
}

function pergolaBaseFootprintWidth(n: PergolaNode): number {
  if (n.postBaseStyle === 'none') return 0
  const width = Math.max(n.postBaseWidth ?? 0.25, n.postSize * 1.1)
  if (n.postBaseStyle === 'panelled-pedestal') return width * 1.03
  if (n.postBaseStyle === 'round-rings' || n.postBaseStyle === 'round-plinth') {
    const neck = Math.max(
      postRadiusAt(n, n.height, pergolaBaseHeight(n)),
      postRadiusAt(n, pergolaPostHeights(n)[1], pergolaBaseHeight(n)),
    ) * 2.08 * (n.postStyle === 'square' ? Math.SQRT2 : 1)
    return Math.max(width, neck * 1.05 * 1.05)
  }
  return width
}

function postContactRadius(n: PergolaNode, height: number, y: number, section: number) {
  const radius = postRadiusAt(n, height, y)
  const transverse = Math.min(section / 2, radius)
  if (n.postStyle === 'tapered') {
    return Math.max(0, radius - transverse)
  }
  if (n.postStyle === 'round') return Math.sqrt(Math.max(0, radius * radius - transverse * transverse))
  if (n.postStyle === 'chamfered') return radius - transverse * (Math.SQRT2 - 1)
  return radius
}

/** Include both ends, with actual spacing never exceeding the requested spacing. */
export function spacedCenters(span: number, maximumSpacing: number): number[] {
  const intervals = Math.max(1, Math.ceil(span / maximumSpacing))
  return Array.from(
    { length: intervals + 1 },
    (_, i) => -span / 2 + (span * i) / intervals,
  )
}

function crossMemberCenters(span: number, spacing: number, width: number, centered: boolean): number[] {
  const maximumIntervals = Math.max(1, Math.floor(span / (width + 0.01)))
  let intervals = Math.min(Math.ceil(span / spacing), maximumIntervals)
  if (centered && intervals % 2 !== 0)
    intervals += intervals < maximumIntervals ? 1 : -1
  intervals = Math.max(1, intervals)
  return Array.from(
    { length: intervals + 1 },
    (_, i) => -span / 2 + (span * i) / intervals,
  )
}

export function pergolaPostPositions(n: PergolaNode) {
  const halfX = (n.width - n.postSize) / 2
  const halfZ = (n.depth - n.postSize) / 2
  return {
    leftX: -halfX + (n.leftPostInset ?? 0),
    rightX: halfX - (n.rightPostInset ?? 0),
    frontZ: -halfZ + (n.frontPostInset ?? 0),
    backZ: halfZ - (n.backPostInset ?? 0),
  }
}

export function pergolaRoofLine(n: PergolaNode) {
  const { frontZ, backZ } = pergolaPostPositions(n)
  const gradient = n.roofForm === 'single-slope'
    ? ((n.backHeight ?? n.height) - n.height) / (backZ - frontZ)
    : 0
  return {
    gradient,
    angle: -Math.atan(gradient),
    heightAt: (z: number) => n.height + gradient * (z - frontZ),
  }
}

export function pergolaDimensions(n: PergolaNode): [number, number, number] {
  const roofDepth = n.depth + (n.endOverhang ?? n.overhang) * 2
  const roofWidth = n.width + (n.sideOverhang ?? n.overhang) * 2
  const layout = pergolaRoofLayout(n)
  const cross = roofCrossSection(n)
  const rotatedCrossMargin = (n.roofForm === 'gable' || n.roofForm === 'curved') &&
    layout !== 'rafters' ? cross.height : 0
  const { heightAt } = pergolaRoofLine(n)
  const { leftX, rightX, frontZ, backZ } = pergolaPostPositions(n)
  const detail = validPostDetailStyle(n)
  const detailWidth =
    n.postSize *
    {
      plain: 1,
      'boxed-base': 1,
      'twin-bands': 1.25,
      'faceted-base': 1,
      crown: 1.55,
      ringed: 1.3,
      pedestal: 1,
      'flared-base': 1,
      'stepped-cap': 1.5,
    }[detail]
  const baseWidth = pergolaBaseFootprintWidth(n)
  const shaftWidth = Math.max(
    ...pergolaPostHeights(n).flatMap((height) =>
      [0, 0.25, 0.5, 0.75, 1].map((t) => postRadiusAt(n, height, height * t) * 2),
    ),
  )
  const shaftUpperBound = n.postShaftProfile === 'bulged' &&
    (n.postStyle === 'round' || n.postStyle === 'tapered')
    ? n.postSize * (1 + (n.postBulge ?? 0.12))
    : n.postSize
  const supportWidth = Math.max(detailWidth, baseWidth, shaftWidth, shaftUpperBound)
  const archDepth = pergolaArchMode(n) === 'none' ? 0 : (n.archDepth ?? 0.16)
  return [
    Math.max(
      roofWidth + rotatedCrossMargin,
      2 * Math.max(Math.abs(leftX), Math.abs(rightX)) + supportWidth,
    ),
    Math.max(heightAt(-roofDepth / 2), heightAt(roofDepth / 2)) +
      n.beamHeight +
      ((n.roofForm === 'gable' || n.roofForm === 'curved') ? (n.roofRise ?? DEFAULT_ROOF_RISE) : 0) +
      n.rafterHeight +
      (layout === 'rafters' ? 0 : cross.height),
    Math.max(
      roofDepth,
      2 * Math.max(Math.abs(frontZ), Math.abs(backZ)) + Math.max(supportWidth, archDepth),
    ),
  ]
}

export function pergolaLayout(
  n: PergolaNode,
  supportOffsetAt?: (x: number, z: number) => number,
): Member[] {
  const roofWidth = n.width + (n.sideOverhang ?? n.overhang) * 2
  const roofDepth = n.depth + (n.endOverhang ?? n.overhang) * 2
  const { leftX, rightX, frontZ, backZ } = pergolaPostPositions(n)
  const { gradient, angle, heightAt } = pergolaRoofLine(n)
  const slopeFactor = Math.sqrt(1 + gradient * gradient)
  const roofLayout = pergolaRoofLayout(n)
  const cross = roofCrossSection(n)
  const raftersOnTop = roofLayout === 'grid' && n.gridTopLayer === 'rafters'
  const rafterLift = raftersOnTop ? cross.height : 0
  const detail = validPostDetailStyle(n)
  const members: Member[] = []
  const add = (
    role: MemberRole,
    position: Member['position'],
    size: Member['size'],
    rotation?: Member['rotation'],
    shape?: Member['shape'],
    brace?: Member['brace'],
    roofProfile?: Member['roofProfile'],
    arch?: Member['arch'],
    trussStrut?: Member['trussStrut'],
  ) => members.push({ role, position, size, rotation, shape, brace, roofProfile, arch, trussStrut,
    endCut: (role === 'rafters' || role === 'slats') &&
      n.memberEndStyle !== 'square' && !brace && !arch && !trussStrut
      ? { axis: role === 'rafters' && n.roofForm !== 'gable' && n.roofForm !== 'curved' ? 'z' : 'x',
          style: n.memberEndStyle, depth: n.memberEndCut ?? 0.04 }
      : undefined })

  const addPostBase = (x: number, z: number, groundOffset: number) => {
    const style = n.postBaseStyle ?? 'square-plinth'
    if (style === 'none') return
    const width = Math.max(n.postBaseWidth ?? 0.25, n.postSize * 1.1)
    const height = n.postBaseHeight ?? 0.18
    const shaftDiameter = Math.max(
      postRadiusAt(n, n.height, height),
      postRadiusAt(n, pergolaPostHeights(n)[1], height),
    ) * 2
    const neckWidth = shaftDiameter * 1.04
    if (style === 'simple-square') {
      add('feet', [x, groundOffset + height / 2, z], [width, height, width])
    } else if (style === 'square-plinth' || style === 'steel-shoe') {
      add('feet', [x, groundOffset + height * 0.175, z], [width, height * 0.35, width])
      const topWidth = Math.max(width * 0.84, neckWidth)
      add('feet', [x, groundOffset + height * 0.675, z], [topWidth, height * 0.65, topWidth])
    } else if (style === 'stepped-square' || style === 'stepped-plinth') {
      for (let tier = 0; tier < 3; tier++) {
        const tierHeight = height / 3
        const tierWidth = Math.max(width * (1 - tier * 0.16), neckWidth)
        add('feet', [x, groundOffset + (tier + 0.5) * tierHeight, z], [tierWidth, tierHeight, tierWidth])
      }
    } else if (style === 'round-rings' || style === 'round-plinth') {
      const topWidth = Math.max(
        width * 0.72,
        n.postStyle === 'square' ? neckWidth * Math.SQRT2 : neckWidth,
      )
      const bandWidth = Math.max(width * 0.92, topWidth * 1.05)
      const plinthWidth = Math.max(width, bandWidth * 1.05)
      add('feet', [x, groundOffset + height * 0.22, z], [plinthWidth, height * 0.44, plinthWidth])
      add('feet', [x, groundOffset + height * 0.6, z], [bandWidth, height * 0.32, bandWidth], undefined, 'round')
      add('feet', [x, groundOffset + height * 0.88, z], [topWidth, height * 0.24, topWidth], undefined, 'round')
    } else {
      add('feet', [x, groundOffset + height / 2, z], [width, height, width])
      for (const side of [-1, 1]) {
        add('feet', [x + side * width * 0.505, groundOffset + height * 0.5, z], [width * 0.025, height * 0.44, width * 0.38])
        add('feet', [x, groundOffset + height * 0.5, z + side * width * 0.505], [width * 0.38, height * 0.44, width * 0.025])
      }
    }
  }

  for (const x of [leftX, rightX]) {
    for (const z of [frontZ, backZ]) {
      const groundOffset = supportOffsetAt?.(x, z) ?? 0
      const height = heightAt(z)
      const baseTop = pergolaBaseHeight(n)
      const shaftBottom = groundOffset + (baseTop === 0 ? 0 : baseTop - 0.001)
      // Keep the roof-to-post joint fixed as the terrain changes. Extremely
      // steep ground may shorten the post, but must never push the roof up.
      const postTop = height
      add(
        'posts',
        [x, (postTop + shaftBottom) / 2, z],
        [n.postSize, postTop - shaftBottom, n.postSize],
        undefined,
        n.postStyle,
      )
      addPostBase(x, z, groundOffset)
      add('trim', [x, height - 0.04, z], [n.postSize, 0.08, n.postSize])
      if (detail === 'twin-bands')
        for (const y of [groundOffset + baseTop + 0.1, groundOffset + baseTop + 0.19, height - 0.2])
          add('trim', [x, y, z], [n.postSize * 1.25, 0.035, n.postSize * 1.25])
      if (detail === 'crown')
        add(
          'trim',
          [x, height - 0.095, z],
          [n.postSize * 1.55, 0.19, n.postSize * 1.55],
          undefined,
          'chamfered',
        )
      if (detail === 'ringed')
        for (const y of [groundOffset + baseTop + 0.08, groundOffset + baseTop + 0.18, height - 0.2, height - 0.12])
          add(
            'trim',
            [x, y, z],
            [n.postSize * 1.3, 0.035, n.postSize * 1.3],
            undefined,
            'round',
          )
      if (detail === 'stepped-cap')
        for (const [offset, factor, sectionHeight] of [
          [0.2, 1.25, 0.08],
          [0.11, 1.5, 0.1],
        ] as const)
          add(
            'trim',
            [x, height - offset, z],
            [n.postSize * factor, sectionHeight, n.postSize * factor],
          )
      if (n.braces) {
        const section = n.braceThickness ?? 0.08
        const drop = n.braceDrop ?? 0.55
        for (const axis of ['x', 'z'] as const) {
          const inward: -1 | 1 =
            axis === 'x' ? (x === leftX ? 1 : -1) : z === frontZ ? 1 : -1
          const reach = Math.min(
            n.braceReach ?? 0.55,
            (axis === 'x' ? rightX - leftX : backZ - frontZ) / 2 - n.postSize / 2,
          )
          const shoulder = Math.min(section * 1.4, reach * 0.28, drop * 0.55)
          const contact = postContactRadius(n, height, height - drop + shoulder, section)
          const start = (axis === 'x' ? x : z) + inward * (contact - Math.min(0.012, contact * 0.3))
          const curvedElevation = axis === 'x' && n.roofForm === 'curved'
            ? roofElevation('curved', start, leftX, rightX, n.roofRise ?? DEFAULT_ROOF_RISE)
            : 0
          const anchorY = axis === 'x' ? height + curvedElevation : heightAt(start)
          const lowerY = height - drop - anchorY
          const braceSlope = axis === 'z'
            ? gradient * inward
            : n.roofForm === 'curved'
              ? (roofElevation('curved', start + inward * reach, leftX, rightX, n.roofRise ?? DEFAULT_ROOF_RISE) - curvedElevation) / reach
              : 0
          add(
            'braces',
            axis === 'x' ? [start, anchorY, z] : [x, anchorY, start],
            [section, reach, section],
            undefined,
            undefined,
            {
              axis,
              inward,
              reach,
              section,
              slope: braceSlope,
              lowerY,
              style: n.braceStyle ?? 'diagonal',
              shoulder,
              curve: n.braceCurve ?? 0.55,
            },
          )
        }
      }
    }
  }
  if (n.sideScreens !== 'none') {
    const screenSides = n.sideScreens === 'both'
      ? [leftX, rightX]
      : [n.sideScreens === 'left' ? leftX : rightX]
    const inset = n.postSize / 2 + 0.025
    const startZ = frontZ + inset
    const endZ = backZ - inset
    const span = endZ - startZ
    const rail = 0.055
    const topY = Math.min(heightAt(frontZ), heightAt(backZ)) - 0.12
    const bottomY = Math.max(0.12, topY - (n.screenHeight ?? 1.5))
    const panelHeight = topY - bottomY
    const thickness = 0.045
    if (span > 0.2 && panelHeight > 0.2) {
      for (const x of screenSides) {
        for (const y of [bottomY + rail / 2, topY - rail / 2])
          add('screens', [x, y, (startZ + endZ) / 2], [thickness, rail, span])
        for (const z of [startZ + rail / 2, endZ - rail / 2])
          add('screens', [x, (bottomY + topY) / 2, z], [thickness, panelHeight, rail])
        const innerStart = startZ + rail
        const innerEnd = endZ - rail
        const innerSpan = innerEnd - innerStart
        const innerHeight = panelHeight - rail * 2
        if (innerSpan <= 0 || innerHeight <= 0) continue
        if (n.screenStyle === 'solid') {
          add('screens', [x, (bottomY + topY) / 2, (innerStart + innerEnd) / 2],
            [thickness * 0.65, innerHeight, innerSpan])
        } else if (n.screenStyle === 'vertical-slats') {
          const slat = n.screenSlatWidth ?? 0.09
          const count = Math.max(1, Math.floor((innerSpan + (n.screenSlatGap ?? 0.055)) / (slat + (n.screenSlatGap ?? 0.055))))
          const spacing = innerSpan / count
          for (let i = 0; i < count; i++)
            add('screens', [x, (bottomY + topY) / 2, innerStart + spacing * (i + 0.5)],
              [thickness * 0.7, innerHeight, Math.min(slat, spacing * 0.9)])
        } else {
          const slat = n.screenSlatWidth ?? 0.09
          const count = Math.max(1, Math.floor((innerHeight + (n.screenSlatGap ?? 0.055)) / (slat + (n.screenSlatGap ?? 0.055))))
          const spacing = innerHeight / count
          for (let i = 0; i < count; i++)
            add('screens', [x, bottomY + rail + spacing * (i + 0.5), (innerStart + innerEnd) / 2],
              [thickness * 0.7, Math.min(slat, spacing * 0.9), innerSpan])
        }
      }
    }
  }
  for (const z of [frontZ, backZ]) {
    if (n.roofForm === 'curved' || n.roofForm === 'gable') {
      const rise = n.roofRise ?? DEFAULT_ROOF_RISE
      add('beams', [0, n.height + n.beamHeight / 2 + rise / 2, z],
        [roofWidth, n.beamHeight, n.beamWidth], undefined, undefined, undefined,
        { form: n.roofForm, leftX, rightX, rise })
    } else {
      add('beams', [0, heightAt(z) + n.beamHeight / 2, z],
        [roofWidth, n.beamHeight, n.beamWidth])
    }
    const archMode = pergolaArchMode(n)
    if (archMode === 'both' ||
      (archMode === 'front' && z === frontZ) ||
      (archMode === 'back' && z === backZ)) {
      const span = rightX - leftX
      add('arches', [(leftX + rightX) / 2, heightAt(z), z],
        [span, n.gableArchDrop ?? DEFAULT_ARCH_DROP, n.archDepth ?? 0.16],
        undefined, undefined, undefined,
        undefined,
        {
          span,
          drop: n.gableArchDrop ?? DEFAULT_ARCH_DROP,
          curve: n.gableArchCurve ?? DEFAULT_ARCH_RISE,
          style: n.archStyle ?? 'segmental',
          roofRise: n.roofRise ?? DEFAULT_ROOF_RISE,
          leftX,
          rightX,
          roofForm: n.roofForm,
        })
      if (n.roofForm === 'gable') {
        const rise = n.roofRise ?? DEFAULT_ROOF_RISE
        const archRise = n.gableArchCurve ?? DEFAULT_ARCH_RISE
        const midX = (leftX + rightX) / 2
        const kingHeight = rise - archRise
        if (kingHeight > 0.02)
          add('beams', [midX, n.height + archRise + kingHeight / 2, z],
            [n.postSize * 0.65, kingHeight, (n.archDepth ?? 0.16) * 0.7])
        for (const side of [-1, 1]) {
          const lowerX = midX + side * span * 0.25
          const upperX = midX + side * span * 0.18
          const lowerY = n.height + archRise * archCrownAt(n.archStyle ?? 'segmental', 0.5)
          const upperY = n.height + roofElevation('gable', upperX, leftX, rightX, rise)
          const deltaX = upperX - lowerX
          const deltaY = upperY - lowerY
          if (deltaY <= 0.04) continue
          const centerX = (lowerX + upperX) / 2
          const centerY = (lowerY + upperY) / 2
          const strutWidth = n.beamWidth * 0.6
          const strutDepth = Math.min(n.beamWidth, n.archDepth ?? 0.16) * 0.8
          add('beams', [centerX, centerY, z],
            [strutWidth, Math.hypot(deltaX, deltaY), strutDepth],
            undefined, undefined, undefined, undefined, undefined,
            {
              lower: [lowerX - centerX, lowerY - centerY],
              upper: [upperX - centerX, upperY - centerY],
              width: strutWidth,
              depth: strutDepth,
              baseY: n.height,
              leftX,
              rightX,
              roofRise: rise,
              archRise,
              archStyle: n.archStyle ?? 'segmental',
            })
        }
      }
    }
  }
  for (const x of [leftX, rightX]) {
    add(
      'beams',
      [
        x,
        heightAt((frontZ + backZ) / 2) + n.beamHeight / 2,
        (frontZ + backZ) / 2,
      ],
      [
        n.beamWidth,
        n.beamHeight,
        (backZ - frontZ) * slopeFactor - n.beamHeight * Math.abs(gradient),
      ],
      [angle, 0, 0],
    )
  }
  if (n.roofForm === 'gable' || n.roofForm === 'curved') {
    const form = n.roofForm
    const rise = n.roofRise ?? DEFAULT_ROOF_RISE
    const eaveY = n.height + n.beamHeight + n.rafterHeight / 2 + rafterLift
    const roofHeightAt = (x: number) => roofElevation(form, x, leftX, rightX, rise)
    const roofAngleAt = (x: number) => Math.atan(roofSlope(form, x, leftX, rightX, rise))

    // The ridge supports the paired gable rafters or the crown of the curved roof.
    add('beams', [(leftX + rightX) / 2, n.height + n.beamHeight + rise - n.beamHeight / 2, 0],
      [n.beamWidth, n.beamHeight, roofDepth])
    for (const z of spacedCenters(roofDepth - n.rafterWidth, n.rafterSpacing)) {
      add('rafters', [0, eaveY + rise / 2, z],
        [roofWidth, n.rafterHeight, n.rafterWidth], undefined, undefined, undefined,
        { form, leftX, rightX, rise })
    }
    if (roofLayout !== 'rafters') {
      const centers = crossMemberCenters(
        roofWidth - cross.width,
        cross.spacing,
        cross.width,
        roofLayout === 'grid',
      )
      for (const x of centers) {
        const crossY = n.height + n.beamHeight + roofHeightAt(x) +
          (raftersOnTop ? cross.height / 2 : n.rafterHeight + cross.height / 2)
        add('slats', [x, crossY, 0],
          [cross.width, cross.height, roofDepth], [0, 0, roofAngleAt(x)])
      }
    }
  } else {
    for (const x of spacedCenters(roofWidth - n.rafterWidth, n.rafterSpacing)) {
      add(
        'rafters',
        [x, heightAt(0) + n.beamHeight + n.rafterHeight / 2 + rafterLift, 0],
        [
          n.rafterWidth,
          n.rafterHeight,
          roofDepth * slopeFactor - n.rafterHeight * Math.abs(gradient),
        ],
        [angle, 0, 0],
      )
    }
    if (roofLayout !== 'rafters') {
      const slatFootprint =
        cross.width / slopeFactor +
        (cross.height * Math.abs(gradient)) / slopeFactor
      for (const z of crossMemberCenters(
        roofDepth - slatFootprint,
        cross.spacing,
        slatFootprint,
        roofLayout === 'grid',
      )) {
        add(
          'slats',
          [0, heightAt(z) + n.beamHeight +
            (raftersOnTop ? cross.height / 2 : n.rafterHeight + cross.height / 2), z],
          [roofWidth, cross.height, cross.width],
          [angle, 0, 0],
        )
      }
    }
  }
  return members
}
