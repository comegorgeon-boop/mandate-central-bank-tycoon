import type { Difficulty, GuidanceState } from '../../simulation/index.ts'
import { promiseLedger } from './promiseLedger.ts'

/**
 * A promise that was judged by the decision just confirmed.
 *
 * Derived by differencing the guidance ledger across a meeting rather than by
 * adding a field to the engine: `keptPromises` and `brokenPromises` are
 * already recorded, only ever count up, and the engine is on the path of every
 * balance sweep and every replay — none of which needs to know that a screen
 * would like to congratulate someone.
 *
 * Null at almost every meeting, which is correct. A binding promise is judged
 * when it matures or when a move settles it, and both are rare: the panel this
 * feeds must be a moment, not furniture.
 */
export interface SettledPromise {
  readonly kept: boolean
  /** Credibility credit for delivery after this meeting, out of the cap. */
  readonly credit: number
  readonly creditMax: number
  /** How much the credit moved. Zero once the ceiling has been reached. */
  readonly change: number
  /** Total credibility lost to broken promises so far. */
  readonly credibilityCost: number
  /** Total market trust lost to broken promises so far. */
  readonly marketCost: number
}

export function settledPromise(
  before: GuidanceState,
  after: GuidanceState,
  difficulty: Difficulty,
): SettledPromise | null {
  const kept = after.keptPromises > before.keptPromises
  const broken = after.brokenPromises > before.brokenPromises
  if (!kept && !broken) return null

  const priorLedger = promiseLedger(before, difficulty)
  const ledger = promiseLedger(after, difficulty)

  return {
    // A meeting can in principle settle one of each; the break is the one
    // worth reporting, because it is the one that costs and the one that
    // cannot be undone.
    kept: kept && !broken,
    credit: ledger.keptCredit,
    creditMax: ledger.keptCreditMax,
    change: ledger.keptCredit - priorLedger.keptCredit,
    credibilityCost: ledger.brokenCredibilityCost,
    marketCost: ledger.brokenMarketCost,
  }
}
