export type PlantSource = 'FABOTANIC' | 'Claude grass artifact' | 'Grassworks demo' | 'Grass2 preview'
export type PlantCategory = 'Deciduous trees' | 'Flowering trees' | 'Conifers' | 'Shrubs and bamboo' | 'Palms and tropical' | 'Cacti and succulents' | 'Flowers and ferns' | 'Grasses and meadows'
export type PlantForm = 'tree' | 'flowering-tree' | 'conifer' | 'shrub' | 'bamboo' | 'palm' | 'cactus' | 'succulent' | 'flower' | 'fern' | 'grass'
export type PlantPreset = { key: string; name: string; source: PlantSource; category: PlantCategory; form: PlantForm; height: number; spread: number; foliage: string; accent?: string }

const make = (source: PlantSource, category: PlantCategory, form: PlantForm, entries: [string, string, number, number, string, string?][]): PlantPreset[] =>
  entries.map(([key, name, height, spread, foliage, accent]) => ({ key, name, source, category, form, height, spread, foliage, accent }))

export const PLANT_PRESETS: PlantPreset[] = [
  ...make('FABOTANIC', 'Deciduous trees', 'tree', [
    ['fab:tree', 'Broadleaf tree', 6, 4, '#648c4d'], ['fab:oak', 'Oak', 9, 7, '#50793b'],
    ['fab:zelkova', 'Zelkova', 8, 6, '#6b9352'], ['fab:ginkgo', 'Ginkgo', 7, 4, '#a3ad4c'],
    ['fab:maple', 'Maple', 7, 5, '#af6844'],
  ]),
  ...make('FABOTANIC', 'Flowering trees', 'flowering-tree', [
    ['fab:cherry', 'Cherry blossom', 6, 5, '#9b8c69', '#e8b7c5'],
    ['fab:floweringtreeb', 'Flowering tree B', 6, 4, '#789052', '#e5d5b5'],
  ]),
  ...make('FABOTANIC', 'Conifers', 'conifer', [
    ['fab:fir', 'Fir', 9, 4, '#3b6549'], ['fab:pine', 'Pine', 9, 6, '#426a42'],
    ['fab:cedar', 'Cedar', 10, 5, '#51715a'],
  ]),
  ...make('FABOTANIC', 'Grasses and meadows', 'grass', [
    ['fab:field', 'Wild field', 0.85, 3, '#7d9c58', '#e2c266'],
    ['fab:meadow', 'Meadow patch A', 0.6, 2, '#7b9e52', '#d9c56c'],
    ['fab:meadowb', 'Meadow patch B', 0.7, 2, '#729754', '#d6b76e'],
    ['fab:meadowc', 'Meadow patch C', 0.65, 2, '#81a157', '#e1d192'],
    ['fab:grass', 'Grass clump', 0.5, 1, '#578b4e'],
    ['fab:finegrassb', 'Fine grass B', 0.5, 1, '#8caa5b'],
    ['fab:pampas', 'Pampas grass', 1.8, 1.5, '#a4a86e', '#e5d4ad'],
    ['fab:plumegrassb', 'Plume grass B', 1.5, 1.3, '#8a9a66', '#d2bf9c'],
    ['fab:deadgrass', 'Dry grass', 0.6, 1, '#b4a374'],
  ]),
  ...make('FABOTANIC', 'Flowers and ferns', 'flower', [
    ['fab:yarrow', 'Yarrow', 0.8, 0.7, '#668a56', '#e6e2c9'],
    ['fab:daisy', 'Daisy', 0.55, 0.6, '#668b4b', '#f0ebda'],
    ['fab:poppy', 'Poppy', 0.7, 0.5, '#628846', '#d76640'],
    ['fab:dandelion', 'Dandelion', 0.35, 0.5, '#5b8943', '#eac744'],
    ['fab:plantain', 'Plantain', 0.4, 0.6, '#63844c', '#8d996d'],
    ['fab:clover', 'Clover', 0.25, 0.7, '#5f914b', '#e8d9e2'],
    ['fab:cloverb', 'Clover B', 0.28, 0.7, '#67a05a', '#dca5c3'],
  ]),
  ...make('FABOTANIC', 'Flowers and ferns', 'fern', [
    ['fab:fern', 'Fern', 0.8, 0.8, '#457b43'], ['fab:fernb', 'Fern B', 0.9, 1, '#5c8e4c'],
  ]),
  ...make('FABOTANIC', 'Shrubs and bamboo', 'bamboo', [
    ['fab:bamboo', 'Bamboo', 5, 1.8, '#4c8b4d'], ['fab:sasa', 'Sasa bamboo', 1, 1.4, '#5b9955'],
  ]),
  ...make('FABOTANIC', 'Palms and tropical', 'palm', [
    ['fab:palmfan', 'Fan palm', 5, 4, '#668d50'],
    ['fab:cycad', 'Cycad', 1.5, 2, '#47764a'],
  ]),
  ...make('FABOTANIC', 'Cacti and succulents', 'cactus', [
    ['fab:cactuscolumn', 'Column cactus', 3, 1.2, '#4f865c'],
    ['fab:cactuspad', 'Pad cactus', 1.7, 1.7, '#658d5b'],
  ]),
  ...make('FABOTANIC', 'Cacti and succulents', 'succulent', [
    ['fab:succulent', 'Succulent', 0.5, 0.8, '#81a474'],
    ['fab:succulentb', 'Succulent B', 0.7, 0.9, '#779c80'],
    ['fab:succulentc', 'Succulent C', 0.6, 0.8, '#8fac78'],
  ]),
  ...make('FABOTANIC', 'Shrubs and bamboo', 'shrub', [
    ['fab:ficus', 'Ficus', 2.5, 2, '#527e48'],
    ['fab:splitleaf', 'Split leaf', 1.5, 2, '#467b48'],
    ['fab:hardleaf', 'Hard leaf', 1.2, 1.4, '#668e58'],
  ]),
  ...make('Claude grass artifact', 'Deciduous trees', 'tree', [
    ['claude:oak', 'Oak tree', 9, 7, '#517749'], ['claude:kobushi', 'Kobushi', 7, 5, '#829a64'],
    ['claude:kaki', 'Persimmon', 6, 5, '#82944e', '#da8e40'],
    ['claude:willow', 'Willow', 8, 7, '#71925d'], ['claude:keyaki', 'Keyaki', 10, 8, '#5f8d51'],
  ]),
  ...make('Claude grass artifact', 'Flowering trees', 'flowering-tree', [
    ['claude:yamazakura', 'Yamazakura', 8, 6, '#718c59', '#e9c3cf'],
    ['claude:sakura', 'Sakura', 7, 6, '#78915d', '#efc8d7'],
  ]),
  ...make('Claude grass artifact', 'Conifers', 'conifer', [
    ['claude:cedar', 'Cedar tree', 10, 4, '#3d6b52'],
    ['claude:evergreen', 'Evergreen', 7, 5, '#427054'],
  ]),
  ...make('Claude grass artifact', 'Shrubs and bamboo', 'shrub', [
    ['claude:shrub', 'Shrub', 1.5, 2, '#5f914e'],
    ['claude:camellia', 'Camellia', 2, 2, '#40794c', '#d95b68'],
    ['claude:tsutsuji', 'Tsutsuji azalea', 1.5, 2, '#578e51', '#d887aa'],
  ]),
  ...make('Claude grass artifact', 'Shrubs and bamboo', 'bamboo', [
    ['claude:bamboo', 'Bamboo stand', 5, 1.7, '#63a45b'],
  ]),
  ...make('Claude grass artifact', 'Grasses and meadows', 'grass', [
    ['claude:meadow', 'Meadow grass', 0.6, 2, '#74a153'],
    ['claude:rice', 'Rice seedlings', 0.5, 1.5, '#77a354'],
    ['claude:renge', 'Renge', 0.4, 1.2, '#669454', '#b888c5'],
    ['claude:nanohana', 'Nanohana', 0.8, 1.3, '#668b4d', '#e6c647'],
    ['claude:moss', 'Moss', 0.12, 1.5, '#4d8050'],
  ]),
  ...make('Grassworks demo', 'Grasses and meadows', 'grass', [
    ['grassworks:perennialRyegrass', 'Perennial ryegrass', 0.55, 1.5, '#538c48'],
    ['grassworks:sheepFescue', 'Sheep fescue', 0.4, 1.5, '#8a9c64'],
    ['grassworks:kentuckyBluegrass', 'Kentucky bluegrass', 0.45, 1.5, '#618f68'],
  ]),
  ...make('Grass2 preview', 'Flowers and ferns', 'flower', [
    ['grass2:dandelion', 'Dandelion mix', 0.38, 0.8, '#668c4d', '#e8cd52'],
    ['grass2:clover', 'Clover mix', 0.28, 0.8, '#65914d', '#e7cde1'],
    ['grass2:violet', 'Violet', 0.3, 0.6, '#58844d', '#876fb2'],
    ['grass2:blueFlower', 'Blue wildflower', 0.5, 0.7, '#5f8952', '#668fcb'],
  ]),
]

export const PLANT_PRESET_BY_KEY: Record<string, PlantPreset> = Object.fromEntries(PLANT_PRESETS.map((preset) => [preset.key, preset]))
export const PLANT_CATEGORIES: PlantCategory[] = ['Deciduous trees', 'Flowering trees', 'Conifers', 'Shrubs and bamboo', 'Palms and tropical', 'Cacti and succulents', 'Flowers and ferns', 'Grasses and meadows']
