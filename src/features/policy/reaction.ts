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

/** One member's sovereign spread, on the day. */
export interface SpreadMove {
  readonly id: string
  readonly name: string
  readonly before: number
  readonly after: number
  readonly change: number
}

export interface DecisionReaction {
  readonly items: readonly ReactionItem[]
  /**
   * Sovereign spreads by member, where the institution has members.
   *
   * The euro area's most immediate channel and the one with a face on it: a
   * rate decision reprices six sovereigns differently within the hour, and the
   * member carrying the heaviest debt moves several times as far as the one
   * carrying the least. Nothing else on this screen makes the currency area's
   * problem that visible that fast.
   */
  readonly spreads: readonly SpreadMove[]
  /** True when nothing in the fast channel registered the decision at all. */
  readonly quiet: boolean
  /** True when institutional credibility itself moved on the day. */
  readonly standingMoved: boolean
}

/**
 * Series that can respond within the day: prices, and what words touch.
 *
 * The three at the end were missing, and they are the ones a player watches. A
 * decision that repriced the curve, moved the currency and marked the equity
 * market down reported none of it — the panel listed the priced path and some
 * expectations, which is the transmission mechanism rather than the news. The
 * whole point of this screen is that markets answer *now*, while inflation and
 * unemployment take quarters, so the answer has to include the prices people
 * actually look at.
 */
const SAME_DAY: readonly SeriesId[] = [
  'policy_rate',
  'market_expected_rate',
  'inflation_expectations_1y',
  'long_rate',
  'equity_index',
  'exchange_rate',
  'credit_spread',
  'market_volatility',
  'credibility_index',
]

const DECIMALS: Partial<Record<SeriesId, number>> = {
  market_volatility: 1,
  credibility_index: 0,
  equity_index: 0,
  exchange_rate: 1,
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
    case 'long_rate':
      return Math.abs(change) < 0.01
        ? 'The ten-year did not move: the long end had already priced this.'
        : `The ten-year moved ${Math.abs(Math.round(change * 100))} bp ` +
          `${change > 0 ? 'higher' : 'lower'}. This is what mortgages and ` +
          'corporate investment are actually priced off, so it reaches the ' +
          'real economy ahead of the policy rate itself.'
    case 'equity_index':
      if (Math.abs(change) < 1) return 'Equities were unmoved.'
      return (
        `Equities ${change > 0 ? 'rose' : 'fell'} ${Math.abs(change).toFixed(0)} points ` +
        'on the announcement. A market marking down the future it had been ' +
        'pricing is information, not a verdict on the decision.'
      )
    case 'exchange_rate':
      if (Math.abs(change) < 0.1) return 'The currency held.'
      return (
        `The currency ${change > 0 ? 'strengthened' : 'weakened'} ` +
        `${Math.abs(change).toFixed(1)} index points. A stronger currency means ` +
        'cheaper imports and lower inflation ahead — and a harder time for ' +
        'exporters.'
      )
    case 'credit_spread':
      if (Math.abs(change) < 0.02) return 'Corporate borrowing costs were unchanged.'
      return (
        `Corporate spreads ${change > 0 ? 'widened' : 'narrowed'} ` +
        `${Math.abs(change).toFixed(2)} pp. This is financial conditions moving ` +
        'without any decision being taken about them.'
      )
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

  const spreads: SpreadMove[] = []
  if (before.area !== null && onTheDay.area !== null) {
    const was = new Map(before.area.members.map((member) => [member.id, member.spread]))
    for (const member of onTheDay.area.members) {
      const previous = was.get(member.id)
      if (previous === undefined) continue
      const change = member.spread - previous
      if (change === 0) continue
      spreads.push({
        id: member.id,
        name: member.name,
        before: previous,
        after: member.spread,
        change,
      })
      moved = true
    }
    // Widest move first: the story is which member the decision hit hardest,
    // not the alphabet.
    spreads.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
  }

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

  return { items, spreads, quiet: !moved, standingMoved }
}
