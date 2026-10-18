import {
  projectInstrument,
  standingLevel,
  type InstrumentId,
  type ObservationSet,
  type PolicyPackage,
  type RunSession,
  type SeriesId,
} from '../../simulation/index.ts'

/**
 * What an instrument was expected to do, kept until it can be checked.
 *
 * The confirmation screen answers "what will this do"; nothing answered "what
 * did it do", and a player who moves a dial, waits a year of game time and
 * never hears the outcome has not learned the instrument — they have used it
 * once, blind, which is exactly the complaint this ledger exists to answer.
 *
 * Two numbers are recorded at the moment of the decision: the engine's
 * counterfactual for that instrument alone, and the published value of each
 * series it acts on *as the player saw it that day*. When that instrument's own
 * lag has run — three meetings for a facility, eight for the policy rate —
 * both are compared against the published figure then. Observed against observed,
 * never against latent state — the interface's whole discipline is that the
 * player reads statistics rather than truth, and a verdict that quietly graded
 * itself on the truth would be reporting an accuracy nobody could have had.
 *
 * It lives in the interface, not the engine. `submitMeeting` is on the path of
 * every balance sweep and every replay, and none of them needs a projection;
 * paying for two extra engine runs per instrument per meeting across a
 * 150-seed sweep to serve a panel only a human ever sees would be a poor trade.
 */

export interface LedgerLine {
  readonly seriesId: SeriesId
  readonly label: string
  readonly unit: string
  readonly decimals: number
  /** The instrument's own contribution at the horizon, from the engine. */
  readonly projectedDelta: number
  /** The published value on the day of the decision. Null if unpublished. */
  readonly observedThen: number | null
}

export interface LedgerEntry {
  readonly decidedAtMeeting: number
  /** The meeting at which this entry can be checked. */
  readonly dueAtMeeting: number
  readonly instrument: InstrumentId
  readonly label: string
  readonly unit: 'basis_points' | 'percent_of_gdp' | 'ordinal' | 'index_points'
  readonly from: number
  readonly to: number
  readonly lines: readonly LedgerLine[]
}

/** One line of the verdict: what was expected, beside what happened. */
export interface RealisedLine extends LedgerLine {
  /** The published value now. Null if either end is unpublished. */
  readonly observedNow: number | null
  /** Total movement over the span, from everything, not just this instrument. */
  readonly actualDelta: number | null
  /** True when the total moved the way this instrument was pushing. */
  readonly sameDirection: boolean
}

export interface RealisedEntry extends LedgerEntry {
  readonly lines: readonly RealisedLine[]
  readonly meetingsElapsed: number
}

/**
 * Records what this package's instruments are expected to do.
 *
 * Called with the session *before* the package is applied, which is the only
 * state from which the counterfactual is the right one.
 */
export function recordInstruments(
  session: RunSession,
  pkg: PolicyPackage,
): readonly LedgerEntry[] {
  const decidedAtMeeting = session.state.meetingIndex
  const entries: LedgerEntry[] = []

  for (const action of pkg.actions) {
    // Guidance is judged by whether it was kept, not by a projection — see
    // `guidancePreview` and the credibility mechanics it feeds.
    if (action.instrument === 'forward_guidance') continue

    const from =
      action.instrument === 'policy_rate'
        ? session.state.stance.targetRate
        : (standingLevel(session.state.stance, action.instrument) ?? 0)
    const effect = projectInstrument(
      session.state,
      action,
      action.instrument === 'policy_rate' ? 0 : from,
    )
    if (effect === null || effect.negligible) continue

    entries.push({
      decidedAtMeeting,
      // Each instrument is checked at its own horizon, which is the one it was
      // projected at — a rate rise read back four meetings later would be read
      // halfway through its own transmission.
      dueAtMeeting: decidedAtMeeting + effect.horizonMeetings,
      instrument: action.instrument,
      label: effect.label,
      unit: effect.unit,
      // The rate is chosen as a change and lives as a level, so the ledger
      // records where it went rather than how far it moved: "3.25 % → 3.75 %"
      // is what a player checking back several meetings later can recognise.
      from,
      to:
        action.instrument === 'policy_rate'
          ? from + action.magnitude / 100
          : action.magnitude,
      lines: effect.lines
        .filter((line) => !line.negligible)
        .map((line) => ({
          seriesId: line.seriesId,
          label: line.label,
          unit: line.unit,
          decimals: line.decimals,
          projectedDelta: line.delta,
          observedThen:
            session.observation.indicators[line.seriesId]?.value ?? null,
        })),
    })
  }

  return entries
}

/** Entries whose horizon has been reached, checked against today's figures. */
export function realiseDue(
  ledger: readonly LedgerEntry[],
  meetingIndex: number,
  observation: ObservationSet,
): readonly RealisedEntry[] {
  return ledger
    .filter((entry) => entry.dueAtMeeting === meetingIndex)
    .map((entry) => ({
      ...entry,
      meetingsElapsed: meetingIndex - entry.decidedAtMeeting,
      lines: entry.lines.map((line) => {
        const observedNow = observation.indicators[line.seriesId]?.value ?? null
        const actualDelta =
          observedNow === null || line.observedThen === null
            ? null
            : observedNow - line.observedThen
        return {
          ...line,
          observedNow,
          actualDelta,
          sameDirection:
            actualDelta !== null && actualDelta * line.projectedDelta > 0,
        }
      }),
    }))
}

/** Drops entries too old to be checked, so the ledger cannot grow unbounded. */
export function pruneLedger(
  ledger: readonly LedgerEntry[],
  meetingIndex: number,
): readonly LedgerEntry[] {
  return ledger.filter((entry) => entry.dueAtMeeting >= meetingIndex)
}
