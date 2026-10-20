import {
  meetingLabel,
  scenarioOf,
  type EndConditionResult,
  type SimulationState,
} from '../../simulation/index.ts'

/**
 * What a historical scenario says when you do not reach its last meeting.
 *
 * > "Ton verdict pour les sept scénarios — « vous avez été démis en mars
 * > 1931 ; le vrai a servi jusqu'en 1933 » — garde-le tel quel."
 *
 * ## Why the scenarios did not get the survival structure
 *
 * They have **dates**. 1929-33 is thirty meetings because it is August 1929 to
 * the end of 1932. Britain leaves gold at meeting 17 because that is 21
 * September 1931. Burns gets his price controls at meeting 8 because that is
 * when they happened. The meeting count is not a setting there; it is a
 * calendar, and a calendar cannot be a difficulty option.
 *
 * So tenure applies to fictional mandates only, and all seven counts stay
 * exactly as they are — 30, 24, 32, 19, 24, 20, 20. Nothing in the fits, the
 * event slots or the Okun adjustment table moves.
 *
 * ## What they got instead
 *
 * A verdict. Revocation was always live in a scenario — the catastrophes and
 * the dismissal bar have never been switched off — but the report had no way
 * of saying what that meant *against the history*. Now it does, and it is the
 * one line that makes the Volcker scenario say the thing it is about: he
 * nearly was.
 */
export function scenarioVerdict(
  state: SimulationState,
  outcome: EndConditionResult,
): string | null {
  const scenario = scenarioOf(state.config)
  if (scenario === null) return null
  if (outcome.status !== 'failed') return null

  // The date you left, and the date the record ran to.
  const left = meetingLabel(state.config, Math.max(0, state.meetingIndex - 1))
  const last = meetingLabel(state.config, scenario.meetingCount - 1)
  if (left === null || last === null) return null

  const served = state.meetingIndex
  const full = scenario.meetingCount
  const short = full - served

  return (
    `You were let go in ${left}. The real one served to ${last} — ` +
    `${short} more ${short === 1 ? 'meeting' : 'meetings'} than you had.`
  )
}

/**
 * The same comparison for a scenario that *was* played to its end.
 *
 * Not a congratulation: serving the whole calendar is the baseline a
 * historical chair managed, not an achievement over them. What it is for is to
 * make the pairing symmetrical, so that reading "you served it all" and
 * reading "you were let go in March 1931" are the same kind of statement about
 * the same measuring stick.
 */
export function scenarioTenureNote(
  state: SimulationState,
  outcome: EndConditionResult,
): string | null {
  const scenario = scenarioOf(state.config)
  if (scenario === null) return null
  if (outcome.status === 'failed') return null

  const last = meetingLabel(state.config, scenario.meetingCount - 1)
  if (last === null) return null
  return `You served the whole record, to ${last}, as the real one did.`
}
