import type { DiagnosticEvent, RunConfig } from './core.ts'
import type { ForecastCall } from '../policy/forecastCall.ts'
import type { GuidanceState, PolicyStance } from './policy.ts'
import type { PendingEventEffect, ResolvedEventRecord } from './events.ts'
import type { PrngState } from '../rng/prng.ts'
import type { MemberId } from '../config/members.ts'

/**
 * The latent true economic state.
 *
 * This is what the simulation runs on. It is never shown to the player: the
 * UI only ever sees an ObservationSet produced by generateObservation, which
 * adds noise, publication lags and revisions on top of these values.
 *
 * Rates and growth figures are annualised percentages (2.4 means 2.4 %/year)
 * unless documented otherwise.
 */
export interface LatentState {
  // ---- Prices -------------------------------------------------------------
  /** Headline consumer-price inflation, annualised %. */
  inflationHeadline: number
  /** Core inflation excluding energy and food, annualised %. */
  inflationCore: number
  /** One-year-ahead inflation expectations, annualised %. */
  expectedInflationShort: number
  /** Five-year-ahead inflation expectations, annualised %. */
  expectedInflationLong: number
  /** How firmly long-run expectations are pinned to the target. 0..1. */
  anchoring: number
  /** Nominal wage growth, annualised %. */
  wageGrowth: number
  /** Imported goods price inflation, annualised %. */
  importPriceInflation: number

  // ---- Activity -----------------------------------------------------------
  /** Output gap: actual minus potential output, % of potential. */
  outputGap: number
  /** Trend growth of potential output, annualised %. */
  potentialGrowth: number
  /** Realised real output growth, annualised %. */
  realGrowth: number
  /** Unemployment rate, %. */
  unemployment: number
  /** Non-accelerating-inflation rate of unemployment, %. */
  naturalUnemployment: number
  /** Smoothed recent change in employment; positive means hiring. */
  employmentMomentum: number

  // ---- Policy and balance sheet ------------------------------------------
  /** Nominal policy rate, %. */
  policyRate: number
  /** Neutral real rate of interest (r*), %. */
  neutralRealRate: number
  /** Central-bank balance sheet, % of GDP. */
  balanceSheet: number
  /** Excess reserves / liquidity index. 50 is the neutral baseline. */
  reserves: number
  /** Current asset-purchase pace, % of GDP per year. Negative means runoff. */
  balanceSheetFlow: number

  // ---- External -----------------------------------------------------------
  /** Effective exchange rate index; 100 is baseline, higher is stronger. */
  exchangeRate: number

  // ---- Financial ----------------------------------------------------------
  /** Real credit growth, annualised %. */
  creditGrowth: number
  /** Corporate credit spread over the risk-free curve, percentage points. */
  creditSpread: number
  /** Term premium embedded in long rates, percentage points. */
  termPremium: number
  /** Housing and equity valuation pressure. 0 is fair value. */
  assetPricePressure: number
  /** Banking-system stress index, 0..100. Above 50 is impaired. */
  bankingStress: number
  /** Market volatility index, 0..100. Around 20 is calm. */
  marketVolatility: number
  /**
   * Fragility built up by calm, 0 to 100. **Minsky's hypothesis, as a number.**
   *
   * The defect this exists to fix was reported from a played mandate: eight
   * consecutive meetings with nothing to decide, because the economy was well
   * run and a well-run economy made the event generator go quiet. That is
   * realistic and it is bad play — and the correction is not a cheat, it is
   * the financial-instability hypothesis this game already ships an adviser
   * for. *Stability breeds instability.* A long calm is when leverage is
   * built, risk is repriced as safe, and the imbalances of the next crisis
   * are assembled.
   *
   * So calm **accumulates** here, and what accumulates raises the hazard of a
   * shock and the severity of one when it lands. A shock discharges it, which
   * is the other half of the hypothesis: the crisis is the deleveraging.
   *
   * It is not shown to the player as a gauge. It is read in the newswire —
   * the clues that precede an event — because a visible "crisis meter" would
   * turn an argument about the world into a number to manage.
   */
  fragility: number
  /**
   * Meetings since anything last happened.
   *
   * Carried so the generator can keep a promise it could not otherwise keep:
   * **never a third consecutive meeting with nothing to decide.** A played
   * mandate reported eight in a row, and raising the hazard fixed the median
   * without fixing the tail — a probability, however steep, has a tail by
   * definition.
   *
   * So this is a stated rule rather than a model result, and it is stated
   * here rather than hidden in a constant: after two quiet meetings the next
   * draw fires. What fires is still the weighted draw over what the state
   * makes eligible, and by then fragility has been building for two
   * meetings, so the thing that arrives is the thing the calm had earned.
   */
  meetingsSinceEvent: number
  /**
   * Institution-specific transmission impairment.
   * ECB: sovereign fragmentation spread in basis points.
   * Fed: regional banking stress index, 0..100 scaled to the same field.
   */
  fragmentation: number

