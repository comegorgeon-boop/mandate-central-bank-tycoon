import type { ObservationSet, SeriesId } from '../../../simulation/index.ts'
import { getSeries } from '../../../simulation/index.ts'
import { Sparkline } from '../../../components/Sparkline.tsx'

/**
 * The markets.
 *
 * Its own panel rather than rows among the statistics, because these are a
 * different *kind* of number and the difference is the most useful thing a
 * player can learn about this game. Every series here is a price: observed
 * exactly, published with no lag, never revised. Everything on the Prices and
 * Labor panels is a statistic: late, noisy and corrected afterwards.
 *
 * So this is where a decision shows up first — the fast channel the engine has
 * always had and the interface never gave a home. It is also the panel that
 * moves during the interval between meetings, which is the one place the
 * player can watch a crisis arrive rather than read about it afterwards.
 */

const MARKET_SERIES: readonly SeriesId[] = [
  'equity_index',
  'long_rate',
  'market_expected_rate',
  'credit_spread',
  'exchange_rate',
  'market_volatility',
]

/**
 * Which direction is good news, per series.
 *
 * Not cosmetic. A falling equity index and a falling credit spread are
 * opposite pieces of news and colouring both by their sign would teach the
 * player the wrong reflex — spreads *narrowing* is the market saying it has
 * stopped worrying.
 */
const RISE_IS_GOOD: Readonly<Partial<Record<SeriesId, boolean>>> = {
  equity_index: true,
  credit_spread: false,
  market_volatility: false,
  // The rest are neither: a higher long rate or a stronger currency is good or
  // bad entirely according to what the committee is trying to do.
}

function formatChange(value: number, previous: number, decimals: number): string {
  const change = value - previous
  if (Math.abs(change) < 10 ** -decimals / 2) return 'unchanged'
  return `${change > 0 ? '+' : '−'}${Math.abs(change).toFixed(decimals)}`
}

export function MarketsPanel({
  observation,
  previousObservation,
}: {
  readonly observation: ObservationSet
  readonly previousObservation: ObservationSet | null
}) {
  const rows = MARKET_SERIES.map((id) => observation.indicators[id]).filter(
    (row) => row !== undefined,
  )

  return (
    <section aria-labelledby="markets-heading">
      <h2
        id="markets-heading"
        className="font-display text-2xl font-semibold text-ink"
      >
        Markets
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Prices, not statistics. Every number here is observed exactly and moves
        the moment anything changes — which makes this the first place a decision
        shows up, and the first place a crisis does.
      </p>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => {
          const decimals = getSeries(row.seriesId)?.decimals ?? 2
          const previous =
            previousObservation?.indicators[row.seriesId]?.value ?? row.previous
          const change =
            row.value !== null && previous !== null
              ? row.value - previous
              : null
          const riseIsGood = RISE_IS_GOOD[row.seriesId]
          // One verdict, used for the figure and for the line, so a falling
          // index is never drawn in the colour of good news.
          const verdict: 'neutral' | 'good' | 'bad' =
            change === null || riseIsGood === undefined || Math.abs(change) < 1e-9
              ? 'neutral'
              : change > 0 === riseIsGood
                ? 'good'
                : 'bad'
          const tone =
            verdict === 'neutral'
              ? 'text-ink-soft'
              : verdict === 'good'
                ? 'text-good'
                : 'text-bad'

          return (
            <li
              key={row.seriesId}
              className="rounded-lg border border-edge bg-sunk p-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                  {row.label}
                </span>
                {change !== null && (
                  <span className={`text-xs tabular-nums ${tone}`}>
                    {formatChange(row.value ?? 0, previous ?? 0, decimals)}
                  </span>
                )}
              </div>

              <div className="mt-1 flex items-end justify-between gap-3">
                <span className="font-mono text-2xl tabular-nums text-ink">
                  {row.value === null ? '—' : row.value.toFixed(decimals)}
                  <span className="ml-1 text-xs font-sans text-ink-faint">
                    {row.unit}
                  </span>
                </span>
                <Sparkline
                  values={row.trend}
                  label={row.label}
                  decimals={decimals}
                  tone={verdict}
                />
              </div>

              <p className="mt-2 text-2xs leading-snug text-ink-faint">
                {row.definition}
              </p>
            </li>
          )
        })}
      </ul>

      <p className="mt-4 text-2xs text-ink-faint">
        All instruments and indices here are fictional. The equity index is not a
        real index and does not track one.
      </p>
    </section>
  )
}
