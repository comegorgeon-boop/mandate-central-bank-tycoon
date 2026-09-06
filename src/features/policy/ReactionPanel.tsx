import { useMemo } from 'react'
import type { ObservationSet } from '../../simulation/index.ts'
import type { RealisedEntry } from './instrumentLedger.ts'
import type { SettledPromise } from './settledPromise.ts'
import { buildReaction } from './reaction.ts'
import { RealisedEffectPanel } from './RealisedEffectPanel.tsx'

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
  headlines,
  promise,
  realised,
  onContinue,
}: {
  readonly before: ObservationSet
  readonly onTheDay: ObservationSet
  readonly headlines: number
  /** A promise settled by this decision, if one was. Usually null. */
  readonly promise: SettledPromise | null
  /** Instruments whose lag has run, now checkable. Usually empty. */
  readonly realised: readonly RealisedEntry[]
  readonly onContinue: () => void
}) {
  const reaction = useMemo(() => buildReaction(before, onTheDay), [before, onTheDay])

  return (
    // On paper, like every other document the player reads. It draws in ink,
    // and it used to render straight onto the walnut of the room — the
    // headings and the "after" figures measured 1.04:1, which is invisible.
    // It survived a contrast audit that reported ALL CLEAR because the audit's
    // harness clicked "Continue to the next meeting" before it ever measured
    // anything: a panel that only exists *between* meetings was never once on
    // screen while the audit ran.
    <section
      aria-labelledby="reaction-heading"
      className="rounded-lg border border-edge bg-panel p-4 text-ink shadow-panel sm:p-5"
    >
      <h2
        id="reaction-heading"
        className="font-display text-2xl font-semibold text-ink"
      >
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

      {/* The wire lines themselves used to be listed here *and* on the meeting
          screen, unranked in both places. They now run in one paper, with a
          lead and a hierarchy, and this is the handoff to it: enough to know
          whether the quarter was eventful, and no second copy of the news. */}
      {headlines > 0 && (
        <p className="mt-5 border-t border-edge pt-4 text-sm text-ink-soft">
          {headlines === 1
            ? 'One story broke in the weeks after the decision'
            : `${headlines} stories broke in the weeks after the decision`}
          , not because of it. They lead the front page at the meeting.
        </p>
      )}

      {/* A promise kept is the one thing in this game that pays for conduct
          rather than outcome, and until now nothing said when it happened.
          The player's report was that they could not see the point of
          committing; being told, on the day, that a promise was delivered and
          what it earned is half of the answer. */}
      {promise !== null && (
        <div
          className={`mt-5 rounded border-l-4 p-3 ${
            promise.kept
              ? 'border-good bg-good-surface'
              : 'border-bad bg-bad-surface'
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              promise.kept ? 'text-good-strong' : 'text-bad-strong'
            }`}
          >
            {promise.kept
              ? 'You delivered the path you published.'
              : 'You moved against the path you published.'}
          </p>
          <p className="mt-1 text-sm text-ink">
            {promise.kept ? (
              promise.change > 0 ? (
                <>
                  Credibility credit for delivery rises to{' '}
                  <span className="font-semibold tabular-nums">
                    +{promise.credit.toFixed(1)}
                  </span>{' '}
                  of a possible {promise.creditMax.toFixed(0)}. This is the only
                  part of your standing that rewards how you behaved rather than
                  what happened to you.
                </>
              ) : (
                <>
                  The delivery credit is already at its ceiling of{' '}
                  {promise.creditMax.toFixed(0)}. What keeping this one protects
                  is the record — a broken promise from here would cost far more
                  than another kept one can add.
                </>
              )
            ) : (
              <>
                Charged as a broken promise: no shock large enough to justify it
                had happened since it was published. Credibility and market
                trust are down{' '}
                <span className="font-semibold tabular-nums">
                  {promise.credibilityCost.toFixed(0)}
                </span>{' '}
                and{' '}
                <span className="font-semibold tabular-nums">
                  {promise.marketCost.toFixed(0)}
                </span>{' '}
                for the rest of the mandate. That count only ever goes up.
              </>
            )}
          </p>
        </div>
      )}

      <RealisedEffectPanel entries={realised} />

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
