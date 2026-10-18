import type { Difficulty, Institution } from '../types/core.ts'
import type { ForecastFan } from '../types/observation.ts'
import { IS_CURVE, PHILLIPS } from '../config/model.ts'
import { SUBSTEPS_PER_MEETING, YEARS_PER_MEETING } from '../config/time.ts'
import { LABOR } from '../config/model.ts'
import { buildLagKernel } from '../engine/lags.ts'
import { getInstitution } from '../config/institutions.ts'

/**
 * Where the forecast goes if you move the dial — redrawn while you move it.
 *
 * ## Why this exists
 *
 * The player's own words: *"I barely read the numbers between two meetings. I
 * click hold or increase, and it is always the same choice."* A dial with a
 * table beside it is a form. A dial that visibly bends the path of inflation
 * as you drag it is an instrument, and the difference is not decoration — it
 * is whether the consequence of a decision is something you *see before
 * taking it* or a sentence you are asked to believe.
 *
 * ## Why it is not an oracle, at any difficulty
 *
 * This is the part that decides whether it may be shown above easy.
 *
 * `policy/projection.ts` runs the engine forward twice from the **true latent
 * state** and differences the arms. That is the model's own answer and it is
 * privileged information, which is why the information ladder withdraws it
 * above the learning mandate.
 *
 * This is a different thing. It takes the fan the staff have already
 * **published** to the player, and shifts its central path by the arithmetic
 * the desk already states in prose: a rate move of this size, transmitted
 * through the lag kernel this difficulty is told it has, moving the output gap
 * through the IS curve's own sensitivity and inflation through the Phillips
 * slope. Every input is either on the player's screen or a structural constant
 * the game documents. Nothing here reads a latent variable.
 *
 * So it is **the player's own arithmetic, drawn** — the sentence "raising the
 * rate cools demand over the following meetings, and inflation only responds
 * after the output gap has moved" rendered as a shape rather than as a claim.
 * It is available at every difficulty for exactly that reason, and the fan it
 * shifts carries the staff's own bias and width, so a hard mandate's fan is
 * wide and wrong in the way hard mandates' forecasts are.
 *
 * ## What it is careful not to promise
 *
 * The *width* of the band never changes with the move. Uncertainty about the
 * economy is not reduced by having decided something, and a fan that narrowed
 * when the player tightened would be telling them a comfortable lie. Only the
 * central path moves.
 */

/** One horizon of the projected path, published and contemplated side by side. */
export interface LivingBand {
  readonly horizonMeetings: number
  /** The published central path, unchanged. */
  readonly held: number
  /** Where the central path goes under the contemplated move. */
  readonly moved: number
  readonly p10: number
  readonly p30: number
  readonly p70: number
  readonly p90: number
}

export interface LivingFan {
  readonly seriesId: ForecastFan['seriesId']
  readonly label: string
  /**
   * Where the series stands now, as published — or null when it has not.
   *
   * Null is the ordinary case at the first meeting of a mandate and at any
   * meeting whose release is missing or still lagged. The forecast exists
   * regardless: a staff forecast is a statement about the future and does not
   * wait for this month's print. The chart then starts at the nearest horizon
   * rather than pretending to an anchor it has not got, which is what the
   * first version did — it skipped the chart entirely and the headline
   * feature of the desk was invisible at meeting one of every mandate.
   */
  readonly now: number | null
  readonly bands: readonly LivingBand[]
  /** The objective or sustainable level this series is read against. */
  readonly reference: number | null
  readonly referenceLabel: string
  /** The move this was drawn for, in basis points. */
  readonly basisPoints: number
}

/**
 * Share of a rate move's effect delivered by a given horizon.
 *
 * Read off the engine's own kernel, which is the same object
 * `features/policy/lag.ts` quotes when the desk says "peak effect around seven
 * meetings from now". A player who has read that sentence and then watches
 * this curve is seeing the same fact twice, which is the point.
 */
function deliveredBy(difficulty: Difficulty, horizonMeetings: number): number {
  const kernel = buildLagKernel(difficulty)
  const substeps = Math.round(horizonMeetings * SUBSTEPS_PER_MEETING)
  let cumulative = 0
  for (let index = 0; index < Math.min(substeps, kernel.length); index += 1) {
    cumulative += kernel[index]
  }
  return cumulative
}

/**
 * How far one point of real rate moves the output gap once fully delivered.
 *
 * The IS curve's own sensitivity, integrated over the time it takes to arrive
 * rather than applied as an instantaneous jump. The gap's own mean reversion
 * fights it, so the steady-state displacement is the sensitivity divided by
 * the reversion speed — which is the standard reduced form and is what the
 * engine converges to if a rate is held.
 */
function gapPerPoint(): number {
  return IS_CURVE.rateSensitivity / IS_CURVE.meanReversion
}

/**
 * The published fan, redrawn for a contemplated move.
 *
 * Returns null when there is no published fan for the series — a mode that
 * withholds the forecast withholds this with it, because this is built out of
 * the forecast and cannot be more available than its input.
 */
export function livingFan(
  fan: ForecastFan | undefined,
  options: {
    readonly basisPoints: number
    readonly difficulty: Difficulty
    readonly institution: Institution
    /** The latest published reading, or null if it has not printed. */
    readonly now: number | null
    /** The published objective, or the sustainable rate for unemployment. */
    readonly reference: number | null
    readonly referenceLabel: string
  },
): LivingFan | null {
  if (fan === undefined || fan.bands.length === 0) return null

  const points = options.basisPoints / 100
  const gapAtFullDelivery = -points * gapPerPoint()

  const bands = fan.bands.map((band) => {
    const share = deliveredBy(options.difficulty, band.horizonMeetings)
    const gapShift = gapAtFullDelivery * share
    const years = band.horizonMeetings * YEARS_PER_MEETING

    let shift: number
    switch (fan.seriesId) {
      case 'headline_inflation':
        // Inflation follows the gap through the Phillips curve, and the gap
        // itself has to have moved first — which is why the second lag is
        // applied on top of the first and why a rate move shows up in
        // inflation later than it shows up in anything else.
        shift = PHILLIPS.gapSlope * gapShift * Math.min(1, years)
        break
      case 'unemployment':
        // Okun, the other way round: a negative gap raises unemployment.
        shift = -LABOR.okun * gapShift
        break
      default:
        shift = gapShift
        break
    }

    return {
      horizonMeetings: band.horizonMeetings,
      held: band.central,
      moved: band.central + shift,
      // The width is untouched. See the note at the top: deciding something
      // does not make the world more predictable.
      p10: band.p10 + shift,
      p30: band.p30 + shift,
      p70: band.p70 + shift,
      p90: band.p90 + shift,
    }
  })

  return {
    seriesId: fan.seriesId,
    label: fan.label,
    now: options.now,
    bands,
    reference: options.reference,
    referenceLabel: options.referenceLabel,
    basisPoints: options.basisPoints,
  }
}

/** The objective this institution's inflation fan is read against. */
export function fanReference(
  seriesId: ForecastFan['seriesId'],
  institution: Institution,
  objective: number,
): { readonly value: number | null; readonly label: string } {
  if (seriesId === 'headline_inflation') {
    return { value: objective, label: 'objective' }
  }
  if (seriesId === 'unemployment') {
    return {
      value: getInstitution(institution).initial.naturalUnemployment,
      label: 'sustainable rate',
    }
  }
  return { value: 0, label: 'balance' }
}
