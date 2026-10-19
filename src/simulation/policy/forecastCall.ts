import type { SimulationState } from '../types/state.ts'
import { INSTITUTIONAL } from '../config/model.ts'
import { getDifficulty } from '../config/difficulty.ts'

/**
 * The published forecast, as a wager.
 *
 * > "Avant la réunion, je m'engage publiquement sur où sera l'inflation dans
 * > deux réunions, et je choisis ma mise : une fourchette large rapporte peu
 * > et coûte peu, une fourchette serrée rapporte gros et coûte cher. C'est
 * > l'arbitrage entre crédibilité et flexibilité, et c'est ce que font les
 * > vraies banques centrales."
 *
 * It is the oldest trade in the job. A central bank that publishes a tight
 * forecast and hits it is believed, and being believed is the whole of its
 * power; one that publishes a tight forecast and misses has spent the thing
 * it was trying to buy. A wide band is nearly free and buys nearly nothing.
 *
 * ## Why it belongs in the engine
 *
 * Because it pays in **credibility**, which is a latent variable every
 * expectations block reads, and because it must survive a replay. A wager
 * settled in the interface would be a wager the decision log could not
 * reconstruct — the same reason the committee vote moved out of
 * `submitMeeting` and into `applyPolicyPackage`.
 *
 * ## The shape of the trade
 *
 * Three bands, and the arithmetic is deliberately legible rather than tuned:
 * the reward and the cost both scale as the inverse of the band's width, so
 * halving the band doubles both sides. A player can see that in the numbers
 * without being told it, which is the point of a stake you choose.
 */

export type CallBand = 'wide' | 'even' | 'tight'

export interface ForecastCall {
  /** Where the committee says headline inflation will be, in per cent. */
  readonly centre: number
  readonly band: CallBand
  /** The meeting at which it was published. */
  readonly issuedAtMeeting: number
}

export interface CallTerms {
  readonly band: CallBand
  /** Half-width of the band, in percentage points. */
  readonly halfWidth: number
  /** Credibility gained if the print lands inside it. */
  readonly reward: number
  /** Credibility lost if it does not. */
  readonly cost: number
}

/** How many meetings ahead a call is made. */
export const CALL_HORIZON = 2

/**
 * The three bands on offer.
 *
 * Reward and cost are expressed before the difficulty's credibility
 * sensitivity, which scales both — a harder mode does not change the trade,
 * it changes how much the institution's standing moves for any trade.
 */
const BANDS: readonly CallTerms[] = [
  { band: 'wide', halfWidth: 1.0, reward: 0.9, cost: 1.2 },
  { band: 'even', halfWidth: 0.5, reward: 2.0, cost: 2.6 },
  { band: 'tight', halfWidth: 0.25, reward: 4.2, cost: 5.4 },
]

export function callTerms(band: CallBand): CallTerms {
  return BANDS.find((entry) => entry.band === band) ?? BANDS[0]
}

export function allCallTerms(): readonly CallTerms[] {
  return BANDS
}

/**
 * What a call is worth in this mandate, after the difficulty's sensitivity.
 *
 * The cost always exceeds the reward, at every band. That is not a thumb on
 * the scale: a forecast is a promise, and the asymmetry between keeping one
 * and breaking one is the mechanism the whole credibility block models. A
 * wager that paid symmetrically would make calling the tightest band every
 * meeting free expected value, and the trade would stop being a trade.
 */
export function callStake(state: SimulationState, band: CallBand): CallTerms {
  const terms = callTerms(band)
  const sensitivity = getDifficulty(state.config.difficulty).credibilitySensitivity
  return {
    ...terms,
    reward: terms.reward * sensitivity,
    cost: terms.cost * sensitivity,
  }
}

export interface CallOutcome {
  readonly call: ForecastCall
  readonly printed: number
  readonly won: boolean
  /** Signed credibility change. Positive is a gain. */
  readonly credibility: number
}

/**
 * Settle a call against what actually printed.
 *
 * Judged on the **published** figure rather than the latent truth, which is
 * the only honest reading: a committee is believed or not according to what
 * the statistical agency publishes, and at hard that number carries noise and
 * revisions the committee cannot see through. Missing because a release did
 * not arrive is treated as a miss that costs nothing — the committee did not
 * fail, the world failed to report.
 */
export function settleCall(
  state: SimulationState,
  call: ForecastCall,
  printed: number | null,
): CallOutcome | null {
  if (state.meetingIndex - call.issuedAtMeeting < CALL_HORIZON) return null
  if (printed === null) {
    return { call, printed: Number.NaN, won: false, credibility: 0 }
  }

  const terms = callStake(state, call.band)
  const won = Math.abs(printed - call.centre) <= terms.halfWidth
  return {
    call,
    printed,
    won,
    credibility: won ? terms.reward : -terms.cost,
  }
}

/** The ceiling credibility is held under, so a run of wins cannot break it. */
export const CALL_CREDIBILITY_CEILING = INSTITUTIONAL.credibility.resolve
