import { describe, expect, it } from 'vitest'
import type { Difficulty, Institution } from '../types/core.ts'
import type { InstrumentId, PolicyAction, PolicyPackage } from '../types/policy.ts'
import type { ScoreComponentId } from '../types/scoring.ts'
import { SCORE_WEIGHTS } from '../config/scoring.ts'
import { availableInstruments } from '../config/instruments.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { playRun, type RunSession } from '../replay/replayRun.ts'
import { calculateScore } from '../scoring/calculateScore.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'

/**
 * **A component the score charges must be a component the player can reach.**
 *
 * This is the rule behind docs/QUESTIONS.md #18, generalised into something
 * that fails a build instead of being remembered. The player's complaint was
 * specific and correct:
 *
 * > "On me facture quelque chose sur quoi je n'ai aucun instrument."
 *
 * `cohesion` carries 0.08 of the ECB's scorecard at *every* difficulty, and
 * the one instrument that reaches the sovereign-spread range the penalty is
 * mostly made of — `transmission_protection` — was `availableFrom: 'hard'`.
 * So two of the three modes charged for a quantity they withheld the tool for.
 * Nothing caught it: every balance test asks what a mechanic *does*, and the
 * defect was in what a mode does not *have*.
 *
 * The journal has written "a rule with a check nobody runs is the same as a
 * rule with no check" twice, and the second time it added that what it keeps
 * shipping are habits rather than mechanisms. This is the mechanism.
 *
 * Two claims, deliberately separate:
 *
 *  1. **Reach** — static, cheap, and the one that failed. If a component has
 *     weight at an institution, the instruments that move it must be available
 *     at every difficulty that institution is played at.
 *  2. **Response** — measured. Reach is necessary and not sufficient: an
 *     instrument that is present and inert is the same defect wearing a
 *     better config. So the component has to actually move when the
 *     instrument does.
 */

/**
 * The instruments that reach each scored component.
 *
 * Hand-written, and that is the point: it is a claim about the design that a
 * reader can check against `config/instruments.ts`, not a derivation from it.
 * Deriving it from the `channels` field would make the test agree with the
 * configuration by construction and prove nothing — the defect it exists to
 * catch was a configuration that was internally consistent and wrong.
 *
 * Components with no entry are deliberately absent: `credibility`,
 * `anchoring`, `policy_volatility`, `shock_response` and `completion` are
 * properties of *how* every instrument is used rather than quantities any one
 * of them points at, and `price_stability`, `employment_output`,
 * `financial_stability` and `market_prosperity` are reached by the policy rate,
 * which is available everywhere by definition.
 *
 * Typed on both sides, which is half the value: `ScoreComponentId` keys and
 * `InstrumentId` values mean a component renamed or an instrument misspelled
 * is a compile error rather than an entry that quietly matches nothing — which
 * is the shape of the defect this file exists for, one level up.
 */
const REACHED_BY: Readonly<Partial<Record<ScoreComponentId, readonly InstrumentId[]>>> = {
  // The sovereign-spread range is most of the cohesion penalty, and these are
  // the three things in the game that compress it. The first is the dedicated
  // one; the other two do it as a side effect of another job.
  cohesion: ['transmission_protection', 'targeted_refinancing', 'asset_purchases'],
}

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']
const INSTITUTIONS: readonly Institution[] = ['fed', 'ecb']

describe('every scored component has an instrument that reaches it', () => {
  for (const institution of INSTITUTIONS) {
    for (const difficulty of DIFFICULTIES) {
      it(`${institution}/${difficulty}`, () => {
        const available = new Set(
          availableInstruments(institution, difficulty).map((instrument) => instrument.id),
        )

        for (const [component, instruments] of Object.entries(REACHED_BY)) {
          const weight = SCORE_WEIGHTS[institution][component as ScoreComponentId]
          // A component with no weight at this institution is not charged
          // here, so there is nothing to have an instrument for — which is
          // the Fed and cohesion: it has regions, not members with their own
          // sovereign borrowing costs.
          if (weight === 0) continue

          const reachable = (instruments ?? []).filter((id) => available.has(id))
          expect(
            reachable,
            `${institution}/${difficulty} charges ${weight} of its scorecard for ` +
              `"${component}" and offers none of the instruments that move it ` +
              `(${(instruments ?? []).join(', ')}). Either open one of them at this ` +
              `difficulty, or take the component's weight to zero here — but do not ` +
              `bill the player for a quantity they cannot touch.`,
          ).not.toHaveLength(0)
        }
      })
    }
  }
})

/** Forces one instrument's level, leaving the rest of the package alone. */
function pin(pkg: PolicyPackage, instrument: PolicyAction['instrument'], level: number): PolicyPackage {
  const actions = pkg.actions.filter((action) => action.instrument !== instrument)
  return { ...pkg, actions: [...actions, { instrument, magnitude: level }] }
}

function cohesionOf(difficulty: Difficulty, level: number, seed: string): number {
  const config = createRunConfig({
    institution: 'ecb',
    difficulty,
    seed,
    simulationVersion: SIMULATION_VERSION,
  })
  const session = playRun(config, (current: RunSession) =>
    pin(toolkitPackage(current, 'ecb', difficulty), 'transmission_protection', level),
  )
  const component = calculateScore(session.state, session.outcome).components.find(
    (candidate) => candidate.id === 'cohesion',
  )
  return component?.raw ?? 0
}

describe('and the component actually responds to it', () => {
  /*
   * Reach without response is the same defect in better clothes, and this
   * project has shipped that version too — a gate that could never fire, a
   * verdict band comparing a pair that cannot move, a wager whose payoff was
   * unreachable code. So the claim is paired on the seed and stated as a
   * count: holding the instrument at full must score better on cohesion than
   * never touching it, on most of the economies it is offered for.
   *
   * Most rather than all, deliberately. The instrument restores policy
   * transmission as well as compressing spreads, so on a seed where the
   * mandate ends earlier because its own tightening finally reached the whole
   * area, the average dispersion over a shorter path can come out either way.
   * A claim of "every seed" would be a claim about the integrator.
   */
  for (const difficulty of DIFFICULTIES) {
    it(`ecb/${difficulty}: using it beats never using it`, () => {
      const seeds = Array.from({ length: 12 }, (_, index) => `reach-${index}`)
      const better = seeds.filter(
        (seed) => cohesionOf(difficulty, 3, seed) > cohesionOf(difficulty, 0, seed),
      ).length

      expect(
        better,
        `Transmission protection is available at ecb/${difficulty} and made no ` +
          `difference to the cohesion component on ${seeds.length - better} of ` +
          `${seeds.length} economies. An instrument the scorecard cannot feel is ` +
          'the same as no instrument at all.',
      ).toBeGreaterThanOrEqual(8)
    })
  }
})
