'use client'
import PondPanel from './pond/panel'
import { IrrigationPanel } from './irrigation/panel'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ActionButton, PanelSection, SegmentedControl, SliderControl, useEditor } from '@pascal-app/editor'
import { type AnyNode, type ItemNode, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { PergolaPanel } from './pergola/editor/panel'
import TreePanel from './tree/editor/panel'
import PlantPanel from './plant/editor/panel'
import { PLANT_CATEGORIES, PLANT_PRESETS, PLANT_PRESET_BY_KEY } from './plant/domain/catalog'
import { FAB_PLANT_THUMBNAILS } from './plant/domain/thumbnails'
import { TREE_SPECIES, TREE_SPECIES_BY_KEY, treeControls } from './tree/domain/species'
import { PathwayPanel } from './pathways/editor/panel'
import { GroundAccessPanel } from './ground-access/panel'
import GroundAreaPanel from './ground-areas/editor/panel'
import { GROUND_AREA_KIND } from './ground-areas/domain/schema'
import { GROUND_SURFACE_THUMBNAILS, LANDSCAPE_CATALOG_THUMBNAILS, TREE_SPECIES_THUMBNAILS } from './editor/catalog-thumbnails'
import { catalogMatches, levelDescendants } from './editor/scene-inventory'
import { LandscapeObjectsPanel, selectLandscapeObjects } from './editor/objects-panel'
import { useCatalogPreferences } from './editor/catalog-preferences'
import { PathwayGradePanel } from './pathways/editor/grade-panel'
import { PlantingLayoutPanel } from './editor/planting-layout-panel'
import { PlantingDocumentationPanel } from './editor/planting-documentation-panel'
import { DesignChecksPanel } from './editor/design-checks-panel'
import { QuantityPanel } from './editor/quantity-panel'
import type { GroundSurface } from './ground-areas/domain/schema'

type Menu = 'pond' | 'root' | 'pergola' | 'pathway' | 'patio' | 'deck' | 'concrete-slab' | 'landing' | 'edging' | 'retaining-wall' | 'tree' | 'plant'
type Target = 'irrigation-head' | 'ground-area' | Exclude<Menu, 'root'>
type CatalogItem = { label: string; target: Target; species?: string }
type CatalogGroup = { title: string; items: CatalogItem[] }
type LayoutTab = 'layout' | 'planting' | 'review'
type SceneGroup = 'Structures' | 'Surfaces' | 'Pathways' | 'Plants' | 'Irrigation'
type SceneRow = { key: string; label: string; detail: string; thumbnail: string; nodes: AnyNode[]; target: Target; species?: string }

const catalog: CatalogGroup[] = [
  { title: 'Plants', items: TREE_SPECIES.map((species) => ({ label: species.name, target: 'tree', species: species.key })) },
  ...PLANT_CATEGORIES.map((category) => ({ title: category, items: PLANT_PRESETS.filter((plant) => plant.category === category)
    .map((plant) => ({ label: plant.name, target: 'plant' as const, species: plant.key })) })),
  { title: 'Site', items: [{ label: 'Ground areas', target: 'ground-area' }, { label: 'Pond', target: 'pond' }] },
  { title: 'Pathways', items: [{ label: 'Walkways', target: 'pathway' }] },
  { title: 'Structures', items: [
    { label: 'Pergola', target: 'pergola' }, { label: 'Deck', target: 'deck' },
    { label: 'Patio', target: 'patio' }, { label: 'Landing', target: 'landing' },
    { label: 'Concrete slab', target: 'concrete-slab' }, { label: 'Edging', target: 'edging' },
    { label: 'Retaining wall', target: 'retaining-wall' },
  ] },
]

const TABS: { id: LayoutTab; label: string; number: string }[] = [
  { id: 'layout', label: 'Layout', number: '1' },
  { id: 'planting', label: 'Planting', number: '2' },
  { id: 'review', label: 'Review', number: '3' },
]

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.2 4.2" /></svg>
}

function CatalogThumb({ item, size = 36 }: { item: CatalogItem; size?: number }) {
  const treeThumbnail = item.target === 'tree' && item.species ? TREE_SPECIES_THUMBNAILS[item.species] : undefined
  return <img src={treeThumbnail ?? (item.target === 'plant' && item.species ? FAB_PLANT_THUMBNAILS[item.species] ?? LANDSCAPE_CATALOG_THUMBNAILS.plant : LANDSCAPE_CATALOG_THUMBNAILS[item.target as keyof typeof LANDSCAPE_CATALOG_THUMBNAILS])} alt="" aria-hidden="true"
    width={size} height={size} style={{ width: size, height: size, flex: `0 0 ${size}px`,
      objectFit: 'contain', borderRadius: 5, border: '1px solid color-mix(in srgb, var(--foreground) 13%, transparent)' }} />
}

