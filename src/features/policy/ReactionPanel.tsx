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
      <h2 id="reaction-heading" className="text-lg font-semibold text-neutral-50">
        The decision lands
      </h2>
      <p className="mt-1 text-sm text-neutral-400">
        What moved the moment the decision was announced, before any time passed.
        Inflation and unemployment cannot answer yet — they take quarters. These can.
      </p>

      <ul className="mt-4 divide-y divide-neutral-800 border-y border-neutral-800">
        {reaction.items.map((item) => (
          <li key={item.id} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span className="font-medium text-neutral-100">{item.label}</span>
              <span className="tabular-nums text-neutral-300">
                <span className="text-neutral-500">{item.before}</span>
                <span aria-hidden="true" className="mx-2 text-neutral-600">
                  →
                </span>
                <span className="text-neutral-50">{item.after}</span>
              </span>
            </div>
            <p className="mt-1 text-sm text-neutral-400">{item.note}</p>
          </li>
        ))}
      </ul>

      {reaction.quiet && (
        <p className="mt-3 text-sm text-neutral-300">
          Nothing moved. Markets had this decision fully priced, which is its own
          result: a committee that surprises nobody spends no credibility, and one
          that never surprises anybody is only ever ratifying what markets decided.
        </p>
      )}

      {newswire.length > 0 && (
        <div className="mt-5 border-t border-neutral-800 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Between your decision and this meeting
          </h3>
          <ul className="mt-2 space-y-1">
            {newswire.map((headline) => (
              <li key={headline} className="text-sm text-neutral-300">
                {headline}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-neutral-500">
            These happened in the weeks after the decision, not because of it.
          </p>
        </div>
      )}

      {!reaction.standingMoved && (
        <p className="mt-4 text-xs text-neutral-500">
          Your standing did not move today. Credibility moves the day a published
          promise is delivered or broken; a package with nothing on the record
          leaves it untouched until its consequences arrive.
        </p>
      )}

      <button
        type="button"
        onClick={onContinue}
        className="mt-5 rounded border border-neutral-300 bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
      >
        Continue to the next meeting
      </button>
    </section>
  )
}
