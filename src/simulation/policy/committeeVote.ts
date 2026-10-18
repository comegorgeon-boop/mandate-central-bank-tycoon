import type { PolicyPackage } from '../types/policy.ts'
import type { CommitteeView } from './staffRule.ts'

/** The rate change a package proposes, in basis points. Zero is a hold. */
export function chairMoveOf(pkg: PolicyPackage): number {
  return (
    pkg.actions.find((action) => action.instrument === 'policy_rate')?.magnitude ?? 0
  )
}

/**
 * The vote, and the dissents that get published with it.
 *
 * ## Why the chair always wins
 *
 * Because that is what a central bank is. The FOMC chair has been outvoted
 * once since the 1930s; the committee's power is not the ballot, it is the
 * *record* — a dissent is published with the decision, under the dissenter's
 * name, and the market reads it as a statement about how durable the policy
 * is. So this does not take the decision away from the player. It prices it.
 *
 * The alternative — a committee that can block a package — was considered and
 * rejected, and the reasoning is in `docs/QUESTIONS.md` along with what to
 * change to reverse it. In short: a game whose central control can be refused
 * by an adviser is a game about lobbying advisers, and the one this is would
 * have to be rebuilt around that.
 *
 * ## What a dissent is
 *
 * A member dissents when the chair's move is further from their own preferred
 * move than they can live with. The tolerance is deliberately wider than one
 * detent: a committee that dissented over 25 basis points at every meeting
 * would publish noise, and the publication would stop meaning anything, which
 * is the opposite of the mechanic's point.
 *
 * It is *not* a judgement about whether the chair is right. A member who wanted
 * +50 dissents from a hold whether or not holding turns out to have been
 * correct, and the scoreboard that judges doctrines after the fact is a
 * separate thing — see `features/game/doctrineScoreboard.ts`.
 *
 * ## And why one dissent costs nothing
 *
 * Because one dissent is ordinary. The Fed publishes them routinely and nobody
 * reads a 10–1 vote as an institution in trouble. What markets read is a
 * committee that cannot hold a majority behind its own decision — so the cost
 * is on the *margin*, and it starts above a single dissenting voice.
 */

export interface Ballot {
  /** The member, by wing. Never a named person. */
  readonly voice: string
  /** What this member would have done, in basis points. */
  readonly preferred: number
  readonly dissents: boolean
  /** Published alongside the decision when they dissent. Empty otherwise. */
  readonly statement: string
}

export interface CommitteeVote {
  /** One per *other* member. The chair does not cast a published ballot. */
  readonly ballots: readonly Ballot[]
  /** Including the chair's own vote. See `committeeVote`. */
  readonly inFavour: number
  readonly against: number
  /** True when nobody dissented. */
  readonly unanimous: boolean
  /**
   * Credibility cost of the published record, in points, never negative.
   *
   * Zero for unanimity and for a single dissent. See the note above: what is
   * expensive is a committee that cannot hold a majority, not one that
   * disagrees out loud.
   */
  readonly credibilityCost: number
  /** One line for the press, or null when there is nothing to report. */
  readonly headline: string | null
}

/**
 * How far from their own position a member will follow the chair.
 *
 * Two detents. Wider than a rounding difference, narrower than a change of
 * direction — so a member who wanted +50 follows a +25 without comment and
 * dissents from a hold.
 */
const TOLERANCE = 50

/** Credibility points per dissenting voice beyond the first. */
const COST_PER_DISSENT = 1.6

function statementFor(preferred: number, chair: number): string {
  const direction = preferred > chair ? 'tighter' : 'looser'
  const gap = Math.abs(preferred - chair)
  const wanted =
    preferred === 0
      ? 'no change'
      : `${preferred > 0 ? '+' : '−'}${Math.abs(preferred)} bp`
  return (
    `Voted against, preferring ${wanted}: a stance ${gap} basis points ` +
    `${direction} than the one adopted.`
  )
}

/**
 * Put the chair's move to the committee.
 *
 * Returns a vote with no ballots when there is no committee to ask — which
 * happens at the difficulties that do not publish one, and in any meeting
 * whose releases did not arrive. A vote nobody cast must read as *absent*
 * rather than as unanimous: a 0–0 result reported as "the committee was of one
 * mind" is the interface inventing a consensus.
 */
export function committeeVote(
  views: readonly CommitteeView[],
  chairMove: number,
): CommitteeVote {
  if (views.length === 0) {
    return {
      ballots: [],
      inFavour: 0,
      against: 0,
      unanimous: false,
      credibilityCost: 0,
      headline: null,
    }
  }

  const ballots = views.map((view): Ballot => {
    const dissents = Math.abs(view.basisPoints - chairMove) > TOLERANCE
    return {
      voice: view.voice,
      preferred: view.basisPoints,
      dissents,
      statement: dissents ? statementFor(view.basisPoints, chairMove) : '',
    }
  })

  const against = ballots.filter((ballot) => ballot.dissents).length
  // The chair's own vote, which is the one certainty in the room: nobody puts
  // a package to a committee and then votes against it. Counting only the
  // other members produced "decision taken 0-3", which reads as a decision
  // nobody supported — in a game where the player is the chair and has just
  // made it.
  const inFavour = ballots.length - against + 1
  const credibilityCost = Math.max(0, against - 1) * COST_PER_DISSENT

  return {
    ballots,
    inFavour,
    against,
    unanimous: against === 0,
    credibilityCost,
    headline: headlineFor(inFavour, against),
  }
}

function headlineFor(inFavour: number, against: number): string | null {
  if (against === 0) return `Decision taken unanimously, ${inFavour}–0.`
  if (against === 1) {
    return (
      `Decision taken ${inFavour}–${against}, with one dissent published ` +
      `alongside it.`
    )
  }
  if (inFavour > against) {
    return (
      `Decision taken ${inFavour}–${against}. A committee this divided is read ` +
      `as a policy that may not last.`
    )
  }
  // The chair's decision still stands — see the note at the top of this file —
  // but a chair carrying a minority of their own committee is the worst
  // reading the record can produce, and the line says so plainly.
  return (
    `Decision taken ${inFavour}–${against}, against the balance of the ` +
    `committee. The chair's vote carries it.`
  )
}
