import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  SIMULATION_VERSION,
  calculateScore,
  createRunConfig,
  getInstrument,
  getInstrumentRange,
  instrumentRangesFor,
  startRun,
  submitMeeting,
  type MeetingResult,
  type PolicyPackage,
  type RunConfig,
} from '../../simulation/index.ts'
import {
  RunContext,
  type ActiveRun,
  type FinishedRun,
  type RunContextValue,
  type StartRunOptions,
} from './runContext.ts'
import {
  pruneLedger,
  recordInstruments,
} from '../policy/instrumentLedger.ts'
import { settledPromise } from '../policy/settledPromise.ts'
import { advanceArms, openArms } from './counterfactualRun.ts'
import { advanceScoreboard, openScoreboard } from './doctrineScoreboard.ts'
import { makeRunId } from './seed.ts'

/** The largest move the desk allows, which caps every school's advice. */
function maxMoveFor(config: RunConfig): number {
  const instrument = getInstrument('policy_rate')
  return instrument === undefined
    ? 150
    : getInstrumentRange(instrument, config.difficulty, instrumentRangesFor(config)).max
}

/** Verdict returned when a package arrives with no run open to apply it to. */
const NO_ACTIVE_RUN: MeetingResult = {
  ok: false,
  validation: {
    ok: false,
    rejections: [
      {
        instrument: null,
        code: 'unavailable_at_difficulty',
        message: 'There is no run in progress.',
      },
    ],
    contradictions: [],
  },
}

export function RunProvider({ children }: { readonly children: ReactNode }) {
  const [active, setActive] = useState<ActiveRun | null>(null)
  const [finished, setFinished] = useState<FinishedRun | null>(null)

  const begin = useCallback((options: StartRunOptions) => {
    const config = createRunConfig({
      institution: options.institution,
      difficulty: options.difficulty,
      seed: options.seed,
      simulationVersion: SIMULATION_VERSION,
      scenario: options.scenario ?? null,
    })
    const session = startRun(config)
    setActive({
      runId: makeRunId(options.seed),
      session,
      ledger: [],
      settled: null,
      arms: openArms(session),
      scoreboard: openScoreboard(),
    })
    setFinished(null)
  }, [])

  const submit = useCallback(
    (pkg: PolicyPackage): MeetingResult => {
      if (active === null) return NO_ACTIVE_RUN

      // Recorded before the package is applied: the counterfactual is only
      // the right one from the state the decision was actually taken in.
      const recorded = recordInstruments(active.session, pkg)

      const result = submitMeeting(active.session, pkg)
      if (!result.ok) return result

      const session = result.session
      const scoreboard = advanceScoreboard(
        active.scoreboard,
        active.session,
        session,
        pkg,
        maxMoveFor(active.session.state.config),
      )
      setActive({
        runId: active.runId,
        session,
        ledger: pruneLedger(
          [...active.ledger, ...recorded],
          session.state.meetingIndex,
        ),
        settled: settledPromise(
          active.session.state.guidance,
          session.state.guidance,
          session.state.config.difficulty,
        ),
        // The same meeting, played again with each lever held still and the
        // same shocks applied verbatim. Exact, not estimated.
        arms: advanceArms(active.arms, active.session, session, pkg),
        // Every school that disagreed with this decision is now on trial,
        // and the ones whose trials have come due are judged.
        scoreboard,
      })

      // The engine decides when a mandate is over; the score is computed once,
      // here, so the result screen never recomputes it from a moving state.
      if (session.outcome.status !== 'active') {
        setFinished({
          runId: active.runId,
          session,
          score: calculateScore(session.state, session.outcome),
          scoreboard,
        })
      }

      return result
    },
    [active],
  )

  const reset = useCallback(() => {
    setActive(null)
    setFinished(null)
  }, [])

  const value = useMemo<RunContextValue>(
    () => ({ active, finished, begin, submit, reset }),
    [active, finished, begin, submit, reset],
  )

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>
}
