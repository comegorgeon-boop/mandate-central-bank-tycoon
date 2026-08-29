import type { Institution } from '../types/core.ts'
import type { GuidanceState, PolicyStance } from '../types/policy.ts'
import type { LagBuffers, LatentState } from '../types/state.ts'
import type { Prng } from '../rng/prng.ts'
import type { DifficultyConfig } from '../config/difficulty.ts'
import type { InstitutionConfig } from '../config/institutions.ts'
import { LATENT_BOUNDS, clamp } from '../config/bounds.ts'
import {
  ASSETS,
  BALANCE_SHEET,
  BANKING,
  COMMUNICATION,
  CREDIT,
  EXCHANGE,
  EXPECTATIONS,
  FISCAL,
  FRAGMENTATION,
  HEADLINE,
  IMPORTS,
  INSTITUTIONAL,
  IS_CURVE,
  LABOR,
  MARKET_EXPECTATIONS,
  PHILLIPS,
  SPREADS,
  SUPPLY_SIDE,
  VOLATILITY,
  WAGES,
} from '../config/model.ts'
import { INSTRUMENT_EFFECTS } from '../config/instruments.ts'
import { FISCAL_SHOCK, FX_SHOCK_VOLATILITY, SHOCK_PROCESSES } from '../config/shocks.ts'
import { convolve, pushLag, tighteningSpeed } from './lags.ts'
import {
  financialConditionsIndex,
  purchaseEffectiveness,
  realPolicyRate,
  realRateGap,
  taylorBenchmark,
  transmissionEfficiency,
  unemploymentGap,
} from './indices.ts'

/**
 * One internal sub-step of the semi-structural model.
 *
 * The step is an explicit Euler update: every block computes its target and
 * its delta from the *pre-step* state, and all deltas are applied together.
 * The one deliberate exception is imported inflation, which reads the
 * deterministic part of this step's currency move — that dependency is
 * within-step by construction.
 *
 * Random draws are consumed in a fixed order so a replay reproduces the run
 * exactly.
 */

/**
 * Holds a block's target inside the range its variable is defined on.
 *
 * The safety clamps in config/bounds.ts are a last resort against arithmetic
 * failure. Model blocks are expected to keep their own variables in range, so
 * that a clamp firing always means something genuinely went wrong rather than
 * a 0-100 index sitting at its floor during a bad enough economy.
 */
function boundTarget(key: keyof LatentState, value: number): number {
  const [min, max] = LATENT_BOUNDS[key]
  return clamp(value, min, max)
}

export interface SubstepContext {
  readonly institution: InstitutionConfig
  readonly difficulty: DifficultyConfig
  readonly stance: PolicyStance
  readonly guidance: GuidanceState
  /** Distributed-lag kernel for this difficulty. */
  readonly kernel: readonly number[]
  readonly dt: number
}

export interface SubstepResult {
  readonly latent: LatentState
  readonly lags: LagBuffers
}

/** Aggregate liquidity support currently provided by standing facilities. */
export function liquiditySupport(
  stance: PolicyStance,
  institution: Institution,
): number {
  if (institution === 'fed') {
    return stance.discountWindowLevel / 3 + 0.4 * (stance.swapLinesLevel / 2)
  }
  return stance.targetedRefinancing / 6
}

