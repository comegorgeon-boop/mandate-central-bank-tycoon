import type { MemberLatent } from '../types/state.ts'
import { COHESION_BLEND } from '../config/scoring.ts'
import { dispersion } from '../engine/members.ts'

/**
 * How far apart the currency area was held, as one number and as three.
 *
 * **This file exists because the score and its own calibration script were
 * computing different quantities.** `calculateScore` built the penalty inline
 * from `engine/members.ts`'s `dispersion` — a GDP-weighted mean absolute
 * deviation — and `dev/cohesion.ts`, the committed script whose entire job is
 * to set `COHESION_TOLERANCE` against that penalty, declared a local
 * `dispersion` that was an *unweighted population standard deviation*. Its
 * docstring said it "duplicates the three lines of `calculateScore`". It did
 * not: it duplicated their shape and not their arithmetic, so the tolerance
 * that decides whether the chair is charged anything at all was set against a
 * statistic the chair is never charged on.
 *
 * That is this project's own recorded defect — one quantity stated in two
 * places, agreeing with each other and disagreeing with the model — and the
 * only repair that holds is for there to be one place. Everything that needs
 * the penalty calls this: the score, the calibration script, the diagnosis in
 * `dev/fragmentation.ts`, and the revocation condition.
 *
 * ## The three channels, and why the split is load-bearing
 *
 * The penalty is three different quantities added together, and the player's
 * instruments reach exactly one of them:
 *
 * | channel | weight | what reaches it |
 * | --- | --- | --- |
 * | inflation dispersion | 1.0 | nothing |
 * | unemployment dispersion | 0.6 | nothing |
 * | spread range ÷ 100 | 1.0 | transmission protection, TLTROs, purchases |
 *
 * A component the player is charged for must be a component the player can
 * move, and whether that is true here is an empirical question about which
 * channel dominates — which is why the decomposition is exported rather than
 * computed privately inside the score. Measured, the spread channel is both
 * the largest and the one that responds: see `dev/fragmentation.ts`.
 */
export interface CohesionChannels {
  /** GDP-weighted mean absolute inflation dispersion, percentage points. */
  readonly inflation: number
  /** The same for unemployment, already multiplied by its blend weight. */
  readonly unemployment: number
  /** Widest member spread range, in units of `COHESION_BLEND.spreadRange`. */
  readonly spread: number
  /** The three added: the penalty the score charges against the tolerance. */
  readonly total: number
}

const EMPTY: CohesionChannels = { inflation: 0, unemployment: 0, spread: 0, total: 0 }

/** The penalty at one meeting, decomposed. Zero outside a currency area. */
export function cohesionChannelsAt(members: readonly MemberLatent[]): CohesionChannels {
  if (members.length === 0) return EMPTY

  const spreads = members.map((member) => member.spread)
  const inflation = COHESION_BLEND.inflation * dispersion(members, 'inflationOffset')
  const unemployment =
    COHESION_BLEND.unemployment * dispersion(members, 'unemploymentOffset')
  const spread =
    (Math.max(...spreads) - Math.min(...spreads)) / COHESION_BLEND.spreadRange

  return { inflation, unemployment, spread, total: inflation + unemployment + spread }
}

/**
 * The penalty averaged over a mandate, decomposed.
 *
 * Meetings with no members are skipped rather than averaged in as zero: a Fed
 * mandate has no currency area, and dividing by meetings that cannot
 * contribute would report every one of them as perfectly cohesive.
 */
export function cohesionChannels(
  history: readonly { readonly members: readonly MemberLatent[] }[],
): CohesionChannels {
  let inflation = 0
  let unemployment = 0
  let spread = 0
  let counted = 0

  for (const snapshot of history) {
    if (snapshot.members.length === 0) continue
    const channels = cohesionChannelsAt(snapshot.members)
    inflation += channels.inflation
    unemployment += channels.unemployment
    spread += channels.spread
    counted += 1
  }

  if (counted === 0) return EMPTY
  return {
    inflation: inflation / counted,
    unemployment: unemployment / counted,
    spread: spread / counted,
    total: (inflation + unemployment + spread) / counted,
  }
}

/** The penalty averaged over a mandate, as the single number the score uses. */
export function cohesionPenalty(
  history: readonly { readonly members: readonly MemberLatent[] }[],
): number {
  return cohesionChannels(history).total
}
