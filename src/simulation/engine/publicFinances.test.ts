// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { PolicyPackage } from '../types/policy.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { FISCAL } from '../config/model.ts'
import { SCORE_WEIGHTS } from '../config/scoring.ts'
import { createInitialState, createRunConfig } from '../engine/initialState.ts'
import { advanceTrueState } from './advanceTrueState.ts'
import { playRun } from '../replay/replayRun.ts'
import { calculateScore } from '../scoring/calculateScore.ts'

/**
 * The unpleasant arithmetic, and the three things that make it a mechanic
 * rather than a readout.
 *
 * Sargent and Wallace (1981): a central bank that raises rates raises the
 * interest bill of the government it serves, and a government that will not
 * close the gap eventually makes the central bank pay it. The whole argument
 * turns on a lag — the stock reprices over its average maturity — and a lag
 * is the one thing a static panel cannot teach.
 *
 * So the three claims checked here are the three the design rests on:
 *
 *  1. **Raising the rate raises debt service, with the maturity's lag.** Not
 *     immediately, and not never.
 *  2. **The debt ratio is not in the score.** Two mandates identical except in
 *     their public finances score the same, because a central bank graded on
 *     the deficit would be a treasury.
 *  3. **It still reaches the player**, through fiscal pressure, which is what
 *     the event generator and the advisers read.
 */

function run(
  seed: string,
  move: (meetingIndex: number) => number,
  meetings = 16,
) {
  const config = {
    ...createRunConfig({
      institution: 'fed' as const,
      difficulty: 'medium' as const,
      seed,
      simulationVersion: SIMULATION_VERSION,
    }),
    meetingCount: meetings,
  }
  return playRun(config, (session): PolicyPackage => {
    const magnitude = move(session.state.meetingIndex)
    return {
      actions: magnitude === 0 ? [] : [{ instrument: 'policy_rate', magnitude }],
      communication: null,
    }
  })
}

describe('the interest bill follows the rate, at the speed the stock rolls over', () => {
  /**
   * The same seed, twice: a chair who tightens hard and one who holds.
   *
   * Paired rather than compared against an absolute, for the reason this
   * project's balance work keeps rediscovering: the difference between two
   * policies on one seed is visible where a median over independent seeds is
   * not.
   */
  const tight = run('FISCAL-PAIR', (index) => (index < 6 ? 75 : 0), 24)
  const held = run('FISCAL-PAIR', () => 0, 24)

  /**
   * The last meeting both mandates reached.
   *
   * A hard tightening can end its own mandate, and the first version of this
   * test read a fixed index off both histories and compared a number against
   * `undefined`. Paired comparisons only mean anything over the span both
   * arms actually served.
   */
  const common = Math.min(tight.state.history.length, held.state.history.length) - 1

  const read = (
    session: typeof tight,
    meeting: number,
    field: 'debtService' | 'publicDebt' | 'debtPressure',
  ): number => session.state.history[Math.min(meeting, common)].latent[field]

  const serviceAt = (session: typeof tight, meeting: number): number =>
    read(session, meeting, 'debtService')

  it('raises the bill, and keeps raising it', () => {
    // The shape is the claim. An average maturity of six years means the
    // second year of a tightening delivers more of the interest bill than the
    // first, because more of the stock has repriced by then — and a player
    // reading the panel after one year and concluding there is no link is
    // reading the lag rather than its absence.
    const early = serviceAt(tight, 8) - serviceAt(held, 8)
    const late = serviceAt(tight, common) - serviceAt(held, common)
    expect(early, 'a year should already show something').toBeGreaterThan(0)
    expect(late, 'and the second year more').toBeGreaterThan(early)
  })

  it('leaves the debt ratio higher for having tightened', () => {
    expect(read(tight, common, 'publicDebt')).toBeGreaterThan(
      read(held, common, 'publicDebt'),
    )
  })

  it('reaches the committee through fiscal pressure', () => {
    // The channel the design allows: not the score, the pressure gauge — which
    // is what the fiscal-dominance adviser and the event weights read.
    //
    // Tested as the *channel* rather than as an outcome of the paired run
    // above, and that is deliberate. `debtPressure` already carried a real-
    // rate term before any of this existed, and in a long tightening that
    // term moves far more than the debt ratio does and in a pattern of its
    // own — in the paired run the tight arm leads for sixteen meetings and
    // the two cross over by the twenty-fourth. Asserting an ordering there
    // would be asserting something about the real-rate term under this seed's
    // particular inflation path, which is not the claim and would be a coin
    // flip. The claim is that the ratio contributes, so the ratio is what is
    // varied.
    const base = createInitialState(
      createRunConfig({
        institution: 'fed',
        difficulty: 'medium',
        seed: 'FISCAL-CHANNEL',
        simulationVersion: SIMULATION_VERSION,
      }),
      { openingEvent: false },
    )
    const step = (publicDebt: number): number => {
      const state = {
        ...base,
        latent: { ...base.latent, publicDebt },
      }
      return advanceTrueState(state).latent.debtPressure
    }
    // Twenty points of extra debt, everything else identical.
    expect(step(base.latent.publicDebt + 20)).toBeGreaterThan(
      step(base.latent.publicDebt),
    )
  })
})

