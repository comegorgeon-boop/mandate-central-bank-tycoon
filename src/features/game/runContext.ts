import { createContext, useContext } from 'react'
import type {
  Difficulty,
  Institution,
  MeetingResult,
  PolicyPackage,
  RunSession,
  ScoreBreakdown,
} from '../../simulation/index.ts'
import type { LedgerEntry } from '../policy/instrumentLedger.ts'
import type { SettledPromise } from '../policy/settledPromise.ts'
import type { CounterfactualArms } from './counterfactualRun.ts'

/**
 * The run currently being played, held in memory only.
 *
 * This build has no persistence: reloading the page ends the run. The routes
 * guard on that by redirecting back to setup when no run is open.
 */
export interface ActiveRun {
  readonly runId: string
  readonly session: RunSession
  /**
   * Projections still waiting to be checked against what actually happened.
   *
   * Interface state rather than run state: it is derived from decisions the
   * engine already records, and it exists so a player can be told what the dial
   * they moved four meetings ago produced. See `policy/instrumentLedger.ts`.
   */
  readonly ledger: readonly LedgerEntry[]
  /**
   * A promise the last decision settled, if it settled one.
   *
   * Derived here rather than in the engine for the same reason as the ledger:
   * `submitMeeting` is on the path of every sweep and every replay, and none of
   * them needs to know that a screen would like to say well done.
   */
  readonly settled: SettledPromise | null
  /**
   * The same mandate with each lever held still, advanced in lockstep.
   *
   * What makes "without your rises, inflation would be at 6.2 %" an exact
   * statement rather than an estimate. See `counterfactualRun.ts`.
   */
  readonly arms: CounterfactualArms
}

/** A run that has reached its end state, with its score already computed. */
export interface FinishedRun {
  readonly runId: string
  readonly session: RunSession
  readonly score: ScoreBreakdown
}

export interface StartRunOptions {
  readonly institution: Institution
  readonly difficulty: Difficulty
  readonly seed: string
}

export interface RunContextValue {
  readonly active: ActiveRun | null
  readonly finished: FinishedRun | null
  /** Opens a new run at its first meeting, discarding any previous one. */
  readonly begin: (options: StartRunOptions) => void
  /**
   * Plays one meeting. Returns the engine's verdict so the caller can show
   * rejections; a rejected package leaves the run untouched.
   */
  readonly submit: (pkg: PolicyPackage) => MeetingResult
  /** Clears both the active and the finished run. */
  readonly reset: () => void
}

export const RunContext = createContext<RunContextValue | null>(null)

export function useRun(): RunContextValue {
  const value = useContext(RunContext)
  if (value === null) {
    throw new Error('useRun must be used inside a RunProvider.')
  }
  return value
}
