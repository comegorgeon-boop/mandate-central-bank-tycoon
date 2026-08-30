import type { Institution } from './core.ts'
import type { LatentState } from './state.ts'

export type SeriesId =
  | 'headline_inflation'
  | 'core_inflation'
  | 'inflation_expectations'
  | 'inflation_expectations_1y'
  | 'neutral_rate_estimate'
  | 'wage_growth'
  | 'import_prices'
  | 'unemployment'
  | 'employment_growth'
  | 'real_growth'
  | 'output_gap_estimate'
  | 'consumer_confidence'
  | 'credibility_index'
  | 'policy_rate'
  | 'market_expected_rate'
  | 'market_volatility'
  | 'credit_spread'
  | 'exchange_rate'
  | 'asset_valuation'
  | 'bank_stress_proxy'
  | 'balance_sheet'
  | 'fragmentation_spread'
  | 'regional_bank_stress'

/**
 * How a number reaches the player, which decides how trustworthy it is.
 *
 * The design rule of the observation layer: market data is observed exactly
 * and immediately, official statistics arrive late, noisy and revised. The
 * player has to read markets to infer the state the statistics have not
 * caught up with yet.
 */
export type ReleaseCategory =
  | 'market_data'
  | 'official_statistic'
  | 'survey'
  | 'internal_estimate'

export interface SeriesDefinition {
  readonly id: SeriesId
  readonly label: string
  readonly unit: string
  /** Plain-English tooltip shown next to the indicator: what it measures. */
  readonly definition: string
  /**
   * What a rise or a fall in it means for the player.
   *
   * Kept separate from `definition` because knowing what a series measures and
   * knowing what to do about it are different pieces of knowledge, and a
   * player who has only the first cannot act on the second. No technical term
   * appears here that the definition has not already introduced.
   */
  readonly meaning: string
  /** Pulls the true value out of the latent state. */
  readonly read: (latent: LatentState) => number
  readonly category: ReleaseCategory
  /** Meetings between the reference period and its first publication. */
  readonly publicationLagMeetings: number
  /** Meetings after the first print before a revised vintage appears. 0 = never. */
  readonly revisionLagMeetings: number
  /** 1-sigma measurement noise at medium difficulty, in the series' unit. */
  readonly baseNoiseSd: number
  /** 1-sigma size of the revision at medium difficulty. */
  readonly baseRevisionSd: number
  readonly decimals: number
  readonly institutions: readonly Institution[]
  /**
   * Draws the measurement error once for the whole run instead of once per
   * reference period.
   *
   * For a slow-moving structural estimate — the neutral rate above all — fresh
   * noise every meeting would be wrong twice over. It would imply the staff
   * re-estimate from scratch each time, and it would make the number jitter
   * around a truth that is not moving, which reads as information when it is
   * not. A persistent error is the honest shape: the estimate is wrong by a
   * fixed amount the player never learns, exactly as in reality.
   */
  readonly persistentError?: boolean
}

/**
 * A revision the player can see.
 *
 * The current reading is always a first print — a period cannot be revised
 * before it has been published. What gets corrected is an *earlier* period,
 * `periodsAgo` back, which is what this reports.
 */
export interface IndicatorRevision {
  /** How many reference periods back the corrected reading sits. */
  readonly periodsAgo: number
  /** What that period was originally published at. */
  readonly firstPrint: number
  /** What it reads now. */
  readonly current: number
}

export interface IndicatorObservation {
  readonly seriesId: SeriesId
  readonly label: string
  readonly unit: string
  readonly definition: string
  /** What a rise or a fall means for the player. See SeriesDefinition. */
  readonly meaning: string
  readonly category: ReleaseCategory
  /** Latest published value; null when this release is missing. */
  readonly value: number | null
  /** Published value for the preceding reference period. */
  readonly previous: number | null
  /** The most recent correction to an earlier print, if there is one. */
  readonly revision: IndicatorRevision | null
  readonly publicationLagMeetings: number
  /** Published vintages, oldest first, for the trend sparkline. */
  readonly trend: readonly (number | null)[]
  /** 1-sigma uncertainty the player is told about. */
  readonly uncertainty: number
  readonly missing: boolean
}

/** One horizon of a fan chart. Never a false point estimate. */
export interface ForecastBand {
  readonly horizonMeetings: number
  readonly central: number
  readonly p10: number
  readonly p30: number
  readonly p70: number
  readonly p90: number
}

export interface ForecastFan {
  readonly seriesId: SeriesId
  readonly label: string
  readonly bands: readonly ForecastBand[]
}

/** The family of disturbance currently dominating the economy. */
export type ShockKind =
  | 'supply'
  | 'demand'
  | 'financial'
  | 'productivity'
  | 'confidence'
  | 'none'

/**
 * A named shock and the published evidence for it.
 *
 * Published only where the difficulty grants it. The name is the easy
 * mandate's teaching aid; the evidence is the part that has to survive its
 * removal, so both are assembled together and the evidence is never empty.
 */
export interface ShockDiagnosis {
  readonly kind: ShockKind
  readonly label: string
  /** What this kind of shock does to the two halves of the mandate. */
  readonly summary: string
  /** Observable tells, each quoting the published series that shows it. */
  readonly evidence: readonly string[]
}

/** Everything the player is allowed to see at one meeting. */
export interface ObservationSet {
  readonly meetingIndex: number
  readonly indicators: Readonly<Partial<Record<SeriesId, IndicatorObservation>>>
  readonly forecasts: readonly ForecastFan[]
  /** Fictional headlines tied to events that actually fired. */
  readonly newswire: readonly string[]
  /** Warning signals for risks that may materialise soon. */
  readonly clues: readonly string[]
  /**
   * Taylor-rule reference rate. A benchmark for comparison only, never the
   * uniquely correct policy.
   */
  readonly taylorBenchmark: number
  /**
   * The shock in progress, named. Null wherever the difficulty withholds it,
   * which is every difficulty above easy: reading the economy unaided is the
   * skill the easy mandate exists to teach.
   */
  readonly diagnosis: ShockDiagnosis | null
}

/** Context handed to the observation layer. */
export interface ObservationContext {
  readonly meetingIndex: number
  readonly newswire: readonly string[]
  readonly clues: readonly string[]
}
