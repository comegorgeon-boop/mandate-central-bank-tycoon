import type { Difficulty, Institution } from '../types/core.ts'
import type {
  CommunicationTone,
  PolicyAction,
  PolicyPackage,
} from '../types/policy.ts'
import type { RunSession } from '../replay/replayRun.ts'
import { staffRecommendation } from './staffRule.ts'

/**
 * The staff rule with a voice: the same rate decisions as `staffRule.ts`, plus
 * a forward-guidance announcement about where those decisions are heading.
 *
 * This is the benchmark family that decides whether communication is an
 * instrument or a decoration, and `engine/guidance.test.ts` pins the verdict:
 * announcing the rule's own intentions honestly must beat staying silent, and
 * announcing a path the rule has no intention of delivering must lose to it.
 * If either inequality fails, the second axis is cosmetic and must not ship.
 *
 * Three honesty modes:
 *
 * - `silent` — the rate decisions alone, with the same minimal statement the
 *   old sweep benchmarks used. The control.
 * - `honest` — announces most of the remaining distance to the rule's own
 *   desired rate, binding itself only when it has something substantial to
 *   say: a conditional commitment for a real path, a weak bias for drift.
 *   Because the rule smooths a quarter of the way each meeting, what it
 *   announces is what it will in fact do, so its promises mature kept.
 * - `bluff` — announces maximum tightening ahead at every meeting under a
 *   conditional commitment, regardless of what the rule intends to do. Talk
 *   without delivery: the promise ledger and the surprise channel should make
 *   this strictly worse than silence.
 */

/** Share of the remaining distance to the desired rate the honest mode announces. */
const HONEST_SHARE = 0.7

/** Announced paths at least this large, in bp, carry a conditional commitment. */
const BINDING_SIGNAL_BP = 50

export type GuidanceHonesty = 'silent' | 'honest' | 'bluff'

export function guidedStaffPackage(
  session: RunSession,
  institution: Institution,
  difficulty: Difficulty,
  honesty: GuidanceHonesty,
): PolicyPackage {
  const advice = staffRecommendation(session.observation, institution, difficulty)
  const move = advice?.basisPoints ?? 0
  const actions: PolicyAction[] = move === 0 ? [] : [{ instrument: 'policy_rate', magnitude: move }]
  const moveTone: CommunicationTone = move > 0 ? 'hawkish' : move < 0 ? 'dovish' : 'neutral'

  if (honesty === 'silent' || advice === null) {
    return {
      actions,
      communication: {
        tone: moveTone,
        emphasis: 'inflation',
        commitment: 'weak_bias',
        channel: 'statement',
      },
    }
  }

  let signal: number
  if (honesty === 'bluff') {
    signal = 100
  } else {
    const rateAfter = session.state.stance.targetRate + move / 100
    const remaining = advice.desiredRate - rateAfter
    signal = Math.max(
      -100,
      Math.min(100, Math.round((remaining * HONEST_SHARE * 100) / 25) * 25),
    )
  }

  actions.push({ instrument: 'forward_guidance', magnitude: signal })
  const commitment =
    honesty === 'bluff' || Math.abs(signal) >= BINDING_SIGNAL_BP
      ? 'conditional_path'
      : 'weak_bias'
  const tone: CommunicationTone =
    signal > 0 ? 'hawkish' : signal < 0 ? 'dovish' : moveTone

  return {
    actions,
    communication: { tone, emphasis: 'inflation', commitment, channel: 'statement' },
  }
}
