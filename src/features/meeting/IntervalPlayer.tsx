import { useEffect, useRef, useState } from 'react'
import {
  calendarLabel,
  getSeries,
  type IntervalDispatch,
  type IntervalFrame,
  type SeriesId,
} from '../../simulation/index.ts'
import { Sparkline } from '../../components/Sparkline.tsx'

/**
 * The quarter passing.
 *
 * The player confirms a decision and, instead of cutting to the next meeting,
 * watches the interval elapse: the date advances, the market prices move, and
 * the dispatches arrive at the moment the consequence actually landed.
 *
 * Every number on screen is one the engine computed. The frames come from
 * `advanceTrueStateTraced` — the states the integrator genuinely passed
 * through — and carry only the exactly-observed market prices, because those
 * are the only series a player could really watch move in real time. The
 * inflation print is not here, and its absence is the point: markets move
 * while you watch, statistics arrive late. A player who has seen that once
 * understands the lag this whole game is built on better than any panel of
 * text could explain it.
 *
 * It is skippable by Enter, Space, Escape or a click, and can be switched off
 * entirely; a
 * reader who has asked their system for reduced motion never sees it at all.
 * See `features/settings/settings.ts`.
 */

/** How long the whole interval takes, in milliseconds. */
const DURATION_MS = 3600

/** Series shown as a moving figure, in the order they matter. */
const WATCHED: readonly SeriesId[] = [
  'equity_index',
  'long_rate',
  'market_expected_rate',
  'credit_spread',
]

/** Which way is good news, for the colour. Matches the Markets panel. */
const RISE_IS_GOOD: Readonly<Partial<Record<SeriesId, boolean>>> = {
  equity_index: true,
  credit_spread: false,
}

function Reading({
  seriesId,
  frames,
  upto,
}: {
  readonly seriesId: SeriesId
  readonly frames: readonly IntervalFrame[]
  readonly upto: number
}) {
  const series = getSeries(seriesId)
  const decimals = series?.decimals ?? 2
  const shown = frames.slice(0, upto + 1)
  const values = shown.map((frame) => frame.markets[seriesId] ?? null)
  const first = frames[0]?.markets[seriesId] ?? null
  const latest = values[values.length - 1] ?? null
  const change = first !== null && latest !== null ? latest - first : null
  const riseIsGood = RISE_IS_GOOD[seriesId]

  const verdict: 'neutral' | 'good' | 'bad' =
    change === null || riseIsGood === undefined || Math.abs(change) < 10 ** -decimals / 2
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
    <div className="rounded-lg border border-edge bg-sunk p-3">
      <p className="text-2xs uppercase tracking-wide text-ink-soft">
        {series?.label ?? seriesId}
      </p>
      <p className="mt-1 flex items-end justify-between gap-2">
        <span className="font-mono text-xl tabular-nums text-ink">
          {latest === null ? '—' : latest.toFixed(decimals)}
        </span>
        <Sparkline
          values={values}
          label={series?.label}
          decimals={decimals}
          tone={verdict}
          width={64}
          height={20}
        />
      </p>
      {change !== null && (
        <p className={`mt-0.5 text-xs tabular-nums ${tone}`}>
          {change > 0 ? '+' : '−'}
          {Math.abs(change).toFixed(decimals)} over the interval
        </p>
      )}
    </div>
  )
}

