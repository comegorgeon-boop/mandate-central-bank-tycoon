import type { SeriesId } from '../types/observation.ts'
import type { Difficulty } from '../types/core.ts'

/**
 * Which indicators a learning chair has met yet.
 *
 * A played mandate reported reading almost nothing from about the fifth
 * meeting. Part of that was density, fixed elsewhere; part of it is that
 * twenty-six series arrive at once on meeting one, and a reader who cannot
 * tell which four matter reasonably concludes that none of them do.
 *
 * So on the **learning mandate only**, the dashboard fills in. It opens on the
 * four numbers a rate decision is actually made from and adds the rest in the
 * order a chair would come to need them: the expectations that decide whether
 * the anchor is holding, then the market prices that answer on the day, then
 * the financial-stability block, then the rest.
 *
 * Easy only, and that is not caution. From medium a chair is expected to have
 * the full dashboard in front of them and the difficulty is reading it; a
 * professional who had to earn the right to see the credit spread would be a
 * game mechanic wearing an economics costume. The tutorial is the one place
 * where "you have not met this yet" is true.
 *
 * Nothing here changes what the engine computes. A withheld series is withheld
 * from the *panel*, exactly as the information ladder withholds the shock's
 * name — the number exists, and the meeting it appears is the meeting it
 * starts being worth a beginner's attention.
 *
 * ## Where this is applied, and why not one layer down
 *
 * In the **indicator panels**, not in `generateObservation`.
 *
 * The first version gated the observation set itself and broke six tests,
 * every one of them correctly. The stance decomposition reads expected
 * inflation and the priced path; the guidance preview reads the credibility
 * survey; the shock diagnosis reads core inflation; the same-day reaction
 * screen reads volatility, the long rate, equities and the currency. Gating
 * the observation did not simplify a panel, it silently removed mechanics —
 * and it removed them from the mode those mechanics exist to teach.
 *
 * Applied at the panel, the separation is exact by construction: the
 * *dashboard* fills in, and everything derived from the same numbers — the
 * stance, the reaction to a decision, the counterfactual — keeps working from
 * meeting one. A player meets a series on the reaction screen, where it is
 * doing something, before meeting it as a row on a table.
 */

/**
 * The meeting each series joins the dashboard, on easy.
 *
 * Anything absent from this table is available from the first meeting. The
 * four that open it are the two halves of the mandate, the instrument, and
 * what the instrument is judged against.
 */
const UNLOCK_AT: Readonly<Partial<Record<SeriesId, number>>> = {
  // Meeting three: the long end and the market's own verdict. The priced path
  // is *not* here — the stance reads it, so withholding it would take the
  // "was this priced in?" reading away with it.
  long_rate: 2,
  equity_index: 2,

  // Meeting four: the second-order reals, and what the public makes of it.
  public_approval: 3,
  consumer_confidence: 3,

  // Meeting six: the financial-stability block, which matters when it matters
  // and is noise until then.
  credit_spread: 5,
  market_volatility: 5,
  bank_stress_proxy: 5,
  asset_valuation: 5,
  regional_bank_stress: 5,

  // Meeting eight: the rest of the real economy, once the handful that decide
  // the rate have become familiar.
  wage_growth: 7,
  import_prices: 7,
  employment_growth: 7,
  real_growth: 7,
  exchange_rate: 7,
  balance_sheet: 7,
}

/** True when this series is on the dashboard at this meeting. */
export function isUnlocked(
  seriesId: SeriesId,
  difficulty: Difficulty,
  meetingIndex: number,
): boolean {
  if (difficulty !== 'easy') return true
  return meetingIndex >= (UNLOCK_AT[seriesId] ?? 0)
}

/** Series joining the dashboard at exactly this meeting, for the notice. */
export function unlockedAt(
  difficulty: Difficulty,
  meetingIndex: number,
): readonly SeriesId[] {
  if (difficulty !== 'easy' || meetingIndex === 0) return []
  return (Object.entries(UNLOCK_AT) as [SeriesId, number][])
    .filter(([, at]) => at === meetingIndex)
    .map(([id]) => id)
}
