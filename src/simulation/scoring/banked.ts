import type { Institution } from '../types/core.ts'
import type { LatentSnapshot, SimulationState } from '../types/state.ts'
import { clamp } from '../config/bounds.ts'
import { BANKED } from '../config/scoring.ts'
import { inflationTargetFor } from '../scenarios/scenarios.ts'
import { STRESS_PENALTY_FLOOR } from '../config/scoring.ts'
import { unemploymentGap } from '../engine/indices.ts'

/**
 * The banked score: points earned meeting by meeting, not graded at the end.
 *
 * ## Why the average had to go
 *
 * > "BANQUE LES POINTS RÉUNION PAR RÉUNION, pondérés par la qualité de cette
 * > réunion-là. Une réunion à la cible banque plein ; une réunion à trois
 * > points de l'écart banque peu, ou négatif. La durée ET la qualité comptent
 * > ensemble, et se faire virer tôt ne peut plus être payant."
 *
 * Under a fixed mandate every run in a bucket was the same length, so grading
 * the *average* of the path was sound. Under a survival structure it inverts:
 * a governor revoked at meeting six after a calm opening has a better RMS
 * inflation miss than one who served forty meetings through two crises, and an
 * averaged scorecard ranks the first higher. It would be measuring luck and
 * brevity and calling it skill — and it would have taken a long time to
 * notice, because the scorecard would look exactly as it had always looked.
 *
 * So a meeting is now *worth* something. You hold the economy near its
 * objectives for a meeting, you bank `MEETING_POINTS`. You hold it three
 * points off, you bank almost nothing. You preside over a banking crisis, you
 * bank a negative number. Length and quality multiply instead of competing,
 * and being dismissed early stops being a way to protect a good average —
 * there is no average left to protect.
 *
 * ## What is deliberately *not* here
 *
 * No state field. The whole total is derived from `state.history`, which
 * already carries a full latent snapshot per meeting, so it replays exactly
 * from a decision log with nothing new to serialise and no second path
 * through `applyPolicyPackage` to diverge from. `enginePathParity.test.tsx`
 * exists because that divergence has happened before; the cheapest way to
 * pass it is to have nothing to diverge.
 */

export interface MeetingBank {
  readonly meetingIndex: number
  /** −0.4 to 1. What this meeting was worth as a fraction of full marks. */
  readonly quality: number
  /** Points banked for this meeting. */
  readonly points: number
  /** Running total after this meeting. */
  readonly running: number
  /** The component that cost the most this meeting, for the report. */
  readonly worst: 'prices' | 'jobs' | 'stability' | null
}

/** Maps a distance onto 1..0, reaching ~0.37 at `scale`. */
function near(distance: number, scale: number): number {
  return Math.exp(-((distance / scale) ** 2))
}

/**
 * What one meeting was worth.
 *
 * Three readings, weighted the way the institution weights its mandate, each
 * mapped to 0..1 — and then the whole thing is shifted so that a genuinely
 * bad meeting banks a *negative* number rather than zero. That shift is the
 * part the brief insists on and the part that makes the structure work: if
 * the floor were zero, presiding over a catastrophe would cost nothing and
 * sitting still through one would be free.
 */
export function meetingQuality(
  snapshot: LatentSnapshot,
  institution: Institution,
  target: number,
): { readonly quality: number; readonly worst: MeetingBank['worst'] } {
  const { latent } = snapshot

  const priceMiss = Math.abs(latent.inflationHeadline - target)
  const prices = near(priceMiss, BANKED.priceScale)

  const jobsMiss = Math.abs(unemploymentGap(latent))
  const jobs = near(jobsMiss, BANKED.jobsScale)

  const stress =
    Math.max(0, latent.bankingStress - STRESS_PENALTY_FLOOR) +
    12 * Math.max(0, latent.creditSpread - 0.9)
  const stability = near(stress, BANKED.stabilityScale)

  const weights = BANKED.weights[institution]
  const blended =
    weights.prices * prices + weights.jobs * jobs + weights.stability * stability

  // The shift. `floor` is what a meeting with everything at its worst banks.
  const quality = BANKED.floor + (1 - BANKED.floor) * blended

  // Which reading hurt most, for the one line the report gets to say.
  const losses: readonly [MeetingBank['worst'], number][] = [
    ['prices', weights.prices * (1 - prices)],
    ['jobs', weights.jobs * (1 - jobs)],
    ['stability', weights.stability * (1 - stability)],
  ]
  let worst: MeetingBank['worst'] = null
  let worstLoss = 0.08 // below this nothing is worth naming
  for (const [id, loss] of losses) {
    if (loss > worstLoss) {
      worst = id
      worstLoss = loss
    }
  }

  return { quality: clamp(quality, BANKED.floor, 1), worst }
}

/**
 * The whole ledger, meeting by meeting.
 *
 * The first snapshot is the opening state — what was inherited, before any
 * decision — so it is not banked. You are not paid or charged for the economy
 * you walked into.
 */
export function bankLedger(state: SimulationState): readonly MeetingBank[] {
  const target = inflationTargetFor(state.config)
  const institution = state.config.institution
  const out: MeetingBank[] = []
  let running = 0

  for (let index = 1; index < state.history.length; index += 1) {
    const snapshot = state.history[index]
    const { quality, worst } = meetingQuality(snapshot, institution, target)
    const points = BANKED.meetingPoints * quality
    running += points
    out.push({
      meetingIndex: snapshot.meetingIndex,
      quality,
      points,
      running,
      worst,
    })
  }

  return out
}

export interface BankedTotal {
  /** The banked total, rounded. Can be negative. */
  readonly total: number
  /** Meetings actually served and banked. */
  readonly meetings: number
  /** Average points a meeting, which is the quality half of the result. */
  readonly perMeeting: number
  /** The ledger itself. */
  readonly ledger: readonly MeetingBank[]
}

/**
 * The banked total.
 *
 * **Both halves are reported, always.** The total alone is a leaderboard of
 * length; the rate alone is the average that this whole file exists to get
 * rid of. A forty-meeting run at 180 a meeting and a six-meeting run at 240 a
 * meeting are different achievements and the pair of numbers says so, where
 * either one on its own lies about it.
 */
export function bankedTotal(state: SimulationState): BankedTotal {
  const ledger = bankLedger(state)
  const total = ledger.length === 0 ? 0 : ledger[ledger.length - 1].running
  return {
    total: Math.round(total),
    meetings: ledger.length,
    perMeeting: ledger.length === 0 ? 0 : Math.round(total / ledger.length),
    ledger,
  }
}
