import type { SeriesId } from '../types/observation.ts'

/**
 * Three ranks, and the question that assigns them.
 *
 * ## The test every indicator has to pass
 *
 * > "Tout indicateur affiché par défaut doit répondre à « qu'est-ce que je
 * > ferais différemment s'il bougeait ? ». Si rien, il descend d'un rang."
 *
 * That is the sharpest editorial rule anyone has given this project, because
 * it is answerable. Not "is this interesting", not "is this real economics" —
 * both of which everything here passes — but *does a decision change*. On
 * that test most of the panel fails, and it fails for an honest reason: the
 * indicators were added because the model has them, which is a statement
 * about the model rather than about the player.
 *
 * ## Nothing is deleted
 *
 * > "On ne supprime rien, on déclasse."
 *
 * Right, and it matters. An indicator that does not change today's decision
 * can still be the thing a player wants at the end of a mandate, or the thing
 * that explains a postmortem. Demoting is cheap and reversible; deleting
 * throws away a measurement the engine is still making.
 *
 * ## The three ranks
 *
 * - **`always`** — enormous, on every meeting, with an arrow and a cause.
 *   Two of them. Both halves of the mandate and nothing else.
 * - **`heavy`** — four to six, only on the full apparatus, and *this is where
 *   the explaining happens*. Each one carries what it means and what it
 *   should make you do.
 * - **`demand`** — everything else, one click away, never gone.
 */

export type Rank = 'always' | 'heavy' | 'demand'

/**
 * The rank of every series, with the reason written down.
 *
 * The `why` is not documentation. It is the answer to the assigning question,
 * recorded so that a future change of rank has to argue with it rather than
 * quietly disagree.
 */
export const SERIES_RANK: Readonly<
  Partial<Record<SeriesId, { readonly rank: Rank; readonly why: string }>>
> = {
  /* ── Rank one. Both halves of the mandate, and nothing else. ────────── */
  headline_inflation: {
    rank: 'always',
    why: 'Half the mandate, and the half the public and the politicians judge.',
  },
  unemployment: {
    rank: 'always',
    why: 'The other half. At the Fed it is the mandate; at the ECB it is the cost of pursuing the first half.',
  },

  /* ── Rank two. Six, and every one of them changes a move. ───────────── */
  core_inflation: {
    rank: 'heavy',
    why: 'Decides whether a high headline is a shock to look through or a problem to act on. That is a different decision, not a different number.',
  },
  inflation_expectations: {
    rank: 'heavy',
    why: 'Decides whether words are still enough. Once this moves, speaking stops being cheaper than acting.',
  },
  output_gap_estimate: {
    rank: 'heavy',
    why: 'The one leg of inflation the rate actually reaches. Acting on the gap rather than the print is the whole skill.',
  },
  credit_spread: {
    rank: 'heavy',
    why: 'Tightening you did not vote for. It decides whether your next rise lands on a borrower who has already had two.',
  },
  market_expected_rate: {
    rank: 'heavy',
    why: 'Decides what a move costs and what it buys: a third of the expected path is already in prices.',
  },
  bank_stress_proxy: {
    rank: 'heavy',
    why: 'Decides whether the rate is still your instrument at all, or whether the facilities are.',
  },
  fragmentation_spread: {
    rank: 'heavy',
    why: 'ECB only, and there it decides everything: one rate arriving as twenty different policies.',
  },

  /* ── Demoted, with the reason. Still there, one click away. ─────────── */
  policy_rate: {
    rank: 'demand',
    why: 'You set it. It is on the dial, three inches away, in 52 point type. A second copy of your own decision changes nothing.',
  },
  wage_growth: {
    rank: 'demand',
    why: 'Real, slow, and already inside the inflation decomposition as its own segment. Watching the input and the output both is watching one thing twice.',
  },
  import_prices: {
    rank: 'demand',
    why: 'Same: it is the currency segment of the cause bar, which is where it is actually legible.',
  },
  employment_growth: {
    rank: 'demand',
    why: 'Moves with unemployment and never against it. Nothing is decided here that is not decided one row up.',
  },
  real_growth: {
    rank: 'demand',
    why: 'A quarter of growth never changed a rate decision that the output gap had not already changed.',
  },
  consumer_confidence: {
    rank: 'demand',
    why: 'A leading indicator of a leading indicator. Interesting after the fact, never actionable at the table.',
  },
  equity_index: {
    rank: 'demand',
    why: 'A central bank that set rates by the stock market would be doing the wrong job, and a panel that puts it at eye level teaches exactly that.',
  },
  asset_valuation: {
    rank: 'demand',
    why: 'Belongs to the postmortem, where a bubble is visible. At the table it is a number with no move attached.',
  },
  market_volatility: {
    rank: 'demand',
    why: 'It is the *price* of surprising the market, which the book already quotes live under your thumb.',
  },
  long_rate: {
    rank: 'demand',
    why: 'Follows the path you are publishing. Useful as a check on whether you were believed, which is a postmortem question.',
  },
  public_approval: {
    rank: 'demand',
    why: 'Reads as a thing to manage. It is not: it is a consequence, and at the Fed the hearing is where it is collected.',
  },
  credibility_index: {
    rank: 'demand',
    why: 'The exception that proves the rule — it decides whether you keep the job, so it is surfaced by the *hearing countdown* rather than as a number to watch.',
  },
  neutral_rate_estimate: {
    rank: 'demand',
    why: 'An estimate of an unobservable, revised constantly. Acting on its wobbles is how 1972 happened; it belongs where it can be consulted, not watched.',
  },
  balance_sheet: {
    rank: 'demand',
    why: 'Only becomes a decision at the floor, and when it does the toolkit surfaces it by itself.',
  },
  regional_bank_stress: {
    rank: 'demand',
    why: 'Folded into banking stress for the decision; kept separately because which region matters in a postmortem.',
  },
  inflation_expectations_1y: {
    rank: 'demand',
    why: 'The long horizon is the one that decides anything. A one-year expectation mostly reports the last print back to you.',
  },
  exchange_rate: {
    rank: 'demand',
    why: 'Matters through import prices, which is the currency segment of the cause bar. Direct is less legible than the channel.',
  },
}

export function rankOf(seriesId: SeriesId): Rank {
  return SERIES_RANK[seriesId]?.rank ?? 'demand'
}

/** Series at a given rank, in declaration order. */
export function seriesAtRank(rank: Rank): readonly SeriesId[] {
  return (Object.keys(SERIES_RANK) as SeriesId[]).filter(
    (id) => SERIES_RANK[id]?.rank === rank,
  )
}
