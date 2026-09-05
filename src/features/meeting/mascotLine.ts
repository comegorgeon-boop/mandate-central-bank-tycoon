import type { Difficulty } from '../../simulation/index.ts'

/**
 * What the house tortoise says.
 *
 * Deterministic templates, chosen by the situation — no model, no remote call,
 * no randomness. The same state always produces the same line, exactly like
 * every other piece of generated copy in this build.
 *
 * The rule the lines are written to: each one has to be *true and useful*, or
 * it is decoration wearing a character costume. A mascot that says "good luck
 * out there!" is worse than no mascot, because it takes up the space where a
 * sentence the player needed could have been.
 */

/** Said before the first meeting, keyed to the mode the player picked. */
const OPENING: Readonly<Record<Difficulty, string>> = {
  easy: 'You will move the rate today and see almost nothing next meeting. That is not the instrument failing — it is the lag, and this mode is short enough that you will still see it land before the end.',
  medium:
    'From here the two halves of the mandate can pull against each other. When they do, you are not choosing the right answer; you are choosing which half to disappoint and by how much.',
  hard: 'Nobody will name the shock, nobody will read the evidence for you, and the committee will not agree. Decide anyway — a chair who waits for certainty simply decides later, and later is worse.',
}

export function openingLine(difficulty: Difficulty): string {
  return OPENING[difficulty]
}

/**
 * Said on the result screen.
 *
 * Ordered by what the mandate's story actually was: how it ended first, then
 * whether the score reflected conduct rather than the economy, then the score
 * itself. A closing line that congratulated a revoked mandate on its
 * expectations anchoring would be the same failure as a green panel over a
 * mandate four meetings from collapse.
 */
export function closingLine({
  completed,
  score,
  maxScore,
  conductGate,
  supplyRegimeShare,
}: {
  readonly completed: boolean
  readonly score: number
  readonly maxScore: number
  readonly conductGate: number
  readonly supplyRegimeShare: number
}): string {
  if (!completed) {
    return 'It ended early. Read the causes above before the seed tempts you — the same economy will do the same thing to the same policy, which is exactly what makes replaying it worth something.'
  }
  if (conductGate < 0.6) {
    return 'The economy came through this better than your conduct did. Markets forgave the numbers; they did not forgive a committee that argued with itself.'
  }
  if (supplyRegimeShare > 0.4) {
    return 'Costs were pushed up from outside for much of that, and no rate you could have set would have removed them. You were judged on the anchor and the damage, which is the standard that regime actually sets.'
  }

  const share = score / maxScore
  if (share >= 0.75) {
    return 'A quiet mandate, which is the highest praise this job offers. Nobody writes about the decade the central bank got it right.'
  }
  if (share >= 0.5) {
    return 'Served in full, with the objective missed by more than you would like. That is most mandates, including the real ones.'
  }
  return 'You reached the end, which is not nothing. The scorecard above says where it went; the charts say when.'
}
