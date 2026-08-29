import type { Institution } from '../types/core.ts'
import type { ScoreComponentId } from '../types/scoring.ts'

/** Maximum attainable score. */
export const MAX_SCORE = 10000

/**
 * Component weights, per institution. Each set sums to 1.
 *
 * For the Fed, price stability and employment carry substantial coequal
 * weight, matching the dual mandate. For the ECB, price stability carries the
 * primary weight; employment and growth still matter but cannot be the main
 * route to a high score.
 */
export const SCORE_WEIGHTS: Readonly<
  Record<Institution, Readonly<Record<ScoreComponentId, number>>>
> = {
  fed: {
    price_stability: 0.26,
    employment_output: 0.26,
    financial_stability: 0.12,
    anchoring: 0.12,
    credibility: 0.1,
    shock_response: 0.06,
    policy_volatility: 0.04,
    completion: 0.04,
  },
  ecb: {
    price_stability: 0.38,
    employment_output: 0.14,
    financial_stability: 0.12,
    anchoring: 0.14,
    credibility: 0.1,
    shock_response: 0.06,
    policy_volatility: 0.03,
    completion: 0.03,
  },
}

/**
 * Scales that map a path statistic onto a 0..1 component score.
 *
 * Each is the value at which the component falls to roughly 37 % (one e-fold),
 * so they read as "how bad is bad".
 */
export const SCORE_SCALES = {
  /** Root-mean-square deviation of inflation from target, percentage points. */
  priceStabilityRmse: 1.6,
  /** RMS of the unemployment gap and output gap, blended. */
  employmentRmse: 1.9,
  /** Average financial stress penalty. */
  financialStress: 26,
  /** RMS deviation of long-run expectations from target. */
  anchoringRmse: 0.85,
  /** Average shortfall of credibility below 100. */
  credibilityShortfall: 34,
  /** Cumulative absolute policy rate change beyond the free allowance, in pp. */
  policyVolatility: 4.5,
} as const

/**
 * Policy churn the player may use for free before the volatility component
 * starts to bite, in cumulative percentage points of rate change per year.
 */
export const POLICY_VOLATILITY_ALLOWANCE_PER_YEAR = 2.0

/**
 * ECB safeguard: a persistent failure on inflation caps the total score, so
 * strong employment and growth cannot compensate for it.
 *
 * Below `threshold` on the price-stability component, the whole score is
 * multiplied by a factor that falls linearly to `floor`.
 */
export const PRICE_STABILITY_GATE = {
  threshold: 0.4,
  floor: 0.55,
} as const

/**
 * Shock-response scoring.
 *
 * The engine rewards the textbook distinction: a demand shock should be
 * leaned against, while the first-round effect of a supply shock should
 * largely be looked through, defending expectations rather than crushing
 * output. A large shock is one whose absolute size exceeds this threshold.
 */
export const SHOCK_RESPONSE = {
  /** Absolute shock size, in percentage points, that counts as large. */
  largeShockThreshold: 1.2,
  /** Credit for leaning against a demand shock, per unit of correct response. */
  demandLeanReward: 1.0,
  /** Credit for looking through a supply shock's first-round effect. */
  supplyLookThroughReward: 1.0,
  /** Penalty weight for letting expectations drift during a supply shock. */
  anchoringPenalty: 1.2,
  /** Score awarded when a run contains no large shocks to respond to. */
  neutralScore: 0.6,
} as const
