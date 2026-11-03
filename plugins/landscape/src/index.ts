import { LANDSCAPE_ICON } from './landscape-icon'
import { pondDefinition } from './pond/definition'
import { irrigationPreviewDefinition } from './irrigation/preview'
import { irrigationZoneDefinition } from './irrigation/zone-model'
import { irrigationFittingDefinition } from './irrigation/fitting'
import type { AnyNode, AnyNodeDefinition, InspectorExtension, Plugin } from '@pascal-app/core'

import { pergolaDefinition } from './pergola/definition'
import { pathwayDefinition } from './pathways/definition'
import { groundAreaDefinition } from './ground-areas/definition'
import { patioDefinition } from './ground-access/patio/definition'
import { deckDefinition } from './ground-access/deck/definition'
import { concreteSlabDefinition } from './ground-access/concrete-slab/definition'
import { landingDefinition } from './ground-access/landing/definition'
import { edgingDefinition } from './ground-access/edging/definition'
import { retainingWallDefinition } from './ground-access/retaining-wall/definition'
import { treeDefinition } from './tree/definition'
import { plantDefinition } from './plant/definition'
import { irrigationHeadDefinition } from './irrigation/definition'
import { irrigationRunDefinition } from './irrigation/run'
import { irrigationValveDefinition } from './irrigation/valve'
import { irrigationControllerDefinition } from './irrigation/controller'
import { irrigationSourceDefinition } from './irrigation/source'
import { driplineDefinition } from './irrigation/dripline'

type PluginHostPanel = {
  id: string
  label: string
  icon: { kind: 'url'; src: string }
  component: () => Promise<{ default: React.ComponentType }>
  pluginId: string
  description: string
  creator: { name: string; url?: string }
  pluginUrl: string
  defaultInstalled: boolean
}

const retainingWallInspector: InspectorExtension & { primaryWhen: (node: AnyNode) => boolean } = {
  id: 'pascal:landscape:retaining-wall-finish',
  pluginId: 'pascal:landscape',
  kinds: ['wall', 'landscape:retaining-wall'],
  icon: { kind: 'iconify', name: 'lucide:brick-wall' },
  title: 'Retaining wall',
  component: () => import('./ground-access/retaining-wall/editor/finish-panel'),
  primaryWhen: (node) => (node.type as string) === 'landscape:retaining-wall' ||
    node.type === 'wall' && node.metadata?.landscapeRetainingWall === true,
}

const groundAreaInspector: InspectorExtension & { primaryWhen: (node: AnyNode) => boolean } = {
  id: 'pascal:landscape:ground-area',
  pluginId: 'pascal:landscape',
  kinds: ['landscape:ground-area'],
  icon: { kind: 'iconify', name: 'lucide:land-plot' },
  title: 'Ground area',
  component: () => import('./ground-areas/editor/panel'),
  primaryWhen: (node) => (node.type as string) === 'landscape:ground-area',
}

const treeInspector: InspectorExtension & { primaryWhen: (node: AnyNode) => boolean } = {
  id: 'pascal:landscape:tree',
  pluginId: 'pascal:landscape',
  kinds: ['landscape:tree'],
  icon: { kind: 'iconify', name: 'lucide:tree-deciduous' },
  title: 'Tree',
  component: () => import('./tree/editor/panel'),
  primaryWhen: (node) => (node.type as string) === 'landscape:tree',
}

const plantInspector: InspectorExtension & { primaryWhen: (node: AnyNode) => boolean } = {
  id: 'pascal:landscape:plant', pluginId: 'pascal:landscape', kinds: ['landscape:plant'],
  icon: { kind: 'iconify', name: 'lucide:sprout' }, title: 'Plant',
  component: () => import('./plant/editor/panel'),
  primaryWhen: (node) => (node.type as string) === 'landscape:plant',
}

