import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  SIMULATION_VERSION,
  calculateScore,
  createRunConfig,
  startRun,
  submitMeeting,
  type MeetingResult,
  type PolicyPackage,
} from '../../simulation/index.ts'
import {
  RunContext,
  type ActiveRun,
  type FinishedRun,
  type RunContextValue,
  type StartRunOptions,
} from './runContext.ts'
import { makeRunId } from './seed.ts'

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
    })
    setActive({ runId: makeRunId(options.seed), session: startRun(config) })
    setFinished(null)
  }, [])

  const submit = useCallback(
    (pkg: PolicyPackage): MeetingResult => {
      if (active === null) return NO_ACTIVE_RUN

      const result = submitMeeting(active.session, pkg)
      if (!result.ok) return result

      const session = result.session
      setActive({ runId: active.runId, session })

      // The engine decides when a mandate is over; the score is computed once,
      // here, so the result screen never recomputes it from a moving state.
      if (session.outcome.status !== 'active') {
        setFinished({
          runId: active.runId,
          session,
          score: calculateScore(session.state, session.outcome),
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