function formatDetail(node: AnyNode) {
  if ((node.type as string) === 'landscape:tree') return 'Tree'
  if ((node.type as string) === 'landscape:plant') return PLANT_PRESET_BY_KEY[(node as AnyNode & { preset?: string }).preset ?? '']?.category ?? 'Plant'
  const raw = node as AnyNode & { width?: number; depth?: number; vertices?: unknown[]; edges?: unknown[] }
  if (Array.isArray(raw.edges)) return `${raw.edges.length} ${raw.edges.length === 1 ? 'segment' : 'segments'}`
  if (typeof raw.width === 'number' && typeof raw.depth === 'number') return `${raw.width.toFixed(1)} m × ${raw.depth.toFixed(1)} m`
  return 'Landscape element'
}

function sceneRows(nodes: AnyNode[], group: SceneGroup): SceneRow[] {
  const buckets = new Map<string, SceneRow>()
  for (const node of nodes) {
    const type = node.type as string
    const metadata = (node as AnyNode & { metadata?: Record<string, unknown> }).metadata
    let definition: { group: SceneGroup; key: string; label: string; target: Target; thumbnail: string; species?: string } | null = null
    if (type === 'landscape:pergola' && group === 'Structures') definition = { group, key: type, label: 'Pergola', target: 'pergola', thumbnail: LANDSCAPE_CATALOG_THUMBNAILS.pergola }
    else if (type === 'landscape:tree' && group === 'Plants') {
      const species = (node as AnyNode & { species?: string }).species ?? 'whiteOak'
      definition = { group, key: `${type}:${species}`, label: TREE_SPECIES_BY_KEY[species]?.name ?? 'Tree',
        target: 'tree', species, thumbnail: TREE_SPECIES_THUMBNAILS[species] ?? LANDSCAPE_CATALOG_THUMBNAILS.tree }
    }
    else if (type === 'landscape:plant' && group === 'Plants') {
      const preset = (node as AnyNode & { preset?: string }).preset ?? ''
      definition = { group, key: `${type}:${preset}`, label: PLANT_PRESET_BY_KEY[preset]?.name ?? 'Plant',
        target: 'plant', species: preset, thumbnail: FAB_PLANT_THUMBNAILS[preset] ?? LANDSCAPE_CATALOG_THUMBNAILS.plant }
    }
    else if (type === 'landscape:pond' && group === 'Surfaces') definition = { group, key: type, label: 'Pond', target: 'pond', thumbnail: LANDSCAPE_CATALOG_THUMBNAILS.pond }
    else if (type === 'landscape:deck' && group === 'Structures') definition = { group, key: type, label: 'Deck', target: 'deck', thumbnail: LANDSCAPE_CATALOG_THUMBNAILS.deck }
    else if (type === 'wall' && metadata?.landscapeRetainingWall === true && group === 'Structures') definition = { group, key: 'landscape:retaining-wall', label: 'Retaining wall', target: 'retaining-wall', thumbnail: LANDSCAPE_CATALOG_THUMBNAILS['retaining-wall'] }
    else if (type === 'landscape:ground-area' && group === 'Surfaces') {
      const surface = (node as AnyNode & { surface?: string }).surface ?? 'grass'
      const inventorySurface = surface === 'grass2' ? 'grass' : surface
      const label = inventorySurface.charAt(0).toUpperCase() + inventorySurface.slice(1)
      definition = { group, key: `${type}:${inventorySurface}`, label, target: 'ground-area',
        thumbnail: GROUND_SURFACE_THUMBNAILS[inventorySurface as keyof typeof GROUND_SURFACE_THUMBNAILS] ?? LANDSCAPE_CATALOG_THUMBNAILS['ground-area'] }
    } else if (type === 'landscape:pathway' && group === 'Pathways') {
      definition = { group, key: type, label: 'Walkways', target: 'pathway', thumbnail: LANDSCAPE_CATALOG_THUMBNAILS.pathway }
    } else if (group === 'Structures') {
      const structures: Record<string, { label: string; target: Target }> = {
        'landscape:patio': { label: 'Patio', target: 'patio' },
        'landscape:concrete-slab': { label: 'Concrete slab', target: 'concrete-slab' },
        'landscape:landing': { label: 'Landing', target: 'landing' },
        'landscape:edging': { label: 'Edging', target: 'edging' },
      }
      const structure = structures[type]
      if (structure) definition = { group, key: type, ...structure, thumbnail: LANDSCAPE_CATALOG_THUMBNAILS[structure.target as keyof typeof LANDSCAPE_CATALOG_THUMBNAILS] }
    }
    if (!definition) continue
    const row = buckets.get(definition.key) ?? { key: definition.key, label: definition.label,
      detail: formatDetail(node), thumbnail: definition.thumbnail, nodes: [], target: definition.target, species: definition.species }
    row.nodes.push(node)
    buckets.set(definition.key, row)
  }
  return [...buckets.values()].sort((a, b) => a.label.localeCompare(b.label))
}