/** Public plugin manifest. Landscape tools and node kinds can be added here. */
export const landscapePlugin: Plugin = {
  id: 'pascal:landscape',
  apiVersion: 1,
  inspectorExtensions: [{ id: 'pascal:landscape:irrigation-fitting-properties', pluginId: 'pascal:landscape', kinds: ['landscape:irrigation-fitting'], icon: { kind: 'iconify', name: 'lucide:git-branch' }, title: 'Irrigation fitting settings', component: () => import('./irrigation/fitting-inspector'), primaryWhen: () => true }, { id: 'pascal:landscape:irrigation-source-properties', pluginId: 'pascal:landscape', kinds: ['landscape:irrigation-source'], icon: { kind: 'iconify', name: 'lucide:gauge' }, title: 'Irrigation supply', component: () => import('./irrigation/source-inspector'), primaryWhen: () => true }, { id: 'pascal:landscape:dripline-properties', pluginId: 'pascal:landscape', kinds: ['landscape:dripline'], icon: { kind: 'iconify', name: 'lucide:droplets' }, title: 'Dripline', component: () => import('./irrigation/dripline-inspector'), primaryWhen: () => true }, { id: 'pascal:landscape:irrigation-controller-properties', pluginId: 'pascal:landscape', kinds: ['landscape:irrigation-controller'], icon: { kind: 'iconify', name: 'lucide:calendar-clock' }, title: 'Irrigation controller', component: () => import('./irrigation/controller-inspector'), primaryWhen: () => true }, { id: 'pascal:landscape:irrigation-valve-properties', pluginId: 'pascal:landscape', kinds: ['landscape:irrigation-valve'], icon: { kind: 'iconify', name: 'lucide:circle-gauge' }, title: 'Irrigation valve', component: () => import('./irrigation/valve-inspector'), primaryWhen: () => true }, { id: 'pascal:landscape:irrigation-run-properties', pluginId: 'pascal:landscape', kinds: ['landscape:irrigation-run'], icon: { kind: 'iconify', name: 'lucide:route' }, title: 'Irrigation run', component: () => import('./irrigation/run-inspector'), primaryWhen: () => true }, { id: 'pascal:landscape:irrigation-properties', pluginId: 'pascal:landscape', kinds: ['landscape:irrigation-head'], icon: { kind: 'iconify', name: 'lucide:droplets' }, title: 'Irrigation head', component: () => import('./irrigation/inspector'), primaryWhen: () => true }, retainingWallInspector, groundAreaInspector, treeInspector, plantInspector, { id: 'pascal:landscape:pond', pluginId: 'pascal:landscape', kinds: ['landscape:pond'], icon: { kind: 'iconify', name: 'lucide:waves' }, title: 'Pond', component: () => import('./pond/panel'), primaryWhen: () => true }],
  nodes: [
    pondDefinition as unknown as AnyNodeDefinition,
    pergolaDefinition as unknown as AnyNodeDefinition,
    pathwayDefinition as unknown as AnyNodeDefinition,
    groundAreaDefinition as unknown as AnyNodeDefinition,
    patioDefinition as unknown as AnyNodeDefinition,
    deckDefinition as unknown as AnyNodeDefinition,
    concreteSlabDefinition as unknown as AnyNodeDefinition,
    landingDefinition as unknown as AnyNodeDefinition,
    edgingDefinition as unknown as AnyNodeDefinition,
    retainingWallDefinition as unknown as AnyNodeDefinition,
    treeDefinition as unknown as AnyNodeDefinition,
    plantDefinition as unknown as AnyNodeDefinition,
    irrigationHeadDefinition as unknown as AnyNodeDefinition,
    irrigationRunDefinition as unknown as AnyNodeDefinition,
    irrigationValveDefinition as unknown as AnyNodeDefinition,
    irrigationControllerDefinition as unknown as AnyNodeDefinition,
    irrigationSourceDefinition as unknown as AnyNodeDefinition,
    driplineDefinition as unknown as AnyNodeDefinition,
    irrigationFittingDefinition as unknown as AnyNodeDefinition,
    irrigationZoneDefinition as unknown as AnyNodeDefinition,
    irrigationPreviewDefinition as unknown as AnyNodeDefinition,
  ],
}

/** Editor panel entry point for the landscape plugin. */
export const landscapeHostPanel: PluginHostPanel = {
  id: 'pascal:landscape:landscape',
  label: 'Landscape',
  icon: { kind: 'url', src: LANDSCAPE_ICON },
  component: () => import('./landscape-panel'),
  pluginId: landscapePlugin.id,
  description: 'Tools for designing landscape scenes.',
  creator: { name: 'Sudhir Yadav', url: 'https://github.com/sudhir9297' },
  pluginUrl: 'https://github.com/sudhir9297/landscape-pascal-plugin',
  defaultInstalled: true,
}

export { PergolaNode } from './pergola/domain/schema'
export { pergolaDefinition } from './pergola/definition'
export { PathwayNode } from './pathways/domain/schema'
export { pathwayDefinition } from './pathways/definition'
export { GroundAreaNode, GROUND_AREA_KIND } from './ground-areas/domain/schema'
export { groundAreaDefinition } from './ground-areas/definition'
export { PatioNode } from './ground-access/patio/domain/schema'
export { DeckNode } from './ground-access/deck/domain/schema'
export { ConcreteSlabNode } from './ground-access/concrete-slab/domain/schema'
export { LandingNode } from './ground-access/landing/domain/schema'
export { EdgingNode } from './ground-access/edging/domain/schema'
export { RetainingWallNode } from './ground-access/retaining-wall/domain/schema'
export { TreeNode, TREE_KIND } from './tree/domain/schema'
export { treeDefinition } from './tree/definition'
export { PlantNode, PLANT_KIND } from './plant/domain/schema'
export { plantDefinition } from './plant/definition'

export { PondNode, POND_KIND } from './pond/schema'
export { pondDefinition } from './pond/definition'
