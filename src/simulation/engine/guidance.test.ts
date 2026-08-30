// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { PolicyPackage } from '../types/policy.ts'
import type { LatentState } from '../types/state.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { GUIDANCE_HORIZON_MEETINGS } from '../config/thresholds.ts'
import { createInitialState, createRunConfig } from './initialState.ts'
import { applyPolicyPackage } from './applyPolicyPackage.ts'
import { playRun } from '../replay/replayRun.ts'
import { calculateScore } from '../scoring/calculateScore.ts'
import { guidedStaffPackage } from '../policy/guidedStaffRule.ts'
import {
  HOLD,
  holds,
  invisibleEffect,
  playWithoutEvents,
  testConfig,
} from '../testing/harness.ts'

/**
 * The guard-rails on communication as a second instrument.
 *
 * The design promise, from docs/DIRECTION.md: what you say must be a real
 * axis of decision, not a modifier — saying "we will go further" while hiking
 * must do something different from saying "we stop here", credibility must
 * move, and markets must answer words the day they are said.
 *
 * The economics underneath is time consistency. Guidance is an *advance* on
 * the rate channel: it buys disinflation now against a promise about the path,
 * and the promise ledger makes that advance repayable — deliver the path, or
 * default on it and watch every future announcement do less. Three exploits
 * would otherwise make talk free, and each has a named test here: holding
 * forever under a hawkish promise used to accrue kept-promise credit, a
 * promise to stop could never be broken, and restating a promise every
 * meeting kept it forever young.
 *
 * The final block is the falsifiable criterion this instrument shipped
 * against: a rule that honestly announces its own intentions must beat the
 * same rule staying silent, and the same rule announcing a path it never
 * delivers must lose to silence. If either inequality fails, communication
 * has become cosmetic — do not weaken these bounds to make a change pass.
 */

/** A hawkish announcement: +100bp ahead, conditionally committed, no move. */
const ANNOUNCE: PolicyPackage = {
  actions: [{ instrument: 'forward_guidance', magnitude: 100 }],
  communication: {
    tone: 'hawkish',
    emphasis: 'inflation',
    commitment: 'conditional_path',
    channel: 'statement',
  },
}

/** The same announcement with the commitment withheld entirely. */
const REMARK: PolicyPackage = {
  actions: [{ instrument: 'forward_guidance', magnitude: 100 }],
  communication: {
    tone: 'hawkish',
    emphasis: 'inflation',
    commitment: 'none',
    channel: 'statement',
  },
}

function pkg(
  rateBp: number,
  guidanceBp: number | null,
  commitment: 'none' | 'weak_bias' | 'conditional_path' = 'conditional_path',
): PolicyPackage {
  return {
    actions: [
      ...(rateBp !== 0 ? [{ instrument: 'policy_rate', magnitude: rateBp } as const] : []),
      ...(guidanceBp !== null
        ? [{ instrument: 'forward_guidance', magnitude: guidanceBp } as const]
        : []),
    ],
    communication: {
      tone: guidanceBp !== null && guidanceBp < 0 ? 'dovish' : 'hawkish',
      emphasis: 'inflation',
      commitment,
      channel: 'statement',
    },
  }
}

/** Applies packages meeting by meeting with events off; returns final state. */
function play(seed: string, packages: readonly PolicyPackage[]) {
  return playWithoutEvents(testConfig('fed', 'easy', seed), packages)
}

describe('the market answers words the day they are said', () => {
  it('jumps the priced path toward an announced one, scaled by belief', () => {
    const config = testConfig('fed', 'easy', 'same-day')
    const state = createInitialState(config)

    const announced = applyPolicyPackage(state, ANNOUNCE)
    const silent = applyPolicyPackage(state, HOLD)
    expect(announced.ok && silent.ok).toBe(true)
    if (!announced.ok || !silent.ok) return

    const jump =
      announced.state.latent.marketExpectedRate - silent.state.latent.marketExpectedRate

    // A readable move on a series published exactly, to two decimals.
    expect(jump).toBeGreaterThan(0.1)

    // The same words from a distrusted institution do a fraction of the work.
    const distrusted = { ...state, latent: { ...state.latent, credibility: 15 } }
    const announcedLow = applyPolicyPackage(distrusted, ANNOUNCE)
    const silentLow = applyPolicyPackage(distrusted, HOLD)
    expect(announcedLow.ok && silentLow.ok).toBe(true)
    if (!announcedLow.ok || !silentLow.ok) return
    const jumpLow =
      announcedLow.state.latent.marketExpectedRate - silentLow.state.latent.marketExpectedRate
    expect(jumpLow).toBeLessThan(jump / 2)

    // And with no commitment at all, the announced path adds nothing beyond
    // what the hawkish tone alone already nudges.
    const toneOnly: PolicyPackage = { ...REMARK, actions: [] }
    const remarked = applyPolicyPackage(state, REMARK)
    const toned = applyPolicyPackage(state, toneOnly)
    expect(remarked.ok && toned.ok).toBe(true)
    if (!remarked.ok || !toned.ok) return
    expect(
      Math.abs(
        remarked.state.latent.marketExpectedRate - toned.state.latent.marketExpectedRate,
      ),
    ).toBeLessThan(1e-9)
  })
})

