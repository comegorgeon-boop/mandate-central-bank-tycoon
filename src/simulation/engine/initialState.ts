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

/**
 * The damage the tutorial opens on, in percentage points.
 *
 * Easy used to open on a *healthy* economy and be broken by a named crisis, on
 * the reasoning that the player should see the baseline, then the cause, then
 * know what to repair. Two mandates of play found the flaw: the crisis is
 * repaired in about three meetings and the remaining nine have nothing in
 * them. A tutorial whose problem is solved a quarter of the way through spends
 * the rest of itself teaching that there is nothing to do.
 *
 * So it now opens on an economy that is *already* broken on both halves of the
 * mandate at once — inflation well above the objective and unemployment well
 * above its sustainable rate — which is the only opening that makes both of
 * the tutorial's two objectives something to work toward rather than something
 * already true. The named opening crisis still fires on top: it is what makes
 * the damage a story with a cause rather than an arbitrary starting board.
 *
 * Sized against `DifficultyConfig.tutorialGoal`, and both are measured
 * together — the opening has to be far enough from the goal to need real
 * policy and near enough to be reachable before `maxMeetings`.
 */
export const TUTORIAL_DAMAGE = {
  /** Added to headline and core inflation. */
  inflation: 2.4,
  /**
   * Added to the output gap, and taken off unemployment.
   *
   * *Positive*, which is the whole design. Three arrangements of this damage
   * were measured before this one, and the two rejected ones are worth
   * recording because they were both wrong for reasons that are not obvious.
   *
   * Damaging both halves — inflation up *and* unemployment up — reads as the
   * most broken economy and is the least instructive one, because it heals
   * itself: a negative output gap is disinflationary and mean-reverts to zero,
   * so unemployment walks back to its natural rate and inflation follows it
   * down. Measured, a player could pass that tutorial 57-69 % of the time by
   * holding the rate and doing nothing whatsoever.
   *
   * Damaging it harder did not fix that. Loosening the anchor to the point
   * where passive play failed also put competent play at 45-56 %, and a
   * *decisive* rule that closed the whole rate gap every meeting scored the
   * same as the gradual one — so the ceiling was not the benchmark's caution,
   * it was a mode where the rate could not reach the problem in time.
   *
   * An economy that is *overheating* is the arrangement that works. Inflation
   * is high because demand is running ahead of capacity; unemployment starts
   * below its sustainable rate, so the employment objective is met on the
   * opening meeting and the player's job is to bring inflation down *without
   * losing it*. That is a real trade-off rather than two chores, it is the
   * standing objective this game already states in words, and it is squarely
   * demand-side — which is what easy is for.
   */
  outputGap: 1.2,
  unemployment: -0.5,
  /**
   * Expectations, and the anchor.
   *
   * The overheating gap mean-reverts on its own, so on its own it would heal
   * like everything else. A loose anchor does not: `EXPECTATIONS.longTargetSlope`
   * makes the pull back toward the objective proportional to credibility *and*
   * anchoring, so inflation stays up until policy earns the anchor back. It is
   * the one thing in this model that cannot be waited out, which makes it the
   * only honest way to build a lesson that requires acting.
   */
  shortExpectations: 1.1,
  longExpectations: 0.6,
  anchoring: -0.35,
} as const

/** Options controlling how a fresh state is built. */
export interface InitialStateOptions {
  /**
   * Whether to apply the easy-mode opening crisis. Defaults to true, so real
   * play always gets it. Test harnesses that need an uncontaminated baseline
   * — `testing/harness.ts`'s `playWithoutEvents`, and the catalog-symmetry
   * guard in `events/balance.test.ts` — pass `false` explicitly.
   */
  readonly openingEvent?: boolean
  /**
   * Whether to apply the tutorial's opening damage. Defaults to true, so real
   * play always gets it.
   *
   * Passed `false` for the same reason `openingEvent` is: a calibration
   * harness measures a *mechanism* by differencing a treatment run against a
   * control, and both are contaminated by a deliberate, scripted starting
   * condition. The kernel tests in `engine/transmission.test.ts` measure how
   * fast a rate move reaches banking stress, and an overheating opening moves
   * where the stress path starts — which is a fact about the tutorial's
   * scenario, not about the kernel.
   */
  readonly tutorialDamage?: boolean
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
    // A tutorial has no scheduled length, so its "count" is the point at which
    // it ends unfinished — the only sense in which it has one. Everything that
    // divides by `meetingCount` (the share served, the churn allowance) then
    // still means something rather than dividing by a number the mode ignores.
    meetingCount:
      getDifficulty(options.difficulty).tutorialGoal?.maxMeetings ??
      MEETING_COUNT[options.difficulty],
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
    contradictionCost: 0,
    reversalCount: 0,
    diagnostics: [],
    history: [{ meetingIndex: 0, timeYears: 0, latent }],
  }

  // The scripted opener (docs/DIRECTION.md): a healthy economy, then a major,
  // named event that breaks it before the player's first decision. Defaults
  // on, so real play always gets it; test harnesses that need an
  // uncontaminated baseline pass `openingEvent: false`.
  //
  // Which difficulties get one, and which kinds of crisis they may draw, is
  // `DifficultyConfig.openingCrisisCharacters` — `applyOpeningCrisis` is a
  // no-op where that is null, so the difficulty rule lives in the config
  // rather than being spelled a second time here.
  // The tutorial opens damaged, so that repairing it is the lesson. Applied
  // before the opening crisis, which then lands on an economy already in
  // trouble — which is also what a real committee inherits.
  const damage = getDifficulty(config.difficulty).tutorialGoal
  if (damage !== null && (options.tutorialDamage ?? true)) {
    const hurt: LatentState = {
      ...state.latent,
      inflationHeadline: state.latent.inflationHeadline + TUTORIAL_DAMAGE.inflation,
      inflationCore: state.latent.inflationCore + TUTORIAL_DAMAGE.inflation,
      expectedInflationShort:
        state.latent.expectedInflationShort + TUTORIAL_DAMAGE.shortExpectations,
      expectedInflationLong:
        state.latent.expectedInflationLong + TUTORIAL_DAMAGE.longExpectations,
      anchoring: clamp(state.latent.anchoring + TUTORIAL_DAMAGE.anchoring, 0, 1),
      unemployment: state.latent.unemployment + TUTORIAL_DAMAGE.unemployment,
      outputGap: state.latent.outputGap + TUTORIAL_DAMAGE.outputGap,
    }
    state = {
      ...state,
      latent: hurt,
      history: [{ meetingIndex: 0, timeYears: 0, latent: hurt }],
    }
  }

  if (options.openingEvent ?? true) {
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
