import type { DiagnosticEvent } from '../types/core.ts'
import type { LatentState } from '../types/state.ts'

/**
 * Documented computational safety bounds for every latent variable.
 *
 * These are not gameplay limits: they sit far outside any plausible economy
 * and exist only to keep the integrator from producing NaN or Infinity. When
 * one bites, a DiagnosticEvent is recorded so instability is visible in the
 * developer tooling rather than silently absorbed.
 */
export const LATENT_BOUNDS: Readonly<
  Record<keyof LatentState, readonly [number, number]>
> = {
  inflationHeadline: [-25, 60],
  inflationCore: [-20, 50],
  expectedInflationShort: [-15, 40],
  expectedInflationLong: [-10, 30],
  anchoring: [0, 1],
  wageGrowth: [-15, 45],
  importPriceInflation: [-50, 90],

  outputGap: [-20, 15],
  potentialGrowth: [-4, 8],
  realGrowth: [-25, 25],
  unemployment: [0.5, 35],
  naturalUnemployment: [2, 12],
  employmentMomentum: [-10, 10],

  policyRate: [-2, 30],
  neutralRealRate: [-2, 5],
  balanceSheet: [0, 120],
  reserves: [0, 100],
  balanceSheetFlow: [-15, 20],

  exchangeRate: [40, 200],

  creditGrowth: [-25, 30],
  creditSpread: [0.1, 15],
  termPremium: [-2, 8],
  assetPricePressure: [-60, 100],
  bankingStress: [0, 100],
  marketVolatility: [5, 100],
  fragmentation: [0, 1200],

  fiscalImpulse: [-6, 8],
  debtPressure: [0, 100],

  credibility: [0, 100],
  publicTrust: [0, 100],
  marketTrust: [0, 100],
  politicalPressure: [0, 100],

  marketExpectedRate: [-2, 30],

  supplyShock: [-8, 12],
  demandShock: [-8, 8],
  confidenceShock: [-6, 6],
  productivityShock: [-3, 3],
  financialShock: [-6, 8],
  geopoliticalRisk: [0, 100],
}

const LATENT_KEYS = Object.keys(LATENT_BOUNDS) as (keyof LatentState)[]

/** Plain numeric clamp with no diagnostics. */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return value < min ? min : value > max ? max : value
}

/**
 * Clamps every field of a latent state into its documented bounds, appending
 * a diagnostic for each one that had to be corrected.
 *
 * Returns the same object reference when nothing was out of bounds, which is
 * the overwhelmingly common case.
 */
export function clampLatentState(
  latent: LatentState,
  step: number,
  diagnostics: DiagnosticEvent[],
): LatentState {
  let corrected: LatentState | null = null

  for (const key of LATENT_KEYS) {
    const raw = latent[key]
    const [min, max] = LATENT_BOUNDS[key]

    if (!Number.isFinite(raw)) {
      corrected ??= { ...latent }
      corrected[key] = clamp(0, min, max)
      diagnostics.push({
        step,
        variable: key,
        rawValue: raw,
        clampedValue: corrected[key],
        kind: 'non_finite',
      })
      continue
    }

    if (raw < min || raw > max) {
      corrected ??= { ...latent }
      corrected[key] = raw < min ? min : max
      diagnostics.push({
        step,
        variable: key,
        rawValue: raw,
        clampedValue: corrected[key],
        kind: raw < min ? 'min' : 'max',
      })
    }
  }

  return corrected ?? latent
}

/** True when every field sits inside its documented bounds and is finite. */
export function isWithinBounds(latent: LatentState): boolean {
  for (const key of LATENT_KEYS) {
    const value = latent[key]
    const [min, max] = LATENT_BOUNDS[key]
    if (!Number.isFinite(value) || value < min || value > max) return false
  }
  return true
}

export { LATENT_KEYS }