describe('a standing announcement pulls expectations between meetings', () => {
  // One announcement, never renewed and never delivered, measured just before
  // it matures. The honest, renewed version in the criterion below does more;
  // this pins the floor of the channel in units of the published noise.
  const HALF_HORIZON = Math.floor(GUIDANCE_HORIZON_MEETINGS * 0.75)

  it('moves one-year expectations by more than their published noise', () => {
    const treated = play('pull', [ANNOUNCE, ...holds(HALF_HORIZON)])
    const control = play('pull', holds(HALF_HORIZON + 1))
    const pull =
      treated.history[HALF_HORIZON].latent.expectedInflationShort -
      control.history[HALF_HORIZON].latent.expectedInflationShort
    expect(pull).toBeLessThan(-invisibleEffect('inflation_expectations_1y', 'easy'))
  })

  it('does a fraction of the work for an institution nobody believes', () => {
    // Credibility rebuilds itself over the mandate — that recovery is part of
    // the design — so a zero start cannot stay zero, and what is testable is
    // the ratio: the same words from a distrusted institution must pull far
    // less than from a trusted one, on the same seed and shocks.
    const config = testConfig('fed', 'easy', 'pull-distrust')
    const crushed = (latent: LatentState): LatentState => ({
      ...latent,
      credibility: 0,
    })
    const pullWith = (seed?: (latent: LatentState) => LatentState): number => {
      const treated = playWithoutEvents(config, [ANNOUNCE, ...holds(HALF_HORIZON)], seed)
      const control = playWithoutEvents(config, holds(HALF_HORIZON + 1), seed)
      return (
        treated.history[HALF_HORIZON].latent.expectedInflationShort -
        control.history[HALF_HORIZON].latent.expectedInflationShort
      )
    }
    const trusted = pullWith()
    const distrusted = pullWith(crushed)
    expect(trusted).toBeLessThan(0)
    expect(Math.abs(distrusted)).toBeLessThan(Math.abs(trusted) / 2)
  })
})

describe('the promise ledger: talk is an advance, not a gift', () => {
  it('holding under a promise earns no kept-promise credit', () => {
    const state = play('ledger-hold', [ANNOUNCE, ...holds(3)])
    expect(state.guidance.keptPromises).toBe(0)
    expect(state.guidance.brokenPromises).toBe(0)
  })

  it('each delivered step toward the announced path earns credit', () => {
    const state = play('ledger-deliver', [pkg(0, 100), pkg(50, null), pkg(50, null)])
    expect(state.guidance.keptPromises).toBe(2)
    expect(state.guidance.brokenPromises).toBe(0)
  })

  it('a promise to stop is a promise, and a hike breaks it', () => {
    const state = play('ledger-pause', [pkg(0, 0), pkg(50, null)])
    expect(state.guidance.brokenPromises).toBe(1)
  })

  it('a move away from the announced path breaks the promise', () => {
    const state = play('ledger-reverse', [pkg(0, 100), pkg(-50, null)])
    expect(state.guidance.brokenPromises).toBe(1)
  })

  it('rewriting the path with words breaks it like a move would', () => {
    const state = play('ledger-rewrite', [pkg(0, 100), pkg(0, -25)])
    expect(state.guidance.brokenPromises).toBe(1)
  })

  it('withdrawing the commitment while the path is undelivered breaks it', () => {
    const state = play('ledger-withdraw', [pkg(0, 100), pkg(0, 100, 'weak_bias')])
    expect(state.guidance.brokenPromises).toBe(1)
  })

  it('stepping down after delivering the path is a promise kept, not broken', () => {
    const state = play('ledger-arrived', [pkg(0, 50), pkg(50, null), pkg(0, 0, 'weak_bias')])
    expect(state.guidance.brokenPromises).toBe(0)
    expect(state.guidance.keptPromises).toBeGreaterThanOrEqual(2)
  })

  it('an undelivered promise comes due at the horizon and expires', () => {
    const state = play('ledger-maturity', [ANNOUNCE, ...holds(GUIDANCE_HORIZON_MEETINGS)])
    expect(state.guidance.brokenPromises).toBe(1)
    expect(state.guidance.impliedRatePath).toBeNull()
  })

  it('restating the same promise every meeting cannot keep it young', () => {
    const restated = Array.from({ length: GUIDANCE_HORIZON_MEETINGS }, () => pkg(0, 100))
    const state = play('ledger-restate', [pkg(0, 100), ...restated])
    expect(state.guidance.brokenPromises).toBeGreaterThanOrEqual(1)
  })

  it('a bias binds nothing: it expires unjudged either way', () => {
    const state = play('ledger-bias', [
      pkg(0, 100, 'weak_bias'),
      ...holds(GUIDANCE_HORIZON_MEETINGS),
    ])
    expect(state.guidance.brokenPromises).toBe(0)
    expect(state.guidance.keptPromises).toBe(0)
    expect(state.guidance.impliedRatePath).toBeNull()
  })

  it('the same announcement is worth more delivered than defaulted on', () => {
    // Latent credibility folds in inflation performance, which a hawkish pull
    // improves even when the promise behind it is broken — so the clean
    // comparison holds the announcement fixed and varies only the delivery.
    // Market trust carries the mechanical cost of the default against
    // silence; credibility separates the deliverer from the defaulter even
    // though delivering also costs banking stress.
    const broken = play('ledger-cost', [ANNOUNCE, ...holds(GUIDANCE_HORIZON_MEETINGS)])
    const silent = play('ledger-cost', holds(GUIDANCE_HORIZON_MEETINGS + 1))
    const delivered = play('ledger-cost', [
      pkg(0, 100),
      pkg(50, null),
      pkg(50, null),
      ...holds(GUIDANCE_HORIZON_MEETINGS - 2),
    ])
    expect(broken.latent.marketTrust).toBeLessThan(silent.latent.marketTrust)
    expect(broken.guidance.brokenPromises).toBe(1)
    expect(delivered.guidance.brokenPromises).toBe(0)
    expect(delivered.latent.credibility).toBeGreaterThan(broken.latent.credibility)
  })
})

