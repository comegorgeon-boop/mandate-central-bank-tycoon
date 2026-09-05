import type { Difficulty, Institution } from '../types/core.ts'
import type { PolicyAction, PolicyPackage } from '../types/policy.ts'
import type { RunSession } from '../replay/replayRun.ts'
import { availableInstruments } from '../config/instruments.ts'
import { staffRecommendation } from './staffRule.ts'

/**
 * The staff rule, playing the whole toolkit rather than the policy rate alone.
 *
 * Every benchmark in this project until now moved one instrument. That was
 * honest while the rate was the only instrument a player could reach, and it
 * stopped being honest the moment the desk opened the balance sheet and the
 * facilities: measuring whether a difficulty is winnable with a policy that
 * declines to use eleven of its twelve instruments measures the benchmark, not
 * the difficulty.
 *
 * It is still deliberately mediocre, and that matters — if a rule this crude
 * sweeps a difficulty, the difficulty has no decision problem in it. What it
 * adds over `staffRule` is only what any competent committee would do without
 * thinking:
 *
 * - **Never bind to a path it read off untrustworthy data.** Words carry a
 *   leaning, never a promise. This is not caution for its own sake: measured
 *   at hard, the honest *binding* rule breaks 2.3-2.9 promises a mandate,
 *   because hard's observation noise moves its own target between meetings, and
 *   is dismissed in 57-59 % of runs against 19-21 % for the same rule speaking
 *   without binding itself. Committing firmly to a forecast you cannot trust
 *   is a real error and the engine is right to be lethal about it.
 * - **Answer financial stress with the liquidity instruments**, which exist for
 *   exactly that and cost almost nothing when they are not needed.
 * - **Stop draining reserves into a crisis.** Runoff into rising banking stress
 *   is procyclical, and the balance sheet is the instrument that undoes it.
 * - **Never send two signals at once.** Buying assets while raising the rate is
 *   a contradiction the engine prices at 0.4 severity a meeting, and a rule
 *   that did it completed 30 % of hard mandates against 41 % for the same rule
 *   using the rate alone — the facilities were helping and the mixed signal was
 *   costing more than they gained. Liquidity support carries no such conflict,
 *   so it stays.
 *
 * Nothing here reads latent state. Like `staffRule`, it sees the same noisy,
 * late published series the player sees.
 */

/**
 * Banking stress at which the facilities are worth escalating, and the lower
 * level at which they are wound back.
 *
 * Two bars rather than one, because a single one makes the rule *thrash*. Read
 * off the published proxy, which carries a meeting of publication lag and, at
 * hard, six points of noise: a rule that escalates above 45 and stands down
 * below 45 flips its whole balance-sheet stance on measurement error, and
 * measured that way it was setting runoff and taking it off again often enough
 * to trip `easing_rate_while_tightening_balance_sheet` in 14-24 % of meetings.
 * A committee does not reverse its balance-sheet policy because a print moved
 * two points, and neither should the benchmark that stands in for one.
 */
const STRESS_ESCALATE = 45
const STRESS_STAND_DOWN = 30
const STRESS_SEVERE = 65

/** Credit spreads, in percentage points, that count as a funding squeeze. */
const SPREAD_SQUEEZE = 2.6

function has(
  institution: Institution,
  difficulty: Difficulty,
  id: string,
): boolean {
  return availableInstruments(institution, difficulty).some(
    (instrument) => instrument.id === id,
  )
}

export function toolkitPackage(
  session: RunSession,
  institution: Institution,
  difficulty: Difficulty,
): PolicyPackage {
  const advice = staffRecommendation(session.observation, institution, difficulty)
  const move = advice?.basisPoints ?? 0
  const actions: PolicyAction[] = []
  if (move !== 0) actions.push({ instrument: 'policy_rate', magnitude: move })

  const indicators = session.observation.indicators
  const stress = indicators.bank_stress_proxy?.value ?? 0
  const spread = indicators.credit_spread?.value ?? 0
  const stance = session.state.stance

  // Hysteresis: once the facilities are up they stay up until stress has
  // genuinely receded, rather than following each print up and down.
  const alreadySupporting =
    stance.runoffPace === 0 ||
    stance.discountWindowLevel > 0 ||
    stance.targetedRefinancing > 0 ||
    stance.assetPurchasePace > 0
  const strained = alreadySupporting
    ? stress >= STRESS_STAND_DOWN || spread >= SPREAD_SQUEEZE
    : stress >= STRESS_ESCALATE || spread >= SPREAD_SQUEEZE
  const severe = stress >= STRESS_SEVERE

  // Liquidity, where the institution has it. Escalated against real stress and
  // wound back when it passes — signalling a backstop with no stress to justify
  // it unsettles markets, which `INSTRUMENT_EFFECTS` prices directly.
  const facility = institution === 'fed' ? 'discount_window' : 'targeted_refinancing'
  if (has(institution, difficulty, facility)) {
    const wanted =
      institution === 'fed'
        ? severe
          ? 3
          : strained
            ? 2
            : 0
        : severe
          ? 3
          : strained
            ? 2
            : 0
    const current =
      institution === 'fed' ? stance.discountWindowLevel : stance.targetedRefinancing
    if (Math.abs(wanted - current) > 1e-9) {
      actions.push({ instrument: facility, magnitude: wanted })
    }
  }

  // Do not drain reserves into a squeeze — and do not drain them while easing
  // either. Cutting the rate with the balance sheet still running off is a
  // package arguing with itself through two channels at once, and the engine
  // charges for it every meeting it continues, which is right: it is exactly
  // the mixed signal real committees are criticised for.
  if (has(institution, difficulty, 'balance_sheet_runoff')) {
    const wanted = strained || move < 0 ? 0 : 1
    if (Math.abs(wanted - stance.runoffPace) > 1e-9) {
      actions.push({ instrument: 'balance_sheet_runoff', magnitude: wanted })
    }
  }

  // Buy into a genuine dislocation, and stop when it clears — but never while
  // raising the rate, which is a mixed signal the engine charges for and which
  // measurably cost more than the purchases were worth.
  if (has(institution, difficulty, 'asset_purchases')) {
    const wanted = severe && move <= 0 ? 2 : 0
    if (Math.abs(wanted - stance.assetPurchasePace) > 1e-9) {
      actions.push({ instrument: 'asset_purchases', magnitude: wanted })
    }
  }

  return {
    actions,
    communication: {
      tone: move > 0 ? 'hawkish' : move < 0 ? 'dovish' : 'neutral',
      emphasis: strained ? 'financial_stability' : 'inflation',
      // A leaning, never a promise. See the doc comment above.
      commitment: 'weak_bias',
      channel: 'statement',
    },
  }
}