export function IntervalPlayer({
  frames,
  onDone,
}: {
  readonly frames: readonly IntervalFrame[]
  readonly onDone: () => void
}) {
  const [index, setIndex] = useState(0)
  // Held in a ref so the effect below does not restart on every tick.
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const skipRef = useRef<HTMLButtonElement>(null)

  // The interval takes over the screen, so it takes the caret with it: a
  // keyboard user should land on the one control here rather than at the top
  // of a document whose contents have just been replaced.
  useEffect(() => {
    skipRef.current?.focus()
  }, [])

  useEffect(() => {
    if (frames.length === 0) {
      doneRef.current()
      return
    }

    const perFrame = DURATION_MS / frames.length
    const timer = globalThis.setInterval(() => {
      setIndex((current) => {
        if (current + 1 >= frames.length) {
          globalThis.clearInterval(timer)
          // A beat on the final frame before the meeting opens, so the last
          // dispatch is readable rather than a flash.
          globalThis.setTimeout(() => doneRef.current(), perFrame)
          return current
        }
        return current + 1
      })
    }, perFrame)

    return () => globalThis.clearInterval(timer)
  }, [frames])

  // A *deliberate* key skips — not any key.
  //
  // "Any key" sounds friendlier and is hostile: Tab is a key, so a keyboard
  // user dismissed the interval the instant they tried to navigate it, and
  // could never reach the skip button at all. Measured by tabbing through the
  // whole game, which is how this was caught. Enter, Space and Escape are the
  // three a player actually means, and everything else is left for reading.
  useEffect(() => {
    const skip = (event: KeyboardEvent): void => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
        // Space scrolls the page by default, which would fight the skip.
        event.preventDefault()
        doneRef.current()
      }
    }
    globalThis.addEventListener('keydown', skip)
    return () => globalThis.removeEventListener('keydown', skip)
  }, [])

  if (frames.length === 0) return null

  const arrived: IntervalDispatch[] = []
  for (const frame of frames.slice(0, index + 1)) arrived.push(...frame.dispatches)
  const frame = frames[index]
  const progress = frame.progress

  return (
    <section
      aria-labelledby="interval-heading"
      className="rounded-lg border border-edge bg-panel p-4 text-ink shadow-panel sm:p-5"
      // Clicking anywhere skips, which is what an impatient player will try
      // first. The button above is what a keyboard or screen-reader user needs:
      // "press any key" is a sentence, not a control.
      onClick={() => doneRef.current()}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-2xs uppercase tracking-[0.14em] text-ink-soft">
            The interval
          </p>
          <h2 id="interval-heading" className="mt-1 font-display text-2xl text-ink">
            {calendarLabel(frame.timeYears)}
          </h2>
        </div>
        <button
          ref={skipRef}
          type="button"
          onClick={() => doneRef.current()}
          className="rounded-md border border-edge px-3 py-1.5 text-xs font-medium text-ink hover:bg-sunk"
        >
          Skip to the meeting
        </button>
      </div>

      {/* The clock, as a rule that fills. Announced politely rather than
          assertively: a screen reader should not be interrupted four times in
          three seconds. */}
      <div
        className="mt-3 h-1 w-full overflow-hidden rounded-full bg-sunk"
        role="progressbar"
        aria-label="Interval elapsed"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* The bar glides where the figures step. Time is continuous and the
            model's output is not: prices update on the four sub-steps the
            engine actually computed, and interpolating *those* would be
            inventing readings. The clock is the one thing that may be smooth,
            because it really is. The duration reads `--motion-duration`, so a
            reader who asked for less motion gets a bar that simply arrives. */}
        <div
          className="h-full bg-accent"
          style={{
            width: `${progress * 100}%`,
            transition: `width calc(${DURATION_MS / frames.length}ms * var(--motion-duration, 1)) linear`,
          }}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {WATCHED.map((seriesId) => (
          <Reading key={seriesId} seriesId={seriesId} frames={frames} upto={index} />
        ))}
      </div>

      <div aria-live="polite" className="mt-4 space-y-2">
        {arrived.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Nothing on the wire so far this quarter.
          </p>
        ) : (
          arrived.map((dispatch, position) => (
            <div
              key={`${dispatch.eventId}-${position}`}
              className="rounded-md border-l-4 border-edge-accent bg-sunk p-3"
            >
              <p className="text-2xs uppercase tracking-wide text-accent-strong">
                Wire · {calendarLabel(frame.timeYears)}
              </p>
              <p className="mt-0.5 font-medium text-ink">{dispatch.title}</p>
            </div>
          ))
        )}
      </div>

      <p className="mt-4 text-2xs leading-relaxed text-ink-faint">
        Only prices move while you watch. Inflation, unemployment and the rest
        describe a period that is still being measured — they will be on the
        table at the meeting, and they will describe the quarter that has just
        gone by rather than this one.
      </p>
    </section>
  )
}
