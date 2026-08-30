import type { ObservationSet, SeriesId } from '../types/observation.ts'

/**
 * The policy stance, read from published data alone.
 *
 * A nominal rate on its own says nothing about whether policy is tight or
 * loose. Three quarter-point rises while expected inflation rises faster is
 * an *easing*, and nothing on a screen showing only the nominal rate would
 * ever say so. This module turns the published numbers into the comparison
 * that actually matters:
 *
 *     real rate  = nominal rate − expected inflation
 *     stance     = real rate − the neutral real rate
 *
 * It deflates by one-year expectations, not by published inflation, because
 * that is the variable the engine's IS curve is driven by: see
 * `realPolicyRate` in engine/indices.ts. The ex-post measure — the rate minus
 * the inflation households are living through — is computed alongside it and
 * reported separately, because the two can point in opposite directions and
 * the player deserves to see both rather than be quietly told one of them.
 *
 * Reads the observation set only, so it is subject to exactly the same
 * measurement error as the player: this is an estimate of the stance, not
 * privileged knowledge of it.
 */

export type StanceLabel = 'restrictive' | 'neutral' | 'accommodative'

/**
 * Narrowest half-width of the band that still counts as neutral.
 *
 * Even a perfectly estimated neutral rate does not make a 10bp gap meaningful,
 * so the band never collapses to nothing however confident the estimate is.
 */
const MIN_NEUTRAL_BAND = 0.25

export interface StanceReading {
  readonly nominalRate: number | null
  /** One-year expected inflation, as published. */
  readonly expectedInflation: number | null
  /** Nominal minus expected inflation. The rate the economy responds to. */
  readonly realRate: number | null
  /** Nominal minus published headline inflation. What households live through. */
  readonly realRateExPost: number | null
  readonly headlineInflation: number | null
  readonly neutralEstimate: number | null
  /** 1-sigma error band the staff attach to their own neutral estimate. */
  readonly neutralUncertainty: number
  /** Real rate minus the neutral estimate. Positive means restrictive. */
  readonly gap: number | null
  /** Half-width of the band around neutral in which no label can be justified. */
  readonly neutralBand: number
  readonly label: StanceLabel | null
}

/** The stance change since the previous meeting, split into its two causes. */
export interface StanceChange {
  /** Percentage points the committee moved the nominal rate. */
  readonly nominal: number
  /** Percentage points expected inflation moved on its own. */
  readonly expectations: number
  /** The resulting move in the real rate: nominal minus expectations. */
  readonly real: number
  readonly previousLabel: StanceLabel | null
  /** True when the decision moved the real rate the opposite way to the nominal. */
  readonly contradictory: boolean
}

function published(observation: ObservationSet, id: SeriesId): number | null {
  return observation.indicators[id]?.value ?? null
}

function labelFor(gap: number, band: number): StanceLabel {
  if (gap > band) return 'restrictive'
  if (gap < -band) return 'accommodative'
  return 'neutral'
}

export function readStance(observation: ObservationSet): StanceReading {
  const nominalRate = published(observation, 'policy_rate')
  const expectedInflation = published(observation, 'inflation_expectations_1y')
  const headlineInflation = published(observation, 'headline_inflation')
  const neutralEstimate = published(observation, 'neutral_rate_estimate')
  const neutralUncertainty =
    observation.indicators.neutral_rate_estimate?.uncertainty ?? 0

  const realRate =
    nominalRate === null || expectedInflation === null
      ? null
      : nominalRate - expectedInflation

  const realRateExPost =
    nominalRate === null || headlineInflation === null
      ? null
      : nominalRate - headlineInflation

  // The band widens with the staff's own uncertainty about neutral. Where the
  // estimate is poor, the honest reading is that the stance cannot be called —
  // not a confident label resting on a number nobody knows.
  const neutralBand = Math.max(MIN_NEUTRAL_BAND, neutralUncertainty)

  const gap =
    realRate === null || neutralEstimate === null ? null : realRate - neutralEstimate

  return {
    nominalRate,
    expectedInflation,
    realRate,
    realRateExPost,
    headlineInflation,
    neutralEstimate,
    neutralUncertainty,
    gap,
    neutralBand,
    label: gap === null ? null : labelFor(gap, neutralBand),
  }
}

/**
 * How the stance moved between two meetings, and why.
 *
 * The decomposition is the whole point. A player who sees only "real rate
 * −7 bp" learns nothing; a player who sees "you raised 25 bp, expectations
 * rose 32 bp" learns what happened to their decision.
 */
export function readStanceChange(
  current: ObservationSet,
  previous: ObservationSet | null,
): StanceChange | null {
  if (previous === null) return null

  const now = readStance(current)
  const before = readStance(previous)
  if (
    now.nominalRate === null ||
    before.nominalRate === null ||
    now.expectedInflation === null ||
    before.expectedInflation === null
  ) {
    return null
  }

  const nominal = now.nominalRate - before.nominalRate
  const expectations = now.expectedInflation - before.expectedInflation
  const real = nominal - expectations

  return {
    nominal,
    expectations,
    real,
    previousLabel: before.label,
    // Only a real decision can contradict itself. A hold has no direction to
    // contradict, even though its stance drifts.
    contradictory: nominal !== 0 && Math.sign(real) !== Math.sign(nominal),
  }
}

/**
 * The stance that would be in force if a move were confirmed and expectations
 * did not react.
 *
 * The caveat is not a disclaimer to be buried: expectations *will* react, and
 * the gap between this projection and next meeting's reading is exactly the
 * lesson the decomposition teaches.
 */
export function stanceAfterMove(
  observation: ObservationSet,
  basisPoints: number,
): StanceReading {
  const current = readStance(observation)
  if (current.nominalRate === null) return current

  const nominalRate = current.nominalRate + basisPoints / 100
  const realRate =
    current.expectedInflation === null ? null : nominalRate - current.expectedInflation
  const realRateExPost =
    current.headlineInflation === null ? null : nominalRate - current.headlineInflation
  const gap =
    realRate === null || current.neutralEstimate === null
      ? null
      : realRate - current.neutralEstimate

  return {
    ...current,
    nominalRate,
    realRate,
    realRateExPost,
    gap,
    label: gap === null ? null : labelFor(gap, current.neutralBand),
  }
}
