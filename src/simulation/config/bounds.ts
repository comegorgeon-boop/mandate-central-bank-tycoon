import type { DiagnosticEvent } from '../types/core.ts'
import type { LatentState } from '../types/state.ts'

/**
 * Documented bounds for every latent variable.
 *
 * Most of these are computational safety rails: they sit far outside any
 * plausible economy and exist only to keep the integrator from producing NaN
 * or Infinity. When one bites, a DiagnosticEvent is recorded so instability is
 * visible in the developer tooling rather than silently absorbed.
 *
 * A minority are not safety rails at all — see `SATURATING` below.
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
  fragility: [0, 100],
  meetingsSinceEvent: [0, 99],
  fragmentation: [0, 1200],

  fiscalImpulse: [-6, 8],
  // Per cent of GDP. The upper bound is above Japan and the lower is a
  // government with no net debt, which are the two ends of the real range.
  publicDebt: [0, 320],
  // A surplus of 10 % of GDP is Norway; a primary deficit of 20 % is a war or
  // a pandemic, and 2020 reached about 12 in the United States.
  primaryBalance: [-20, 10],
  debtService: [0, 30],
  // The average coupon on the stock. The floor is negative because the euro
  // area issued at negative yields for years and those bonds are still in
  // the stock.
  effectiveDebtRate: [-1, 25],
  debtPressure: [0, 100],

  credibility: [0, 100],
  publicTrust: [0, 100],
  marketTrust: [0, 100],
  politicalPressure: [0, 100],

  // Widened from [-2, 30]. The priced path tracks the Taylor benchmark, which
  // is linear in headline inflation, so in a genuine spiral it follows headline
  // upward — and, unlike headline, it *diverges* rather than settling, because
  // the priced path feeds financial conditions which feed the gap which feeds
  // inflation. Widening does not stop that and is not meant to.
  //
  // This comment used to go on to say that what reached the rail were mandates
  // already ending in `inflation_spiral`. That was a guess and it was wrong in
  // its *direction*: measured over 300 hard mandates, every run that touched it
  // touched the **floor**, in a deflation, because the Taylor benchmark has no
  // floor and prescribes about -11 at -7 % inflation. That is the diagnosis of
  // the one standing clamp warning in `npm run sim:sweep`, carried in
  // docs/BALANCE.md as "not diagnosed" for several sessions. The priced path now
  // carries its own modelled floor — `MARKET_EXPECTATIONS.belowFloorAllowance` —
  // which sits above this rail, so this is a safety rail again rather than a
  // working part of the model.
  marketExpectedRate: [-2, 40],

  // Widened from [-8, 12]. Hard deliberately has no `costPushCeiling`, so
  // shocks piling onto one another is its subject rather than an accident, and
  // a rail a mode is *designed* to reach is not sitting where this file says
  // its rails sit. Three runs in 150 on ecb/hard touched it.
  supplyShock: [-10, 16],
  demandShock: [-8, 8],
  // Widened from [-6, 6]. The stationary spread of the process itself is 0.7,
  // so six was already far outside anything the stochastic side produces — but
  // the major events each push confidence 1.7 to 2.2, and once they were
  // unlocked above easy, hard's 1.35 severity multiplier let three of them
  // inside one window reach the rail. A safety rail that a plausible run can
  // touch is not sitting where this file says its rails sit.
  confidenceShock: [-9, 9],
  productivityShock: [-3, 3],
  financialShock: [-6, 8],
  geopoliticalRisk: [0, 100],
}

/**
 * Variables whose bounds are the definition of the variable, not a safety rail.
 *
 * `bankingStress`, `credibility` and the rest of these are 0-100 indices. One
 * hundred is not "the integrator has come apart"; it is the top of the scale,
 * and an index pinned there during a bank failure is the model working. The
 * end conditions read exactly that — `bankingCrisis.failStress` is capped at 95
 * — so saturation is a state the game is built to have opinions about.
 *
 * The distinction is recorded here because its absence produced a real, and
 * lasting, false alarm. The developer sweep flags any run that recorded a
 * clamp diagnostic, so `geopoliticalRisk` reaching 100 in one or two runs out
 * of 150 has been printing as a balance warning since engine 1.0.0 and was
 * carried in docs/BALANCE.md for several sessions as "pre-existing, not
 * diagnosed". It was never a defect. Unlocking the major events above easy
 * would have added `marketVolatility` and `bankingStress` to the same list of
 * phantoms, since hard's severity multiplier of 1.35 makes a bank failure's
 * `+50` stress land on an index that only has so much room.
 *
 * Saturation is still *clamped* here, exactly as before — the arithmetic is
 * unchanged — and still recorded, as `kind: 'saturated'`, so it stays
 * inspectable. What changes is that it is no longer reported as instability.
 */
const SATURATING: ReadonlySet<keyof LatentState> = new Set([
  'anchoring',
  'bankingStress',
  'marketVolatility',
  'geopoliticalRisk',
  'credibility',
  'publicTrust',
  'marketTrust',
  'politicalPressure',
  'debtPressure',
  'reserves',
])

/** True when hitting this variable's bound is the scale ending, not a fault. */
export function saturates(variable: keyof LatentState): boolean {
  return SATURATING.has(variable)
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
        // An index reaching the end of its own scale is not a fault. The
        // arithmetic is identical either way; only the label differs.
        kind: SATURATING.has(key) ? 'saturated' : raw < min ? 'min' : 'max',
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
