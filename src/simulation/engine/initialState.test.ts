// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Difficulty, Institution } from '../types/core.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { getInstitution } from '../config/institutions.ts'
import { BANKING } from '../config/model.ts'
import { createInitialState, createRunConfig } from './initialState.ts'

/**
 * The easy-mode opening: healthy, per docs/DIRECTION.md.
 *
 * `{ openingEvent: false }` throughout, deliberately: this isolates the
 * *baseline* the crisis is applied on top of, which is a separate concern
 * from the crisis itself (covered in `events/openingCrisis.test.ts`).
 */

const SEEDS = 40

function openings(institution: Institution, difficulty: Difficulty) {
  return Array.from({ length: SEEDS }, (_, index) => {
    const config = createRunConfig({
      institution,
      difficulty,
      seed: `opening-health-${index}`,
      simulationVersion: SIMULATION_VERSION,
    })
    return createInitialState(config, { openingEvent: false }).latent
  })
}

function maxDeviation(values: readonly number[], from: number): number {
  return Math.max(...values.map((value) => Math.abs(value - from)))
}

describe('the easy-mode opening is healthy', () => {
  it("clusters tightly around the institution's own calm baseline, on easy", () => {
    for (const institution of ['fed', 'ecb'] as const) {
      const base = getInstitution(institution).initial
      const latents = openings(institution, 'easy')

      expect(maxDeviation(latents.map((l) => l.inflationHeadline), base.inflationHeadline)).toBeLessThan(0.6)
      expect(maxDeviation(latents.map((l) => l.outputGap), base.outputGap)).toBeLessThan(0.7)
      expect(maxDeviation(latents.map((l) => l.bankingStress), BANKING.base)).toBeLessThan(4)
      expect(maxDeviation(latents.map((l) => l.geopoliticalRisk), 25)).toBeLessThan(8)
    }
  })

  it('leaves medium and hard exactly as widely spread as before this change', () => {
    // Regression: the perturbation scale must be an easy-only change. Medium
    // and hard should still show the "moderately damaged" spread this
    // document's balance work was measured against.
    for (const difficulty of ['medium', 'hard'] as const) {
      const base = getInstitution('fed').initial
      const latents = openings('fed', difficulty)
      expect(maxDeviation(latents.map((l) => l.inflationHeadline), base.inflationHeadline)).toBeGreaterThan(1)
      expect(maxDeviation(latents.map((l) => l.bankingStress), BANKING.base)).toBeGreaterThan(8)
    }
  })

  it('still varies seed to seed on easy, just narrowly', () => {
    // A healthy opening is not a fixed opening: DIRECTION.md asks for a
    // healthy economy, not an identical one every run.
    const latents = openings('fed', 'easy')
    const distinctHeadlines = new Set(latents.map((l) => l.inflationHeadline.toFixed(4)))
    expect(distinctHeadlines.size).toBeGreaterThan(SEEDS / 2)
  })
})
