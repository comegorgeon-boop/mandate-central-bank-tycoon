import type { SimulationState } from '../types/state.ts'
import { bankedTotal } from './banked.ts'

/**
 * **The score. There is one.**
 *
 * > "LE SCORE ENGRANGÉ EST LE SCORE. C'est ce qu'on a tranché en passant en
 * > survie. L'autre est un reste de l'ancienne structure : soit tu le
 * > supprimes, soit tu le gardes comme diagnostic interne, mais le joueur
 * > n'en voit plus qu'un. Deux scores qui se contredisent, c'est pire que
 * > n'importe lequel des deux."
 *
 * Settled. This file exists so that the sentence has exactly one place to
 * live, because the defect it closes was two functions each confidently
 * answering "what did this mandate score" with numbers that disagreed about
 * whether competence beat passivity:
 *
 * | ECB, competent vs passive | banked | graded |
 * | --- | --- | --- |
 * | medium | 2,611 vs 331 | 2,159 vs **2,318** |
 * | hard | 329 vs 40 | 1,278 vs **2,519** |
 *
 * Both were on the result screen, a scroll apart, and the records page
 * compared the second — so a mandate that served fourteen years and was
 * forced out showed 5,437 banked beside 1,741 graded, and the leaderboard
 * took the 1,741.
 *
 * ## Why banked, and not a reweighting of the other one
 *
 * `scoring/banked.ts` argues it at length and the argument is structural
 * rather than aesthetic: under a survival structure the mandate ends when it
 * is lost, so a governor revoked at meeting six has a better *average* than
 * one who served forty meetings through two crises. Every path-averaged
 * component inherits that, which is why `calculateScore` prefers an early
 * exit however its weights are set. Banking points meeting by meeting removes
 * the average there is to protect.
 *
 * ## What happens to the other one
 *
 * It stays, and it stays useful, as **the explanation and nothing else**.
 * `calculateScore`'s components are the only place that says *which
 * objective* a mandate lost on and by how much, which is exactly what a
 * report is for. What is gone is its *total*: the components explain, the
 * banked figure scores, and no screen shows two numbers that could ever
 * disagree.
 *
 * It also remains the engine's own diagnostic — `dev/sweep.ts`,
 * `dev/fragmentation.ts` and the balance harnesses read it directly, and that
 * is fine, because a harness comparing components is asking a different
 * question from a player reading a score.
 */
export interface TheScore {
  /** Points banked over the whole mandate. This is the score. */
  readonly total: number
  /** Points per meeting served: the rate, which the total alone hides. */
  readonly perMeeting: number
  /** Meetings served. */
  readonly meetings: number
}

/**
 * What this mandate scored.
 *
 * Every player-facing comparison goes through here: the headline, the personal
 * best, the ten schools' own mandates, the historical standard. A caller that
 * reaches past this for `calculateScore(...).score` is reintroducing the
 * second score, and `scoring/oneScore.test.ts` fails the build if one does.
 */
export function theScore(state: SimulationState): TheScore {
  const banked = bankedTotal(state)
  return {
    total: banked.total,
    perMeeting: banked.perMeeting,
    meetings: banked.meetings,
  }
}
