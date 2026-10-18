import type { CommunicationCommitment } from '../../simulation/index.ts'
import {
  announcementWeight,
  isBinding,
  type PromiseLedger,
} from './promiseLedger.ts'

/**
 * The whole trade a commitment is, at the moment it is chosen.
 *
 * *"I don't see the point of committing."* The interface showed one side of
 * the deal and never the other two. What committing buys was on the
 * confirmation screen; what breaking one costs appeared nowhere; and the cost
 * of never committing is invisible by construction — a credit that never
 * accrues and a channel that stays shut produce no event, no warning, and no
 * number that moves.
 *
 * Three lines, then: what this rung buys, what it costs to walk away from, and
 * what the ledger says so far. Every figure comes from the constants the
 * engine charges against, so none of it can drift from the mechanism.
 *
 * The one that matters most is the first. At `none`, markets price **zero** of
 * an announced path — not a little, none. A mandate that never leaves that
 * rung has its fastest instrument switched off, and no choice of words opens
 * it. That is the sentence the player needed and never got.
 */
export function PromisePanel({
  commitment,
  ledger,
  meetingIndex,
}: {
  readonly commitment: CommunicationCommitment
  readonly ledger: PromiseLedger
  readonly meetingIndex: number
}) {
  const weight = announcementWeight(commitment)
  const binding = isBinding(commitment)
  const priced = Math.round(weight * 100)

  return (
    <div className="mt-3 rounded border border-edge bg-sunk p-3">
      <h4 className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
        What this is worth, and what it costs
      </h4>

      <dl className="mt-2 space-y-2 text-sm">
        <div>
          <dt className="font-medium text-ink">What it buys</dt>
          <dd className="text-ink-soft">
            {priced === 0 ? (
              <>
                Nothing. At this rung markets price{' '}
                <span className="font-semibold text-accent-strong">none</span> of
                the path you announce — the announcement channel is shut, and it
                is the only instrument that acts before the rate does.
              </>
            ) : (
              <>
                Markets price about{' '}
                <span className="font-semibold tabular-nums text-ink">
                  {priced} %
                </span>{' '}
                of the path you announce, scaled by how far you are believed.
                That reaches expectations this quarter, years before a rate
                change does.
              </>
            )}
          </dd>
        </div>

        <div>
          <dt className="font-medium text-ink">What breaking it costs</dt>
          <dd className="text-ink-soft">
            {binding ? (
              <>
                Moving against this without a shock to justify it costs{' '}
                <span className="font-semibold tabular-nums text-ink">
                  {ledger.nextBrokenCredibility.toFixed(0)}
                </span>{' '}
                credibility and{' '}
                <span className="font-semibold tabular-nums text-ink">
                  {ledger.nextBrokenMarket.toFixed(0)}
                </span>{' '}
                market trust — permanently. Broken promises only ever count up.
              </>
            ) : (
              <>
                Nothing: this is not a promise, so it cannot be broken. It
                cannot be kept either, which is why it buys so much less.
              </>
            )}
          </dd>
        </div>

        <div>
          <dt className="font-medium text-ink">Your record</dt>
          <dd className="text-ink-soft">
            {ledger.neverCommitted && meetingIndex >= 2 ? (
              <>
                You have not put anything on the record yet. That has cost you
                nothing visible and up to{' '}
                <span className="font-semibold tabular-nums text-ink">
                  {ledger.keptCreditMax.toFixed(0)}
                </span>{' '}
                points of credibility you could have earned by now — the credit
                for delivering promises is the only part of your standing that
                rewards conduct rather than outcomes.
              </>
            ) : ledger.kept === 0 && ledger.broken === 0 ? (
              <>Nothing on the record yet, either way.</>
            ) : (
              <>
                <span className="tabular-nums">{ledger.kept}</span> delivered,{' '}
                <span className="tabular-nums">{ledger.broken}</span> broken.
                Delivery has earned{' '}
                <span className="font-semibold tabular-nums text-good-strong">
                  +{ledger.keptCredit.toFixed(1)}
                </span>{' '}
                credibility of a possible {ledger.keptCreditMax.toFixed(0)}
                {ledger.broken > 0 && (
                  <>
                    ; breaking has cost{' '}
                    <span className="font-semibold tabular-nums text-bad-strong">
                      −{ledger.brokenCredibilityCost.toFixed(1)}
                    </span>{' '}
                    credibility and{' '}
                    <span className="font-semibold tabular-nums text-bad-strong">
                      −{ledger.brokenMarketCost.toFixed(0)}
                    </span>{' '}
                    market trust, and neither comes back
                  </>
                )}
                .
                {ledger.nextKeptGain === 0 && ledger.kept > 0 && (
                  <> The delivery credit is at its ceiling.</>
                )}
              </>
            )}
          </dd>
        </div>
      </dl>
    </div>
  )
}
