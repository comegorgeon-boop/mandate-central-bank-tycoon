export type ScoreComponentId =
  | 'price_stability'
  | 'employment_output'
  | 'financial_stability'
  | 'anchoring'
  | 'credibility'
  | 'shock_response'
  | 'policy_volatility'
  | 'completion'

export interface ScoreComponent {
  readonly id: ScoreComponentId
  readonly label: string
  /** Normalised performance on this component, 0..1. */
  readonly raw: number
  readonly weight: number
  /** raw * weight. */
  readonly contribution: number
  /** Plain-English explanation shown in the postmortem. */
  readonly explanation: string
}

export interface ScoreBreakdown {
  /** Final score, 0..10000. */
  readonly score: number
  readonly components: readonly ScoreComponent[]
  /** Sum of contributions before gate and multiplier, 0..1. */
  readonly weightedTotal: number
  /**
   * ECB-only safeguard, 0..1. A persistent failure on inflation caps the
   * total so employment and growth cannot compensate for it. Always 1 for
   * the Fed's coequal dual mandate.
   */
  readonly priceStabilityGate: number
  readonly difficultyMultiplier: number
  /** institution:difficulty:simulationVersion. Records never mix buckets. */
  readonly bucketKey: string
  readonly simulationVersion: string
  readonly scoringVersion: string
}

export type EndConditionId =
  | 'mandate_completed'
  | 'inflation_spiral'
  | 'deflation_spiral'
  | 'depression'
  | 'banking_crisis'
  | 'fragmentation_crisis'
  | 'currency_dysfunction'
  | 'loss_of_monetary_control'
  | 'dismissed'

export type RunStatus = 'active' | 'completed' | 'failed'

/**
 * One contributing factor in an end state.
 *
 * The postmortem reports a ranked chain rather than a single cause: a complex
 * crisis is never attributed to one player action alone.
 */
export interface CausalFactor {
  readonly label: string
  /** Normalised share of the outcome, 0..1. Contributions sum to 1. */
  readonly contribution: number
  readonly detail: string
}

export interface EndConditionWarning {
  readonly id: EndConditionId
  readonly label: string
  readonly message: string
  readonly severity: 'watch' | 'severe'
  /** Consecutive meetings the failing test has already held. */
  readonly meetingsHeld: number
  /** Consecutive meetings required before the run actually ends. */
  readonly meetingsToTrigger: number
}

export interface EndConditionResult {
  readonly status: RunStatus
  readonly triggered: EndConditionId | null
  readonly label: string | null
  readonly summary: string | null
  readonly causalChain: readonly CausalFactor[]
  readonly warnings: readonly EndConditionWarning[]
  /**
   * Consecutive-breach counters per condition, carried into the next call.
   * Failures require a condition to hold for several meetings, so a single
   * bad reading never ends a run.
   */
  readonly breachCounters: Readonly<Record<string, number>>
}
