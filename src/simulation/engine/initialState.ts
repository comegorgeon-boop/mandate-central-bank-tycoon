import type { Institution, RunConfig } from '../types/core.ts'
import type { GuidanceState, PolicyStance } from '../types/policy.ts'
import type { LatentState, SimulationState } from '../types/state.ts'
import { createPrng } from '../rng/prng.ts'
import { clamp } from '../config/bounds.ts'
import { getDifficulty } from '../config/difficulty.ts'
import { getInstitution } from '../config/institutions.ts'
import { MEETING_COUNT } from '../config/time.ts'
import { BANKING, VOLATILITY } from '../config/model.ts'
import { INSTRUMENT_EFFECTS } from '../config/instruments.ts'
import { fillLag } from './lags.ts'
import { financialConditionsIndex, realRateGap, taylorBenchmark } from './indices.ts'

/**
 * Builds the starting economy for a run.
 *
 * The seed perturbs the institution's central starting values, so two seeds
 * open on genuinely different economies rather than on the same board with
 * different weather later.
 */

/** Deterministic seed string for a run. Every substream derives from this. */
export function runSeedString(config: RunConfig): string {
  return [
    config.simulationVersion,
    config.seed,
    config.institution,
    config.difficulty,
    config.mode,
  ].join('|')
}

/** Assembles a RunConfig, filling in the mandate length for the difficulty. */
export function createRunConfig(options: {
  readonly institution: Institution
  readonly difficulty: RunConfig['difficulty']
  readonly seed: string
  readonly simulationVersion: string
  readonly mode?: RunConfig['mode']
}): RunConfig {
  return {
    simulationVersion: options.simulationVersion,
    institution: options.institution,
    difficulty: options.difficulty,
    seed: options.seed,
    mode: options.mode ?? 'fictional',
    meetingCount: MEETING_COUNT[options.difficulty],
  }
}

/** The nominal policy rate implied by a stance, after administered rates. */
export function effectivePolicyRate(
  stance: PolicyStance,
  institution: Institution,
): number {
  const administered =
    institution === 'fed'
      ? stance.iorbSpread * INSTRUMENT_EFFECTS.iorbSpread.effectiveRatePerBp +
        (stance.reverseRepoLevel * INSTRUMENT_EFFECTS.reverseRepo.ratePull) / 100
      : stance.depositFacilitySpread *
        INSTRUMENT_EFFECTS.depositFacility.effectiveRatePerBp
  return stance.targetRate + administered
}

/** The stance a run opens with: rate at its starting level, nothing else on. */
export function createInitialStance(targetRate: number): PolicyStance {
  return {
    targetRate,
    assetPurchasePace: 0,
    runoffPace: 0,
    discountWindowLevel: 0,
    reverseRepoLevel: 0,
    swapLinesLevel: 0,
    iorbSpread: 0,
    depositFacilitySpread: 0,
    minimumReserves: 0,
    targetedRefinancing: 0,
    transmissionProtection: 0,
  }
}

/** No guidance has been published when a mandate begins. */
export const INITIAL_GUIDANCE: GuidanceState = {
  impliedRatePath: null,
  commitment: 'none',
  tone: 'neutral',
  issuedAtMeeting: -1,
  brokenPromises: 0,
  keptPromises: 0,
}

