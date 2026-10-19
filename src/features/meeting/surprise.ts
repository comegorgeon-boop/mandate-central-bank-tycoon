import {
  INSTITUTIONAL,
  VOLATILITY,
  getDifficulty,
  type RunSession,
} from '../../simulation/index.ts'

/**
 * The bet you are making by moving away from what the market has priced.
 *
 * ## Why this is a wager and not a consequence
 *
 * > "Là je décide puis je lis ; il n'y a aucun moment où j'espère. Je veux du
 * > pari, assumé. Dans les deux cas je dois VOIR LA MISE avant de m'engager —
 * > ce que je gagne, ce que je perds. Sinon ce n'est pas un pari, c'est un
 * > formulaire."
 *
 * Surprising the market has always had both effects in this engine: a move
 * the market has not priced moves financial conditions further than one it
 * has, and it costs volatility and standing if the economy did not need it.
 * What was missing is that the player met both *afterwards*, in a paragraph.
 * A cost you read about is an outcome; a cost you watch change under your
 * thumb is a stake.
 *
 * ## It is a reading, not a new mechanic
 *
 * Nothing here changes the model. Both numbers are the engine's own
 * coefficients applied to the move currently on the dial — the same arithmetic
 * `applyPolicyPackage` will run when the package is confirmed — so the stake
 * shown is the stake taken. If this file and the engine ever disagree, the
 * engine is right and this is a lie, which is why it reads the published
 * constants rather than carrying copies of them.
 */

/**
 * What the market has priced **for this meeting**, in basis points.
 *
 * Not the whole gap to the expected rate: the engine treats markets as
 * front-running 35 % of a priced *path* at any one meeting, because a path is
 * several decisions and this is one of them. The dial used to mark the full
 * gap as "priced", which put two contradicting sentences on the same screen —
 * the slider saying a move was fifty points *below* what markets expected
 * while the stake beside it said forty-four points *above*. Both were reading
 * a real quantity and only one of them was the quantity the engine charges
 * for.
 *
 * So it is defined once, here, and the marker, the slider's own sentence and
 * the stake all read it. Null where nothing has been published to price.
 */
export function pricedMoveBp(session: RunSession): number | null {
  const marketRate = session.observation.indicators.market_expected_rate?.value ?? null
  if (marketRate === null) return null
  const gap = marketRate - session.state.stance.targetRate
  return Math.round(Math.max(-1.5, Math.min(1.5, gap * 0.35)) * 100)
}

export interface SurpriseStake {
  /** Percentage points of unanticipated move. Signed. */
  readonly surprise: number
  /** Extra financial-conditions reach bought, in index points. */
  readonly reach: number
  /** Volatility the surprise adds, in index points. */
  readonly volatility: number
  /** Market trust it costs, in points. */
  readonly trust: number
  /** True once the move has left the band the market treats as priced-in. */
  readonly beyondPriced: boolean
}

/**
 * Below this many basis points of surprise, there is nothing worth a stake
 * panel. Not a model threshold — the engine charges from the first basis
 * point — but the point below which saying so is noise.
 */
const WORTH_SAYING = 15

export function surpriseStake(session: RunSession, move: number): SurpriseStake {
  const { state, observation } = session
  const previousRate = state.stance.targetRate
  const marketRate = observation.indicators.market_expected_rate?.value ?? null

  const nothing: SurpriseStake = {
    surprise: 0,
    reach: 0,
    volatility: 0,
    trust: 0,
    beyondPriced: false,
  }

  // With no published expectation there is nothing to surprise, and inventing
  // a stake would be inventing the one number this file promises not to.
  if (marketRate === null) return nothing

  // The engine's own arithmetic, verbatim — see the policy-surprise block in
  // `applyPolicyPackage`. Markets front-run 35 % of the path they have
  // priced; the surprise is what the decision does beyond that.
  const expectedMove = Math.max(-1.5, Math.min(1.5, (marketRate - previousRate) * 0.35))
  const actualMove = move / 100
  const surprise = actualMove - expectedMove
  const magnitude = Math.abs(surprise)

  if (magnitude * 100 < WORTH_SAYING) return { ...nothing, surprise }

  const sensitivity = getDifficulty(state.config.difficulty).credibilitySensitivity

  return {
    surprise,
    reach: INSTITUTIONAL.marketTrust.surpriseReach * Math.abs(surprise),
    volatility: VOLATILITY.policySurprise * magnitude * 0.5,
    trust: INSTITUTIONAL.marketTrust.surprise * magnitude * 0.25 * sensitivity,
    beyondPriced: true,
  }
}
