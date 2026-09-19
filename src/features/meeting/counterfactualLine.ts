import {
  FROZEN_LABEL,
  type FrozenSet,
  type SeriesAttribution,
} from '../../simulation/index.ts'

/**
 * One line saying what your policy has actually done.
 *
 * The player's complaint, and it was the right one: nothing on screen showed
 * the effect of any instrument except the rate, and the one thing the game
 * said about the rate under a supply shock was that it did not work. This is
 * the answer, and it is exact rather than estimated — the engine is
 * deterministic, so the counterfactual is a second run of the real thing with
 * the same shocks and a different decision log. See
 * `simulation/counterfactual/counterfactual.ts`.
 *
 * **One line, and it replaces text rather than adding it.** The screen's
 * problem is that there is too much on it; an exact counterfactual printed
 * underneath three paragraphs of hedging would be one more thing not to read.
 * It takes the slot the "your decision" entry used to occupy.
 *
 * What it says is chosen by what actually moved. A mandate whose tightening is
 * holding inflation down gets the inflation line; one whose easing is holding
 * unemployment down gets that one; one whose policy has not yet reached
 * anything is told so plainly, because "it has not arrived yet" is a fact
 * about the lag and not a failure — and it is the single most useful thing a
 * player can know in the first four meetings.
 */

/** Below this, in the series' own units, nothing has arrived worth saying. */
const ARRIVED = 0.05

/** A lever has to carry this share of the total before it is worth naming. */
const DOMINANT_SHARE = 0.55

export interface CounterfactualLine {
  readonly headline: string
  readonly detail: string
  /** True when the policy has visibly done something. */
  readonly arrived: boolean
}

function signed(value: number, decimals: number): string {
  return `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(decimals)}`
}

/** The lever doing most of the work, where one clearly is. */
function dominantLever(
  attribution: SeriesAttribution,
): { readonly lever: FrozenSet; readonly share: number } | null {
  const entries = Object.entries(attribution.byLever) as [FrozenSet, number][]
  if (entries.length === 0 || Math.abs(attribution.total) < ARRIVED) return null

  // Only levers pushing the same way as the total. A lever pulling against it
  // is a real and interesting fact, but it is not "what is doing this".
  const sameWay = entries.filter(
    ([, value]) => value * attribution.total > 0,
  )
  if (sameWay.length === 0) return null

  const [lever, value] = sameWay.reduce((best, entry) =>
    Math.abs(entry[1]) > Math.abs(best[1]) ? entry : best,
  )
  const share = Math.abs(value) / Math.abs(attribution.total)
  return share >= DOMINANT_SHARE ? { lever, share } : null
}

export function counterfactualLine(
  attributions: readonly SeriesAttribution[],
  meetingIndex: number,
): CounterfactualLine | null {
  if (attributions.length === 0) return null

  // The series your policy has moved most, measured against its own published
  // precision so a tenth of a point of inflation outranks a tenth of a point
  // of an index that swings by ten.
  const ranked = [...attributions].sort(
    (a, b) =>
      Math.abs(b.total) * 10 ** b.decimals - Math.abs(a.total) * 10 ** a.decimals,
  )
  const lead = ranked[0]

  if (Math.abs(lead.total) < ARRIVED) {
    return {
      arrived: false,
      headline:
        meetingIndex < 3
          ? 'Nothing you have done has arrived yet'
          : 'Your policy is not moving the economy yet',
      detail:
        'Replayed without your decisions, this economy is where it already ' +
        'is. That is the lag, not a failure of the instrument: a rate change ' +
        'peaks quarters after it is made, and the meetings before it lands ' +
        'look exactly like this one.',
    }
  }

  const noun = lead.label.toLowerCase()
  const dominant = dominantLever(lead)
  const unit = lead.unit.startsWith('%') ? '%' : lead.unit
  const show = (value: number): string => `${value.toFixed(lead.decimals)} ${unit}`

  const headline =
    lead.total < 0
      ? `Without ${FROZEN_LABEL.everything}, ${noun} would be at ${show(lead.counterfactual)}`
      : `${noun[0].toUpperCase()}${noun.slice(1)} is ${signed(lead.total, lead.decimals)} higher than if you had done nothing`

  // The priced path leading means the decision has reached markets and nothing
  // else yet. That is not a weak result, it is the *shape* of monetary policy
  // — the one channel that answers on the day — and a player who is told so
  // at meeting two stops reading the first quiet quarters as failure.
  const fastChannelOnly = lead.seriesId === 'market_expected_rate'

  const detail =
    `It is at ${show(lead.actual)}. The difference of ` +
    `${signed(lead.total, lead.decimals)} is exactly what your decisions have ` +
    'delivered so far — the same shocks, replayed without them.' +
    (fastChannelOnly
      ? ' Markets are the only channel that has answered yet; inflation and ' +
        'unemployment take quarters, and this is what the wait looks like.'
      : dominant === null
        ? ' No single lever accounts for most of it; it is the package.'
        : ` Most of it is ${FROZEN_LABEL[dominant.lever]}: ${Math.round(dominant.share * 100)} % of the total.`)

  return { arrived: true, headline, detail }
}

/**
 * The same thing for a second series, where one is worth adding.
 *
 * Used only by the postmortem, which has the room. The meeting screen gets one
 * line and no more.
 */
export function counterfactualLines(
  attributions: readonly SeriesAttribution[],
): readonly string[] {
  return attributions
    .filter((entry) => Math.abs(entry.total) >= ARRIVED)
    .map(
      (entry) =>
        `${entry.label}: ${entry.actual.toFixed(entry.decimals)} against ` +
        `${entry.counterfactual.toFixed(entry.decimals)} without your policy, ` +
        `a difference of ${signed(entry.total, entry.decimals)}.`,
    )
}