export function createInitialState(config: RunConfig): SimulationState {
  const inst = getInstitution(config.institution)
  const difficulty = getDifficulty(config.difficulty)
  const seed = runSeedString(config)

  // A dedicated substream for setup, so changing the initial draw count can
  // never shift the sequence the run itself consumes.
  const setup = createPrng(`${seed}|init`)
  const base = inst.initial

  // Round the opening rate to a quarter point, as a real committee would set it.
  const rateOffset = Math.round(setup.gaussian(0, 0.75) * 4) / 4
  const targetRate = clamp(base.policyRate + rateOffset, 0, 8)

  const inflationOffset = setup.gaussian(0, 0.9)
  const headline = clamp(base.inflationHeadline + inflationOffset, -1, 9)
  const core = clamp(base.inflationCore + inflationOffset * 0.7, -1, 8)
  const outputGap = clamp(base.outputGap + setup.gaussian(0, 1.3), -5, 4)
  const unemployment = clamp(
    base.unemployment - 0.42 * outputGap + setup.gaussian(0, 0.7),
    1.5,
    16,
  )
  const credibility = clamp(base.credibility + setup.gaussian(0, 7), 40, 90)
  const anchoring = clamp(0.88 - Math.abs(headline - inst.inflationTarget) * 0.06, 0.4, 1)

  const stance = createInitialStance(targetRate)
  const policyRate = effectivePolicyRate(stance, config.institution)

  const expectedShort = clamp(
    inst.inflationTarget + (headline - inst.inflationTarget) * 0.35,
    -1,
    8,
  )
  const expectedLong = clamp(
    inst.inflationTarget + (headline - inst.inflationTarget) * 0.1,
    0,
    6,
  )

  const geopoliticalRisk = clamp(25 + setup.gaussian(0, 12), 0, 70)
  const bankingStress = clamp(BANKING.base + setup.gaussian(0, 6), 0, 45)
  const assetPricePressure = clamp(setup.gaussian(0, 12), -35, 45)

  const latent: LatentState = {
    inflationHeadline: headline,
    inflationCore: core,
    expectedInflationShort: expectedShort,
    expectedInflationLong: expectedLong,
    anchoring,
    wageGrowth: clamp(base.wageGrowth + inflationOffset * 0.5, 0, 12),
    importPriceInflation: clamp(setup.gaussian(0, 1.5), -12, 20),

    outputGap,
    potentialGrowth: base.potentialGrowth,
    realGrowth: base.potentialGrowth,
    unemployment,
    naturalUnemployment: base.naturalUnemployment,
    employmentMomentum: 0,

    policyRate,
    neutralRealRate: clamp(base.neutralRealRate + setup.gaussian(0, 0.3), -1, 3),
    balanceSheet: base.balanceSheet,
    reserves: 50,
    balanceSheetFlow: 0,

    exchangeRate: clamp(100 + setup.gaussian(0, 4), 80, 125),

    creditGrowth: clamp(2 + outputGap * 0.5 + setup.gaussian(0, 1.2), -8, 12),
    creditSpread: clamp(base.creditSpread + setup.gaussian(0, 0.25), 0.4, 4),
    termPremium: clamp(0.9 + setup.gaussian(0, 0.3), -1, 3),
    assetPricePressure,
    bankingStress,
    marketVolatility: clamp(
      VOLATILITY.base + 0.25 * geopoliticalRisk + setup.gaussian(0, 4),
      8,
      55,
    ),
    fragmentation: clamp(base.fragmentation + setup.gaussian(0, base.fragmentation * 0.2), 0, 400),

    fiscalImpulse: clamp(setup.gaussian(0, 0.7), -3, 3),
    debtPressure: clamp(base.debtPressure + setup.gaussian(0, 6), 10, 90),

    credibility,
    publicTrust: clamp(70 + setup.gaussian(0, 8), 35, 90),
    marketTrust: clamp(75 + setup.gaussian(0, 7), 40, 92),
    politicalPressure: clamp(25 + setup.gaussian(0, 8), 5, 70),

    marketExpectedRate: policyRate,

    supplyShock: clamp(setup.gaussian(0, 0.8) * difficulty.shockScale, -4, 5),
    demandShock: clamp(setup.gaussian(0, 0.6) * difficulty.shockScale, -3, 3),
    confidenceShock: 0,
    productivityShock: clamp(setup.gaussian(0, 0.3), -1.5, 1.5),
    financialShock: 0,
    geopoliticalRisk,
  }

  // The market opens priced roughly on the benchmark, not on a blank slate.
  latent.marketExpectedRate = clamp(
    0.5 * policyRate + 0.5 * taylorBenchmark(latent, config.institution),
    -2,
    15,
  )

  // Pre-fill the lag buffers with the opening steady state. Without this the
  // convolution would read an empty history and the economy would behave as
  // though policy had just been switched on.
  const openingRateGap = realRateGap(latent)
  const openingConditions = financialConditionsIndex(latent, config.institution)

  return {
    config,
    meetingIndex: 0,
    stepIndex: 0,
    timeYears: 0,
    latent,
    lags: {
      realRateGap: fillLag(openingRateGap),
      balanceSheetImpulse: fillLag(0),
      financialConditions: fillLag(openingConditions),
    },
    rng: createPrng(`${seed}|run`).getState(),
    stance,
    guidance: INITIAL_GUIDANCE,
    pendingEffects: [],
    eventLog: [],
    diagnostics: [],
    history: [{ meetingIndex: 0, timeYears: 0, latent }],
  }
}
