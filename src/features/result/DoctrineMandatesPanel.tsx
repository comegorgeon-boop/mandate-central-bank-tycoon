import { useMemo } from 'react'
import type { RunSession, ScoreBreakdown } from '../../simulation/index.ts'
import type { Scoreboard } from '../game/doctrineScoreboard.ts'
import { compareMandates } from './doctrineMandates.ts'

/**
 * The committee, in retrospect.
 *
 * The end of an argument that ran the whole mandate, and the two halves of it
 * in one table because they answer the same question from opposite ends.
 *
 * **Right when it differed** is the record kept meeting by meeting: every time
 * a school argued for a rate the committee did not take, that meeting was
 * replayed with its rate and judged four meetings later. It says how often the
 * school was right *about your mandate*, decision by decision.
 *
 * **Its own mandate** is the other end: the same seed, the same shocks, the
 * same opening state, played from the first meeting with that school in the
 * chair and nobody else. It says where its rule would have got you.
 *
 * The two can disagree, and that is the interesting case. A school can be
 * right more often than not on individual meetings and still finish behind,
 * because being right at the margin of someone else's policy is a different
 * thing from setting the policy.
 *
 * ## What the table does not say
 *
 * It does not crown a winner. A mandate is one draw, and a rule that loses on
 * this seed may be the rule you want facing the next one — which is the whole
 * reason to know more than one of them. The caption says so, because a player
 * who memorised a ranking instead of a regime would have learned the wrong
 * thing from an otherwise honest table.
 */

/** Below which a gate, not the economy, is the main thing in the number. */
const GATE_BIT = 0.6

/**
 * The one thing worth knowing about how a school's mandate ended.
 *
 * Because "1,132" on its own is a lie by omission. The credibility hawk run
 * mechanically on the ECB's medium seed finishes with inflation at 1.6 % and
 * unemployment at its sustainable rate — a good economy — and scores 1,132,
 * because it got there by taking the rate from 1.75 to 7.00 to 4.25 to 5.50 to
 * 2.25 and the conduct gate charges 12.5 points of cumulative movement against
 * a 6-point allowance. A reader shown the number alone would conclude that
 * defending the anchor wrecks an economy. What it actually shows is that this
 * rule, followed without judgement, is erratic — which is a sharper lesson and
 * the opposite of the one the bare number teaches.
 */
function whyThatScore(entry: {
  readonly completed: boolean
  readonly endedLabel: string | null
  readonly meetings: number
  readonly spoke: number
  readonly score: { readonly conductGate: number; readonly priceStabilityGate: number }
}): string {
  if (!entry.completed) return entry.endedLabel ?? `ended at ${entry.meetings}`
  if (entry.spoke === 0) return 'held throughout'
  if (entry.score.conductGate < GATE_BIT) {
    return `steadiness ×${entry.score.conductGate.toFixed(2)}`
  }
  if (entry.score.priceStabilityGate < GATE_BIT) {
    return `price gate ×${entry.score.priceStabilityGate.toFixed(2)}`
  }
  return `${entry.meetings} meetings`
}

export function DoctrineMandatesPanel({
  session,
  score,
  board,
}: {
  readonly session: RunSession
  readonly score: ScoreBreakdown
  /** The meeting-by-meeting record kept while the mandate was played. */
  readonly board: Scoreboard
}) {
  // Ten complete alternative mandates, computed on the result screen. Same
  // hazard and same answer as `TheStandardPanel`: a panel that cannot build
  // itself is a missing panel, never a missing screen.
  const comparison = useMemo(() => {
    try {
      return compareMandates(session, score)
    } catch (error) {
      console.error('The doctrine comparison could not be built', error)
      return null
    }
  }, [session, score])
  if (comparison === null) return null

  const beaten =
    comparison.beatenBy === 0
      ? 'None of them finished ahead of you.'
      : comparison.beatenBy === 1
        ? 'One of them finished ahead of you.'
        : `${comparison.beatenBy} of them finished ahead of you.`

  return (
    <section className="mt-10" aria-labelledby="doctrines-heading">
      <h2
        id="doctrines-heading"
        className="text-sm font-semibold uppercase tracking-wide text-ink-soft"
      >
        The committee, in retrospect
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Each school played the same mandate from your opening state, with your
        seed and your shocks, every meeting decided by its own rule. {beaten}
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[26rem] border-collapse text-left text-sm">
          <caption className="sr-only">
            For each school of thought: how often it was right when it
            disagreed with you during your mandate, and what it would have
            scored running the mandate itself.
          </caption>
          <thead>
            <tr className="border-b border-edge text-xs uppercase tracking-wide text-ink-faint">
              <th scope="col" className="py-2 pr-2 font-medium">
                School
              </th>
              <th scope="col" className="py-2 pr-2 text-right font-medium">
                Right when it differed
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Its own mandate
              </th>
            </tr>
          </thead>
          <tbody>
            {comparison.mandates.map((entry) => {
              const record = board.records[entry.doctrine.id]
              const ahead = entry.score.score > comparison.player
              return (
                <tr
                  key={entry.doctrine.id}
                  className="border-b border-edge align-top"
                >
                  <th scope="row" className="py-2 pr-2 font-medium text-ink">
                    {entry.doctrine.name}
                    <span className="block text-xs font-normal text-ink-faint">
                      {entry.doctrine.school}
                    </span>
                  </th>
                  <td className="py-2 pr-2 text-right text-ink">
                    {record.tested > 0 ? (
                      <>
                        <span className="tabular-nums">
                          {record.right} of {record.tested}
                        </span>
                        {record.agreed > 0 && (
                          <span className="block text-xs font-normal text-ink-faint">
                            agreed with you {record.agreed}×
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-ink-faint">
                        {entry.spoke === 0
                          ? 'never had standing'
                          : record.agreed > 0
                            ? `agreed with you ${record.agreed}×`
                            : 'never tested'}
                      </span>
                    )}
                  </td>
                  <td
                    className={`py-2 text-right tabular-nums ${
                      ahead ? 'font-semibold text-accent-strong' : 'text-ink'
                    }`}
                  >
                    {entry.score.score.toLocaleString('en-US')}
                    <span className="block text-xs font-normal tabular-nums text-ink-faint">
                      {whyThatScore(entry)}
                    </span>
                  </td>
                </tr>
              )
            })}
            <tr className="border-b-2 border-edge-accent align-top">
              <th scope="row" className="py-2 pr-2 font-semibold text-ink">
                You
                <span className="block text-xs font-normal text-ink-faint">
                  the decisions you actually took
                </span>
              </th>
              <td className="py-2 pr-2 text-right text-xs text-ink-faint">
                —
              </td>
              <td className="py-2 text-right font-semibold tabular-nums text-ink">
                {comparison.player.toLocaleString('en-US')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-ink-faint">
        Right when it differed counts only the meetings where a school argued
        for a rate you did not take: that meeting replayed with its rate, the
        same shocks, judged four meetings later on the mandate&rsquo;s own loss.
        Its own mandate gave each school the policy rate and nothing else — the
        balance sheet was left alone and no guidance was issued, because none of
        these is a theory about those. A multiplier under a score means a gate
        took a large part of it rather than the economy did: steadiness ×0.20 is
        a rule that reached a tolerable outcome by moving the rate far further
        than the mandate allows. This is one draw. A rule that loses here may be the rule
        you want facing the next shock, which is the reason to know more than
        one of them.
      </p>
    </section>
  )
}
