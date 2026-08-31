import type { Difficulty, Institution, RunConfig } from '../types/core.ts'
import type { GuidanceState, PolicyStance } from '../types/policy.ts'
import type { LatentState, SimulationState } from '../types/state.ts'
import { createPrng } from '../rng/prng.ts'
import { clamp } from '../config/bounds.ts'
import { getDifficulty } from '../config/difficulty.ts'
import { getInstitution } from '../config/institutions.ts'
import { MEETING_COUNT } from '../config/time.ts'
import { BANKING, VOLATILITY } from '../config/model.ts'
import { INSTRUMENT_EFFECTS } from '../config/instruments.ts'
import { applyOpeningCrisis } from '../events/openingCrisis.ts'
import { fillLag } from './lags.ts'
import { financialConditionsIndex, realRateGap, taylorBenchmark } from './indices.ts'

/**
 * How tightly the opening perturbation clusters around the institution's
 * clean base values, per difficulty.
 *
 * docs/DIRECTION.md: easy opens on a *healthy* economy — inflation and
 * unemployment under control, banking and markets calm — so that the major
 * event applied on top of it (see `applyOpeningCrisis` below) is legible as
 * the thing that broke an otherwise-fine picture, not one more source of
 * noise indistinguishable from the ordinary seed-to-seed spread. Medium and
 * hard are unchanged (scale 1): today's "moderately damaged" spread is
 * deliberately what they open on, and neither is in scope for this change.
 */
const OPENING_PERTURBATION_SCALE: Readonly<Record<Difficulty, number>> = {
  easy: 0.15,
  medium: 1,
  hard: 1,
}

/** Options controlling how a fresh state is built. */
export interface InitialStateOptions {
  /**
   * Whether to apply the easy-mode opening crisis. Defaults to true, so real
   * play always gets it. Test harnesses that need an uncontaminated baseline
   * — `testing/harness.ts`'s `playWithoutEvents`, and the catalog-symmetry
   * guard in `events/balance.test.ts` — pass `false` explicitly.
   */
  readonly openingEvent?: boolean
}

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

export function createInitialState(
  config: RunConfig,
  options: InitialStateOptions = {},
): SimulationState {
  const inst = getInstitution(config.institution)
  const difficulty = getDifficulty(config.difficulty)
  const seed = runSeedString(config)

  // A dedicated substream for setup, so changing the initial draw count can
  // never shift the sequence the run itself consumes.
  const setup = createPrng(`${seed}|init`)
  const base = inst.initial

  // Scales every opening perturbation by difficulty; see
  // `OPENING_PERTURBATION_SCALE` above. A single wrapper keeps every draw
  // below consuming exactly one Gaussian regardless of the scale, so the
  // setup substream's draw count — and therefore everything drawn from the
  // `|run` stream afterward — is identical across difficulties.
  const perturbationScale = OPENING_PERTURBATION_SCALE[config.difficulty]
  const noise = (sd: number): number => setup.gaussian(0, sd) * perturbationScale

  // Round the opening rate to a quarter point, as a real committee would set it.
  const rateOffset = Math.round(noise(0.75) * 4) / 4
  const targetRate = clamp(base.policyRate + rateOffset, 0, 8)

  const inflationOffset = noise(0.9)
  const headline = clamp(base.inflationHeadline + inflationOffset, -1, 9)
  const core = clamp(base.inflationCore + inflationOffset * 0.7, -1, 8)
  const outputGap = clamp(base.outputGap + noise(1.3), -5, 4)
  const unemployment = clamp(
    base.unemployment - 0.42 * outputGap + noise(0.7),
    1.5,
    16,
  )
  const credibility = clamp(base.credibility + noise(7), 40, 90)
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

  const geopoliticalRisk = clamp(25 + noise(12), 0, 70)
  const bankingStress = clamp(BANKING.base + noise(6), 0, 45)
  const assetPricePressure = clamp(noise(12), -35, 45)

  const latent: LatentState = {
    inflationHeadline: headline,
    inflationCore: core,
    expectedInflationShort: expectedShort,
    expectedInflationLong: expectedLong,
    anchoring,
    wageGrowth: clamp(base.wageGrowth + inflationOffset * 0.5, 0, 12),
    importPriceInflation: clamp(noise(1.5), -12, 20),

    outputGap,
    potentialGrowth: base.potentialGrowth,
    realGrowth: base.potentialGrowth,
    unemployment,
    naturalUnemployment: base.naturalUnemployment,
    employmentMomentum: 0,

    policyRate,
    neutralRealRate: clamp(base.neutralRealRate + noise(0.3), -1, 3),
    balanceSheet: base.balanceSheet,
    reserves: 50,
    balanceSheetFlow: 0,

    exchangeRate: clamp(100 + noise(4), 80, 125),

    creditGrowth: clamp(2 + outputGap * 0.5 + noise(1.2), -8, 12),
    creditSpread: clamp(base.creditSpread + noise(0.25), 0.4, 4),
    termPremium: clamp(0.9 + noise(0.3), -1, 3),
    assetPricePressure,
    bankingStress,
    marketVolatility: clamp(
      VOLATILITY.base + 0.25 * geopoliticalRisk + noise(4),
      8,
      55,
    ),
    fragmentation: clamp(base.fragmentation + noise(base.fragmentation * 0.2), 0, 400),

    fiscalImpulse: clamp(noise(0.7), -3, 3),
    debtPressure: clamp(base.debtPressure + noise(6), 10, 90),

    credibility,
    publicTrust: clamp(70 + noise(8), 35, 90),
    marketTrust: clamp(75 + noise(7), 40, 92),
    politicalPressure: clamp(25 + noise(8), 5, 70),

    marketExpectedRate: policyRate,

    supplyShock: clamp(noise(0.8) * difficulty.shockScale, -4, 5),
    demandShock: clamp(noise(0.6) * difficulty.shockScale, -3, 3),
    confidenceShock: 0,
    productivityShock: clamp(noise(0.3), -1.5, 1.5),
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

  let state: SimulationState = {
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

  // The easy-mode opener (docs/DIRECTION.md): a healthy economy, then a
  // major, named event that breaks it before the player's first decision.
  // Defaults on, so real play always gets it; test harnesses that need an
  // uncontaminated baseline pass `openingEvent: false`.
  if ((options.openingEvent ?? true) && config.difficulty === 'easy') {
    state = applyOpeningCrisis(state)
    // `history[0]` was captured above, before the crisis. The observation
    // layer reads history for "current period" values (`generateObservation`
    // → `publishedValue`), so without restating it the player's first meeting
    // would publish the pre-crisis numbers even though `latent` has moved on.
    state = {
      ...state,
      history: [{ meetingIndex: 0, timeYears: 0, latent: state.latent }],
    }
  }

  return state
}
