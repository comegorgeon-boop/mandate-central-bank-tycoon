import {
  SIMULATION_VERSION,
  availableInstruments,
  calculateScore,
  createRunConfig,
  getInstrument,
  getInstrumentRange,
  instrumentRangesFor,
  playRun,
  scenarioOf,
  type PolicyPackage,
  type RunSession,
  type Scenario,
  type ScoreBreakdown,
} from '../../simulation/index.ts'

/**
 * The standard: your mandate against what actually happened.
 *
 * The end of a historical scenario, and the reason it is a historical scenario
 * rather than a hard mode with dates on it. The rate that actually prevailed
 * at each meeting is in `docs/SCENARIOS.md`, sourced; here it is replayed
 * through the same engine, on the same seed, against the same shocks, so that
 * "what would have happened if you had done what they did" is an answer and
 * not a rhetorical question.
 *
 * ## What the benchmark path is, and is not
 *
 * It is the monthly average **effective** federal funds rate for the month of
 * each meeting. It is **not** a target the Committee voted. Between October
 * 1979 and October 1982 the FOMC voted reserve paths and the rate was an
 * outcome of those votes — which is the whole point of the period — so the
 * comparison is between what you chose and *what prevailed*. The screen says
 * so, because a reader who took this column for a sequence of decisions would
 * be learning the opposite of the period's central fact.
 *
 * The replay is also not a claim that the history would repeat: it is played
 * against *your* seed's shocks, not against 1979's. On a seed whose draws went
 * differently, the policy that worked may not. That is the interesting case
 * and the copy says so rather than hiding it.
 */

export interface StandardMeeting {
  readonly meetingIndex: number
  readonly label: string
  /** The rate that actually prevailed over that month, %. */
  readonly actual: number
  /** What the player's rate was standing at when that meeting opened. */
  readonly yours: number | null
}

export interface TheStandard {
  readonly scenario: Scenario
  readonly meetings: readonly StandardMeeting[]
  /** Mean absolute distance between the two paths, in points. */
  readonly meanGap: number
  /** Meetings at which the player was tighter than the history. */
  readonly tighter: number
  /** Meetings at which the player was easier. */
  readonly easier: number
  readonly player: ScoreBreakdown
  /** The history replayed on the player's seed, with its own outcome. */
  readonly replay: {
    readonly score: ScoreBreakdown
    readonly completed: boolean
    readonly endedAs: string | null
    readonly meetings: number
    readonly finalInflation: number
    readonly peakUnemployment: number
  }
  readonly yours: {
    readonly finalInflation: number
    readonly peakUnemployment: number
  }
}

/** Within this, the two paths are the same decision. */
const SAME_DECISION = 0.13

/** The rate move that takes the stance to `want`, on the grid and in range. */
function moveToward(session: RunSession, want: number, max: number, increment: number): number {
  const current = session.state.stance.targetRate
  const raw = Math.round(((want - current) * 100) / increment) * increment
  const capped = Math.max(-max, Math.min(max, raw))
  // Never propose a move the validator would refuse: a rejected package would
  // end the replay on a technicality rather than on the history.
  return current + capped / 100 < 0 ? 0 : capped
}

export function buildTheStandard(
  session: RunSession,
  score: ScoreBreakdown,
): TheStandard | null {
  const scenario = scenarioOf(session.state.config)
  if (scenario === null) return null

  const source = session.state.config
  const config = createRunConfig({
    institution: source.institution,
    difficulty: source.difficulty,
    seed: source.seed,
    simulationVersion: SIMULATION_VERSION,
    scenario: scenario.id,
  })

  // The window is not universal. The ECB has none, and 1929's Federal Reserve
  // has one but no `asset_purchases`; a replay that proposed an instrument the
  // institution does not hold throws out of `playRun` — and this runs inside a
  // `useMemo` on the result screen, so the throw took the **entire result
  // page** down to a blank white screen. Found by playing a euro-area scenario
  // to the end and looking at it; 952 tests were green at the time.
  const lendsAtWindow =
    !scenario.withheldInstruments.includes('discount_window') &&
    availableInstruments(config.institution, config.difficulty).some(
      (entry) => entry.id === 'discount_window',
    )

  const instrument = getInstrument('policy_rate')
  const range =
    instrument === undefined
      ? { min: -300, max: 300, increment: 25 }
      : getInstrumentRange(instrument, config.difficulty, instrumentRangesFor(config))

  const replaySession = playRun(config, (current): PolicyPackage => {
    const index = Math.min(current.state.meetingIndex, scenario.calendar.length - 1)
    const want = scenario.calendar[index].benchmarkRate
    const move = moveToward(current, want, range.max, range.increment)

    // The rate, and the window. Tightening with one while lending with the
    // other is what the Federal Reserve of 1982 did, and a replay that only
    // moved the rate would be handing the history a banking crisis it did not
    // have. The window opens with stress rather than on a schedule, because
    // that is what a lender of last resort is.
    const stress = current.state.latent.bankingStress
    const window = stress > 40 ? 3 : stress > 28 ? 2 : stress > 20 ? 1 : 0
    const actions: PolicyPackage['actions'] = [
      ...(move === 0 ? [] : [{ instrument: 'policy_rate' as const, magnitude: move }]),
      ...(window === current.state.stance.discountWindowLevel || !lendsAtWindow
        ? []
        : [{ instrument: 'discount_window' as const, magnitude: window }]),
    ]
    return { actions, communication: null }
  })

  const meetings: StandardMeeting[] = scenario.calendar.map((meeting, index) => ({
    meetingIndex: index,
    label: meeting.label,
    actual: meeting.benchmarkRate,
    yours: session.state.history[index]?.latent.policyRate ?? null,
  }))

  const compared = meetings.filter((meeting) => meeting.yours !== null)
  const gaps = compared.map((meeting) => (meeting.yours as number) - meeting.actual)
  const meanGap =
    gaps.length === 0
      ? 0
      : gaps.reduce((total, gap) => total + Math.abs(gap), 0) / gaps.length

  const peak = (history: RunSession['state']['history']): number =>
    history.reduce((highest, snapshot) => Math.max(highest, snapshot.latent.unemployment), 0)

  return {
    scenario,
    meetings,
    meanGap,
    tighter: gaps.filter((gap) => gap > SAME_DECISION).length,
    easier: gaps.filter((gap) => gap < -SAME_DECISION).length,
    player: score,
    replay: {
      score: calculateScore(replaySession.state, replaySession.outcome),
      completed: replaySession.outcome.status === 'completed',
      endedAs: replaySession.outcome.label,
      meetings: replaySession.state.meetingIndex,
      finalInflation:
        replaySession.state.history.at(-1)?.latent.inflationHeadline ?? 0,
      peakUnemployment: peak(replaySession.state.history),
    },
    yours: {
      finalInflation: session.state.history.at(-1)?.latent.inflationHeadline ?? 0,
      peakUnemployment: peak(session.state.history),
    },
  }
}
