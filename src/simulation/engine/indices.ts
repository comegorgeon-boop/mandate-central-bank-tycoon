import type { Institution } from '../types/core.ts'
import type { LatentState } from '../types/state.ts'
import {
  BALANCE_SHEET,
  BANKING,
  EXCHANGE,
  FINANCIAL_CONDITIONS,
  FRAGMENTATION,
  SPREADS,
  TAYLOR,
} from '../config/model.ts'
import { getInstitution } from '../config/institutions.ts'

/** Derived quantities shared by several blocks of the model. */

/** Policy rate deflated by one-year inflation expectations. */
export function realPolicyRate(latent: LatentState): number {
  return latent.policyRate - latent.expectedInflationShort
}

/** Real policy rate relative to neutral. Positive means restrictive. */
export function realRateGap(latent: LatentState): number {
  return realPolicyRate(latent) - latent.neutralRealRate
}

/** Unemployment above its natural rate. Positive means slack. */
export function unemploymentGap(latent: LatentState): number {
  return latent.unemployment - latent.naturalUnemployment
}

/**
 * A single summary of financial conditions. Positive means tighter than
 * neutral. Feeds the IS curve alongside the policy rate itself, which is how
 * spreads, valuations and the currency get their own grip on demand.
 */
export function financialConditionsIndex(
  latent: LatentState,
  institution: Institution,
): number {
  const openness = getInstitution(institution).openness
  const c = FINANCIAL_CONDITIONS
  return (
    c.rateGap * realRateGap(latent) +
    c.spread * (latent.creditSpread - SPREADS.base) +
    c.termPremium * (latent.termPremium - SPREADS.termBase) +
    c.bankingStress * (latent.bankingStress - BANKING.base) -
    c.assetPressure * latent.assetPricePressure +
    c.exchangeRate * (latent.exchangeRate - EXCHANGE.baseline) * openness
  )
}

/**
 * Share of policy that actually reaches the real economy.
 *
 * The impairment mechanism is institution-specific: sovereign fragmentation
 * for the ECB, regional banking stress for the Fed. Both are stored in the
 * `fragmentation` latent field on their own scales.
 */
export function transmissionEfficiency(
  latent: LatentState,
  institution: Institution,
): number {
  const cfg = institution === 'ecb' ? FRAGMENTATION.ecb : FRAGMENTATION.fed
  const impaired = Math.min(1, Math.max(0, latent.fragmentation) / cfg.impairmentScale)
  return 1 - cfg.impairment * impaired
}

/**
 * State dependence of asset purchases.
 *
 * Buying into a dysfunctional market — wide spreads, high volatility, a
 * stressed banking system — is highly effective: it restores intermediation
 * and relieves stress. Buying into a calm market with stretched valuations
 * does little for demand and mostly inflates asset prices further, which
 * returns later as banking stress when the boom unwinds.
 */
export function purchaseEffectiveness(latent: LatentState): {
  readonly multiplier: number
  readonly bubbleShare: number
} {
  const cfg = BALANCE_SHEET
  const volatilityComponent =
    Math.max(0, latent.marketVolatility - cfg.dysfunctionVolatilityPivot) /
    cfg.dysfunctionVolatilityScale
  const stressComponent =
    Math.max(0, latent.bankingStress - BANKING.base) / cfg.dysfunctionStressScale
  const dysfunction = Math.min(1, volatilityComponent + stressComponent)

  const multiplier =
    cfg.calmMinMultiplier +
    (cfg.dysfunctionMaxMultiplier - cfg.calmMinMultiplier) * dysfunction

  const bubbleShare = Math.min(
    1.5,
    Math.max(0, latent.assetPricePressure - cfg.bubblePivot) / 40,
  )

  return { multiplier, bubbleShare }
}

/**
 * Taylor-rule reference rate.
 *
 * Shown in the postmortem as a benchmark only. It is never applied
 * automatically and is never the uniquely correct policy: the ECB's lower gap
 * weight reflects its price-stability-first mandate, and neither rule accounts
 * for financial stability, transmission or credibility.
 */
export function taylorBenchmark(
  latent: LatentState,
  institution: Institution,
): number {
  const target = getInstitution(institution).inflationTarget
  return (
    latent.neutralRealRate +
    latent.inflationHeadline +
    TAYLOR.inflationWeight * (latent.inflationCore - target) +
    TAYLOR.gapWeight[institution] * latent.outputGap
  )
}
