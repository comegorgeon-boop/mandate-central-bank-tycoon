import type { Difficulty, Institution } from '../types/core.ts'
import type { ObservationSet } from '../types/observation.ts'
import { getInstitution } from '../config/institutions.ts'
import { getInstrument, getInstrumentRange, POLICY_RATE_FLOOR } from '../config/instruments.ts'
import { readStance } from '../observation/stance.ts'

/**
 * The reference policy rule, as used by the staff.
 *
 * Real central banks separate analysis from decision: the staff work the data
 * and put a recommendation to the committee, and the committee decides. This
 * is that recommendation. It is not the right answer — the committee is free
 * to depart from it, and on any given meeting it may be wrong.
 *
 * The rule targets **core** inflation, not headline. That is the single most
 * consequential choice in it, and docs/BALANCE.md records why: the sweep's
 * original headline-chasing rules tightened into supply shocks, which this
 * model is built to punish, and switching the same rule onto core was worth
 * 400 points on fed/medium and doubled hard-mode survival on the Fed. A rule
 * that reacts to headline is reacting mostly to energy prices it cannot
 * influence.
 *
 * It reads published data only — the same noisy, late numbers the player has —
 * so it is fallible for exactly the reasons the player is fallible. That is
 * what makes it usable as a fallible adviser at higher difficulties later,
 * rather than an oracle that would have to be taken away.
 */

/** Weight on the deviation of core inflation from the objective. */
const INFLATION_WEIGHT = 0.5

/**
 * Share of the gap to the desired rate closed at a single meeting.
 *
 * Committees move gradually, and so should the advice: recommending the whole
 * distance every meeting would produce exactly the rate churn that feeds
 * `BANKING.tighteningSpeed` into a banking crisis.
 */
const SMOOTHING = 0.25

export interface StaffRecommendation {
  /** Recommended move, in basis points, already valid for the instrument. */
  readonly basisPoints: number
  /** The rate the rule would settle at if it could move freely. */
  readonly desiredRate: number
  /** Which inflation measure the rule could actually read. */
  readonly measure: 'core' | 'headline'
  /** One or two sentences of plain English: the recommendation and its grounds. */
  readonly reasoning: string
}

function formatMove(basisPoints: number): string {
  if (basisPoints === 0) return 'hold'
  return `${basisPoints > 0 ? 'a rise of' : 'a cut of'} ${Math.abs(basisPoints)} bp`
}

/**
 * Computes the staff's recommendation from the published observation set.
 *
 * Returns null when the releases the rule depends on did not arrive, which is
 * itself informative: the services do not guess, and at higher difficulties a
 * missing print is a meeting they cannot advise on.
 */
export function staffRecommendation(
  observation: ObservationSet,
  institution: Institution,
  difficulty: Difficulty,
): StaffRecommendation | null {
  const instrument = getInstrument('policy_rate')
  if (instrument === undefined) return null
  const range = getInstrumentRange(instrument, difficulty)
  if (range === null) return null

  const stance = readStance(observation)
  if (stance.nominalRate === null) return null

  // Core is the rule's proper input; headline is a degraded fallback used only
  // when the core print is missing, and the copy says so.
  const core = observation.indicators.core_inflation?.value ?? null
  const measure: 'core' | 'headline' = core === null ? 'headline' : 'core'
  const inflation = core ?? stance.headlineInflation
  if (inflation === null) return null

  const target = getInstitution(institution).inflationTarget
  // Without a neutral estimate the rule has no anchor; the institution's own
  // published assumption is the fallback, which is what a real staff would use.
  const neutral = stance.neutralEstimate ?? getInstitution(institution).initial.neutralRealRate

  const desiredRate = neutral + inflation + INFLATION_WEIGHT * (inflation - target)

  const rawBp = (desiredRate - stance.nominalRate) * 100 * SMOOTHING
  const steps = Math.round(rawBp / range.increment)
  let basisPoints = Math.max(range.min, Math.min(range.max, steps * range.increment))

  // Never advise a move the committee could not legally take.
  const floor = POLICY_RATE_FLOOR[institution]
  while (basisPoints < 0 && stance.nominalRate + basisPoints / 100 < floor - 1e-9) {
    basisPoints += range.increment
  }

  const gapText =
    inflation >= target + 0.05
      ? `${(inflation - target).toFixed(2)} pp above the ${target.toFixed(1)} % objective`
      : inflation <= target - 0.05
        ? `${(target - inflation).toFixed(2)} pp below the ${target.toFixed(1)} % objective`
        : `on the ${target.toFixed(1)} % objective`

  const measureText =
    measure === 'core'
      ? `Core inflation at ${inflation.toFixed(2)} % is ${gapText}`
      : `The core print is missing, so this reads headline inflation at ` +
        `${inflation.toFixed(2)} %, ${gapText}`

  const stanceText =
    stance.gap === null
      ? ''
      : stance.gap > stance.neutralBand
        ? `, and the real rate is already ${stance.gap.toFixed(2)} pp above neutral`
        : stance.gap < -stance.neutralBand
          ? `, while the real rate is still ${Math.abs(stance.gap).toFixed(2)} pp below neutral`
          : ', and the real rate is close to neutral'

  const reasoning =
    `${measureText}${stanceText}. On that basis the services recommend ` +
    `${formatMove(basisPoints)}, which moves a quarter of the way to the ` +
    `${desiredRate.toFixed(2)} % the rule implies.`

  return { basisPoints, desiredRate, measure, reasoning }
}