function inventoryRows(group: SceneGroup, placed: SceneRow[]): SceneRow[] {
  const structures: SceneRow[] = [
    ['pergola', 'Pergola'], ['deck', 'Deck'], ['patio', 'Patio'], ['landing', 'Landing'],
    ['concrete-slab', 'Concrete slab'], ['edging', 'Edging'], ['retaining-wall', 'Retaining wall'],
  ].map(([target, label]) => ({ key: target === 'retaining-wall' ? 'landscape:retaining-wall' : `landscape:${target}`,
    label: String(label || target || 'Landscape'), target: String(target) as Target, thumbnail: LANDSCAPE_CATALOG_THUMBNAILS[target as keyof typeof LANDSCAPE_CATALOG_THUMBNAILS] ?? LANDSCAPE_CATALOG_THUMBNAILS['ground-area'], detail: 'Landscape structure', nodes: [] }))
  const surfaces: SceneRow[] = (Object.keys(GROUND_SURFACE_THUMBNAILS) as (keyof typeof GROUND_SURFACE_THUMBNAILS)[])
    .filter((surface) => surface !== 'grass2')
    .map((surface) => ({ key: `landscape:ground-area:${surface}`, label: surface.charAt(0).toUpperCase() + surface.slice(1),
      target: 'ground-area' as const, thumbnail: GROUND_SURFACE_THUMBNAILS[surface], detail: 'Ground cover', nodes: [] }))
  surfaces.push({ key: 'landscape:pond', label: 'Pond', target: 'pond', thumbnail: LANDSCAPE_CATALOG_THUMBNAILS.pond, detail: 'Garden water feature', nodes: [] })
  const pathways: SceneRow[] = [{ key: 'landscape:pathway', label: 'Walkways', target: 'pathway',
    thumbnail: LANDSCAPE_CATALOG_THUMBNAILS.pathway, detail: 'Connected pathways', nodes: [] }]
  const plants: SceneRow[] = [...TREE_SPECIES.map((species) => ({ key: `landscape:tree:${species.key}`,
    label: species.name, target: 'tree' as const, species: species.key,
    thumbnail: TREE_SPECIES_THUMBNAILS[species.key] ?? LANDSCAPE_CATALOG_THUMBNAILS.tree, detail: 'Tree', nodes: [] })),
    ...PLANT_PRESETS.map((plant) => ({ key: `landscape:plant:${plant.key}`, label: plant.name,
      target: 'plant' as const, species: plant.key, thumbnail: FAB_PLANT_THUMBNAILS[plant.key] ?? LANDSCAPE_CATALOG_THUMBNAILS.plant,
      detail: plant.category, nodes: [] }))]
  const defaults = group === 'Structures' ? structures : group === 'Surfaces' ? surfaces : group === 'Plants' ? plants : pathways
  const placedByKey = new Map(placed.map((row) => [row.key, row]))
  return defaults.map((row) => {
    const current = placedByKey.get(row.key)
    return current ? { ...row, detail: current.detail, nodes: current.nodes } : row
  })
}

function InventoryRow({ row, onAdd, placed = false }: { row: SceneRow; onAdd: (row: SceneRow) => void; placed?: boolean }) {
  const thumbnail = <img src={row.thumbnail} alt="" aria-hidden="true" width={42} height={42}
    style={{ width: 42, height: 42, flex: '0 0 42px', objectFit: 'contain', borderRadius: 6,
      border: '1px solid color-mix(in srgb, var(--foreground) 12%, transparent)' }} />
  return <div className="flex w-full items-center gap-1 rounded-md px-1 transition-colors hover:bg-accent/30">
    <button type="button" onClick={() => onAdd(row)}
    aria-label={`${placed ? 'Select' : 'Add'} ${row.label}`}
    className="flex min-w-0 flex-1 items-center gap-2.5 border-0 bg-transparent py-1.5 text-left text-foreground focus-visible:outline-2 focus-visible:outline-ring"
    style={{ background: 'transparent' }}>
    {thumbnail}
    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{row.label}</span>
      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{row.detail}</span></span>
    <span aria-label={`${row.nodes.length} placed`} className="min-w-7 rounded bg-secondary px-2 py-1 text-center text-xs font-medium">{row.nodes.length}</span>
    </button>
  </div>
}

function InventoryGridCard({ row, onAdd }: { row: SceneRow; onAdd: (row: SceneRow) => void }) {
  const transparentTree = row.target === 'tree' && Boolean(TREE_SPECIES_THUMBNAILS[row.species ?? ''])
  return <button type="button" onClick={() => onAdd(row)} aria-label={`Add ${row.label}`}
    className="group min-w-0 border-0 bg-transparent p-0 text-left text-foreground focus-visible:outline-2 focus-visible:outline-ring">
    <img src={row.thumbnail} alt="" aria-hidden="true" width={112} height={112}
      className={`aspect-square w-full rounded-md border border-border bg-secondary/30 transition-colors group-hover:bg-accent/30 ${transparentTree ? 'object-contain p-2' : 'object-cover'}`} />
    <span className="block truncate pt-1 text-[11px] font-medium leading-tight">{row.label}</span>
  </button>
}

