import type { Institution } from './core.ts'
import type { LatentState } from './state.ts'

export type SeriesId =
  | 'headline_inflation'
  | 'core_inflation'
  | 'inflation_expectations'
  | 'wage_growth'
  | 'import_prices'
  | 'unemployment'
  | 'employment_growth'
  | 'real_growth'
  | 'output_gap_estimate'
  | 'consumer_confidence'
  | 'policy_rate'
  | 'market_expected_rate'
  | 'credit_spread'
  | 'exchange_rate'
  | 'asset_valuation'
  | 'bank_stress_proxy'
  | 'balance_sheet'
  | 'fragmentation_spread'

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
  /** Plain-English tooltip shown next to the indicator. */
  readonly definition: string
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
}

export interface IndicatorObservation {
  readonly seriesId: SeriesId
  readonly label: string
  readonly unit: string
  readonly definition: string
  readonly category: ReleaseCategory
  /** Latest published value; null when this release is missing. */
  readonly value: number | null
  /** Published value for the preceding reference period. */
  readonly previous: number | null
  /** First print for the current period, when it has since been revised. */
  readonly priorVintage: number | null
  readonly revised: boolean
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
}

/** Context handed to the observation layer. */
export interface ObservationContext {
  readonly meetingIndex: number
  readonly newswire: readonly string[]
  readonly clues: readonly string[]
}
