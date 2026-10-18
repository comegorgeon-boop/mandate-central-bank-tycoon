import {
  advanceArm,
  attribute,
  withoutGroup,
  type FrozenSet,
  type PolicyPackage,
  type RunSession,
  type SeriesAttribution,
  type SeriesId,
  type SimulationState,
} from '../../simulation/index.ts'

/**
 * The counterfactual arms, advanced in lockstep with the real mandate.
 *
 * One state per lever held still, plus one with everything held still. Each is
 * advanced by exactly one meeting when the real run is, with the same shocks
 * applied verbatim — so this is a fixed multiple of one meeting's work however
 * long the mandate runs, rather than a replay from the start every time.
 *
 * It lives in the interface layer for the same reason the instrument ledger
 * and the settled promise do: `submitMeeting` is on the path of every balance
 * sweep and every replay, and none of them needs five extra economies running
 * beside them to serve a line of text only a human reads.
 */

/** Everything held still, then each lever held still on its own. */
const ARMS: readonly FrozenSet[] = [
  'everything',
  'policy_rate',
  'balance_sheet',
  'facilities',
  'communication',
]

/**
 * What the line is allowed to lead on.
 *
 * The two halves of the mandate and the fastest channel, which is the same
 * short list the package projection uses and for the same reason: an
 * attribution over eight series is not an attribution, it is a table.
 */
const ATTRIBUTED: readonly SeriesId[] = [
  'headline_inflation',
  'unemployment',
  'market_expected_rate',
]

export type CounterfactualArms = Readonly<Partial<Record<FrozenSet, SimulationState>>>

/** Opens every arm on the run's own starting state. */
export function openArms(session: RunSession): CounterfactualArms {
  const arms: Partial<Record<FrozenSet, SimulationState>> = {}
  for (const frozen of ARMS) arms[frozen] = session.state
  return arms
}

/**
 * Advances every arm through the meeting the real run just played.
 *
 * `before` is the session as it stood when the package was confirmed, and
 * `after` is the result: the events that fired are the ones `after` recorded
 * at `before`'s meeting index, and they are replayed into each arm exactly as
 * they landed in the real world.
 */
export function advanceArms(
  arms: CounterfactualArms,
  before: RunSession,
  after: RunSession,
  pkg: PolicyPackage,
): CounterfactualArms {
  const meetingIndex = before.state.meetingIndex
  const events = after.state.eventLog.filter(
    (record) => record.meetingIndex === meetingIndex,
  )

  const next: Partial<Record<FrozenSet, SimulationState>> = {}
  for (const frozen of ARMS) {
    const state = arms[frozen]
    if (state === undefined) continue
    next[frozen] = advanceArm(state, withoutGroup(pkg, frozen), events)
  }
  return next
}

/** What the policy has delivered so far, series by series. */
export function readAttribution(
  session: RunSession,
  arms: CounterfactualArms,
): readonly SeriesAttribution[] {
  return attribute(session.state, arms, ATTRIBUTED)
}
