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
 * Banking stress above which the financial stability component starts to bite.
 *
 * Named here rather than left inline in `calculateScore` because the indicator
 * panel quotes it to the player. A threshold stated in two places is a
 * threshold that will eventually disagree with itself — which is exactly what
 * happened when the banking stress indicator told players the system was
 * impaired above 50, a number no part of the engine has ever known.
 */
export const STRESS_PENALTY_FLOOR = 25

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
 * The conduct gate: erratic, self-contradictory policy guts the whole score,
 * independent of how the real economy happened to absorb it.
 *
 * The engine's own transmission lag is a low-pass filter: a policy rate that
 * alternates sign every meeting mostly cancels inside the kernel before it
 * ever reaches inflation or output, so a churning, contradictory mandate can
 * leave every path-based component looking almost as good as a steady one —
 * measured directly, alternating +/-100bp left the post-kernel real-rate gap
 * within 0.1-0.15pp of a flat hold's, on the same seed. Every *other*
 * component in this file measures the economy; this is the one that measures
 * the decisions themselves, the same way `PRICE_STABILITY_GATE` measures one
 * objective directly rather than trusting the weighted blend to notice it.
 *
 * Three independent exponential factors — churn beyond the free allowance,
 * accumulated contradiction severity beyond `freeContradictionCost`, and
 * broken guidance promises beyond `freeBrokenPromises` — each at the scale
 * where the *billed* excess alone would pull the gate to roughly 37%. They
 * multiply, so genuinely incoherent conduct (bad on more than one axis at
 * once, which alternating-and-lying is) is punished harder than any single
 * axis implies. `floor` keeps the gate a steep slope rather than a hard wall
 * at zero, matching every other `performance`-shaped component in this file.
 *
 * The free allowances matter as much as the scales. `guidedStaffPackage`'s
 * own honest mode — the falsifiable criterion's "communication is a real
 * instrument" benchmark — breaks roughly 0.1-0.15 promises per mandate on
 * easy as a normal artefact of its target shifting on noisy data, exactly as
 * intended and already priced elsewhere (docs/BALANCE.md, "the honest rule
 * breaks 0.1 promises per mandate and keeps 4"). Measured directly: one
 * broken promise with `freeBrokenPromises` at 0 cut a seed's score from
 * ~6600 to 3250 on its own, which was severe enough to invert the whole
 * falsifiable criterion in `engine/guidance.test.ts` — communication looked
 * like it no longer paid, when what had actually happened was this gate
 * punishing an already-priced, already-acceptable rate of normal slippage.
 * `churnScale` needed no equivalent fix: `POLICY_VOLATILITY_ALLOWANCE_PER_YEAR`
 * already gives churn its own free allowance upstream of this gate.
 */
export const CONDUCT_GATE = {
  churnScale: 4.0,
  contradictionScale: 10.0,
  /** Contradiction severity forgiven before the contradiction factor bites. */
  freeContradictionCost: 0.7,
  brokenPromiseScale: 3.0,
  /** Broken promises forgiven before the broken-promise factor bites. */
  freeBrokenPromises: 1,
  floor: 0.03,
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