  // ---- Fiscal -------------------------------------------------------------
  /** Fiscal impulse, % of GDP. Positive is expansionary. */
  fiscalImpulse: number
  /**
   * General government debt, per cent of GDP.
   *
   * A real quantity rather than an index, because the public finances panel
   * shows it to the player as one and because the arithmetic that makes it
   * move is the whole of the Sargent-Wallace mechanism: a debt stock rolls
   * over at the rate the market charges, and the rate the market charges is
   * the thing this game is about.
   *
   * It is **not in anybody's mandate**. Nothing in `calculateScore.ts` reads
   * it. It reaches the player through two channels and only two: the event
   * generator, which makes a fiscal-dominance episode more likely as it
   * rises, and the pressure gauge. A central bank that was scored on the
   * deficit would be a treasury.
   */
  publicDebt: number
  /**
   * The primary balance, per cent of GDP. Negative is a deficit.
   *
   * "Primary" means before interest: this is what the government decides, and
   * `debtService` below is what the central bank's own decisions cost it. The
   * separation is the point of the panel — one of those two lines is the
   * player's doing and the other is not.
   */
  primaryBalance: number
  /**
   * Interest paid on the debt stock, per cent of GDP.
   *
   * The living link. It does not follow the policy rate; it follows the
   * *average rate on the outstanding stock*, which converges on the market
   * rate at a speed set by the average maturity. A chair who raises by two
   * points sees this move by almost nothing in the first year and by a great
   * deal in the fourth, which is the lag the whole mechanism is about.
   */
  debtService: number
  /**
   * The average rate the existing debt stock actually pays, per cent.
   *
   * Carried rather than derived because it has memory: it is the weighted
   * average coupon of a stock issued over the past several years, and the
   * only way to get the lag right is to integrate it.
   */
  effectiveDebtRate: number
  /** Sovereign debt sustainability pressure, 0..100. */
  debtPressure: number

  // ---- Institutional standing --------------------------------------------
  /** Institutional credibility, 0..100. */
  credibility: number
  /** Public trust in the central bank, 0..100. */
  publicTrust: number
  /** Market trust in the reaction function, 0..100. */
  marketTrust: number
  /** Political pressure on the institution, 0..100. */
  politicalPressure: number

  // ---- Market expectations ------------------------------------------------
  /** Policy rate the market prices roughly one year ahead, %. */
  marketExpectedRate: number

  // ---- Persistent stochastic components ----------------------------------
  /** AR(1) supply-side cost push, percentage points on inflation. */
  supplyShock: number
  /** AR(1) demand disturbance, percentage points on the output gap. */
  demandShock: number
  /** AR(1) confidence disturbance. */
  confidenceShock: number
  /** AR(1) productivity disturbance, percentage points on potential growth. */
  productivityShock: number
  /** AR(1) financial disturbance driving spreads and volatility. */
  financialShock: number
  /** Geopolitical risk level, 0..100. */
  geopoliticalRisk: number
}

/**
 * Rolling histories used by the distributed-lag convolution.
 *
 * Index 0 is the most recent internal sub-step. These buffers are what stops
 * policy from acting like an instantaneous turn bonus: a rate change enters
 * the buffer now and only reaches its peak effect on demand several quarters
 * of simulated time later.
 */
export interface LagBuffers {
  /** Real policy rate minus the neutral real rate, percentage points. */
  readonly realRateGap: readonly number[]
  /** Balance-sheet impulse, % of GDP per year. */
  readonly balanceSheetImpulse: readonly number[]
  /** Financial conditions gap; positive means tighter than neutral. */
  readonly financialConditions: readonly number[]
}

