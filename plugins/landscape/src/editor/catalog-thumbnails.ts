import groundGrass from '../assets/catalog/ground-grass-transparent-thumbnail.webp'
import patio from '../assets/catalog/patio-transparent-thumbnail.webp'
import walkwayStraight from '../assets/catalog/walkway-straight-transparent-thumbnail.webp'
import walkwayCurve from '../assets/catalog/walkway-curve-transparent-thumbnail.webp'
import walkwayStone from '../assets/catalog/walkway-stone-transparent-thumbnail.webp'
import deck from '../assets/catalog/deck-transparent-thumbnail.webp'
import concreteSlab from '../assets/catalog/concrete-slab-transparent-thumbnail.webp'
import landing from '../assets/catalog/landing-transparent-thumbnail.webp'
import edging from '../assets/catalog/edging-transparent-thumbnail.webp'
import retainingWall from '../assets/catalog/retaining-wall-transparent-thumbnail.webp'
import groundSoil from '../assets/catalog/ground-soil-transparent-thumbnail.webp'
import groundMulch from '../assets/catalog/ground-mulch-transparent-thumbnail.webp'
import groundGravel from '../assets/catalog/ground-gravel-transparent-thumbnail.webp'
import groundSand from '../assets/catalog/ground-sand-transparent-thumbnail.webp'
import groundMud from '../assets/catalog/ground-mud-transparent-thumbnail.webp'
import groundGrass2 from '../assets/catalog/ground-grass2-transparent-thumbnail.webp'
import pergolaFlat from '../assets/catalog/pergola-flat-transparent-thumbnail.webp'
import pergolaSingleSlope from '../assets/catalog/pergola-single-slope-transparent-thumbnail.webp'
import pergolaGable from '../assets/catalog/pergola-gable-transparent-thumbnail.webp'
import pergolaCurved from '../assets/catalog/pergola-curved-transparent-thumbnail.webp'
import pond from '../assets/catalog/pond-transparent-thumbnail.webp'
import whiteOak from '../assets/catalog/white-oak-transparent-thumbnail.webp'
import redMaple from '../assets/catalog/red-maple-transparent-thumbnail.webp'
import tulipPoplar from '../assets/catalog/tulip-poplar-transparent-thumbnail.webp'
import sweetgum from '../assets/catalog/sweetgum-transparent-thumbnail.webp'
import americanBeech from '../assets/catalog/american-beech-transparent-thumbnail.webp'
import ponderosaPine from '../assets/catalog/ponderosa-pine-transparent-thumbnail.webp'
import loblollyPine from '../assets/catalog/loblolly-pine-transparent-thumbnail.webp'
import douglasFir from '../assets/catalog/douglas-fir-transparent-thumbnail.webp'
import cultivatedApple from '../assets/catalog/cultivated-apple-transparent-thumbnail.webp'
import sweetCherry from '../assets/catalog/sweet-cherry-transparent-thumbnail.webp'
import paperBirch from '../assets/catalog/paper-birch-transparent-thumbnail.webp'
import quakingAspen from '../assets/catalog/quaking-aspen-transparent-thumbnail.webp'
import americanSycamore from '../assets/catalog/american-sycamore-transparent-thumbnail.webp'
import floweringDogwood from '../assets/catalog/flowering-dogwood-transparent-thumbnail.webp'
import weepingWillow from '../assets/catalog/weeping-willow-transparent-thumbnail.webp'
import joshuaTree from '../assets/catalog/joshua-tree-transparent-thumbnail.webp'
import saguaro from '../assets/catalog/saguaro-transparent-thumbnail.webp'
import creosoteBush from '../assets/catalog/creosote-bush-transparent-thumbnail.webp'
import blackbrush from '../assets/catalog/blackbrush-transparent-thumbnail.webp'
import bigSagebrush from '../assets/catalog/big-sagebrush-transparent-thumbnail.webp'
import shrub from '../assets/catalog/shrub-transparent-thumbnail.webp'

const src = (image: { src: string }) => image.src
export const TREE_SPECIES_THUMBNAILS: Record<string, string> = {
  whiteOak: src(whiteOak),
  redMaple: src(redMaple),
  tulipPoplar: src(tulipPoplar),
  sweetgum: src(sweetgum),
  americanBeech: src(americanBeech),
  pine: src(ponderosaPine),
  loblolly: src(loblollyPine),
  douglasFir: src(douglasFir),
  apple: src(cultivatedApple),
  cherry: src(sweetCherry),
  paperBirch: src(paperBirch),
  quakingAspen: src(quakingAspen),
  americanSycamore: src(americanSycamore),
  floweringDogwood: src(floweringDogwood),
  weepingWillow: src(weepingWillow),
  joshuaTree: src(joshuaTree),
  saguaro: src(saguaro),
  creosote: src(creosoteBush),
  blackbrush: src(blackbrush),
  sagebrush: src(bigSagebrush),
}
export const LANDSCAPE_CATALOG_THUMBNAILS = {
  pond: src(pond),
  'ground-area': src(groundGrass),
  patio: src(patio),
  pathway: src(walkwayStraight),
  deck: src(deck),
  'concrete-slab': src(concreteSlab),
  landing: src(landing),
  edging: src(edging),
  'retaining-wall': src(retainingWall),
  pergola: src(pergolaFlat),
  tree: src(whiteOak),
  plant: src(shrub),
} as const

export const WALKWAY_THUMBNAILS = {
  straight: src(walkwayStraight),
  curve: src(walkwayCurve),
  stone: src(walkwayStone),
} as const

export const GROUND_SURFACE_THUMBNAILS = {
  grass: src(groundGrass),
  grass2: src(groundGrass2),
  soil: src(groundSoil),
  mulch: src(groundMulch),
  gravel: src(groundGravel),
  sand: src(groundSand),
  mud: src(groundMud),
} as const
