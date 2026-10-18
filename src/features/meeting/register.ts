import {
  getDifficulty,
  getSeries,
  type Difficulty,
  type IndicatorObservation,
} from '../../simulation/index.ts'

/**
 * The register each difficulty publishes its numbers in.
 *
 * Difficulty is not only what the player is told, it is the *language* they
 * are told it in. The learning mandate leads with a sentence and puts the
 * figure underneath as a footnote, because a player who cannot yet read a
 * two-decimal print against an error bar is being handed noise. The real job
 * leads with the figure and the technical name, because that is what the
 * numbers look like on a governing council's table and reading them is the
 * skill.
 *
 * All copy here is assembled from fixed templates, from the published
 * observation only. No model, no remote call, no randomness — the same
 * observation always produces the same sentence.
 */

export type Register =
  /** Easy: the sentence is the headline and the figure is the note. */
  | 'plain'
  /** Medium: the figure is the headline, with a short plain-language label. */
  | 'brief'
  /** Hard: the figure and the technical name, and nothing read for you. */
  | 'technical'

export function registerFor(difficulty: Difficulty): Register {
  const config = getDifficulty(difficulty)
  if (config.namesShocks) return 'plain'
  return config.showsShockEvidence ? 'brief' : 'technical'
}

/**
 * How far a reading has to sit from its reference before the sentence is
 * allowed to call the distance anything, in multiples of the error bar the
 * player is shown.
 *
 * Stated in units of the published uncertainty rather than in percentage
 * points, for the same reason every effect-size claim in this codebase is: a
 * plain-language headline that says "clearly above the objective" about a gap
 * smaller than the print's own measurement error is not plain language, it is
 * a confident lie. docs/BALANCE.md records what that mistake cost when it was
 * made in a test assertion; making it in copy the player steers by would be
 * worse.
 */
const CLEAR_MULTIPLE = 3
const SLIGHT_MULTIPLE = 1

/**
 * The error bar to judge a distance against.
 *
 * `uncertainty` is what the panel prints beside the number, so it is the right
 * scale — but it is zero for exact market prices, where any visible move is
 * real. The floor keeps a sentence from calling a rounding difference "far
 * above" on those series.
 */
function scaleOf(observation: IndicatorObservation): number {
  const decimals = getSeries(observation.seriesId)?.decimals ?? 2
  return Math.max(observation.uncertainty, 10 ** -decimals)
}

function distanceWord(distance: number, scale: number): string | null {
  if (distance >= CLEAR_MULTIPLE * scale) return 'well'
  if (distance >= SLIGHT_MULTIPLE * scale) return 'clearly'
  return null
}

/**
 * The plain-language headline for one indicator: what it is doing, in a
 * sentence, with no figure in it.
 *
 * Reads a reference where the panel supplies one — the inflation objective,
 * say — and otherwise falls back to the direction of travel since the last
 * meeting, which is the only other statement that can be made about an
 * arbitrary series without inventing per-series content.
 */
export function plainHeadline(
  observation: IndicatorObservation,
  reference: number | null,
  referenceLabel: string,
): string {
  if (observation.missing || observation.value === null) {
    return `${observation.label} did not arrive in time for this meeting.`
  }

  const scale = scaleOf(observation)

  if (reference !== null) {
    const gap = observation.value - reference
    const word = distanceWord(Math.abs(gap), scale)
    if (word === null) {
      return `${observation.label} is close to the ${referenceLabel}.`
    }
    return `${observation.label} is ${word} ${gap > 0 ? 'above' : 'below'} the ${referenceLabel}.`
  }

  if (observation.previous === null) {
    return `${observation.label} is on the table for the first time this mandate.`
  }

  const change = observation.value - observation.previous
  const word = distanceWord(Math.abs(change), scale)
  if (word === null) {
    return `${observation.label} is little changed since the last meeting.`
  }
  return `${observation.label} has ${change > 0 ? 'risen' : 'fallen'} ${word} since the last meeting.`
}
