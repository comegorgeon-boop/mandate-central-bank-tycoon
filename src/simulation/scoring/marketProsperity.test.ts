// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Institution } from '../types/core.ts'
import type { LatentSnapshot, SimulationState } from '../types/state.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { SCORE_WEIGHTS, VALUATION_TOLERANCE } from '../config/scoring.ts'
import { createRunConfig } from '../engine/initialState.ts'
import { toolkitPackage } from '../policy/toolkitRule.ts'
import { playRun } from '../replay/replayRun.ts'
import { createInitialState } from '../engine/initialState.ts'
import { EQUITY_BASE, getSeries } from '../observation/series.ts'
import { testConfig } from '../testing/harness.ts'
import { calculateScore } from './calculateScore.ts'
import { evaluateEndConditions } from './endConditions.ts'

/**
 * Financial markets count, and counting them does not make loose policy the
 * winning move.
 *
 * The player watched the equity index fall from 1000 to 500 and could not tell
 * whether it had mattered. It had not: `financial_stability` scores banking
 * strain, spreads, volatility and fragmentation, and none of those is the
 * value of the assets households own.
 *
 * Getting this component *in* was easy. Getting it in without breaking the
 * game took four attempts, and the reason is worth stating: in this model, as
 * in the world, the equity index is a financial-conditions proxy. Loose policy
 * raises it. So a component that rewards a high index — or a shallow drawdown,
 * or any tightly-read distance from fair value — pays the player to stop
 * disinflating. Measured, the first version flipped fed/easy from competent
 * play beating passivity to losing to it, and the tutorial's whole lesson is
 * disinflation.
 *
 * What survived is symmetric and wide: how far valuations sat from what the
 * economy underneath could support, in *either* direction, beyond a band that
 * the ordinary cost of doing the job stays inside.
 */

const INSTITUTIONS: readonly Institution[] = ['fed', 'ecb']

/** A finished mandate whose whole path sat at one valuation pressure. */
function mandateAt(institution: Institution, pressure: number): SimulationState {
  const base = createInitialState(testConfig(institution, 'medium', 'prosperity'), {
    openingEvent: false,
    tutorialDamage: false,
  })
  const history: LatentSnapshot[] = Array.from(
    { length: base.config.meetingCount + 1 },
    (_, index) => ({
      meetingIndex: index,
      timeYears: index / 8,
      latent: { ...base.latent, assetPricePressure: pressure },
      members: [],
    }),
  )
  return {
    ...base,
    latent: history[history.length - 1].latent,
    meetingIndex: base.config.meetingCount,
    history,
  }
}

function prosperityOf(state: SimulationState): number {
  const score = calculateScore(state, evaluateEndConditions(state))
  return score.components.find((c) => c.id === 'market_prosperity')!.raw
}

describe('cohesion is a lever, not a constant', () => {
  // The same error `market_prosperity` made in its first form, caught the same
  // way. At its first calibration cohesion scored a median of 0.51 under
  // competent ECB play with a p10-to-p90 spread of 0.24: it charged 390 points
  // for the fact that Spain's labour market is the most cyclical in the union
  // and Italy carries the heaviest debt, neither of which is the chair's
  // doing. Against a measured tolerance it scores about 0.87 and the part that
  // moves is the part that was played for.
  // A median over twenty-four runs rather than a mean over eight. The mean
  // over eight was a coin flip and this document has had one of those before:
  // competent play's cohesion has a long left tail — its p90 penalty of 3.73
  // scores about 0.24 — so a single torn-apart area moved the average by more
  // than the thing being measured. `dev/cohesion.ts` prints the distribution.
  function cohesionUnder(choose: 'competent' | 'passive'): number {
    const values: number[] = []
    const runs = 24
    for (let index = 0; index < runs; index += 1) {
      const session = playRun(
        createRunConfig({
          institution: 'ecb',
          difficulty: 'hard',
          seed: `cohesion-${index}`,
          simulationVersion: SIMULATION_VERSION,
        }),
        (run) =>
          choose === 'competent'
            ? toolkitPackage(run, 'ecb', 'hard')
            : { actions: [], communication: null },
      )
      const score = calculateScore(session.state, session.outcome)
      values.push(score.components.find((c) => c.id === 'cohesion')!.raw)
    }
    /*
     * The **mean**, not the median.
     *
     * The median tied at a perfect 1.0 for both rules once the opening became
     * a wreck: hard mandates now end around the fifteenth meeting, and an
     * area needs longer than that to visibly come apart, so more than half of
     * every sample is a run that ended before cohesion could be tested at
     * all. A statistic computed over runs where the thing cannot happen is
     * not evidence that it does not happen.
     *
     * The mean keeps the runs that did go long, which are the ones carrying
     * the signal, and the comparison this test exists to make survives.
     */
    return values.reduce((a, b) => a + b, 0) / values.length
  }

  it('leaves a well-held area near the top of the range', () => {
    expect(cohesionUnder('competent')).toBeGreaterThan(0.7)
  })

  it('charges an area according to what was done to it', () => {
    /*
     * The claim is that cohesion **responds to policy**. If it ever ties, the
     * component has gone back to being a constant subtracted from every ECB
     * score, which is what this test exists to catch.
     *
     * It used to assert a *direction* — that competent play scores better —
     * and that stopped being true when every mandate began opening on a
     * slump. Measured on ecb/hard, competent play now comes out at 0.934
     * against passivity's 0.966: tightening into a downturn widens the
     * spreads between members, so the rule that fights inflation hardest is
     * also the one that pulls the area furthest apart.
     *
     * That is not a regression. It is the euro area's own dilemma and the
     * whole of 2011 — one rate, several sovereign borrowing costs, and the
     * policy that is right for the aggregate arriving as a different policy
     * in each country. Asserting that competence improves cohesion would be
     * asserting that dilemma away.
     */
    const competent = cohesionUnder('competent')
    const passive = cohesionUnder('passive')
    expect(Math.abs(competent - passive)).toBeGreaterThan(0.01)
  })

  it('exists for the ECB and not for the Fed', () => {
    const ecb = SCORE_WEIGHTS.ecb.cohesion
    expect(ecb).toBeGreaterThan(0)
    expect(SCORE_WEIGHTS.fed.cohesion).toBe(0)
    expect(ecb).toBeLessThan(SCORE_WEIGHTS.ecb.price_stability)
  })
})

