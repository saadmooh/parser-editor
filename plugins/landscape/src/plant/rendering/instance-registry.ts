import type { useNodeEvents } from '@pascal-app/viewer'
import type { Scene } from 'three'
import { belongsToScene, restorePlantPlacement, type PlantPlacement } from './instance-batches'

export type RegisteredPlant = PlantPlacement & { handlers: ReturnType<typeof useNodeEvents> }
const plants = new Set<RegisteredPlant>()

export function registerPlantInstance(placement: RegisteredPlant) {
  plants.add(placement)
  return () => {
    plants.delete(placement)
    restorePlantPlacement(placement)
  }
}

export function scenePlants(scene: Scene) {
  return [...plants].filter((plant) => belongsToScene(plant.root, scene))
}
