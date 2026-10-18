// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Difficulty, Institution } from '../types/core.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { getInstitution } from '../config/institutions.ts'
import { getDifficulty } from '../config/difficulty.ts'
import { BANKING } from '../config/model.ts'
import { TUTORIAL_DAMAGE, createInitialState, createRunConfig } from './initialState.ts'

/**
 * The easy-mode opening: tightly clustered, and deliberately damaged.
 *
 * Two separate properties, and only one of them changed when easy became a
 * tutorial. The *spread* is still narrow — seeds open on nearly the same
 * economy, so the crisis on top is legible as the thing that broke it rather
 * than as one more source of seed-to-seed noise. What moved is the *centre*:
 * the tutorial opens on an economy already broken on both halves of the
 * mandate, because a lesson whose problem is fixed by the third meeting has
 * nine meetings left teaching that there is nothing to do.
 *
 * So these still measure the cluster's width, now around the damaged centre
 * rather than the calm one, and reference `TUTORIAL_DAMAGE` rather than
 * writing its values out — a number stated twice is a number that will
 * eventually disagree with itself.
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

describe('the easy-mode opening', () => {
  it('clusters tightly around its own centre, on easy', () => {
    for (const institution of ['fed', 'ecb'] as const) {
      const base = getInstitution(institution).initial
      const latents = openings(institution, 'easy')

      expect(
        maxDeviation(
          latents.map((l) => l.inflationHeadline),
          base.inflationHeadline + TUTORIAL_DAMAGE.inflation,
        ),
      ).toBeLessThan(0.6)
      expect(
        maxDeviation(
          latents.map((l) => l.outputGap),
          base.outputGap + TUTORIAL_DAMAGE.outputGap,
        ),
      ).toBeLessThan(0.7)
      expect(maxDeviation(latents.map((l) => l.bankingStress), BANKING.base)).toBeLessThan(4)
      expect(maxDeviation(latents.map((l) => l.geopoliticalRisk), 25)).toBeLessThan(8)
    }
  })

  it('opens the tutorial short of inflation and already meeting employment', () => {
    // The whole point of the redesign. If either objective were already met at
    // meeting one, the tutorial would be asking the player to hold still.
    const goal = getDifficulty('easy').tutorialGoal
    expect(goal).not.toBeNull()
    if (goal === null) return

    for (const institution of ['fed', 'ecb'] as const) {
      const config = getInstitution(institution)
      const inflationBar = config.inflationTarget + goal.inflationAboveTargetBy
      const unemploymentBar =
        config.initial.naturalUnemployment + goal.unemploymentAboveNaturalBy
      for (const latent of openings(institution, 'easy')) {
        // Inflation is the problem to solve...
        expect(latent.inflationHeadline, institution).toBeGreaterThan(inflationBar)
        // ...and employment is the thing not to break solving it. Starting
        // *inside* the employment bar is what makes the tutorial a trade-off
        // rather than two chores, and it is why the opening is an overheating
        // economy rather than a slumping one. See `TUTORIAL_DAMAGE`.
        expect(latent.unemployment, institution).toBeLessThan(unemploymentBar)
      }
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