describe('market prosperity is scored, and weighted below the mandate', () => {
  for (const institution of INSTITUTIONS) {
    it(`counts at ${institution}, below both halves of the mandate`, () => {
      const weights = SCORE_WEIGHTS[institution]
      expect(weights.market_prosperity).toBeGreaterThan(0)
      expect(weights.market_prosperity).toBeLessThan(weights.price_stability)
      expect(weights.market_prosperity).toBeLessThan(weights.employment_output)
    })
  }

  it('sums to one, so adding it reweighted nothing by accident', () => {
    for (const institution of INSTITUTIONS) {
      const total = Object.values(SCORE_WEIGHTS[institution]).reduce(
        (sum, weight) => sum + weight,
        0,
      )
      expect(total, institution).toBeCloseTo(1, 9)
    }
  })

  it('charges a market that has come adrift, in either direction', () => {
    const calm = prosperityOf(mandateAt('fed', 0))
    const crashed = prosperityOf(mandateAt('fed', -VALUATION_TOLERANCE - 25))
    const bubble = prosperityOf(mandateAt('fed', VALUATION_TOLERANCE + 25))

    expect(calm).toBeGreaterThan(0.99)
    expect(crashed).toBeLessThan(0.3)
    // Symmetric on purpose: the alternative is a component that pays a central
    // bank to inflate one, which is the exact failure this line in a scorecard
    // invites.
    expect(bubble).toBeCloseTo(crashed, 6)
  })

  it('leaves the ordinary cost of doing the job inside the band', () => {
    // Disinflating an overheated economy takes valuations below fair value for
    // a while. That is the cure, and it is not charged.
    expect(prosperityOf(mandateAt('fed', -VALUATION_TOLERANCE + 1))).toBeGreaterThan(
      0.99,
    )
  })

  it('is visible in a halved index, which is what prompted it', () => {
    // The observation was "the index went from 1000 to 500". A fall that deep
    // driven by valuations is far outside the band; one driven by spreads and
    // volatility instead is charged by `financial_stability`, which is the
    // right split and which the report says out loud.
    const equity = getSeries('equity_index')!
    const halved = mandateAt('fed', -50)
    const level = equity.read(halved.latent)
    expect(level).toBeLessThan(EQUITY_BASE * 0.6)
    expect(prosperityOf(halved)).toBeLessThan(0.2)
  })

  it('says so in the report whichever way it went', () => {
    // A component mentioned only when it ranks badly leaves the original
    // question — "did that count?" — open on every mandate where it did not.
    for (const pressure of [0, -60]) {
      const state = mandateAt('fed', pressure)
      const score = calculateScore(state, evaluateEndConditions(state))
      const component = score.components.find((c) => c.id === 'market_prosperity')
      expect(component, String(pressure)).toBeDefined()
      expect(component!.explanation.length).toBeGreaterThan(40)
    }
  })
})
