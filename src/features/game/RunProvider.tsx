import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  SIMULATION_VERSION,
  calculateScore,
  theScore,
  scoreBucketKey,
  createRunConfig,
  getInstrument,
  getInstrumentRange,
  instrumentRangesFor,
  configFromLog,
  startRun,
  submitMeeting,
  type DecisionLog,
  type MeetingResult,
  type PolicyPackage,
  type RunConfig,
} from '../../simulation/index.ts'
import {
  RunContext,
  type ActiveRun,
  type FinishedRun,
  type ResumeResult,
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
import {
  bestByBucket,
  clearSave,
  loadSave,
  recordResult,
  saveRun,
} from '../records/storage.ts'

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

  /**
   * Rebuild the whole derived run state from a session.
   *
   * Used by both `begin` and `resume`, and shared rather than duplicated
   * because the counterfactual arms, the ledger and the doctrine scoreboard
   * are *derived* from the decisions — a resume that opened them empty would
   * produce a mandate whose second half was compared against a counterfactual
   * that had not been running during its first.
   */
  const rebuild = useCallback(
    (runId: string, log: DecisionLog): ActiveRun | null => {
      let arms = openArms(startRun(configFromLog(log)))
      let scoreboard = openScoreboard()
      let ledger: ActiveRun['ledger'] = []
      let settled: ActiveRun['settled'] = null

      // Walk the log forward, keeping the derived structures in step. This is
      // the same loop `submit` runs, which is why it produces the same state.
      let step = startRun(configFromLog(log))
      for (const entry of log.decisions) {
        const recorded = recordInstruments(step, entry.package)
        const result = submitMeeting(step, entry.package)
        if (!result.ok) break
        const next = result.session
        scoreboard = advanceScoreboard(
          scoreboard,
          step,
          next,
          entry.package,
          maxMoveFor(step.state.config),
        )
        arms = advanceArms(arms, step, next, entry.package)
        ledger = pruneLedger([...ledger, ...recorded], next.state.meetingIndex)
        settled = settledPromise(
          step.state.guidance,
          next.state.guidance,
          next.state.config.difficulty,
        )
        step = next
      }

      // The log must replay in full. A partial replay means the save no
      // longer describes a reachable mandate — a rejected package, a changed
      // instrument range — and resuming into half of one would be worse than
      // refusing.
      if (step.state.meetingIndex !== log.decisions.length) return null
      return { runId, session: step, ledger, settled, arms, scoreboard }
    },
    [],
  )

  const resume = useCallback((): ResumeResult => {
    const stored = loadSave()
    if (stored === null) {
      return { ok: false, error: 'There is nothing saved on this device.' }
    }
    const rebuilt = rebuild(makeRunId(stored.log.seed), stored.log)
    if (rebuilt === null) {
      clearSave()
      return {
        ok: false,
        error:
          'The saved mandate no longer replays on this build, so it has been ' +
          'discarded rather than resumed into a model that has changed under it.',
      }
    }
    setActive(rebuilt)
    setFinished(null)
    return { ok: true }
  }, [rebuild])

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
        const score = calculateScore(session.state, session.outcome)

        // Read *before* `recordResult` writes this mandate into the history.
        // One line, in the only place it can go: everything downstream — the
        // result screen included — sees a record list that already contains
        // this run, and comparing a run against a history containing itself
        // reports every mandate as never having been beaten.
        const bucket =
          session.state.config.scenario ??
          scoreBucketKey(
            session.state.config.institution,
            session.state.config.difficulty,
            SIMULATION_VERSION,
          )
        const previousBest = bestByBucket().get(bucket) ?? null

        setFinished({
          runId: active.runId,
          session,
          score,
          scoreboard,
          previousBest,
        })
        // A finished mandate is remembered and the save is dropped: there is
        // nothing left to resume, and a save that outlived its own run would
        // offer the player a mandate that had already been scored.
        clearSave()
        recordResult({
          /*
           * **The banked total, which is the score.** This recorded
           * `score.score`, the graded one — so the records page and every
           * personal best ranked mandates by the number that prefers an early
           * exit, while the report's headline showed the banked figure. A
           * fourteen-year mandate stored 1,741 beside the 5,437 the player had
           * just read. See `scoring/theScore.ts`.
           */
          score: theScore(session.state).total,
          outcome: session.outcome.triggered ?? 'mandate_completed',
          outcomeLabel: session.outcome.label ?? 'Mandate completed',
          meetingsServed: session.state.meetingIndex,
          meetingCount: session.state.config.meetingCount,
          seed: session.state.config.seed,
          institution: session.state.config.institution,
          difficulty: session.state.config.difficulty,
          scenario: session.state.config.scenario,
        })
        // Achievements are *not* recorded here, deliberately. The report
        // screen records them, for two reasons that both only hold there: it
        // is where the historical standard is built, so it is the only place
        // that knows whether this mandate beat it; and recording here first
        // would mean the report, reading what was earned "before", found
        // everything already present and could never mark anything as earned
        // for the first time. Which is exactly what it did.
        //
        // Nothing is lost by waiting: finishing a mandate goes to the report.
        // `recordResult` above has already run, so the scenario count the
        // report reads includes this mandate — "every period" is earned by
        // the sixth one rather than by the one after it.
      } else {
        // Saved after every confirmed decision, because a mandate is forty
        // minutes long and the project's own setup screen used to warn that
        // reloading the page ended it. The log is the decisions and nothing
        // else, so this is a few hundred bytes.
        saveRun({
          simulationVersion: SIMULATION_VERSION,
          institution: session.state.config.institution,
          difficulty: session.state.config.difficulty,
          mode: session.state.config.mode,
          scenario: session.state.config.scenario,
          seed: session.state.config.seed,
          decisions: session.decisions,
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
    () => ({ active, finished, begin, submit, resume, reset }),
    [active, finished, begin, submit, resume, reset],
  )

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>
}
