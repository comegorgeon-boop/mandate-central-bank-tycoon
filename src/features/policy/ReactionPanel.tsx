import { useMemo } from 'react'
import type { ObservationSet } from '../../simulation/index.ts'
import { buildReaction } from './reaction.ts'

/**
 * The same-day reaction to a confirmed decision.
 *
 * Shown once, immediately after confirming, before the meeting advances. Its
 * only job is to answer "did anything happen?" with a yes — because the engine
 * does react on the day, in the priced path and in volatility, and none of it
 * was reaching the screen.
 */
export function ReactionPanel({
  before,
  onTheDay,
  newswire,
  onContinue,
}: {
  readonly before: ObservationSet
  readonly onTheDay: ObservationSet
  readonly newswire: readonly string[]
  readonly onContinue: () => void
}) {
  const reaction = useMemo(() => buildReaction(before, onTheDay), [before, onTheDay])

  return (
    <section aria-labelledby="reaction-heading">
      <h2 id="reaction-heading" className="text-lg font-semibold text-ink">
        The decision lands
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        What moved the moment the decision was announced, before any time passed.
        Inflation and unemployment cannot answer yet — they take quarters. These can.
      </p>

      <ul className="mt-4 divide-y divide-edge border-y border-edge">
        {reaction.items.map((item) => (
          <li key={item.id} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span className="font-medium text-ink">{item.label}</span>
              <span className="tabular-nums text-ink-soft">
                <span className="text-ink-faint">{item.before}</span>
                <span aria-hidden="true" className="mx-2 text-ink-faint">
                  →
                </span>
                <span className="text-ink">{item.after}</span>
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-soft">{item.note}</p>
          </li>
        ))}
      </ul>

      {reaction.quiet && (
        <p className="mt-3 text-sm text-ink-soft">
          Nothing moved. Markets had this decision fully priced, which is its own
          result: a committee that surprises nobody spends no credibility, and one
          that never surprises anybody is only ever ratifying what markets decided.
        </p>
      )}

      {newswire.length > 0 && (
        <div className="mt-5 border-t border-edge pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Between your decision and this meeting
          </h3>
          <ul className="mt-2 space-y-1">
            {newswire.map((headline) => (
              <li key={headline} className="text-sm text-ink-soft">
                {headline}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-faint">
            These happened in the weeks after the decision, not because of it.
          </p>
        </div>
      )}

      {!reaction.standingMoved && (
        <p className="mt-4 text-xs text-ink-faint">
          Your standing did not move today. Credibility moves the day a published
          promise is delivered or broken; a package with nothing on the record
          leaves it untouched until its consequences arrive.
        </p>
      )}

      <button
        type="button"
        onClick={onContinue}
        className="mt-5 rounded-md border border-edge-accent bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-panel transition-colors hover:bg-accent-onwood"
      >
        Continue to the next meeting
      </button>
    </section>
  )
}
