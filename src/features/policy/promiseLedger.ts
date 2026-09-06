import {
  COMMUNICATION,
  GUIDANCE_HORIZON_MEETINGS,
  INSTITUTIONAL,
  getDifficulty,
  type CommunicationCommitment,
  type Difficulty,
  type GuidanceState,
} from '../../simulation/index.ts'

/**
 * What a commitment buys, what breaking one costs, and what never making one
 * has cost so far.
 *
 * The player's report, verbatim: *"I don't see the point of committing."* They
 * were reading the interface correctly. The confirmation screen showed what
 * saying something buys — the priced path moves, expectations are pulled — and
 * said nothing at all about the other two halves of the trade. Breaking a
 * promise was priced by the engine and named nowhere. And the cost of never
 * promising anything is *invisible by construction*: it is a credit that never
 * accrues and an announcement channel that stays shut, neither of which
 * produces an event, a warning, or a number that moves.
 *
 * So: everything here is computed from the same constants `applyPolicyPackage`
 * and `dynamics` actually use, never from copies. The numbers a player is shown
 * are the numbers charged.
 *
 * Two asymmetries worth stating plainly, because they are the whole reason
 * commitment is a decision rather than a free action:
 *
 *   - **Breaking is permanent, keeping is capped.** `brokenPromises` only ever
 *     counts up and each one costs credibility and market trust for the rest of
 *     the mandate. Kept promises earn credit up to a ceiling and no further.
 *   - **A promise is only judged if it was binding.** A leaning expires
 *     unjudged: it cannot be broken, and it cannot be kept either. That is what
 *     makes it cheap, and it is exactly why it buys so much less.
 */

const CREDIBILITY = INSTITUTIONAL.credibility
const MARKET_TRUST = INSTITUTIONAL.marketTrust

/** The rung at which an announcement becomes a promise the engine judges. */
export const BINDING_WEIGHT = 0.65

export interface PromiseLedger {
  /** Promises delivered so far. */
  readonly kept: number
  /** Promises moved against without a shock to justify it. */
  readonly broken: number
  /** Credibility points earned from delivery, out of the cap. */
  readonly keptCredit: number
  readonly keptCreditMax: number
  /** Credibility points forgone by never having committed. Zero once any. */
  readonly forgoneCredit: number
  /** Credibility already lost to broken promises, permanently. */
  readonly brokenCredibilityCost: number
  /** Market trust already lost to broken promises, permanently. */
  readonly brokenMarketCost: number
  /** What one more delivered promise would add. Zero at the cap. */
  readonly nextKeptGain: number
  /** What one more broken promise would cost in credibility. */
  readonly nextBrokenCredibility: number
  /** What one more broken promise would cost in market trust. */
  readonly nextBrokenMarket: number
  /** True when the mandate has never put anything binding on the record. */
  readonly neverCommitted: boolean
  /** A binding promise currently outstanding, if there is one. */
  readonly outstanding: {
    readonly path: number
    readonly judgedAtMeeting: number
  } | null
}

function creditFor(kept: number): number {
  return Math.min(CREDIBILITY.keptPromiseCap, CREDIBILITY.keptPromise * kept)
}

export function promiseLedger(
  guidance: GuidanceState,
  difficulty: Difficulty,
): PromiseLedger {
  const sensitivity = getDifficulty(difficulty).credibilitySensitivity
  const kept = guidance.keptPromises
  const broken = guidance.brokenPromises
  const keptCredit = creditFor(kept)

  const binding =
    guidance.impliedRatePath !== null &&
    COMMUNICATION.commitmentWeight[guidance.commitment] >= BINDING_WEIGHT

  return {
    kept,
    broken,
    keptCredit,
    keptCreditMax: CREDIBILITY.keptPromiseCap,
    // Only meaningful before the first commitment. After that the ledger has
    // real entries and "what you might have had" is no longer the story.
    forgoneCredit:
      kept === 0 && broken === 0 ? CREDIBILITY.keptPromiseCap : 0,
    brokenCredibilityCost: CREDIBILITY.brokenPromise * broken * sensitivity,
    brokenMarketCost: MARKET_TRUST.brokenPromise * broken,
    nextKeptGain: creditFor(kept + 1) - keptCredit,
    nextBrokenCredibility: CREDIBILITY.brokenPromise * sensitivity,
    nextBrokenMarket: MARKET_TRUST.brokenPromise,
    neverCommitted: kept === 0 && broken === 0 && !binding,
    outstanding: binding
      ? {
          path: guidance.impliedRatePath!,
          judgedAtMeeting:
            guidance.issuedAtMeeting + GUIDANCE_HORIZON_MEETINGS + 1,
        }
      : null,
  }
}

/**
 * How much of an announced path markets actually price, by rung.
 *
 * The number that answers "what does committing buy" in one figure. At `none`
 * it is zero — not "a little", zero — which is the fact the player could not
 * see: a mandate that never leaves that rung has an announcement channel that
 * is switched off, and no amount of choosing the right words opens it.
 */
export function announcementWeight(commitment: CommunicationCommitment): number {
  return COMMUNICATION.commitmentWeight[commitment]
}

/** Whether the engine will judge a promise made at this rung. */
export function isBinding(commitment: CommunicationCommitment): boolean {
  return COMMUNICATION.commitmentWeight[commitment] >= BINDING_WEIGHT
}
