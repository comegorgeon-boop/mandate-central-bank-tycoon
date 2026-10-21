import { POLICY_RATE_FLOOR } from '../../simulation/index.ts'
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
  readonly weight: 'none' | 'light' | 'real' | 'heavy' | 'shock' | 'floor'
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
/** Beyond this, the move is itself the event. */
const SHOCK = 200

export function readConsequence(session: RunSession, move: number): Consequence {
  const difficulty = session.state.config.difficulty
  const will = hedge(difficulty)
  const size = Math.abs(move)
  const tightening = move > 0

  /*
   * ── At the floor, the game explains the floor ─────────────────────────
   *
   * > "VERS LE BAS : garde le plancher. Le taux plancher effectif est une
   * > vraie limite du monde réel, c'est tout l'enjeu de 2008 et de 2021, et
   * > je dois l'apprendre. Mais quand je le touche, le jeu m'EXPLIQUE
   * > pourquoi il existe et ce qu'il me reste comme instruments."
   *
   * The asymmetry is right and it is not arbitrary. The ceiling was a *game*
   * rule — a committee can vote whatever it likes — so it became a cost. The
   * floor is a property of the world: below roughly zero, people hold cash
   * instead of lending it, and no announcement changes that. Keeping it is
   * teaching something true.
   *
   * But a limit that merely refuses is the same wall the ceiling was. So
   * when the dial arrives there, it says why it exists and what is left —
   * which is the actual lesson of 2008 and 2021, and is the moment the
   * toolkit stops being a tab nobody opens.
   */
  const floor = POLICY_RATE_FLOOR[session.state.config.institution]
  const resulting = session.state.stance.targetRate + move / 100
  if (!tightening && resulting <= floor + 0.26) {
    return {
      weight: 'floor',
      gain:
        'You are at the effective lower bound. Below about zero, people hold ' +
        'cash rather than lend it, so the dial stops transmitting — this is ' +
        'the limit of 2008 and of 2021, and no announcement moves it.',
      risk:
        'The rate is no longer your instrument. What is left is the balance ' +
        'sheet, the facilities, and your word about how long this lasts — ' +
        'open the room and use them.',
    }
  }

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

  /*
   * ── Beyond 200 basis points: the move is the event ────────────────────
   *
   * The ceiling used to be 150 and the game simply refused anything larger.
   * It now reaches 500, and what replaces the refusal is this: a sentence
   * that escalates with the size, said *before* the button is pressed.
   *
   * > "La contrainte devient une conséquence au lieu d'un refus."
   *
   * Every clause names something the engine actually does with a surprise
   * that large — `VOLATILITY.policySurprise` scales with the gap to the
   * priced path, `INSTITUTIONAL.marketTrust.surprise` charges credibility
   * against it, and banking stress follows volatility through the financial
   * block. It is a warning, not a threat: the player may absolutely do it,
   * and Volcker did, on a Saturday, in October 1979.
   */
  if (size >= SHOCK) {
    const extreme = size >= 350
    return {
      weight: 'shock',
      gain: tightening
        ? `A move nobody has priced. Inflation ${will} break, and fast — this ` +
          'is the kind of decision a mandate is remembered by.'
        : `An emergency easing. Credit ${will} reopen at once, if anything is ` +
          'left standing to lend to.',
      risk: extreme
        ? 'Your word is broken: a surprise this size is not policy, it is a ' +
          'reversal. Expect volatility off the scale, banks in trouble, and an ' +
          'emergency meeting called about you.'
        : 'Credibility takes real damage, volatility spikes, and the banking ' +
          'system feels it within two meetings.',
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
