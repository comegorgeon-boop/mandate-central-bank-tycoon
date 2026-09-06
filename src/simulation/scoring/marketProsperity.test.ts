// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Institution } from '../types/core.ts'
import type { LatentSnapshot, SimulationState } from '../types/state.ts'
import { SCORE_WEIGHTS, VALUATION_TOLERANCE } from '../config/scoring.ts'
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