describe('the falsifiable criterion: honesty pays and bluffing costs', () => {
  /**
   * Paired per seed, so the economy and its shocks are identical inside each
   * comparison and the difference is caused by the words alone. The margins
   * are set well inside the measured effects (fed +33 se 4.6, ecb +50 se 6.9,
   * bluff -108 and -124) so recalibration has room, but the *sign* of each
   * inequality is the design promise itself. If one of these fails, the
   * second instrument has stopped mattering, or stopped costing: do not
   * weaken the bound — fix the mechanism.
   */
  const SEEDS = 120
  const MIN_HONEST_GAIN = { fed: 10, ecb: 20 } as const
  const MIN_BLUFF_LOSS = 40

  for (const institution of ['fed', 'ecb'] as const) {
    it(`announcing real intentions beats silence on ${institution}/easy`, () => {
      let honestGain = 0
      let bluffLoss = 0
      let honestBroken = 0
      let bluffBroken = 0

      for (let run = 0; run < SEEDS; run += 1) {
        const config = createRunConfig({
          institution,
          difficulty: 'easy',
          seed: `criterion-${run}`,
          simulationVersion: SIMULATION_VERSION,
        })
        const scores: Record<'silent' | 'honest' | 'bluff', number> = {
          silent: 0,
          honest: 0,
          bluff: 0,
        }
        for (const honesty of ['silent', 'honest', 'bluff'] as const) {
          const session = playRun(config, (current) =>
            guidedStaffPackage(current, institution, 'easy', honesty),
          )
          scores[honesty] = calculateScore(session.state, session.outcome).score
          if (honesty === 'honest') honestBroken += session.state.guidance.brokenPromises
          if (honesty === 'bluff') bluffBroken += session.state.guidance.brokenPromises
        }
        honestGain += scores.honest - scores.silent
        bluffLoss += scores.silent - scores.bluff
      }

      honestGain /= SEEDS
      bluffLoss /= SEEDS
      honestBroken /= SEEDS
      bluffBroken /= SEEDS

      expect(
        honestGain,
        `honest guidance gains ${honestGain.toFixed(1)} points over silence on ` +
          `${institution}/easy (needs > ${MIN_HONEST_GAIN[institution]}). ` +
          `Communication has become cosmetic. See docs/BALANCE.md.`,
      ).toBeGreaterThan(MIN_HONEST_GAIN[institution])

      expect(
        bluffLoss,
        `bluffing loses only ${bluffLoss.toFixed(1)} points versus silence on ` +
          `${institution}/easy (needs > ${MIN_BLUFF_LOSS}). Talk without ` +
          `delivery has become free. See docs/BALANCE.md.`,
      ).toBeGreaterThan(MIN_BLUFF_LOSS)

      // The ledger tells the two apart for the right reason: the honest rule
      // delivers what it announces, the bluffer defaults about once a year.
      expect(honestBroken).toBeLessThan(0.4)
      expect(bluffBroken).toBeGreaterThan(0.9)
    })
  }
})