export default function LandscapePanel() {
  const [menu, setMenu] = useState<Menu>('root')
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<LayoutTab>('layout')
  const [browser, setBrowser] = useState<'library' | 'objects' | 'tools' | 'watering'>('library')
  const [libraryView, setLibraryView] = useState<'grid' | 'list'>('grid')
  const [libraryCategory, setLibraryCategory] = useState<'all' | 'Structures' | 'Surfaces' | 'Pathways'>('all')
  const [catalogScope, setCatalogScope] = useState<'all' | 'used' | 'recent'>('all')
  const [thumbnailSize, setThumbnailSize] = useState(80)
  const [plantCategory, setPlantCategory] = useState('all')
  const [heightRange, setHeightRange] = useState('all')
  const preferences = useCatalogPreferences()
  const hasSelectedLevel = useViewer((state) => Boolean(state.selection.levelId))
  const activeLevelId = useViewer((state) => state.selection.levelId)
  const selection = useViewer((state) => state.selection.selectedIds)
  const activeTool = useEditor((state) => state.tool)
  const groundAreaDefaults = useEditor((state) => state.toolDefaults[GROUND_AREA_KIND])
  const plantDefaults = useEditor((state) => state.toolDefaults['landscape:plant'])
  const treeDefaults = useEditor((state) => state.toolDefaults['landscape:tree'])
  const nodes = useScene((state) => state.nodes)
  const content = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    content.current?.scrollTo({ top: 0 })
    heading.current?.focus({ preventScroll: true })
  }, [menu, tab])
  const back = () => {
    const editor = useEditor.getState()
    if (editor.tool?.startsWith('landscape:') || (menu === 'retaining-wall' && editor.tool === 'wall' &&
      (editor.toolDefaults.wall?.metadata as { landscapeRetainingWall?: boolean } | undefined)?.landscapeRetainingWall)) editor.setTool(null)
    setMenu('root')
  }
  const selectedNode = selection.length === 1 ? nodes[selection[0] as keyof typeof nodes] : undefined
  const selectedPlant = (selectedNode?.type as string) === 'landscape:plant' ? selectedNode as AnyNode & { preset: string } : null
  const selectedTree = (selectedNode?.type as string) === 'landscape:tree' ? selectedNode as AnyNode & { species: string } : null
  const plantKey = selectedPlant?.preset ?? String(plantDefaults?.preset ?? 'fab:oak')
  const treeKey = selectedTree?.species ?? String(treeDefaults?.species ?? 'whiteOak')
  const selectedProduct: CatalogItem | undefined = menu === 'plant'
    ? { target: 'plant', species: plantKey, label: PLANT_PRESET_BY_KEY[plantKey]?.name ?? 'Plant' }
    : menu === 'tree' ? { target: 'tree', species: treeKey, label: TREE_SPECIES_BY_KEY[treeKey]?.name ?? 'Tree' }
      : catalog.flatMap((group) => group.items).find((item) => item.target === menu)
  const menuTitle: Record<Menu, string> = {
    pond: 'Pond', root: 'Landscape', pergola: 'Pergola', pathway: 'Walkways',
    tree: 'Trees', plant: 'Plant',
    patio: 'Patio', deck: 'Deck', 'concrete-slab': 'Concrete slab', landing: 'Landing', edging: 'Edging', 'retaining-wall': 'Retaining wall',
  }
  const levelNodes = useMemo(() => levelDescendants(nodes, activeLevelId), [nodes, activeLevelId])
  const groups = useMemo(() => ({
    Irrigation: [{ key: 'landscape:irrigation-source', label: 'Water supplies', detail: 'Authored pressure and available flow', target: 'irrigation-head' as const, thumbnail: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 fill=%22%23262626%22/%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%2220%22 fill=%22%2326354a%22 stroke=%22%2360a5fa%22/%3E%3Cpath d=%22M32 32L44 20%22 stroke=%22%2360a5fa%22 stroke-width=%224%22/%3E%3C/svg%3E', nodes: levelNodes.filter(node => (node.type as string) === 'landscape:irrigation-source') }, { key: 'landscape:irrigation-head', label: 'Irrigation heads', detail: 'Authored watering outlets', target: 'irrigation-head' as const, thumbnail: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 fill=%22%23262626%22/%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%2223%22 fill=%22%231e3a5f%22 stroke=%22%2360a5fa%22 stroke-dasharray=%224 3%22/%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%226%22 fill=%22%2360a5fa%22/%3E%3C/svg%3E', nodes: levelNodes.filter((node) => (node.type as string) === 'landscape:irrigation-head') }, { key: 'landscape:irrigation-run', label: 'Irrigation runs', detail: 'Authored pipe centerlines', target: 'irrigation-head' as const, thumbnail: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 fill=%22%23262626%22/%3E%3Cpath d=%22M12 50V20H50%22 fill=%22none%22 stroke=%22%2360a5fa%22 stroke-width=%224%22 stroke-dasharray=%224 3%22/%3E%3C/svg%3E', nodes: levelNodes.filter((node) => (node.type as string) === 'landscape:irrigation-run') }, { key: 'landscape:irrigation-valve', label: 'Irrigation valves', detail: 'Authored zone valves', target: 'irrigation-head' as const, thumbnail: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 fill=%22%23262626%22/%3E%3Cpath d=%22M8 32H56M32 18V32%22 stroke=%22%2360a5fa%22 stroke-width=%224%22/%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%2210%22 fill=%22%2326354a%22 stroke=%22%2360a5fa%22/%3E%3C/svg%3E', nodes: levelNodes.filter((node) => (node.type as string) === 'landscape:irrigation-valve') }, { key: 'landscape:irrigation-controller', label: 'Irrigation controllers', detail: 'Authored daily station programs', target: 'irrigation-head' as const, thumbnail: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 fill=%22%23262626%22/%3E%3Crect x=%2215%22 y=%228%22 width=%2234%22 height=%2248%22 rx=%224%22 fill=%22%2326354a%22 stroke=%22%2360a5fa%22/%3E%3Crect x=%2221%22 y=%2216%22 width=%2222%22 height=%2210%22 fill=%22%2360a5fa%22/%3E%3C/svg%3E', nodes: levelNodes.filter((node) => (node.type as string) === 'landscape:irrigation-controller') }, { key: 'landscape:dripline', label: 'Driplines', detail: 'Authored emitter laterals', target: 'irrigation-head' as const, thumbnail: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 fill=%22%23262626%22/%3E%3Cpath d=%22M8 32H56%22 stroke=%22%2360a5fa%22 stroke-width=%223%22/%3E%3Cpath d=%22M12 25V39M24 25V39M36 25V39M48 25V39%22 stroke=%22%2360a5fa%22 stroke-width=%223%22/%3E%3C/svg%3E', nodes: levelNodes.filter((node) => (node.type as string) === 'landscape:dripline') }],
    Structures: inventoryRows('Structures', sceneRows(levelNodes, 'Structures')),
    Surfaces: inventoryRows('Surfaces', sceneRows(levelNodes, 'Surfaces')),
    Pathways: inventoryRows('Pathways', sceneRows(levelNodes, 'Pathways')),
    Plants: inventoryRows('Plants', sceneRows(levelNodes, 'Plants')),
  }), [levelNodes])
  const objectGroups = useMemo(() => {
    const outdoor = levelNodes.filter((node): node is ItemNode => node.type === 'item' &&
      (node as ItemNode).asset.category === 'outdoor')
    return [
      ...Object.values(groups).flat().filter(row => row.nodes.length > 0),
      ...(outdoor.length ? [{ key: 'outdoor-assets', label: 'Outdoor assets',
        thumbnail: outdoor[0]!.asset.thumbnail, nodes: outdoor }] : []),
    ]
  }, [groups, levelNodes])
  const reviewNodes = objectGroups.flatMap(row => row.nodes)
  const openProduct = (target: Target, row?: SceneRow | CatalogItem) => {
    if (target === 'irrigation-head') { setMenu('root'); setBrowser('watering'); return }
    preferences.remember(row && 'key' in row ? row.key : `landscape:${target}${row?.species ? ':' + row.species : ''}`)
    setMenu(target === 'ground-area' ? 'root' : target)
    const requestedSurface = target === 'ground-area'
      ? row && 'key' in row && row.key.startsWith('landscape:ground-area:')
        ? row.key.split(':').at(-1) as GroundSurface : 'grass'
      : null
    const editor = useEditor.getState()
    if (target === 'tree') {
      const species = row?.species ?? 'whiteOak'
      const current = editor.toolDefaults['landscape:tree']
      editor.setToolDefaults('landscape:tree', current?.species === species
        ? current : { ...current, species, controls: treeControls(species), lod: {} })
    }
    if (target === 'plant') {
      const preset = row?.species ?? 'fab:oak'
      editor.setToolDefaults('landscape:plant', { ...editor.toolDefaults['landscape:plant'], preset })
    }
    if (!hasSelectedLevel) return
    useViewer.getState().setSelection({ selectedIds: [] })
    if (target === 'patio' || target === 'deck' || target === 'concrete-slab' || target === 'landing' || target === 'edging') {
      const tool = `landscape:${target}`
      if (target !== 'edging' && !editor.toolDefaults[tool]?.shape) editor.setToolDefaults(tool, { ...editor.toolDefaults[tool], shape: 'rectangle' })
      editor.setMode('build'); editor.setTool(tool)
    } else if (target === 'pond') {
      const kind = 'landscape:pond'
      if (!editor.toolDefaults[kind]?.shape) editor.setToolDefaults(kind, { ...editor.toolDefaults[kind], shape: 'oval' })
      editor.setMode('build'); editor.setTool(kind)
    } else if (target === 'retaining-wall') {
      editor.setPhase('building')
      const metadata = editor.toolDefaults.wall?.metadata
      editor.setToolDefaults('wall', { ...editor.toolDefaults.wall,
        metadata: { ...(metadata && typeof metadata === 'object' ? metadata : {}), landscapeRetainingWall: true, roomBoundary: false },
        thickness: editor.toolDefaults['landscape:retaining-wall']?.depth ?? 0.25,
        height: editor.toolDefaults['landscape:retaining-wall']?.thickness ?? 0.9 })
      editor.armToolMode({ mode: 'build', tool: 'wall' })
    } else if (target === 'ground-area') {
      if (requestedSurface) editor.setToolDefaults('landscape:ground-area', {
        ...editor.toolDefaults['landscape:ground-area'], surface: requestedSurface, plantingBed: false,
      })
      editor.setMode('build'); editor.setTool('landscape:ground-area')
    } else if (target === 'pergola') {
      const kind = 'landscape:pergola'
      editor.setToolDefaults(kind, { ...editor.toolDefaults[kind], roofForm: editor.toolDefaults[kind]?.roofForm ?? 'flat' })
      editor.setMode('build'); editor.setTool(kind)
    } else if (target === 'tree') {
      editor.setPhase('building')
      editor.setMode('build'); editor.setTool('landscape:tree')
    } else if (target === 'plant') {
      editor.setPhase('building')
      editor.setMode('build'); editor.setTool('landscape:plant')
    }
  }
  const matchesPlant = (row: SceneRow) => {
    if (row.target !== 'plant' && row.target !== 'tree') return true
    const plant = PLANT_PRESET_BY_KEY[row.species ?? '']
    const rawHeight = row.target === 'tree' ? treeControls(row.species ?? 'whiteOak').height : plant?.height
    const height = typeof rawHeight === 'number' ? rawHeight : null
    return (plantCategory === 'all' || plantCategory === 'procedural' && row.target === 'tree' || plant?.category === plantCategory)
      && (heightRange === 'all' || height !== null && (heightRange === 'low' ? height < 1 : heightRange === 'medium' ? height >= 1 && height < 3 : height >= 3))
  }
  const matchesSearch = (row: SceneRow, group: string) => {
    const species = row.target === 'tree' ? TREE_SPECIES_BY_KEY[row.species ?? ''] : undefined
    return catalogMatches(row.label, `${group} ${row.detail} ${species?.latin ?? ''} ${species?.biome ?? ''}`, query)
  }
  const matchesScope = (row: SceneRow) => catalogScope === 'all' || catalogScope === 'used' && row.nodes.length > 0 || catalogScope === 'recent' && preferences.recent.includes(row.key)
  const catalogCard = (row: SceneRow) => <div key={row.key} className="relative min-w-0">
    <InventoryGridCard row={row} onAdd={(item) => openProduct(item.target, item)} />
  </div>
  const recentOrder = (rows: SceneRow[]) => [...rows].sort((a, b) => preferences.recent.indexOf(a.key) - preferences.recent.indexOf(b.key))
  const renderInventory = (names: SceneGroup[], placedOnly = false, layout: 'list' | 'grid' = 'list') => {
    const sections = !placedOnly && catalogScope === 'recent'
      ? [{ name: 'Recently used', items: recentOrder(names.flatMap((name) => groups[name])) }]
      : names.map((name) => ({ name, items: groups[name] }))
    return sections.flatMap(({ name, items }) => {
    const rows = items.filter((row) => (placedOnly ? row.nodes.length > 0 : matchesScope(row)) &&
      matchesSearch(row, name) && (placedOnly || matchesPlant(row)))
    if (placedOnly && rows.length === 0) return []
    return <PanelSection key={name} title={name}>
      {rows.length ? layout === 'grid'
        ? <div className="grid gap-2 px-1 pb-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))` }}>{rows.map(catalogCard)}</div>
        : rows.map((row) => <InventoryRow key={row.key} row={row} placed={placedOnly} onAdd={(item) => placedOnly ? selectLandscapeObjects(item.nodes) : openProduct(item.target, item)} />)
        : <p className="px-1 py-2 text-xs text-muted-foreground">{query ? `No ${name.toLowerCase()} match “${query}”.` : placedOnly ? `No ${name.toLowerCase()} placed yet.` : `No ${name.toLowerCase()} in this collection.`}</p>}
    </PanelSection>
    })
  }
  const renderPlantGrid = (rows: SceneRow[]) => <div className="grid gap-2 px-1 pb-2" style={{ gridTemplateColumns: libraryView === 'grid' ? `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))` : '1fr' }}>
    {(catalogScope === 'recent' ? recentOrder(rows) : rows).filter((row) => matchesScope(row) && matchesPlant(row) && matchesSearch(row, row.detail))
      .map((row) => libraryView === 'grid' ? catalogCard(row) : <InventoryRow key={row.key} row={row} onAdd={(item) => openProduct(item.target, item)} />)}
  </div>
  const visiblePlants = groups.Plants.filter((row) => matchesScope(row) && matchesPlant(row) && matchesSearch(row, row.detail))
  const countAll = reviewNodes.length
  const outdoorCount = objectGroups.find(group => group.key === 'outdoor-assets')?.nodes.length ?? 0
  return (
    <section aria-label="Landscape" style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', color: 'var(--foreground)', fontSize: 13 }}>
      <header style={{ padding: '14px 14px 0', flexShrink: 0 }}>
        {menu !== 'root' && <button type="button" onClick={back} aria-label="Back to landscape" style={{ background: 'transparent', border: 0, color: 'var(--muted-foreground)', cursor: 'pointer', padding: '0 0 10px' }}>← Landscape</button>}
        <h2 ref={heading} tabIndex={-1} style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{menuTitle[menu]}</h2>
        {menu === 'root' ? <label style={{ height: 36, display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>
          <SearchIcon />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search landscape elements..." aria-label="Search landscape elements" style={{ width: '100%', minWidth: 0, border: 0, outline: 0, padding: 0, background: 'transparent', color: 'var(--foreground)', font: 'inherit', fontSize: 12 }} />
        </label> : null}

      </header>
      {menu === 'root' && <nav aria-label="Landscape workflow" role="tablist" className="mx-3 mt-3 flex border-b border-border">
        {TABS.map((item) => <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}
          className={`flex flex-1 items-center justify-center min-h-10 gap-2 border-0 border-b-2 px-2 py-2 text-xs transition-colors ${tab === item.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold ${tab === item.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>{item.number}</span>{item.label}
        </button>)}
      </nav>}
      {menu === 'root' && tab !== 'review' && <div className="mx-3 mt-3 flex flex-wrap items-center gap-2">
        <SegmentedControl value={browser} onChange={setBrowser} options={[
          { value: 'library', label: 'Library' }, { value: 'objects', label: 'Objects' }, { value: 'tools', label: 'Tools' }, { value: 'watering', label: 'Watering' },
        ]} />
        {browser === 'library' && <>
          {tab === 'layout' && <div role="group" aria-label="Library categories" className="w-full">
            <SegmentedControl value={libraryCategory} onChange={setLibraryCategory} options={[
              { value: 'all', label: 'All' }, { value: 'Structures', label: 'Structures' },
              { value: 'Surfaces', label: 'Surfaces' }, { value: 'Pathways', label: 'Paths' },
            ]} />
          </div>}
          {tab === 'planting' && <div className="flex w-full gap-2">
            <select aria-label="Plant category" value={plantCategory} onChange={(event) => setPlantCategory(event.target.value)} className="min-h-9 min-w-0 flex-1 rounded-md border border-border bg-secondary px-3 py-2 text-xs">
              <option value="all">All plant categories</option><option value="procedural">Procedural trees</option>{PLANT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select aria-label="Plant model height" value={heightRange} onChange={(event) => setHeightRange(event.target.value)} className="min-h-9 min-w-0 flex-1 rounded-md border border-border bg-secondary px-3 py-2 text-xs">
              <option value="all">Any model height</option><option value="low">Under 1 m</option><option value="medium">1–3 m</option><option value="high">3 m and above</option>
            </select>
          </div>}

          <ActionButton type="button" className="h-auto min-h-10 px-3 py-2" label={libraryView === 'grid' ? 'List view' : 'Grid view'} onClick={() => setLibraryView((view) => view === 'grid' ? 'list' : 'grid')} />
          <select aria-label="Library collection" value={catalogScope} onChange={(event) => setCatalogScope(event.currentTarget.value as typeof catalogScope)} className="min-h-10 min-w-0 rounded-md border border-border bg-secondary px-3 py-2 text-xs">
            <option value="all">All assets</option><option value="used">Used in project</option><option value="recent">Recently used</option>
          </select>
          {libraryView === 'grid' && <div className="w-full"><SliderControl label="Thumbnail size" value={thumbnailSize} min={64} max={144} step={16} precision={0} unit="px" onChange={setThumbnailSize} /></div>}
        </>}
      </div>}
      {menu !== 'root' && selectedProduct && <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}><CatalogThumb item={selectedProduct} size={76} /><span className="min-w-0 truncate text-sm" title={selectedProduct.label}>{selectedProduct.label}</span></div>}
      <div ref={content} role={menu === 'root' ? 'tabpanel' : undefined}
        // Keep wheel gestures for panel scrolling. Shared MetricControl attaches
        // a native wheel listener that otherwise edits values under the pointer.
        onWheelCapture={(event) => event.stopPropagation()}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehaviorY: 'contain', padding: menu === 'root' ? '0 12px 12px' : 14 }}>
        {menu === 'root' && browser === 'library' && tab === 'layout' && activeTool === GROUND_AREA_KIND &&
          <div className="pt-3"><GroundAreaPanel inSidebar surfaceChoice={groundAreaDefaults?.surface as GroundSurface | undefined} /></div>}
        {menu === 'root' && browser === 'library' && tab === 'layout' && activeTool !== GROUND_AREA_KIND && <>
          {renderInventory(libraryCategory !== 'all' ? [libraryCategory] : query.trim() ? ['Structures', 'Surfaces', 'Pathways', 'Plants'] : ['Structures', 'Surfaces', 'Pathways'], false, libraryView)}
          {!activeLevelId && <p className="px-1 py-3 text-xs text-muted-foreground">Select a level to see its landscape items.</p>}
        </>}
        {menu === 'root' && browser === 'library' && tab === 'planting' && <>
          {catalogScope === 'recent' && visiblePlants.length > 0 && <PanelSection title="Recently used">{renderPlantGrid(visiblePlants)}</PanelSection>}
          {catalogScope !== 'recent' && visiblePlants.some((row) => row.target === 'tree') && <PanelSection title="Trees">
            {renderPlantGrid(visiblePlants.filter((row) => row.target === 'tree'))}
          </PanelSection>}
          {!visiblePlants.length && <p className="px-1 py-4 text-xs text-muted-foreground">No plants match these filters. Try another category, height, or collection.</p>}
          {(catalogScope === 'recent' ? [] : PLANT_CATEGORIES).filter((category) => visiblePlants.some((row) => PLANT_PRESET_BY_KEY[row.species ?? '']?.category === category)).map((category) => <PanelSection key={category} title={category} defaultExpanded={category === 'Deciduous trees'}>
            {renderPlantGrid(visiblePlants.filter((row) => row.target === 'plant' &&
              PLANT_PRESET_BY_KEY[row.species ?? '']?.category === category))}
          </PanelSection>)}
        </>}
        {menu === 'root' && browser === 'watering' && tab !== 'review' && <IrrigationPanel />}
        {menu === 'root' && browser === 'tools' && tab !== 'review' && <><PlantingLayoutPanel /><PlantingDocumentationPanel /><PathwayGradePanel /></>}
        {menu === 'root' && browser === 'objects' && tab !== 'review' && <LandscapeObjectsPanel query={query} groups={objectGroups} />}
        {menu === 'root' && tab === 'review' && <>
          <div className="px-1 pb-2 pt-4"><h3 className="m-0 text-sm font-semibold">Landscape review</h3><p className="mb-0 mt-1 text-xs text-muted-foreground">A summary of the items in this scene.</p></div>
          {countAll > 0 ? <>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {(['Structures', 'Surfaces', 'Pathways', 'Plants', 'Irrigation'] as const).map((name) => {
                const total = groups[name].reduce((sum, row) => sum + row.nodes.length, 0)
                return total > 0 && <div key={name} className="rounded-md border border-border bg-secondary/40 p-3"><span className="block text-xs text-muted-foreground">{name}</span><strong className="mt-1 block text-lg">{total}</strong></div>
              })}
              {outdoorCount > 0 && <div className="rounded-md border border-border bg-secondary/40 p-3"><span className="block text-xs text-muted-foreground">Outdoor assets</span><strong className="mt-1 block text-lg">{outdoorCount}</strong></div>}
              <div className="rounded-md border border-border bg-secondary/40 p-3"><span className="block text-xs text-muted-foreground">Total items</span><strong className="mt-1 block text-lg">{countAll}</strong></div>
            </div>
            {renderInventory(['Structures', 'Surfaces', 'Pathways', 'Plants', 'Irrigation'], true)}
            <DesignChecksPanel nodes={reviewNodes} />
            <QuantityPanel nodes={reviewNodes} />
          </> : <p className="px-1 py-3 text-xs text-muted-foreground">Nothing has been placed in this scene yet.</p>}
        </>}
        {menu === 'pond' && <PondPanel />}
        {menu === 'pergola' && <PergolaPanel />}
        {menu === 'tree' && <TreePanel />}
        {menu === 'plant' && <PlantPanel />}
        {menu === 'pathway' && <PathwayPanel />}
        {menu !== 'root' && ['patio', 'deck', 'concrete-slab', 'landing', 'edging', 'retaining-wall'].includes(menu) && <GroundAccessPanel item={menu as 'patio' | 'deck' | 'concrete-slab' | 'landing' | 'edging' | 'retaining-wall'} />}
      </div>
      {menu === 'root' && selection.length > 0 && <footer className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">{selection.length} item{selection.length === 1 ? '' : 's'} selected</footer>}
    </section>
  )
}
