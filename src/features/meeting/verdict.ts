import {
  inflationTargetFor,
  sustainableRateFor,
  type ObservationSet,
  type RunConfig,
} from '../../simulation/index.ts'

/**
 * Did this meeting go well or badly, in one bit, readable without words.
 *
 * > "Sur un téléphone en silencieux, je dois pouvoir dire si la réunion s'est
 * > bien ou mal passée SANS LIRE UN MOT, rien qu'au mouvement et à la couleur."
 *
 * The wager already carried colour, but only when a wager had been placed —
 * so a player who declined one had no verdict at all, and the criterion is
 * about the meeting rather than the bet. This is the meeting's own.
 *
 * ## What it judges
 *
 * The two numbers the mandate is scored on: the distance from the inflation
 * objective and the distance from the sustainable rate of unemployment. If
 * both moved the right way, the meeting went well; if both went wrong, badly;
 * anything else is **mixed and gets no colour at all**, which is the point.
 *
 * ## Why mixed is colourless
 *
 * > "Ce qui fait qu'une couleur frappe, c'est sa rareté."
 *
 * Most meetings are mixed — that is what a dual mandate *is* — so a verdict
 * that coloured every meeting would be the wallpaper this whole pass exists
 * to remove. The colour is for the meetings that were unambiguous, and it is
 * worth something because it is not always there.
 *
 * Read from the published observations only, like everything else the player
 * is shown.
 */

export type MeetingVerdict = 'better' | 'worse' | 'mixed'

function value(observation: ObservationSet, id: 'headline_inflation' | 'unemployment'): number | null {
  return observation.indicators[id]?.value ?? null
}

/** How far a reading sits from where it should be, unsigned. */
function miss(reading: number | null, objective: number): number | null {
  return reading === null ? null : Math.abs(reading - objective)
}

/** Points of movement below which nothing happened worth colouring. */
const NOISE = 0.05

export function meetingVerdict(
  before: ObservationSet,
  after: ObservationSet,
  config: RunConfig,
): MeetingVerdict {
  const target = inflationTargetFor(config)
  const sustainable = sustainableRateFor(config)

  const priceBefore = miss(value(before, 'headline_inflation'), target)
  const priceAfter = miss(value(after, 'headline_inflation'), target)
  const jobsBefore = miss(value(before, 'unemployment'), sustainable)
  const jobsAfter = miss(value(after, 'unemployment'), sustainable)

  const moves: number[] = []
  if (priceBefore !== null && priceAfter !== null) moves.push(priceBefore - priceAfter)
  if (jobsBefore !== null && jobsAfter !== null) moves.push(jobsBefore - jobsAfter)

  // Nothing published to compare is not a bad meeting. It is no verdict.
  const real = moves.filter((move) => Math.abs(move) > NOISE)
  if (real.length === 0) return 'mixed'

  if (real.every((move) => move > 0)) return 'better'
  if (real.every((move) => move < 0)) return 'worse'
  return 'mixed'
}
