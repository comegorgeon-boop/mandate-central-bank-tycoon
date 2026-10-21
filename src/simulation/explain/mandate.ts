import type { RunConfig } from '../types/core.ts'
import type { LatentState } from '../types/state.ts'
import { inflationTargetFor } from '../scenarios/scenarios.ts'
import { unemploymentGap } from '../engine/indices.ts'

/**
 * The job, in three readings: two to close, one not to break.
 *
 * ## The complaint
 *
 * > "LE JEU EST TROP TECHNIQUE ET ON NE SAIT PAS OÙ ON VA. Il faut du
 * > CONCRET et un OBJECTIF CLAIR. […] Je n'ai pas de ligne d'arrivée."
 *
 * ## The model, and why growth is not a third target
 *
 * > "L'inflation à 2 % et le chômage autour de son niveau soutenable sont les
 * > CIBLES. La croissance n'est pas une cible : c'est ce qu'on abîme en y
 * > allant, et on est jugé sur le fait de ne pas la détruire. C'est le vrai
 * > arbitrage, et c'est plus honnête que d'en faire un troisième objectif."
 *
 * That is exactly right and it is the correct economics as well as the
 * clearer game. A central bank does not have a growth target — it has price
 * stability and, at the Fed, maximum employment, and the output cost of
 * reaching them is the *sacrifice*. Making growth a third objective would
 * teach that a central bank should maximise output, which is the error the
 * whole 1970s were made of.
 *
 * So: two `target` readings with a distance to close, one `guard` reading
 * with a floor not to fall through.
 *
 * ## The two institutions do not have the same board
 *
 * > "la Fed a un double mandat, donc deux cibles à égalité. La BCE a la
 * > stabilité des prix comme objectif PRIMAIRE, le reste seulement « sans
 * > préjudice » — son tableau doit le montrer."
 *
 * Also exactly right, and it is Article 127(1) in one sentence: the ESCB's
 * primary objective is price stability, and *without prejudice to that*
 * objective it supports the general economic policies of the Union. The Fed
 * Act gives "maximum employment, stable prices, and moderate long-term
 * interest rates" with no ordering.
 *
 * So the ECB's board ranks its readings and the Fed's does not, the weights
 * differ, and `SCORE_WEIGHTS` already carries the same asymmetry — 0.26/0.26
 * at the Fed against 0.32/0.14 at the ECB. This makes it visible instead of
 * leaving it in a scoring table nobody reads.
 */

export type ReadingId = 'inflation' | 'unemployment' | 'growth'

export interface MandateReading {
  readonly id: ReadingId
  readonly label: string
  /** `target` has a distance to close; `guard` has a floor not to breach. */
  readonly kind: 'target' | 'guard'
  /** Where it is now. */
  readonly value: number
  /** Where it should be. */
  readonly objective: number
  /** Signed distance from the objective, in its own units. */
  readonly distance: number
  /** 0 at the objective, 1 at `scale` away. Drives the gauge. */
  readonly fill: number
  /** How far from the objective counts as a full gauge. */
  readonly scale: number
  readonly unit: string
  readonly decimals: number
  /** Primary, secondary, or the thing you are not allowed to break. */
  readonly rank: 'primary' | 'equal' | 'subordinate' | 'guard'
  /** What this reading means, in the real economy. Never a definition. */
  readonly meaning: string
}

export interface MandateBoard {
  readonly readings: readonly MandateReading[]
  /** One line naming what the mandate actually is, for this institution. */
  readonly statement: string
  /** True when every target is inside its tolerance and the guard holds. */
  readonly discharged: boolean
}

/** Inside this much of the objective, a target counts as met. */
const TOLERANCE = { inflation: 0.5, unemployment: 0.5 } as const

/** Growth below this is the thing the player must not do. */
const GROWTH_FLOOR = -0.5

export function readMandate(latent: LatentState, config: RunConfig): MandateBoard {
  const target = inflationTargetFor(config)
  const jobsGap = unemploymentGap(latent)
  const ecb = config.institution === 'ecb'

  const inflation: MandateReading = {
    id: 'inflation',
    label: 'Inflation',
    kind: 'target',
    value: latent.inflationHeadline,
    objective: target,
    distance: latent.inflationHeadline - target,
    scale: 6,
    fill: Math.min(1, Math.abs(latent.inflationHeadline - target) / 6),
    unit: '%',
    decimals: 1,
    rank: ecb ? 'primary' : 'equal',
    meaning:
      'What a week of shopping costs against a year ago. Above the objective ' +
      'for long enough and people stop believing it will come back.',
  }

  const unemployment: MandateReading = {
    id: 'unemployment',
    label: 'Unemployment',
    kind: 'target',
    value: latent.unemployment,
    objective: latent.naturalUnemployment,
    distance: jobsGap,
    scale: 5,
    fill: Math.min(1, Math.abs(jobsGap) / 5),
    unit: '%',
    decimals: 1,
    rank: ecb ? 'subordinate' : 'equal',
    meaning: ecb
      ? 'People who want work and cannot find it. The Treaty puts this after ' +
        'price stability — pursued without prejudice to it, never instead.'
      : 'People who want work and cannot find it. Half the mandate, and the ' +
        'half with a face.',
  }

  const growth: MandateReading = {
    id: 'growth',
    label: 'Growth',
    kind: 'guard',
    value: latent.realGrowth,
    objective: GROWTH_FLOOR,
    distance: latent.realGrowth - GROWTH_FLOOR,
    scale: 4,
    fill: Math.min(1, Math.max(0, GROWTH_FLOOR - latent.realGrowth) / 4),
    unit: '%',
    decimals: 1,
    rank: 'guard',
    meaning:
      'Not a target — the cost of reaching the other two. Breaking the ' +
      'economy to hit the objective is losing, not winning.',
  }

  const statement = ecb
    ? 'Price stability first. Employment without prejudice to it. Do not break the economy.'
    : 'Inflation to target and people in work, equally. Do not break the economy getting there.'

  const discharged =
    Math.abs(inflation.distance) <= TOLERANCE.inflation &&
    Math.abs(unemployment.distance) <= TOLERANCE.unemployment &&
    growth.value > GROWTH_FLOOR

  return {
    readings: ecb
      ? [inflation, unemployment, growth]
      : [inflation, unemployment, growth],
    statement,
    discharged,
  }
}

/** Shorthand used by `institution` label strings. */
export { GROWTH_FLOOR, TOLERANCE }
