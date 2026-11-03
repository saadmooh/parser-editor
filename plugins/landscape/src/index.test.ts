import { describe, expect, test } from 'bun:test'
import { landscapeHostPanel, landscapePlugin } from './index'

describe('Landscape plugin manifest', () => {
  test('exports the landscape identity with its node types', () => {
    expect(landscapePlugin.id).toBe('pascal:landscape')
    expect(landscapePlugin.apiVersion).toBe(1)
    expect(landscapePlugin.nodes?.map((node) => node.kind)).toEqual([
      'landscape:pond',
      'landscape:pergola',
      'landscape:pathway',
      'landscape:ground-area',
      'landscape:patio',
      'landscape:deck',
      'landscape:concrete-slab',
      'landscape:landing',
      'landscape:edging',
      'landscape:retaining-wall',
      'landscape:tree',
      'landscape:plant',
      'landscape:irrigation-head',
      'landscape:irrigation-run',
      'landscape:irrigation-valve',
      'landscape:irrigation-controller',
      'landscape:irrigation-source', 'landscape:dripline', 'landscape:irrigation-fitting', 'landscape:irrigation-zone', 'landscape:irrigation-preview',
    ])
  })

  test('plant rendering registers the instance system', () => {
    expect(landscapePlugin.nodes?.find((node) => node.kind === 'landscape:plant')?.system?.module).toBeFunction()
  })

  test('associates the Landscape panel with the plugin', () => {
    expect(landscapeHostPanel.pluginId).toBe(landscapePlugin.id)
    expect(landscapeHostPanel.label).toBe('Landscape')
    expect(landscapeHostPanel.defaultInstalled).toBe(true)
    expect(landscapeHostPanel.pluginUrl).toBe(
      'https://github.com/sudhir9297/landscape-pascal-plugin',
    )
  })
})