export function advanceSubstep(
  latent: LatentState,
  lags: LagBuffers,
  ctx: SubstepContext,
  prng: Prng,
): SubstepResult {
  const { dt, institution: inst, difficulty: diff, stance } = ctx
  const target = inst.inflationTarget
  const sqrtDt = Math.sqrt(dt)
  const next: LatentState = { ...latent }

  // ---- 1. Stochastic disturbances (Ornstein-Uhlenbeck) --------------------
  // Fixed iteration order: the sequence of draws is part of the replay contract.
  for (const process of SHOCK_PROCESSES) {
    const value = latent[process.key]
    const drift = -process.meanReversion * (value - process.mean) * dt

    // A process defined on a bounded index has its innovation damped toward
    // the ends of that range, so it stays inside on its own rather than being
    // clipped there every few steps.
    let scale = 1
    if (process.range) {
      const [low, high] = process.range
      const span = (high - low) / 2
      scale = Math.sqrt(Math.max(0, (value - low) * (high - value))) / span
    }

    const innovation =
      process.volatility * diff.shockScale * sqrtDt * scale * prng.gaussian()
    next[process.key] = value + drift + innovation
  }
  next.fiscalImpulse =
    latent.fiscalImpulse -
    FISCAL_SHOCK.meanReversion * (latent.fiscalImpulse - FISCAL_SHOCK.mean) * dt +
    FISCAL_SHOCK.volatility * diff.shockScale * sqrtDt * prng.gaussian()

  // ---- 2. Supply side -----------------------------------------------------
  const potentialTarget = inst.initial.potentialGrowth + latent.productivityShock
  next.potentialGrowth =
    latent.potentialGrowth +
    SUPPLY_SIDE.potentialAdjustment * (potentialTarget - latent.potentialGrowth) * dt

  // Hysteresis: a long, deep recession raises the natural rate of unemployment.
  const naturalTarget =
    inst.initial.naturalUnemployment +
    SUPPLY_SIDE.hysteresis * Math.max(0, -latent.outputGap)
  next.naturalUnemployment =
    latent.naturalUnemployment +
    SUPPLY_SIDE.naturalRateAdjustment * (naturalTarget - latent.naturalUnemployment) * dt

  // ---- 3. Exchange rate ---------------------------------------------------
  const fragmentationScale =
    inst.fragmentationKind === 'sovereign_spread' ? 300 : 50
  const riskPremium =
    0.3 * ((latent.marketVolatility - VOLATILITY.base) / 10) +
    0.5 * (latent.bankingStress / 50) +
    0.4 * (latent.fragmentation / fragmentationScale) +
    0.3 * (latent.geopoliticalRisk / 50) -
    INSTRUMENT_EFFECTS.swapLines.exchangeRateRelief *
      0.1 *
      (stance.swapLinesLevel / 2)

  const rateDifferential = realPolicyRate(latent) - EXCHANGE.foreignRealRate
  const fxTarget =
    EXCHANGE.baseline +
    EXCHANGE.rateSensitivity * rateDifferential -
    EXCHANGE.riskSensitivity * riskPremium
  const fxDeterministic = EXCHANGE.adjustment * (fxTarget - latent.exchangeRate) * dt
  const fxNoise = FX_SHOCK_VOLATILITY * diff.shockScale * sqrtDt * prng.gaussian()
  next.exchangeRate = latent.exchangeRate + fxDeterministic + fxNoise

  // ---- 4. Imported inflation ---------------------------------------------
  // Only the deterministic part of the currency move feeds import prices:
  // dividing the stochastic part by dt would blow up as the step shrinks.
  const fxChangeAnnualised =
    ((fxDeterministic / Math.max(1, latent.exchangeRate)) / dt) * 100
  const importTarget =
    IMPORTS.supplyAmplifier * latent.supplyShock -
    IMPORTS.fxPassThrough * fxChangeAnnualised
  next.importPriceInflation =
    latent.importPriceInflation +
    IMPORTS.adjustment * (importTarget - latent.importPriceInflation) * dt

  // ---- 5. Inflation expectations -----------------------------------------
  const anchorWeight =
    EXPECTATIONS.shortAnchorBase + EXPECTATIONS.shortAnchorSlope * latent.anchoring
  const shortTarget =
    anchorWeight * latent.expectedInflationLong +
    (1 - anchorWeight) * latent.inflationHeadline
  let shortDelta =
    EXPECTATIONS.shortAdjustment * (shortTarget - latent.expectedInflationShort) * dt

  // Published guidance keeps working between meetings, scaled by how credible
  // the institution is and how firmly the guidance was committed to.
  if (ctx.guidance.impliedRatePath !== null) {
    const stanceSignal = ctx.guidance.impliedRatePath - latent.policyRate
    const commitmentWeight =
      COMMUNICATION.commitmentWeight[ctx.guidance.commitment]
    const credibilityWeight = (latent.credibility / 100) * commitmentWeight
    shortDelta -=
      EXPECTATIONS.guidancePull *
      credibilityWeight *
      COMMUNICATION.guidanceInflationSensitivity *
      stanceSignal *
      dt
  }
  next.expectedInflationShort = latent.expectedInflationShort + shortDelta

  const longTargetWeight =
    EXPECTATIONS.longTargetBase +
    EXPECTATIONS.longTargetSlope * (latent.credibility / 100) * latent.anchoring
  const longTarget =
    longTargetWeight * target + (1 - longTargetWeight) * latent.expectedInflationShort
  next.expectedInflationLong =
    latent.expectedInflationLong +
    EXPECTATIONS.longAdjustment * (longTarget - latent.expectedInflationLong) * dt

  const missPressure =
    Math.abs(latent.expectedInflationLong - target) +
    0.5 * Math.abs(latent.inflationHeadline - target)
  const anchoringTarget = clamp(
    1 -
      EXPECTATIONS.anchoringMissSensitivity * missPressure +
      EXPECTATIONS.anchoringCredibility * ((latent.credibility - 50) / 50),
    0,
    1,
  )
  next.anchoring =
    latent.anchoring +
    EXPECTATIONS.anchoringAdjustment * (anchoringTarget - latent.anchoring) * dt

  // ---- 6. Phillips curve: core inflation ---------------------------------
  const unitLabourCost =
    latent.wageGrowth - latent.potentialGrowth - latent.inflationCore
  const coreTarget =
    latent.expectedInflationShort +
    PHILLIPS.gapSlope * latent.outputGap +
    PHILLIPS.wagePressure * unitLabourCost +
    latent.supplyShock
  next.inflationCore =
    latent.inflationCore +
    PHILLIPS.adjustment * (coreTarget - latent.inflationCore) * dt

  // ---- 7. Headline inflation ---------------------------------------------
  const headlineTarget =
    latent.inflationCore +
    inst.importPassThrough * latent.importPriceInflation +
    HEADLINE.supplyAmplifier * latent.supplyShock
  next.inflationHeadline =
    latent.inflationHeadline +
    HEADLINE.adjustment * (headlineTarget - latent.inflationHeadline) * dt

  // ---- 8. Wages -----------------------------------------------------------
  const wageTarget =
    latent.expectedInflationShort +
    latent.potentialGrowth -
    WAGES.slackSensitivity * unemploymentGap(latent)
  next.wageGrowth =
    latent.wageGrowth + WAGES.adjustment * (wageTarget - latent.wageGrowth) * dt

  // ---- 9. Financial block -------------------------------------------------
  const purchase = purchaseEffectiveness(latent)
  const purchaseFlow = Math.max(0, stance.assetPurchasePace)
  const runoffFlow = Math.max(0, stance.runoffPace)
  const support = liquiditySupport(stance, inst.id)

  const spreadTarget =
    SPREADS.base +
    SPREADS.gapSensitivity * Math.max(0, -latent.outputGap) +
    SPREADS.stressSensitivity * ((latent.bankingStress - BANKING.base) / 50) +
    SPREADS.volatilitySensitivity * ((latent.marketVolatility - VOLATILITY.base) / 30) +
    0.25 * latent.financialShock -
    SPREADS.purchaseSupport * purchaseFlow * purchase.multiplier +
    INSTRUMENT_EFFECTS.runoff.spreadWidening * runoffFlow +
    INSTRUMENT_EFFECTS.minimumReserves.spreadWidening * stance.minimumReserves
  next.creditSpread =
    latent.creditSpread + SPREADS.adjustment * (spreadTarget - latent.creditSpread) * dt

  const termTarget =
    SPREADS.termBase -
    SPREADS.termPurchaseSupport * purchaseFlow * purchase.multiplier +
    INSTRUMENT_EFFECTS.runoff.termWidening * runoffFlow +
    SPREADS.termVolatility * ((latent.marketVolatility - VOLATILITY.base) / 30)
  next.termPremium =
    latent.termPremium + SPREADS.termAdjustment * (termTarget - latent.termPremium) * dt

  const fciNow = financialConditionsIndex(latent, inst.id)
  const creditTarget =
    CREDIT.base +
    CREDIT.gapSensitivity * latent.outputGap -
    CREDIT.financialConditions * fciNow -
    CREDIT.stressSensitivity * ((latent.bankingStress - BANKING.base) / 50) -
    INSTRUMENT_EFFECTS.minimumReserves.creditTightening * stance.minimumReserves +
    INSTRUMENT_EFFECTS.targetedRefinancing.creditSupport * stance.targetedRefinancing
  next.creditGrowth =
    latent.creditGrowth + CREDIT.adjustment * (creditTarget - latent.creditGrowth) * dt

  // Valuation pressure. Purchases into an already rich market add more of it.
  const assetDelta =
    (ASSETS.easyPolicy * -realRateGap(latent) +
      ASSETS.credit * (latent.creditGrowth - CREDIT.base) +
      ASSETS.purchases * purchaseFlow * (1 + purchase.bubbleShare) -
      ASSETS.meanReversion * latent.assetPricePressure -
      ASSETS.stressCorrection * latent.assetPricePressure * (latent.bankingStress / 50)) *
    dt
  next.assetPricePressure = latent.assetPricePressure + assetDelta
  const assetChangeAnnualised = assetDelta / dt

  const stressTarget =
    BANKING.base +
    BANKING.tighteningSpeed * Math.max(0, tighteningSpeed(lags)) +
    BANKING.assetBust * Math.max(0, -assetChangeAnnualised) +
    BANKING.gapSensitivity * Math.max(0, -latent.outputGap) +
    BANKING.spreadSensitivity * Math.max(0, latent.creditSpread - SPREADS.base) +
    4 * latent.financialShock +
    INSTRUMENT_EFFECTS.runoff.stressAdded * runoffFlow * (1 + latent.bankingStress / 50) -
    BANKING.liquiditySupport * support -
    INSTRUMENT_EFFECTS.assetPurchases.stressRelief * purchaseFlow * purchase.multiplier
  next.bankingStress =
    latent.bankingStress +
    BANKING.adjustment *
      (boundTarget('bankingStress', stressTarget) - latent.bankingStress) *
      dt

  const volatilityTarget =
    VOLATILITY.base +
    VOLATILITY.stressSensitivity * (latent.bankingStress - BANKING.base) +
    VOLATILITY.spreadSensitivity * Math.max(0, latent.creditSpread - SPREADS.base) +
    VOLATILITY.geopolitical * latent.geopoliticalRisk +
    3 * latent.financialShock -
    INSTRUMENT_EFFECTS.swapLines.volatilityRelief * (stance.swapLinesLevel / 2) +
    (latent.bankingStress < BANKING.base * 1.5
      ? INSTRUMENT_EFFECTS.discountWindow.unjustifiedVolatility *
        (stance.discountWindowLevel / 3)
      : 0)
  next.marketVolatility =
    latent.marketVolatility +
    VOLATILITY.adjustment *
      (boundTarget('marketVolatility', volatilityTarget) - latent.marketVolatility) *
      dt

  // ---- 10. Institution-specific transmission impairment -------------------
  if (inst.fragmentationKind === 'sovereign_spread') {
    const cfg = FRAGMENTATION.ecb
    const fragmentationTarget =
      cfg.base +
      cfg.rateSensitivity * Math.max(0, latent.policyRate) +
      cfg.debtSensitivity * latent.debtPressure +
      cfg.volatilitySensitivity * Math.max(0, latent.marketVolatility - VOLATILITY.base) +
      cfg.gapSensitivity * Math.max(0, -latent.outputGap) -
      INSTRUMENT_EFFECTS.transmissionProtection.fragmentationRelief *
        stance.transmissionProtection -
      INSTRUMENT_EFFECTS.targetedRefinancing.fragmentationRelief *
        stance.targetedRefinancing -
      INSTRUMENT_EFFECTS.assetPurchases.fragmentationRelief *
        purchaseFlow *
        purchase.multiplier
    next.fragmentation =
      latent.fragmentation +
      cfg.adjustment *
        (boundTarget('fragmentation', fragmentationTarget) - latent.fragmentation) *
        dt
  } else {
    const cfg = FRAGMENTATION.fed
    const regionalTarget =
      cfg.base +
      cfg.tighteningSpeed * Math.max(0, tighteningSpeed(lags)) +
      cfg.assetBust * Math.max(0, -assetChangeAnnualised) +
      cfg.stressSensitivity * latent.bankingStress -
      INSTRUMENT_EFFECTS.discountWindow.regionalRelief * stance.discountWindowLevel
    next.fragmentation =
      latent.fragmentation +
      cfg.adjustment *
        (boundTarget('fragmentation', regionalTarget) - latent.fragmentation) *
        dt
  }

  // ---- 11. IS curve: the output gap ---------------------------------------
  // This is where the lag pipeline pays off: the impulse acting on demand now
  // is a weighted average of the policy stance over the past two years, not
  // the rate that was set at this meeting.
  const rateImpulse = convolve(lags.realRateGap, ctx.kernel)
  const financialImpulse = convolve(lags.financialConditions, ctx.kernel)
  const balanceSheetImpulse = convolve(lags.balanceSheetImpulse, ctx.kernel)
  const efficiency = transmissionEfficiency(latent, inst.id)

  const gapDelta =
    (-IS_CURVE.rateSensitivity * efficiency * rateImpulse -
      IS_CURVE.financialConditions * financialImpulse +
      IS_CURVE.balanceSheet * balanceSheetImpulse * efficiency +
      IS_CURVE.fiscal * latent.fiscalImpulse +
      IS_CURVE.credit * (latent.creditGrowth - IS_CURVE.creditNeutral) -
      IS_CURVE.exchangeRate *
        ((latent.exchangeRate - EXCHANGE.baseline) / 10) *
        inst.openness +
      IS_CURVE.confidence * latent.confidenceShock -
      IS_CURVE.supply * latent.supplyShock +
      latent.demandShock -
      IS_CURVE.meanReversion * latent.outputGap) *
    dt
  next.outputGap = latent.outputGap + gapDelta

  // ---- 12. Okun: unemployment and employment momentum ---------------------
  const unemploymentTarget = latent.naturalUnemployment - LABOR.okun * latent.outputGap
  const unemploymentDelta =
    LABOR.adjustment * (unemploymentTarget - latent.unemployment) * dt
  next.unemployment = latent.unemployment + unemploymentDelta
  next.employmentMomentum =
    latent.employmentMomentum +
    LABOR.momentumSmoothing *
      (-unemploymentDelta / dt - latent.employmentMomentum) *
      dt

  next.realGrowth = latent.potentialGrowth + gapDelta / dt

  // ---- 13. Balance sheet and reserves -------------------------------------
  next.balanceSheetFlow = stance.assetPurchasePace - stance.runoffPace
  next.balanceSheet = latent.balanceSheet + next.balanceSheetFlow * dt
  const reservesTarget =
    BALANCE_SHEET.reservesBaseline +
    BALANCE_SHEET.reservesPerPurchase * (latent.balanceSheet - inst.initial.balanceSheet) -
    INSTRUMENT_EFFECTS.reverseRepo.reservesDrain * stance.reverseRepoLevel
  next.reserves =
    latent.reserves +
    BALANCE_SHEET.reservesDecay *
      (boundTarget('reserves', reservesTarget) - latent.reserves) *
      dt

  // ---- 14. Fiscal ---------------------------------------------------------
  const debtTarget =
    inst.initial.debtPressure +
    FISCAL.debtFromImpulse * latent.fiscalImpulse * 3 +
    FISCAL.debtFromRealRate * Math.max(0, realPolicyRate(latent)) * 3
  next.debtPressure =
    latent.debtPressure +
    FISCAL.debtDecay *
      (boundTarget('debtPressure', debtTarget) - latent.debtPressure) *
      dt

  // ---- 15. Institutional standing -----------------------------------------
  const sensitivity = diff.credibilitySensitivity
  const cred = INSTITUTIONAL.credibility
  const credibilityTarget =
    cred.ceiling -
    cred.inflationMiss * Math.abs(latent.inflationHeadline - target) * sensitivity -
    cred.anchoring * (1 - latent.anchoring) * sensitivity -
    cred.brokenPromise * ctx.guidance.brokenPromises * sensitivity +
    Math.min(cred.keptPromiseCap, cred.keptPromise * ctx.guidance.keptPromises) -
    cred.bankingStress * latent.bankingStress * sensitivity
  next.credibility =
    latent.credibility +
    cred.adjustment *
      (boundTarget('credibility', credibilityTarget) - latent.credibility) *
      dt

  const pub = INSTITUTIONAL.publicTrust
  const publicTrustTarget =
    pub.ceiling -
    pub.inflation * Math.max(0, latent.inflationHeadline - target) * sensitivity -
    pub.unemployment * Math.max(0, unemploymentGap(latent)) * sensitivity -
    pub.policyRate * Math.max(0, latent.policyRate - pub.policyRateTolerance)
  next.publicTrust =
    latent.publicTrust +
    pub.adjustment *
      (boundTarget('publicTrust', publicTrustTarget) - latent.publicTrust) *
      dt

  const mkt = INSTITUTIONAL.marketTrust
  const marketTrustTarget =
    mkt.ceiling -
    mkt.brokenPromise * ctx.guidance.brokenPromises * sensitivity -
    mkt.volatility * Math.max(0, latent.marketVolatility - VOLATILITY.base)
  next.marketTrust =
    latent.marketTrust +
    mkt.adjustment *
      (boundTarget('marketTrust', marketTrustTarget) - latent.marketTrust) *
      dt

  const pol = INSTITUTIONAL.politicalPressure
  const politicalTarget =
    pol.base +
    pol.unemployment * Math.max(0, unemploymentGap(latent)) +
    pol.policyRate * Math.max(0, latent.policyRate - pol.policyRateTolerance) +
    pol.publicTrust * Math.max(0, 60 - latent.publicTrust) +
    pol.inflation * Math.max(0, latent.inflationHeadline - target) +
    INSTRUMENT_EFFECTS.transmissionProtection.politicalCost *
      stance.transmissionProtection
  next.politicalPressure =
    latent.politicalPressure +
    pol.adjustment *
      (boundTarget('politicalPressure', politicalTarget) - latent.politicalPressure) *
      dt

  // ---- 16. Market-implied policy path -------------------------------------
  const benchmark = taylorBenchmark(latent, inst.id)
  const guided = ctx.guidance.impliedRatePath
  const commitmentShare =
    guided === null ? 0 : COMMUNICATION.commitmentWeight[ctx.guidance.commitment]
  const guidanceCredibility = (latent.credibility / 100) * commitmentShare
  const guidanceWeight =
    MARKET_EXPECTATIONS.guidanceWeightSlope * guidanceCredibility
  const benchmarkWeight =
    MARKET_EXPECTATIONS.taylorWeightBase * (1 - guidanceCredibility)
  const currentWeight = MARKET_EXPECTATIONS.currentWeight
  const totalWeight = guidanceWeight + benchmarkWeight + currentWeight
  const marketRateTarget =
    (guidanceWeight * (guided ?? latent.policyRate) +
      benchmarkWeight * benchmark +
      currentWeight * latent.policyRate) /
    totalWeight
  next.marketExpectedRate =
    latent.marketExpectedRate +
    MARKET_EXPECTATIONS.adjustment *
      (boundTarget('marketExpectedRate', marketRateTarget) - latent.marketExpectedRate) *
      dt

  // ---- 17. Roll the lag buffers forward -----------------------------------
  const nextLags: LagBuffers = {
    realRateGap: pushLag(lags.realRateGap, realRateGap(next)),
    balanceSheetImpulse: pushLag(lags.balanceSheetImpulse, next.balanceSheetFlow),
    financialConditions: pushLag(
      lags.financialConditions,
      financialConditionsIndex(next, inst.id),
    ),
  }

  return { latent: next, lags: nextLags }
}
