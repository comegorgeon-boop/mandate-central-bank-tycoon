import type { Institution } from '../types/core.ts'
import type { LatentState } from '../types/state.ts'
import {
  BALANCE_SHEET,
  BANKING,
  EXCHANGE,
  FINANCIAL_CONDITIONS,
  FRAGMENTATION,
  SPREADS,
  SUPPLY_REGIME_BAND,
  TAYLOR,
} from '../config/model.ts'
import { clamp } from '../config/bounds.ts'
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

/**
 * How far a cost-push shock has pushed the inflation target out of reach, 0 to 1.
 *
 * Zero in ordinary weather; one where no policy the desk could run would have
 * returned inflation to target inside a mandate, because the pressure comes
 * from outside domestic demand and the only trajectories that reach target get
 * there by destroying output.
 *
 * Lives here, alongside the other derived readings, because two very different
 * parts of the game have to agree on it: `dynamics.ts` charges the
 * institution's standing for an inflation miss, and `calculateScore.ts` decides
 * what objective the mandate is judged on. A version of this that lived in only
 * one of them would let the score forgive a miss the end conditions were still
 * ending the mandate over — which is exactly what happened.
 */
export function supplyRegimePressure(latent: LatentState): number {
  const { floor, full } = SUPPLY_REGIME_BAND
  return clamp((latent.supplyShock - floor) / (full - floor), 0, 1)
}
