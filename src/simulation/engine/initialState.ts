import type { Difficulty, Institution, RunConfig } from '../types/core.ts'
import type { GuidanceState, PolicyStance } from '../types/policy.ts'
import type { LatentState, SimulationState } from '../types/state.ts'
import { createPrng } from '../rng/prng.ts'
import { clamp } from '../config/bounds.ts'
import { getDifficulty } from '../config/difficulty.ts'
import { getInstitution } from '../config/institutions.ts'
import { MEETING_COUNT } from '../config/time.ts'
import { BANKING, FISCAL, VOLATILITY } from '../config/model.ts'
import { INSTRUMENT_EFFECTS } from '../config/instruments.ts'
import { applyOpeningCrisis } from '../events/openingCrisis.ts'
import { fillLag } from './lags.ts'
import {
  financialConditionsIndex,
  pricedPathFloor,
  realRateGap,
  taylorBenchmark,
} from './indices.ts'
import { createMembers } from './members.ts'
import { getScenario, scenarioOf } from '../scenarios/scenarios.ts'

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
  readonly scenario?: RunConfig['scenario']
}): RunConfig {
  const scenario = options.scenario ?? null
  if (scenario !== null) {
    // A scenario decides its own institution, its own rules and its own
    // length. The caller passes a seed and nothing else that matters, which is
    // the point: there is no difficulty to choose on a historical mandate.
    const definition = getScenario(scenario)
    return {
      simulationVersion: options.simulationVersion,
      institution: definition.institution,
      difficulty: definition.rules,
      seed: options.seed,
      mode: 'historical',
      meetingCount: definition.meetingCount,
      scenario,
    }
  }
  return {
    simulationVersion: options.simulationVersion,
    institution: options.institution,
    difficulty: options.difficulty,
    seed: options.seed,
    mode: options.mode ?? 'fictional',
    scenario: null,
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
    // Every mandate begins by voting a rate. Volcker's October 1979 meeting is
    // the only place in this build where that can change.
    operatingProcedure: 'rate_target',
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
  // A historical mandate opens where it actually opened. The draws below are
  // still made — the setup substream has to consume the same count whatever
  // the mode, or the run stream that follows it would be a different one — and
  // then the sourced table overwrites what they produced. The opening is
  // history; the path is not, which is where the seed still earns its keep.
  const scenario = scenarioOf(config)
  const perturbationScale =
    scenario === null ? OPENING_PERTURBATION_SCALE[config.difficulty] : 0
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

  const stance = createInitialStance(scenario?.opening.policyRate ?? targetRate)
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

  // The currency area's members, if this institution has any. Deterministic
  // from the configuration rather than drawn: the dispersion is a property of
  // the area's structure, not of the seed.
  const members = createMembers(config.institution)

  // Drawn once and read twice: the index the model has always used, and the
  // debt ratio the public finances panel shows. Pulling a second draw for the
  // ratio would reseed every opening in the game — see the note below.
  const drawnDebtPressure = clamp(base.debtPressure + noise(6), 10, 90)

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
    // A fresh economy has not been calm for long enough to have built
    // anything. See `LatentState.fragility`.
    fragility: 0,
    meetingsSinceEvent: 0,
    fragmentation: clamp(base.fragmentation + noise(base.fragmentation * 0.2), 0, 400),

    fiscalImpulse: clamp(noise(0.7), -3, 3),
    debtPressure: drawnDebtPressure,

    // The public finances open consistent with themselves and **without
    // consuming a single random draw**.
    //
    // Both halves matter. Consistent, because the interest bill *is* the
    // stock times the average coupon and a starting state where it was not
    // would take a year of simulated time to stop being wrong on the panel.
    // And without a draw, because every subsequent draw in this function
    // depends on the order of the ones before it: an earlier version pulled
    // three numbers here and reseeded every fictional opening in the game,
    // which flipped a tutorial balance test that had been stable for
    // sessions. The debt ratio is derived from the fiscal pressure already
    // drawn above, which is the same information read twice rather than
    // twice as much randomness.
    ...(() => {
      const debt =
        base.publicDebt * (1 + (drawnDebtPressure - base.debtPressure) / 100)
      // The average coupon on a stock issued over the past several years sits
      // a little above the policy rate of the day, because the curve slopes.
      const effective = clamp(base.policyRate + 0.6, 0, 20)
      return {
        publicDebt: clamp(debt, 20, 260),
        effectiveDebtRate: effective,
        debtService: (debt * effective) / 100,
        primaryBalance: FISCAL.publicFinances.structuralBalance[config.institution],
      }
    })(),

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

  // ---- A historical mandate opens where it actually opened ----------------
  //
  // The sourced table replaces what the draws above produced. Every figure is
  // in `docs/SCENARIOS.md` with its series, and the two approximations say so
  // in both places. What is *not* overwritten — banking stress, volatility,
  // asset pressure, spreads — has no 1979 counterpart that can be sourced to a
  // number on this scale, so it stays at the engine's neutral values rather
  // than being invented to look authoritative.
  /**
   * Drop the keys a scenario left undefined.
   *
   * Spreading an object with `undefined` values over a `LatentState` would
   * overwrite real numbers with nothing, so the absent fields have to be
   * absent rather than undefined. This is the one place that distinction
   * matters and it is worth four lines to make it impossible to get wrong.
   */
  const optional = (
    fields: Readonly<Record<string, number | undefined>>,
  ): Partial<LatentState> =>
    Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    ) as Partial<LatentState>

  const opened: LatentState =
    scenario === null
      ? latent
      : {
          ...latent,
          inflationHeadline: scenario.opening.inflationHeadline,
          inflationCore: scenario.opening.inflationCore,
          expectedInflationShort: scenario.opening.expectedInflationShort,
          expectedInflationLong: scenario.opening.expectedInflationLong,
          anchoring: scenario.opening.anchoring,
          wageGrowth: scenario.opening.wageGrowth,
          supplyShock: scenario.opening.supplyShock,
          importPriceInflation: scenario.opening.importPriceInflation,
          outputGap: scenario.opening.outputGap,
          unemployment: scenario.opening.unemployment,
          naturalUnemployment: scenario.opening.naturalUnemployment,
          policyRate,
          credibility: scenario.opening.credibility,
          // The long rate is sourced; the term premium is what is left of it
          // once the expected path is taken out, which is the definition.
          termPremium: Math.max(
            -1,
            scenario.opening.longRate - scenario.opening.expectedInflationLong - 2,
          ),
          // The financial side, only where the period has one worth sourcing.
          // `??` and not a default: a scenario that says nothing here gets the
          // engine's neutral value, which is the honest answer for a year with
          // no banking-stress statistic. September 2008 is the opposite case —
          // the TED spread was a published price on the day and the whole
          // subject of the meeting — and it says so.
          ...optional({
            bankingStress: scenario.opening.bankingStress,
            creditSpread: scenario.opening.creditSpread,
            marketVolatility: scenario.opening.marketVolatility,
            creditGrowth: scenario.opening.creditGrowth,
            assetPricePressure: scenario.opening.assetPricePressure,
            geopoliticalRisk: scenario.opening.geopoliticalRisk,
            politicalPressure: scenario.opening.politicalPressure,
            neutralRealRate: scenario.opening.neutralRealRate,
            debtPressure: scenario.opening.debtPressure,
            fragmentation: scenario.opening.fragmentation,
            balanceSheet: scenario.opening.balanceSheet,
            exchangeRate: scenario.opening.exchangeRate,
          }),
        }
  const latentAtOpen = opened

  // The market opens priced roughly on the benchmark, not on a blank slate.
  // The ceiling is the fictional modes' own, and a scenario needs more room:
  // a 1979 opening prices a benchmark rate well above anything the fictional
  // economies produce, and clamping it there would open the mandate with the
  // market pricing a policy nobody could be running.
  latentAtOpen.marketExpectedRate = clamp(
    0.5 * policyRate + 0.5 * taylorBenchmark(latentAtOpen, config.institution),
    // The same modelled floor the dynamics and the statement use, rather than
    // the safety rail: markets do not open pricing a rate the bank cannot set,
    // and a deflationary opening — 1929-33 opens with prices falling — would
    // otherwise price the Taylor rule's -11 % straight into the first meeting.
    pricedPathFloor(config.institution),
    scenario === null ? 15 : 30,
  )

  // Pre-fill the lag buffers with the opening steady state. Without this the
  // convolution would read an empty history and the economy would behave as
  // though policy had just been switched on.
  const openingRateGap = realRateGap(latentAtOpen)
  const openingConditions = financialConditionsIndex(latentAtOpen, config.institution)

  let state: SimulationState = {
    config,
    meetingIndex: 0,
    stepIndex: 0,
    timeYears: 0,
    latent: latentAtOpen,
    lags: {
      realRateGap: fillLag(openingRateGap),
      balanceSheetImpulse: fillLag(0),
      financialConditions: fillLag(openingConditions),
    },
    members,
    rng: createPrng(`${seed}|run`).getState(),
    stance,
    // No forecast outstanding at the opening: a committee that has not met
    // has not published anything.
    call: null,
    guidance: INITIAL_GUIDANCE,
    pendingEffects: [],
    eventLog: [],
    contradictionCost: 0,
    reversalCount: 0,
    diagnostics: [],
    history: [{ meetingIndex: 0, timeYears: 0, latent: latentAtOpen, members }],
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
      history: [{ meetingIndex: 0, timeYears: 0, latent: hurt, members }],
    }
  }

  // A historical mandate does not get a drawn opening crisis. Its opening is
  // the situation that actually obtained, and the things that broke it are on
  // the scenario's calendar with dates on them.
  if (scenario === null && (options.openingEvent ?? true)) {
    state = applyOpeningCrisis(state)
    // `history[0]` was captured above, before the crisis. The observation
    // layer reads history for "current period" values (`generateObservation`
    // → `publishedValue`), so without restating it the player's first meeting
    // would publish the pre-crisis numbers even though `latent` has moved on.
    state = {
      ...state,
      history: [
        { meetingIndex: 0, timeYears: 0, latent: state.latent, members: state.members },
      ],
    }
  }

  return state
}
