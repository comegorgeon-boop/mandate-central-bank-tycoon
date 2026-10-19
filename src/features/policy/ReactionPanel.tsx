import { useMemo } from 'react'
import type { ObservationSet } from '../../simulation/index.ts'
import type { FrontPage } from '../../simulation/index.ts'
import { FrontPagesPanel } from './FrontPagesPanel.tsx'
import type { RealisedEntry } from './instrumentLedger.ts'
import type { SettledPromise } from './settledPromise.ts'
import {
  callTerms,
  type CallOutcome,
  type CommitteeVote,
  type RunConfig,
} from '../../simulation/index.ts'
import type { CounterfactualLine } from '../meeting/counterfactualLine.ts'
import { Reveal } from '../meeting/Reveal.tsx'
import { meetingVerdict } from '../meeting/verdict.ts'
import { VotePanel } from '../meeting/VotePanel.tsx'
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
  frontPages,
  promise,
  realised,
  vote,
  call,
  config,
  current,
  fork,
  onContinue,
}: {
  readonly before: ObservationSet
  readonly onTheDay: ObservationSet
  readonly headlines: number
  /** The morning's front pages, reacting to the decision just taken. */
  readonly frontPages: readonly FrontPage[]
  /** A promise settled by this decision, if one was. Usually null. */
  readonly promise: SettledPromise | null
  /** How the committee voted on the decision just taken. */
  readonly vote: CommitteeVote
  /** A published forecast that came due, if one did. */
  readonly call: CallOutcome | null
  /** The mandate's own objective and sustainable rate, for the verdict. */
  readonly config: RunConfig
  /**
   * The counterfactual, shown here only after the decisive meeting.
   *
   * The banner on that meeting promises the player will be shown what the
   * other way would have produced, and this is that promise kept: the same
   * economy replayed without their decisions, which the engine has been
   * advancing in lockstep all mandate. Null at every other meeting, where it
   * lives in the Meeting Brief as usual rather than taking the top of the
   * screen.
   */
  readonly fork: CounterfactualLine | null
  /**
   * This meeting's published set, for the verdict band.
   *
   * Not `onTheDay`: that is the *same-day* restatement, where markets have
   * moved and prices have not — by construction, because a price index does
   * not respond to a decision on the afternoon it is taken. Judging the
   * meeting on that pair returned "mixed" every single time, which is how the
   * first version of the band managed never to appear.
   */
  readonly current: ObservationSet
  /** Instruments whose lag has run, now checkable. Usually empty. */
  readonly realised: readonly RealisedEntry[]
  readonly onContinue: () => void
}) {
  const reaction = useMemo(() => buildReaction(before, onTheDay), [before, onTheDay])
  // One bit, in colour, for the silent-phone criterion. Mixed carries no
  // colour at all — see `meeting/verdict.ts` for why that is the point.
  const verdict = useMemo(
    () => meetingVerdict(before, current, config),
    [before, current, config],
  )

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
      {/* The verdict, as a band of colour and nothing else. No figure, no
          sentence: this is the thing that has to be readable across a room on
          a silent phone, and a number would invite reading instead of
          glancing. The detail is everything below it.

          First in the panel, which is the whole requirement. It sat below the
          front pages in the first version — present, measurable, and off the
          bottom of a phone screen, which is the same as absent. */}
      {verdict !== 'mixed' && (
        <div
          data-tone={verdict}
          aria-hidden="true"
          className={`mb-3 h-1.5 w-full rounded-full ${
            verdict === 'better' ? 'bg-good' : 'bg-bad'
          }`}
        />
      )}

      {fork !== null && (
        <section
          data-fork=""
          aria-label="What the other way would have produced"
          className="mb-4 rounded-lg border-l-4 border-edge-accent bg-inset p-3 text-onwood"
        >
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-onwood-faint">
            The fork
          </p>
          <p className="mt-1 text-sm font-semibold text-onwood">{fork.headline}</p>
          <p className="mt-1 text-xs text-onwood-soft">{fork.detail}</p>
        </section>
      )}

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

      <FrontPagesPanel pages={frontPages} />

      {/* Staggered, so the tape reads as arriving rather than as a table that
          was always there. Sixty milliseconds apart is fast enough not to be
          a wait and slow enough to be a sequence; `prefers-reduced-motion`
          collapses all of it with the one rule in `tokens.css`. */}
      <ul className="mt-4 divide-y divide-edge border-y border-edge">
        {reaction.items.map((item, index) => (
          <li
            key={item.id}
            className="animate-rise py-3"
            style={{ animationDelay: `${index * 60}ms` }}
          >
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

      {reaction.spreads.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Sovereign spreads, within the hour
          </h3>
          <ul className="mt-2 space-y-1">
            {reaction.spreads.map((move, index) => (
              <li
                key={move.id}
                className="animate-rise flex flex-wrap items-baseline justify-between gap-x-4 text-sm"
                style={{ animationDelay: `${(reaction.items.length + index) * 60}ms` }}
              >
                <span className="text-ink">{move.name}</span>
                <span className="tabular-nums">
                  <span className="text-ink-faint">{move.before} bp</span>
                  <span aria-hidden="true" className="mx-2 text-ink-faint">
                    →
                  </span>
                  <span className="font-medium text-ink">{move.after} bp</span>
                  <span
                    className={`ml-2 text-xs ${
                      move.change > 0 ? 'text-bad-strong' : 'text-good-strong'
                    }`}
                  >
                    {move.change > 0 ? '+' : '−'}
                    {Math.abs(move.change)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-faint">
            One decision, repriced six ways before any statistic has moved. The
            member carrying the heaviest debt moves furthest, which is what
            fragmentation is and why it has its own instrument.
          </p>
        </div>
      )}

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

      {/* The wager, turning over. First, before the vote and before the
          promise: it is the only thing on this screen the player was hoping
          about, and burying a reveal under two panels of record is how a
          moment becomes a line in a table. */}
      {call !== null && Number.isFinite(call.printed) && (
        <Reveal won={call.won}>
          <p className="text-sm font-semibold">
            {call.won ? 'Your call was good.' : 'Your call missed.'}
          </p>
          <p className="mt-1 text-sm">
            You said {call.call.centre.toFixed(2)} % give or take{' '}
            {callTerms(call.call.band).halfWidth.toFixed(2)}. It printed{' '}
            <span className="font-semibold tabular-nums">
              {call.printed.toFixed(2)} %
            </span>
            .
          </p>
          <p className="mt-1 text-sm">
            {call.credibility >= 0 ? '+' : '−'}
            {Math.abs(call.credibility).toFixed(1)} credibility.
          </p>
        </Reveal>
      )}

      {/* The vote, published with the decision — which is when a vote is
          published. It sits above the promise because the player is reading
          the record of the meeting they just held, in the order the world
          would have produced it. */}
      <VotePanel vote={vote} />

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