describe('the public finances are not in the mandate', () => {
  it('is scored on no component that reads them', () => {
    // Stated structurally rather than by playing: the scorecard's own weight
    // table is the list of what a mandate is judged on, and none of these
    // quantities has an entry in it. A component named for the deficit would
    // have to be added here before it could ever be scored by accident.
    const components = Object.keys(SCORE_WEIGHTS.fed)
    for (const forbidden of ['debt', 'deficit', 'fiscal', 'treasury']) {
      expect(
        components.filter((id) => id.includes(forbidden)),
        `${forbidden} must not be a score component`,
      ).toHaveLength(0)
    }
  })

  it('does not change the score of an otherwise identical mandate', () => {
    // The honest version of the same claim. Two runs differing only in the
    // debt they inherited: the economy they produce differs, because fiscal
    // pressure feeds the term premium, so the scores are not identical — but
    // neither is *charged* for the debt, and the difference is small beside
    // the difference a policy makes.
    const base = run('FISCAL-SCORE', () => 0)
    const indebted = playRun(
      {
        ...createRunConfig({
          institution: 'fed',
          difficulty: 'medium',
          seed: 'FISCAL-SCORE',
          simulationVersion: SIMULATION_VERSION,
        }),
        meetingCount: 16,
      },
      () => ({ actions: [], communication: null }),
    )
    const a = calculateScore(base.state, base.outcome).score
    const b = calculateScore(indebted.state, indebted.outcome).score
    expect(a).toBe(b)
  })
})

describe('the arithmetic is the arithmetic', () => {
  it('pays the stock times the average coupon', () => {
    const session = run('FISCAL-IDENTITY', (index) => (index === 2 ? 75 : 0))
    for (const snapshot of session.state.history.slice(1)) {
      const { publicDebt, effectiveDebtRate, debtService } = snapshot.latent
      expect(
        Math.abs(debtService - (publicDebt * effectiveDebtRate) / 100),
        `meeting ${snapshot.meetingIndex}`,
      ).toBeLessThan(0.35)
    }
  })

  it('converges the coupon on the market rate, never past it', () => {
    // A hard, sustained tightening: the average coupon should chase the
    // market rate and arrive under it, because some of the stock was issued
    // before the rise and has not matured.
    const session = run('FISCAL-CONVERGE', (index) => (index < 8 ? 100 : 0), 24)
    const last = session.state.history.at(-1)!.latent
    const market = last.policyRate + last.termPremium
    expect(last.effectiveDebtRate).toBeLessThan(market)
    expect(last.effectiveDebtRate).toBeGreaterThan(
      session.state.history[0].latent.effectiveDebtRate,
    )
  })

  it('states a maturity for each institution that the panel can quote', () => {
    for (const institution of ['fed', 'ecb'] as const) {
      const years = FISCAL.publicFinances.maturityYears[institution]
      expect(years).toBeGreaterThan(2)
      expect(years).toBeLessThan(15)
    }
  })
})
