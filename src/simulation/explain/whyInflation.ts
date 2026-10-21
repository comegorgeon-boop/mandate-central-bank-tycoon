import type { RunConfig } from '../types/core.ts'
import type { LatentState } from '../types/state.ts'
import { HEADLINE, PHILLIPS } from '../config/model.ts'
import { getInstitution } from '../config/institutions.ts'
import { inflationTargetFor, scenarioOf } from '../scenarios/scenarios.ts'

/**
 * Why is inflation where it is?
 *
 * ## The complaint this answers
 *
 * > "J'ai eu un vrai problème d'inflation que j'ai mis longtemps à régler
 * > SANS JAMAIS SAVOIR POURQUOI elle montait, avec des tonnes de chiffres
 * > auxquels je ne comprends rien. […] Le plus absurde : ton moteur SAIT
 * > pourquoi l'inflation monte. Tu calcules la raison et tu ne m'affiches que
 * > le résultat."
 *
 * Exactly so, and the word *absurde* is fair. The decomposition below is not
 * an estimate and not a narrative: it is the engine's own Phillips and
 * headline equations read back term by term. Every coefficient here is
 * imported from the same `config/model.ts` block that `dynamics.ts` uses to
 * move the economy, so the bar the player sees adds up to the number the
 * player is looking at — because it *is* that number, taken apart.
 *
 * The headline equation, from `dynamics.ts` §6 and §7:
 *
 *     core_target     = π^e + slope · gap + wagePressure · ULC + supply
 *     headline_target = core + passThrough · importπ + amplifier · supply
 *
 * So headline inflation stands on five legs, and the player can act on
 * exactly one and a half of them. That asymmetry is the lesson the game is
 * about, and showing the legs is the only way it is ever visible.
 */

export type InflationCauseId =
  | 'energy'
  | 'demand'
  | 'wages'
  | 'expectations'
  | 'currency'

export interface InflationCause {
  readonly id: InflationCauseId
  /** Two words, because this is a bar label and not a paragraph. */
  readonly label: string
  /** Percentage points of inflation this leg accounts for. Signed. */
  readonly points: number
  /** Share of the *total absolute* decomposition, 0..1. For the bar. */
  readonly share: number
  /** What it means in the real economy — one sentence, concrete. */
  readonly meaning: string
  /** Whether the policy rate can do anything about it. */
  readonly answersToRates: 'yes' | 'partly' | 'no'
}

export interface InflationExplanation {
  readonly headline: number
  readonly target: number
  readonly gap: number
  /** Ordered largest first. */
  readonly causes: readonly InflationCause[]
  /** The single biggest leg, which is what the order line names. */
  readonly leading: InflationCause | null
  /** How much of the miss the rate can actually reach. */
  readonly reachable: number
}

/**
 * The five legs, in the engine's own terms.
 *
 * `supply` appears twice in the real equation — once inside core and once
 * amplified in headline — so it is gathered into one leg here. Splitting it
 * would be arithmetically faithful and would tell the player that energy is
 * two different things, which it is not.
 */
export function explainInflation(
  latent: LatentState,
  config: RunConfig,
): InflationExplanation {
  const institution = getInstitution(config.institution)
  // The same slope `advanceTrueState` hands to the Phillips curve: the
  // scenario's own, or the model default. Read here rather than copied,
  // because a decomposition that used a different coefficient from the one
  // that moved the economy would be a plausible lie.
  const slope = scenarioOf(config)?.phillipsGapSlope ?? PHILLIPS.gapSlope
  const target = inflationTargetFor(config)

  const unitLabourCost = latent.wageGrowth - latent.potentialGrowth - latent.inflationCore

  const energy = latent.supplyShock * (1 + HEADLINE.supplyAmplifier)
  const demand = slope * latent.outputGap
  const wages = PHILLIPS.wagePressure * unitLabourCost
  const currency = institution.importPassThrough * latent.importPriceInflation
  // Expectations are the base the rest is measured from, and the part of it
  // that is *not* the objective is the part worth naming: an anchor sitting
  // on the target is not a cause of anything.
  const expectations = latent.expectedInflationShort - target

  const raw: readonly {
    id: InflationCauseId
    label: string
    points: number
    meaning: string
    answersToRates: InflationCause['answersToRates']
  }[] = [
    {
      id: 'energy',
      label: 'energy and supply',
      points: energy,
      meaning:
        'Things cost more to make and ship. The rate cannot make a barrel of ' +
        'oil cheaper — raising it only shrinks demand until the price is met ' +
        'by a smaller economy.',
      answersToRates: 'no',
    },
    {
      id: 'demand',
      label: 'demand',
      points: demand,
      meaning:
        'The economy is running past what it can produce: factories full, ' +
        'firms hiring people they would not normally hire, and it ends in ' +
        'prices. This is the leg the rate is actually for.',
      answersToRates: 'yes',
    },
    {
      id: 'wages',
      label: 'wages',
      points: wages,
      meaning:
        'Pay is rising faster than output per worker, so each unit of what is ' +
        'made costs more before anything else happens to it.',
      answersToRates: 'partly',
    },
    {
      id: 'expectations',
      label: 'expectations',
      points: expectations,
      meaning:
        'What people already assume inflation will be, which they write into ' +
        'next year’s prices and pay deals. Once this moves, inflation ' +
        'makes itself and the rate has to break the belief rather than the ' +
        'economy.',
      answersToRates: 'partly',
    },
    {
      id: 'currency',
      label: 'the currency',
      points: currency,
      meaning:
        'What is bought from abroad, priced in a currency that has moved. It ' +
        'arrives in the shops a quarter or two after the exchange rate does.',
      answersToRates: 'partly',
    },
  ]

  const scale = raw.reduce((sum, leg) => sum + Math.abs(leg.points), 0)
  const causes = raw
    .map((leg) => ({
      ...leg,
      share: scale === 0 ? 0 : Math.abs(leg.points) / scale,
    }))
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))

  // What the rate can reach: the demand leg in full, the two partial legs at
  // half. Not a model quantity — a reading of the model, and it exists so the
  // order line can say "two points of this, the rate cannot touch".
  const reachable = causes.reduce(
    (sum, leg) =>
      sum +
      leg.points *
        (leg.answersToRates === 'yes' ? 1 : leg.answersToRates === 'partly' ? 0.5 : 0),
    0,
  )

  return {
    headline: latent.inflationHeadline,
    target,
    gap: latent.inflationHeadline - target,
    causes,
    leading: causes[0] ?? null,
    reachable,
  }
}
