// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Difficulty, Institution } from '../types/core.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { getInstitution } from '../config/institutions.ts'
import { getDifficulty } from '../config/difficulty.ts'
import { BANKING } from '../config/model.ts'
import { OPENING_DAMAGE, createInitialState, createRunConfig } from './initialState.ts'

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

describe('every mandate opens on a wreck', () => {
  /*
   * Rewritten, because the opening it tested no longer exists.
   *
   * It used to assert that easy opened *overheating*: inflation above the bar
   * and unemployment already inside it, so the tutorial was "fix prices
   * without losing the jobs you have". That was a measured design and it was
   * replaced on the player's instruction:
   *
   * > "ON COMMENCE DANS LE MUR. Pas 0,5 point d'écart : une vraie situation
   * > dégradée, même en moyen. […] Le joueur doit voir en arrivant qu'il y a
   * > un désastre à réparer."
   *
   * So both halves now open broken, at every difficulty, and what this file
   * guards is that the wreck is the stated one rather than a lottery.
   */
  it('opens at the stated distance from both objectives, whatever the seed', () => {
    for (const institution of ['fed', 'ecb'] as const) {
      const base = getInstitution(institution)
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        const damage = OPENING_DAMAGE[difficulty]
        const where = `${institution}/${difficulty}`
        for (const latent of openings(institution, difficulty)) {
          // Set to the objective plus the damage, not nudged by an offset: a
          // disaster that is sometimes only half a disaster is not a brief.
          expect(latent.inflationHeadline, where).toBeCloseTo(
            base.inflationTarget + damage.inflationOverTarget,
            6,
          )
          expect(latent.unemployment - latent.naturalUnemployment, where).toBeCloseTo(
            damage.unemploymentGap,
            6,
          )
          expect(latent.realGrowth, where).toBeCloseTo(damage.realGrowth, 6)
        }
      }
    }
  })

  it('leaves both objectives genuinely unmet at the first meeting', () => {
    // If either were already met, the opening would be asking the player to
    // hold still — which is what the previous design did on purpose for the
    // employment half, and what the instruction above reverses.
    const goal = getDifficulty('easy').tutorialGoal
    expect(goal).not.toBeNull()
    if (goal === null) return

    for (const institution of ['fed', 'ecb'] as const) {
      const config = getInstitution(institution)
      const inflationBar = config.inflationTarget + goal.inflationAboveTargetBy
      const unemploymentBar =
        config.initial.naturalUnemployment + goal.unemploymentAboveNaturalBy
      for (const latent of openings(institution, 'easy')) {
        expect(latent.inflationHeadline, institution).toBeGreaterThan(inflationBar)
        expect(latent.unemployment, institution).toBeGreaterThan(unemploymentBar)
      }
    }
  })

  it('gets worse as the difficulty rises, on every reading', () => {
    // The ladder, asserted rather than assumed: a "harder" mode whose opening
    // was gentler on one reading would be teaching the wrong thing about what
    // difficulty means here.
    for (const institution of ['fed', 'ecb'] as const) {
      const [easy] = openings(institution, 'easy')
      const [medium] = openings(institution, 'medium')
      const [hard] = openings(institution, 'hard')
      expect(medium.inflationHeadline).toBeGreaterThan(easy.inflationHeadline)
      expect(hard.inflationHeadline).toBeGreaterThan(medium.inflationHeadline)
      expect(medium.unemployment).toBeGreaterThan(easy.unemployment)
      expect(hard.unemployment).toBeGreaterThan(medium.unemployment)
      expect(medium.realGrowth).toBeLessThan(easy.realGrowth)
      expect(hard.realGrowth).toBeLessThan(medium.realGrowth)
    }
  })

  it('makes easy an expectations problem and the harder modes a cost-push one', () => {
    /*
     * The distinction that keeps the tutorial winnable.
     *
     * Easy's inflation is held up by an unanchored expectation, which the
     * rate can reach. Medium and hard carry a live cost-push shock, which it
     * cannot — that is hard's settled design, and measured, putting even a
     * small one on easy made competent play *worse* than passive: 9 of 30
     * tutorials solved against 11, because tightening into a supply shock
     * buys unemployment and the goal needs both halves.
     */
    for (const institution of ['fed', 'ecb'] as const) {
      for (const latent of openings(institution, 'easy')) {
        expect(latent.supplyShock, institution).toBeLessThan(0.35)
      }
      // Averaged, because the drawn component is noisy per seed: hard adds
      // more cost-push than medium *on average*, and a single draw can land
      // either way without the ladder being wrong.
      const mean = (values: readonly number[]) =>
        values.reduce((a, b) => a + b, 0) / values.length
      const medium = mean(openings(institution, 'medium').map((l) => l.supplyShock))
      const hard = mean(openings(institution, 'hard').map((l) => l.supplyShock))
      expect(medium, institution).toBeGreaterThan(0.8)
      expect(hard, institution).toBeGreaterThan(medium)
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

  it('still varies seed to seed, in everything but the stated distance', () => {
    /*
     * The two objectives are now *fixed* at the opening — that is the point
     * of a stated brief — so headline inflation is identical across seeds and
     * this test used to assert the opposite.
     *
     * What must still vary is the rest of the board: the banking system, the
     * markets, the geopolitics, the debt. An opening that was identical in
     * every respect would make the seed meaningless until the first event
     * fired, and the whole claim of this project is that a seed is a mandate.
     */
    const latents = openings('fed', 'easy')
    for (const read of [
      (l: (typeof latents)[number]) => l.bankingStress,
      (l: (typeof latents)[number]) => l.geopoliticalRisk,
      (l: (typeof latents)[number]) => l.assetPricePressure,
      (l: (typeof latents)[number]) => l.credibility,
    ]) {
      const distinct = new Set(latents.map((l) => read(l).toFixed(4)))
      expect(distinct.size).toBeGreaterThan(SEEDS / 2)
    }
    // And the stated distance does not vary, which is the other half.
    const headlines = new Set(latents.map((l) => l.inflationHeadline.toFixed(4)))
    expect(headlines.size).toBe(1)
  })
})
