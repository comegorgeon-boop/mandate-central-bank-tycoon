import type { Difficulty, RunSession } from '../../simulation/index.ts'

/**
 * What this move would do, in words — and never in a number.
 *
 * ## What it replaces
 *
 * > "THE BOOK me parle de surprendre le marché et de crédibilité risquée :
 * > un pari de second ordre, technique, qui ne me dit rien de ce qui
 * > m'intéresse. Ce que je veux savoir en bougeant le curseur :
 * > QU'EST-CE QUE JE GAGNE, ET QU'EST-CE QUE JE RISQUE ?"
 *
 * The surprise wager is a good mechanic about a second-order thing. What the
 * player is actually deciding is how hard to hit the economy, and nothing on
 * the screen said what hitting it that hard would do.
 *
 * ## Why no figures, and why that is not a cop-out
 *
 * > "SURTOUT PAS DE CHIFFRES PRÉCIS. « L'inflation baisse de 0,4 d'ici la
 * > réunion 6 » serait trop facile, et faux par construction : ton moteur est
 * > bâti sur l'écart entre l'état latent et ce qu'on observe. Un gouverneur
 * > ne connaît pas le chiffre à venir, il connaît le SENS et le RISQUE.
 * > Donner le chiffre, c'est me laisser lire l'état caché."
 *
 * This is the sharpest constraint anyone has put on this project and it is
 * correct on the engine's own terms. The whole game is the gap between the
 * latent state and the published one — the measurement regime, the series
 * bias, the publication lag, the real-time output gap that Orphanides showed
 * was wrong by three points in 1975. A forecast panel printing "−0.4 by
 * meeting six" would read the latent state out loud and delete the game.
 *
 * So the output is **sentences keyed to the size of the move**, recomputed
 * live under the thumb. A governor knows the direction and the risk. They do
 * not know the number, and neither does this.
 *
 * ## The hedging is the difficulty
 *
 * > "La prudence de la phrase suit la difficulté : en facile « devrait », en
 * > difficile « pourrait ». L'incertitude de la prévision EST la difficulté."
 *
 * Which is the information ladder expressed in grammar rather than in panels,
 * and it costs nothing: the same band of moves says *should* on easy, *may*
 * on hard. The uncertainty is not decoration around the forecast. It is the
 * forecast.
 *
 * ## Words before, numbers after
 *
 * > "ET LA DIVISION EST NETTE : avant d'agir, des mots ; après, des chiffres.
 * > Le contrefactuel garde ses décimales exactes."
 *
 * Nothing here touches the counterfactual, which still reports to two
 * decimals what the decision actually produced. Before the decision there is
 * no number to be honest about; afterwards there is, and it is the one thing
 * in the game that can be exact.
 */

export interface Consequence {
  /** What it buys, in the direction of the mandate. */
  readonly gain: string
  /** What it costs. Never absent: every move costs something. */
  readonly risk: string
  /** How hard the move is, for styling. */
  readonly weight: 'none' | 'light' | 'real' | 'heavy'
}

/** `should` on easy, `may` on hard. The forecast's uncertainty, as grammar. */
function hedge(difficulty: Difficulty): string {
  switch (difficulty) {
    case 'easy':
      return 'should'
    case 'medium':
      return 'ought to'
    default:
      return 'may'
  }
}

/**
 * Bands of move size, in basis points of absolute change.
 *
 * Not tuned against the engine's coefficients, and deliberately so: these are
 * the *qualitative* steps a committee actually talks in — a token move, a
 * real move, a move that breaks something. The engine decides what happens;
 * this says what kind of decision it was.
 */
const LIGHT = 13
const REAL = 60
const HEAVY = 110

export function readConsequence(session: RunSession, move: number): Consequence {
  const difficulty = session.state.config.difficulty
  const will = hedge(difficulty)
  const size = Math.abs(move)
  const tightening = move > 0

  if (size < LIGHT) {
    return {
      weight: 'none',
      gain: 'A year of your past decisions is still arriving.',
      risk: 'If the economy is moving away from you, this lets it.',
    }
  }

  if (size < REAL) {
    return {
      weight: 'light',
      gain: `It ${will} barely show. A gesture, not a policy.`,
      risk: tightening
        ? 'Too small to work, and it reads as hesitation.'
        : 'Too small to help, and it spends room you may need.',
    }
  }

  if (size < HEAVY) {
    return {
      weight: 'real',
      gain: tightening
        ? `Inflation ${will} turn, several meetings from now.`
        : `Credit loosens and hiring ${will} pick up, several meetings out.`,
      risk: tightening
        ? 'Investment stalls and hiring slows on the way.'
        : 'Demand added to an economy that may have no room. Prices answer later.',
    }
  }

  return {
    weight: 'heavy',
    gain: tightening
      ? `This breaks the back of it. Inflation ${will} come down, and sooner.`
      : `Credit opens up and the recovery ${will} come faster.`,
    risk: tightening
      ? 'You are breaking demand. Expect failures, and unemployment that stays.'
      : 'Fuel on prices. A wrong read here takes years to undo.',
  }
}
