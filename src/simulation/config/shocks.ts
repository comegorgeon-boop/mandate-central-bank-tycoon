import type { LatentState } from '../types/state.ts'

/**
 * Stochastic disturbances, modelled as mean-reverting (Ornstein-Uhlenbeck)
 * processes and integrated on the internal sub-step grid.
 *
 * Drawing innovations every sub-step rather than once per meeting keeps the
 * paths smooth and stops shocks from arriving as discrete turn events.
 *
 * All processes are symmetric, so positive surprises are exactly as likely as
 * negative ones.
 */
export interface ShockProcess {
  readonly key: keyof LatentState
  /** Speed of reversion to `mean`, per year. */
  readonly meanReversion: number
  /** Innovation standard deviation, per square root of a year. */
  readonly volatility: number
  readonly mean: number
}

export const SHOCK_PROCESSES: readonly ShockProcess[] = [
  /** Cost-push: energy, food, supply chains. Persistent and slow to fade. */
  { key: 'supplyShock', meanReversion: 1.2, volatility: 1.5, mean: 0 },
  /** Aggregate demand disturbance. */
  { key: 'demandShock', meanReversion: 1.5, volatility: 1.2, mean: 0 },
  /** Household and business confidence. */
  { key: 'confidenceShock', meanReversion: 2.0, volatility: 1.4, mean: 0 },
  /** Productivity, feeding potential growth. The slowest process. */
  { key: 'productivityShock', meanReversion: 0.8, volatility: 0.5, mean: 0 },
  /** Financial disturbance driving spreads and volatility. */
  { key: 'financialShock', meanReversion: 1.8, volatility: 1.0, mean: 0 },
  /** Geopolitical risk level, on a 0-100 scale around a nonzero mean. */
  { key: 'geopoliticalRisk', meanReversion: 0.9, volatility: 12, mean: 25 },
]

/** Fiscal impulse follows its own process, nudged by events and debt pressure. */
export const FISCAL_SHOCK: ShockProcess = {
  key: 'fiscalImpulse',
  meanReversion: 1.1,
  volatility: 0.8,
  mean: 0,
}

/** Exchange-rate innovation, applied on top of the deterministic UIP block. */
export const FX_SHOCK_VOLATILITY = 5.0
