import type { ObservationSet, SeriesId } from '../../simulation/index.ts'

/**
 * What moved the moment the decision was confirmed.
 *
 * The economy runs at two speeds, and the slow one is the reason the last
 * playthrough felt inert: inflation and unemployment take quarters to respond,
 * so a decision looks like it did nothing. The fast channel responds the same
 * day — and until now none of it reached the screen.
 *
 * This differences the observation taken an instant after the decision against
 * the one on the table before it, so nothing that happened during the
 * intervening quarter is mixed in. Everything here is therefore attributable
 * to the decision itself — the measurement noise on surveyed series is drawn
 * per reference period, so it cancels exactly in the difference.
 *
 * With communication in the package, the same-day channel is now several
 * variables wide: the priced path answers the announced one, the statement's
 * tone nudges year-ahead expectations, and credibility moves the day a
 * promise is made good or broken. A rate-only remark still moves little,
 * which is itself the lesson.
 */

export interface ReactionItem {
  readonly id: string
  readonly label: string
  readonly before: string
  readonly after: string
  readonly note: string
}

export interface DecisionReaction {
  readonly items: readonly ReactionItem[]
  /** True when nothing in the fast channel registered the decision at all. */
  readonly quiet: boolean
  /** True when institutional credibility itself moved on the day. */
  readonly standingMoved: boolean
}

/** Series that can respond within the day: prices, and what words touch. */
const SAME_DAY: readonly SeriesId[] = [
  'policy_rate',
  'market_expected_rate',
  'inflation_expectations_1y',
  'market_volatility',
  'credibility_index',
]

const DECIMALS: Partial<Record<SeriesId, number>> = {
  market_volatility: 1,
  credibility_index: 0,
}

function reading(observation: ObservationSet, id: SeriesId): number | null {
  return observation.indicators[id]?.value ?? null
}

function noteFor(id: SeriesId, change: number, priced: number | null): string {
  switch (id) {
    case 'policy_rate':
      return change === 0
        ? 'You held. The stance still moves with expectations underneath it.'
        : 'The decision itself, in force from today.'
    case 'market_expected_rate':
      return Math.abs(change) < 0.01
        ? 'Markets did not reprice the path ahead: the decision told them nothing new.'
        : `Markets repriced the year ahead by ${Math.abs(Math.round(change * 100))} bp ` +
          `${change > 0 ? 'higher' : 'lower'} on the strength of the decision.`
    case 'inflation_expectations_1y':
      if (Math.abs(change) < 0.01) {
        return 'Year-ahead expectations did not react to the statement today.'
      }
      return (
        `The statement moved what people expect prices to do: ` +
        `${Math.abs(change).toFixed(2)} pp ${change > 0 ? 'higher' : 'lower'} within the day. ` +
        'This is the channel that works ahead of the rate itself.'
      )
    case 'credibility_index':
      if (change <= -0.5) {
        return (
          'Your word lost value today: a published promise was broken or walked ' +
          'back, and every future statement will be discounted for it.'
        )
      }
      if (change >= 0.5) {
        return 'A promise came due and was delivered. Your word is worth more.'
      }
      return ''
    case 'market_volatility':
      if (change > 0.5) {
        return (
          'Volatility rose: the decision departed from what was priced. Surprise is ' +
          'not automatically an error, but it costs market trust and it is spent, ' +
          'not stored.' +
          (priced === null
            ? ''
            : ` Markets had ${Math.abs(Math.round(priced * 100))} bp priced.`)
        )
      }
      if (change < -0.5) {
        return 'Volatility fell: the decision resolved an uncertainty markets were carrying.'
      }
      return 'Volatility barely moved. The decision was broadly what markets expected.'
    default:
      return ''
  }
}

export function buildReaction(
  before: ObservationSet,
  onTheDay: ObservationSet,
): DecisionReaction {
  const items: ReactionItem[] = []
  let moved = false
  let standingMoved = false

  const pricedPath = (() => {
    const market = reading(before, 'market_expected_rate')
    const rate = reading(before, 'policy_rate')
    return market === null || rate === null ? null : market - rate
  })()

  for (const id of SAME_DAY) {
    const indicator = onTheDay.indicators[id]
    if (indicator === undefined) continue

    const now = reading(onTheDay, id)
    const then = reading(before, id)
    if (now === null || then === null) continue

    const decimals = DECIMALS[id] ?? 2
    const change = now - then
    const registered = Math.abs(change) >= 10 ** -decimals / 2
    if (registered) moved = true

    // Standing is worth a line only on the days it actually moves; a
    // permanent "63 → 63" row would bury the one meeting where it matters.
    if (id === 'credibility_index') {
      if (!registered) continue
      standingMoved = true
    }

    items.push({
      id,
      label: indicator.label,
      before: `${then.toFixed(decimals)} ${indicator.unit}`,
      after: `${now.toFixed(decimals)} ${indicator.unit}`,
      note: noteFor(id, change, pricedPath),
    })
  }

  return { items, quiet: !moved, standingMoved }
}
