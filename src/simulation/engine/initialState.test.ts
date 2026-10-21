// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Difficulty, Institution } from '../types/core.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { getInstitution } from '../config/institutions.ts'
import { getDifficulty } from '../config/difficulty.ts'
import { BANKING } from '../config/model.ts'
import { BROKEN, OPENING_DAMAGE, createInitialState, createRunConfig } from './initialState.ts'
import { LABOR, okunAt } from '../config/model.ts'

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
  /**
   * **The invariant.**
   *
   * > "ET ÇA DOIT TENIR SUR TOUTES LES GRAINES, pas en moyenne. Écris
   * > l'invariant et teste-le sur tout le catalogue : en facile jamais plus
   * > d'un indicateur hors des clous, en moyen exactement deux et en
   * > opposition, en difficile trois."
   *
   * Three readings, and the count of broken ones is the difficulty. A
   * reading is broken when it is more than `BROKEN` from its objective —
   * inflation from target, unemployment from its sustainable rate, growth
   * from zero.
   */
  function brokenCount(latent: {
    inflationHeadline: number
    unemployment: number
    naturalUnemployment: number
    realGrowth: number
  }, target: number): readonly string[] {
    const broken: string[] = []
    if (Math.abs(latent.inflationHeadline - target) > BROKEN.inflation) {
      broken.push('inflation')
    }
    if (Math.abs(latent.unemployment - latent.naturalUnemployment) > BROKEN.unemployment) {
      broken.push('unemployment')
    }
    if (latent.realGrowth < BROKEN.growth) broken.push('growth')
    return broken
  }

  it('breaks exactly one reading on easy, on every seed', () => {
    for (const institution of ['fed', 'ecb'] as const) {
      const target = getInstitution(institution).inflationTarget
      for (const latent of openings(institution, 'easy')) {
        const broken = brokenCount(latent, target)
        expect(broken, `${institution}: ${broken.join(', ')}`).toEqual(['inflation'])
      }
    }
  })

  it('breaks exactly two on medium, and they pull against each other', () => {
    for (const institution of ['fed', 'ecb'] as const) {
      const target = getInstitution(institution).inflationTarget
      for (const latent of openings(institution, 'medium')) {
        const broken = brokenCount(latent, target)
        expect(broken, `${institution}: ${broken.join(', ')}`).toEqual([
          'inflation',
          'unemployment',
        ])
        /*
         * **In opposition**, which is the whole of what medium is for.
         *
         * Tightening closes one and widens the other, so no setting of the
         * dial repairs both. Mechanically that is inflation *above* target
         * while the output gap is *negative*: the rate reaches inflation
         * through demand, and there is already too little of it.
         */
        expect(latent.inflationHeadline, institution).toBeGreaterThan(target)
        expect(latent.outputGap, institution).toBeLessThan(0)
      }
    }
  })

  it('breaks all three on hard, on every seed', () => {
    for (const institution of ['fed', 'ecb'] as const) {
      const target = getInstitution(institution).inflationTarget
      for (const latent of openings(institution, 'hard')) {
        const broken = brokenCount(latent, target)
        expect([...broken].sort(), `${institution}: ${broken.join(', ')}`).toEqual([
          'growth',
          'inflation',
          'unemployment',
        ])
      }
    }
  })

  it('derives the triplet from one quantity instead of drawing three', () => {
    /*
     * The coherence check.
     *
     * > "j'ai vu une croissance à +5,5 % avec un chômage à 8,1 % et une
     * > inflation à 10,2 %, attelage curieux."
     *
     * The engine holds two identities between the three readings, and the
     * opening must satisfy both or it is a correction in progress rendered
     * as a dashboard. Unemployment follows the output gap through Okun, and
     * growth is potential plus whatever the gap is still doing.
     */
    for (const institution of ['fed', 'ecb'] as const) {
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        const damage = OPENING_DAMAGE[difficulty]
        const where = `${institution}/${difficulty}`
        for (const latent of openings(institution, difficulty)) {
          const okun = okunAt(LABOR.okun, latent.outputGap)
          expect(
            latent.unemployment - latent.naturalUnemployment,
            `${where}: unemployment must satisfy Okun against the gap`,
          ).toBeCloseTo(-okun * latent.outputGap, 6)
          expect(
            latent.realGrowth - latent.potentialGrowth,
            `${where}: growth must be potential plus the gap's momentum`,
          ).toBeCloseTo(damage.gapMomentum, 6)
        }
      }
    }
  })

  it('leaves easy with inflation to fix and employment already in hand', () => {
    /*
     * One broken reading means the tutorial's employment objective is *met*
     * at the opening — which is not an oversight, it is the rung:
     *
     * > "FACILE : UN SEUL hors des clous, les deux autres sains. […] Un seul
     * > levier suffit, et le joueur apprend que le levier marche."
     *
     * So the lesson is "bring inflation down without losing the jobs you
     * have", which is a single lever with a consequence rather than a
     * trade-off with no right answer. A previous pass broke both halves here
     * and measured competent play solving 13 of 30 against passive's 14.
     */
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
        expect(latent.unemployment, institution).toBeLessThan(unemploymentBar)
      }
    }
  })

  it('raises the number of broken readings with the difficulty', () => {
    /*
     * The ladder, asserted as a *count* rather than as every reading getting
     * monotonically worse — which is what it used to assert and is now wrong
     * by design. Medium's growth is deliberately healthy: the economy has
     * stopped falling, so the third reading holds and the player has two
     * problems instead of three.
     */
    for (const institution of ['fed', 'ecb'] as const) {
      const target = getInstitution(institution).inflationTarget
      const counts = (['easy', 'medium', 'hard'] as const).map(
        (difficulty) => brokenCount(openings(institution, difficulty)[0], target).length,
      )
      expect(counts, institution).toEqual([1, 2, 3])

      // And inflation, the one reading broken at every rung, gets worse.
      const [easy] = openings(institution, 'easy')
      const [medium] = openings(institution, 'medium')
      const [hard] = openings(institution, 'hard')
      expect(medium.inflationHeadline).toBeGreaterThan(easy.inflationHeadline)
      expect(hard.inflationHeadline).toBeGreaterThan(medium.inflationHeadline)
      // As does the slump, once there is one.
      expect(hard.outputGap).toBeLessThan(medium.outputGap)
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
