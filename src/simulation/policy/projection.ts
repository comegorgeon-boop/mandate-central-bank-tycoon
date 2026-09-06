import type { SeriesId } from '../types/observation.ts'
import type { PolicyPackage } from '../types/policy.ts'
import type { SimulationState } from '../types/state.ts'
import { getInstitution } from '../config/institutions.ts'
import { advanceTrueState } from '../engine/advanceTrueState.ts'
import { applyPolicyPackage } from '../engine/applyPolicyPackage.ts'
import { getSeries } from '../observation/series.ts'

/**
 * What this package is expected to do, against doing nothing.
 *
 * The learning mandate's whole promise is that a decision is legible: you can
 * anticipate, then compare with what actually happens. That needs a projection
 * of the *package* — the rate, the words and every standing instrument
 * together — and not of one channel at a time.
 *
 * It is computed by **running the engine twice**. Once with the package, once
 * holding everything where it is, from the same state, and differencing the
 * two. Nothing is estimated, curve-fitted or hand-written: the number the
 * player is shown is the model's own answer to "what does this do", produced
 * by the same code that will produce the answer they get.
 *
 * Two properties make it honest rather than a promise:
 *
 * **Procedural events are switched off in both arms.** They are on in the run
 * the player is actually living, and leaving them on here would fold the luck
 * of the next few meetings into a figure labelled "the effect of your
 * decision". With them off, the two arms share a seed and every random draw,
 * so the difference between them is caused by the package alone — exactly the
 * discipline `testing/harness.ts` uses for every calibration measurement in
 * this project. The copy says so: this is *ceteris paribus*, and the economy
 * will not oblige.
 *
 * **It never touches the live run.** Both arms are advanced from copies, and
 * the states they produce are discarded. The player's own random sequence is
 * untouched, because nothing is ever written back.
 */

/** How far ahead the projection looks, in meetings. */
export const PROJECTION_HORIZON = 4

/** One projected series, with the counterfactual beside it. */
export interface ProjectedSeries {
  readonly seriesId: SeriesId
  readonly label: string
  readonly unit: string
  readonly decimals: number
  /** Where it stands today. */
  readonly now: number
  /** Where it lands in `PROJECTION_HORIZON` meetings under this package. */
  readonly withPackage: number
  /** Where it lands if the committee changes nothing at all. */
  readonly holding: number
}

export interface PackageProjection {
  readonly horizonMeetings: number
  readonly series: readonly ProjectedSeries[]
  /** True when the package does nothing the projection could show. */
  readonly unchanged: boolean
}

/**
 * The series worth projecting.
 *
 * Deliberately short. The point is to let the player form an expectation they
 * can check, and an expectation about eight numbers is not an expectation. One
 * from each half of the mandate, plus the fastest channel — which is where the
 * effect shows up before either half of the mandate moves at all, and seeing
 * that is half the lesson.
 */
const PROJECTED: readonly SeriesId[] = [
  'headline_inflation',
  'unemployment',
  'market_expected_rate',
]

/** Advances a copy `meetings` times with no player input and no events. */
function coast(state: SimulationState, meetings: number): SimulationState {
  let current = state
  for (let meeting = 0; meeting < meetings; meeting += 1) {
    const applied = applyPolicyPackage(current, { actions: [], communication: null })
    // A hold can only be rejected by a bound the player is already inside, so
    // this is a guard rather than a case: if it ever fires, showing a partial
    // projection would be worse than showing none.
    if (!applied.ok) return current
    current = advanceTrueState(applied.state)
  }
  return current
}

/**
 * The projection primitive: any package, any set of series.
 *
 * Both arms are advanced from copies of `state` and then discarded, so the
 * live run's random sequence is untouched however many times this is called.
 * Series the institution does not publish are dropped rather than reported as
 * zero — a fragmentation spread means nothing to a single-sovereign mandate.
 */
export function projectSeries(
  state: SimulationState,
  pkg: PolicyPackage,
  seriesIds: readonly SeriesId[],
  horizonMeetings: number = PROJECTION_HORIZON,
): readonly ProjectedSeries[] | null {
  const applied = applyPolicyPackage(state, pkg)
  if (!applied.ok) return null

  const institution = state.config.institution
  // The package's first meeting, then the committee sitting on its hands; and
  // the same from a state where it never acted at all.
  const withPackage = coast(advanceTrueState(applied.state), horizonMeetings - 1)
  const holding = coast(state, horizonMeetings)

  const series: ProjectedSeries[] = []
  for (const seriesId of seriesIds) {
    const definition = getSeries(seriesId)
    if (definition === undefined) continue
    if (!definition.institutions.includes(institution)) continue
    series.push({
      seriesId,
      label: definition.label,
      unit: definition.unit,
      decimals: definition.decimals,
      now: definition.read(state.latent),
      withPackage: definition.read(withPackage.latent),
      holding: definition.read(holding.latent),
    })
  }
  return series
}

export function projectPackage(
  state: SimulationState,
  pkg: PolicyPackage,
  horizonMeetings: number = PROJECTION_HORIZON,
): PackageProjection | null {
  const series = projectSeries(state, pkg, PROJECTED, horizonMeetings)
  if (series === null) return null

  const unchanged = series.every(
    (entry) =>
      Math.abs(entry.withPackage - entry.holding) < 10 ** -entry.decimals / 2,
  )

  return { horizonMeetings, series, unchanged }
}

/** The inflation objective this projection should be read against. */
export function projectionTarget(state: SimulationState): number {
  return getInstitution(state.config.institution).inflationTarget
}
