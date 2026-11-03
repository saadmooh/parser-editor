import type { PondNode } from './schema'

/** Reference moods translated to pond-local controls; project lighting stays owned by the editor. */
export const pondWaterPresets = {
  natural: { waterColor: '#328e92', rippleStrength: .35, waterClarity: 1.3, reflectionStrength: .8, refractionStrength: 1, sunGlints: .65, waveSpeed: 1, waveSettling: 1, rain: 0, fishResponse: 1, animated: true },
  glass: { waterColor: '#579fa5', rippleStrength: .04, waterClarity: 1.9, reflectionStrength: .95, refractionStrength: 1.5, sunGlints: .35, waveSpeed: .6, waveSettling: 1.6, rain: 0, fishResponse: .6, animated: true },
  cinematic: { waterColor: '#23646f', rippleStrength: .28, waterClarity: .8, reflectionStrength: 1, refractionStrength: .6, sunGlints: 1.1, waveSpeed: .8, waveSettling: 1.1, rain: 0, fishResponse: 1, animated: true },
  playful: { waterColor: '#36aeb0', rippleStrength: .65, waterClarity: 1.6, reflectionStrength: .65, refractionStrength: 1.3, sunGlints: .9, waveSpeed: 1.3, waveSettling: .7, rain: 0, fishResponse: 1.6, animated: true },
} satisfies Record<string, Partial<PondNode>>