/** A per-meeting snapshot of the latent state, kept for scoring and charts. */
/**
 * One member of a currency area, as dispersion around the aggregate.
 *
 * Offsets rather than levels, and the weighted mean of each offset is held at
 * zero, so the area's own inflation rate stays exactly the number the rest of
 * the engine integrates. See `engine/members.ts` for why, and for the
 * arithmetic that keeps the identity exact under an asymmetric shock.
 *
 * Empty for a single-sovereign mandate. The Fed has regions; it does not have
 * members with their own sovereign borrowing costs, which is the whole
 * difference this models.
 */
export interface MemberLatent {
  readonly id: MemberId
  /** Percentage points of headline inflation, relative to the area. */
  readonly inflationOffset: number
  /** Percentage points of output gap, relative to the area. */
  readonly outputGapOffset: number
  /** Percentage points of unemployment, relative to the area. */
  readonly unemploymentOffset: number
  /**
   * Sovereign spread over the area benchmark, basis points.
   *
   * A level, not an offset: it is a price, and prices have no reason to
   * average to zero.
   */
  readonly spread: number
}

export interface LatentSnapshot {
  readonly meetingIndex: number
  readonly timeYears: number
  readonly latent: LatentState
  /** Member dispersion at this meeting. Empty outside a currency area. */
  readonly members: readonly MemberLatent[]
}

/** Complete, serialisable simulation state. */
export interface SimulationState {
  readonly config: RunConfig
  readonly meetingIndex: number
  readonly stepIndex: number
  readonly timeYears: number
  readonly latent: LatentState
  /**
   * The members of the currency area, if this institution has any.
   *
   * Kept beside `latent` rather than inside it because `LATENT_BOUNDS` is
   * typed over every key of `LatentState` and every one of them is a number:
   * an array field there would break the clamping contract that keeps the
   * integrator honest.
   */
  readonly members: readonly MemberLatent[]
  readonly lags: LagBuffers
  /** PRNG state, stored as plain data so the whole state stays serialisable. */
  readonly rng: PrngState
  /** Standing policy settings, in force until the player changes them. */
  readonly stance: PolicyStance
  readonly guidance: GuidanceState
  /**
   * The published forecast currently outstanding, if the committee has made
   * one. Settled two meetings after it was issued and then cleared.
   *
   * Mandate-long state rather than a reading, which is why it is here: it has
   * to survive the interval, and a replay has to reconstruct it. See
   * `policy/forecastCall.ts`.
   */
  readonly call: ForecastCall | null
  /** Event effects scheduled to fire at a future internal sub-step. */
  readonly pendingEffects: readonly PendingEventEffect[]
  /** Events already resolved in this run, newest last. */
  readonly eventLog: readonly ResolvedEventRecord[]
  /**
   * Running sum of every confirmed package's contradiction severity
   * (`detectContradictions`'s `severity` values, summed per package and
   * accumulated across the mandate). The instant credibility/trust cost of a
   * contradictory package was always priced and then forgotten; this is what
   * lets the score and a future end condition see a *pattern* of incoherent
   * conduct, the same way `guidance.brokenPromises` already does for broken
   * promises.
   */
  readonly contradictionCost: number
  /**
   * Running count of meetings whose rate move reversed the previous
   * meeting's direction. Read by `applyPolicyPackage` to price a *pattern*
   * of reversals escalatingly rather than any single one — a committee
   * pivoting once in response to genuinely new information is normal
   * central banking and costs nothing; a committee that cannot hold a
   * direction for two meetings running is a different thing entirely. See
   * `COMMUNICATION.reversalCost`'s doc comment.
   */
  readonly reversalCount: number
  /**
   * Consecutive meetings on which a *bloc* of the committee dissented.
   *
   * The ECB's own ending, and the only way a fictional presidency ends short
   * of a catastrophe. It is a count rather than a flag because what ends a
   * presidency is not a vote lost on the day — nobody can remove an ECB
   * president and there is no second term to withhold — but a policy a part
   * of the room has stopped being able to accept, held anyway, meeting after
   * meeting. Weber left the Bundesbank in February 2011 and Stark the
   * Executive Board in September 2011, both over the Securities Markets
   * Programme, and neither was outvoted.
   *
   * Accumulated here rather than derived from `history`, because the ballots
   * are not in the history: a snapshot carries the economy, and a dissent is
   * a fact about the decision. See `COUNCIL` in `config/tenure.ts`.
   */
  readonly councilDissent: number
  /** Clamp and instability records. Developer-facing only. */
  readonly diagnostics: readonly DiagnosticEvent[]
  /** One snapshot per completed meeting, oldest first. */
  readonly history: readonly LatentSnapshot[]
}
