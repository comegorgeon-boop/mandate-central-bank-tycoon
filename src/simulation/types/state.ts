import type { DiagnosticEvent, RunConfig } from './core.ts'
import type { GuidanceState, PolicyStance } from './policy.ts'
import type { PendingEventEffect, ResolvedEventRecord } from './events.ts'
import type { PrngState } from '../rng/prng.ts'

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
   * Institution-specific transmission impairment.
   * ECB: sovereign fragmentation spread in basis points.
   * Fed: regional banking stress index, 0..100 scaled to the same field.
   */
  fragmentation: number

  // ---- Fiscal -------------------------------------------------------------
  /** Fiscal impulse, % of GDP. Positive is expansionary. */
  fiscalImpulse: number
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
export interface LatentSnapshot {
  readonly meetingIndex: number
  readonly timeYears: number
  readonly latent: LatentState
}

/** Complete, serialisable simulation state. */
export interface SimulationState {
  readonly config: RunConfig
  readonly meetingIndex: number
  readonly stepIndex: number
  readonly timeYears: number
  readonly latent: LatentState
  readonly lags: LagBuffers
  /** PRNG state, stored as plain data so the whole state stays serialisable. */
  readonly rng: PrngState
  /** Standing policy settings, in force until the player changes them. */
  readonly stance: PolicyStance
  readonly guidance: GuidanceState
  /** Event effects scheduled to fire at a future internal sub-step. */
  readonly pendingEffects: readonly PendingEventEffect[]
  /** Events already resolved in this run, newest last. */
  readonly eventLog: readonly ResolvedEventRecord[]
  /** Clamp and instability records. Developer-facing only. */
  readonly diagnostics: readonly DiagnosticEvent[]
  /** One snapshot per completed meeting, oldest first. */
  readonly history: readonly LatentSnapshot[]
}
