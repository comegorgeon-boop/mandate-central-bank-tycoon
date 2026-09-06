import type { RealisedEntry, RealisedLine } from './instrumentLedger.ts'
import { formatMagnitude } from './InstrumentStepper.tsx'
import { formatMeetings } from './lag.ts'

/**
 * What an instrument moved some meetings ago actually produced.
 *
 * The honest version of that question has two answers and they are different
 * numbers, so both are printed. The engine's counterfactual says what the
 * instrument contributed — the economy under that change, minus the same
 * economy without it. The published statistics say what the series did, which
 * is the contribution plus every shock, every other instrument and the whole
 * rest of the world over the same span.
 *
 * Conflating the two would be the more satisfying panel and a lie: it would
 * teach a player that their rate rise caused an oil shock's inflation, or that
 * their tightening failed because a supply shock happened to be larger. The
 * gap between the two columns is the lesson, and it is the lesson central
 * banking actually turns on.
 */

/** A change in a series, in whatever the series is measured in. */
function formatDelta(delta: number, unit: string, decimals: number): string {
  const sign = delta > 0 ? '+' : '−'
  const magnitude = Math.abs(delta)
  if (unit === 'bp') return `${sign}${magnitude.toFixed(0)} bp`
  if (unit === 'index') return `${sign}${magnitude.toFixed(decimals)} pts`
  if (unit === 'pp' || unit.startsWith('%')) {
    return `${sign}${magnitude.toFixed(decimals)} pp`
  }
  return `${sign}${magnitude.toFixed(decimals)}`
}

function Line({ line }: { readonly line: RealisedLine }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 py-1 text-sm sm:gap-x-5">
      <span className="text-ink-soft">{line.label}</span>
      <span className="tabular-nums text-ink">
        {formatDelta(line.projectedDelta, line.unit, line.decimals)}
      </span>
      <span className="tabular-nums text-ink">
        {line.actualDelta === null ? (
          <span className="text-ink-faint">not published</span>
        ) : (
          formatDelta(line.actualDelta, line.unit, line.decimals)
        )}
      </span>
    </div>
  )
}

export function RealisedEffectPanel({
  entries,
}: {
  readonly entries: readonly RealisedEntry[]
}) {
  if (entries.length === 0) return null

  // Whether the instrument was pulling with the tide or against it, which is
  // the sentence that turns two columns of numbers into a reading.
  const anyOpposed = entries.some((entry) =>
    entry.lines.some((line) => line.actualDelta !== null && !line.sameDirection),
  )

  return (
    <section
      aria-labelledby="realised-heading"
      className="mt-5 border-t border-edge pt-4"
    >
      <h3
        id="realised-heading"
        className="text-xs font-semibold uppercase tracking-wide text-ink-soft"
      >
        Your earlier decisions, now that their lags have run
      </h3>

      <div className="mt-3 space-y-4">
        {entries.map((entry) => (
          <div key={`${entry.decidedAtMeeting}-${entry.instrument}`}>
            <p className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span className="font-medium text-ink">
                {entry.label}
                <span className="ml-2 text-xs font-normal text-ink-faint">
                  set {formatMeetings(entry.meetingsElapsed)} ago
                </span>
              </span>
              <span className="tabular-nums text-sm text-ink-soft">
                {entry.unit === 'basis_points' && entry.instrument === 'policy_rate'
                  ? `${entry.from.toFixed(2)} % → ${entry.to.toFixed(2)} %`
                  : `${formatMagnitude(entry.from, entry.unit)} → ${formatMagnitude(entry.to, entry.unit)}`}
              </span>
            </p>
            <div className="mt-1.5 grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-edge pb-1 text-2xs uppercase tracking-[0.1em] text-ink-faint sm:gap-x-5">
              <span />
              <span className="text-right">It contributed</span>
              <span className="text-right">Series moved</span>
            </div>
            <div className="divide-y divide-edge">
              {entry.lines.map((line) => (
                <Line key={line.seriesId} line={line} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-ink-faint">
        The first column is what this instrument alone did, measured against the
        same economy with it left alone. The second is what the published series
        actually did — your instrument plus every shock and every other decision
        over the same span.
        {anyOpposed
          ? ' Where the two disagree, something larger was pushing the other way: the instrument still worked, it was outweighed.'
          : ' They point the same way here, which does not by itself prove the instrument caused it.'}
      </p>
    </section>
  )
}
