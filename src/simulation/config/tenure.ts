import type { Institution } from '../types/core.ts'
import { MEETINGS_PER_YEAR } from './time.ts'

/**
 * Tenure: you serve until you are revoked, and the length is a result.
 *
 * ## What this replaces, and why
 *
 * `MEETING_COUNT = { easy: 12, medium: 16, hard: 24 }` set how long a mandate
 * lasted from the difficulty selector, which is arbitrary — no governor has
 * ever known how many meetings they had — and which made length do two jobs
 * at once. `time.ts` admits the second one in its own comment: *a longer
 * mandate is more chances to meet a catastrophe, so length and shock severity
 * are two settings of the same dial.* Removing length from the selector
 * dissolves that coupling. Difficulty is now carried entirely by what the
 * economy does and by what the information ladder publishes.
 *
 * ## The terms are the real ones
 *
 * Eight scheduled meetings a year at both institutions, so:
 *
 * | | term | renewable | what ends you early |
 * | --- | --- | --- | --- |
 * | Fed | 4 years = 32 meetings | **yes** | the appointment is not renewed |
 * | ECB | 8 years = 64 meetings | **no, by treaty** | you lose the Council |
 *
 * Neither horizon is meant to be *reached* often. The median fictional
 * mandate should end well short of it, which makes a session shorter than the
 * fixed 24-meeting hard mandate it replaces while making the length mean
 * something.
 *
 * ## The asymmetry is the whole point
 *
 * This is not two numbers. It is two games out of one engine.
 *
 * **The Fed is a politician's problem.** Reappointment is the sanction, and
 * historically it is the only one ever actually used: no Chair has been
 * removed, and two were declined a further term — Volcker in 1987 and Yellen
 * in 2018. Burns was reappointed in 1974 by the administration that had spent
 * 1972 leaning on him, which is the Burns scenario in one sentence. So
 * political pressure bites continuously, and the hearing is visible from
 * twenty meetings away: you steer at it.
 *
 * **The ECB is a diplomat's problem.** One eight-year term, non-renewable,
 * removal only by the Court of Justice at the request of the Council or the
 * Board. Nobody can fire you and there is no second term to want, so
 * political pressure has nothing to act on — that is not a missing mechanic,
 * it is what the Treaty was written to produce.
 *
 * What *can* end an ECB presidency is losing your own committee. Weber left
 * the Bundesbank in February 2011 and Stark the Executive Board in September
 * 2011, both over the Securities Markets Programme; a president who cannot
 * carry the Governing Council is finished in substance whatever the law says.
 * The engine already models dissent and dispersion. This gives them a
 * consequence.
 */

export interface Tenure {
  /** Meetings in one term. */
  readonly term: number
  /** Whether a second term can be sought at the end of the first. */
  readonly renewable: boolean
  /** How many terms may be served in total. */
  readonly maxTerms: number
  /** What the player is called, for the report and the hearing. */
  readonly office: string
}

export const TENURE: Readonly<Record<Institution, Tenure>> = {
  fed: {
    term: 4 * MEETINGS_PER_YEAR, // 32
    renewable: true,
    /*
     * Two terms is eight years — Volcker's actual tenure, and the most common
     * long chairmanship. Not a legal limit: Martin served nineteen years and
     * Greenspan eighteen. It is set here so the two institutions share one
     * ceiling by completely different routes — the Fed reaches 64 meetings
     * through two hearings it can fail, the ECB through one appointment
     * nobody can touch. The same length, earned two incompatible ways, is the
     * clearest statement the structure can make.
     */
    maxTerms: 2,
    office: 'Chair',
  },
  ecb: {
    term: 8 * MEETINGS_PER_YEAR, // 64
    renewable: false,
    maxTerms: 1,
    office: 'President',
  },
}

/**
 * The horizon a fictional mandate is measured against.
 *
 * Not a scheduled end: it is the longest you could possibly serve, which is
 * what `mandateElapsed` and the tempo schedule need a denominator for. A
 * scenario overrides it with its own calendar — see `scenarioHorizon`.
 */
export function tenureHorizon(institution: Institution): number {
  const tenure = TENURE[institution]
  return tenure.term * tenure.maxTerms
}

/** Which term a given meeting falls in, 1-based. */
export function termOf(institution: Institution, meetingIndex: number): number {
  return Math.floor(meetingIndex / TENURE[institution].term) + 1
}

/** Meetings remaining in the current term. Zero means the hearing is now. */
export function meetingsLeftInTerm(
  institution: Institution,
  meetingIndex: number,
): number {
  const { term } = TENURE[institution]
  return term - (meetingIndex % term)
}

/** True at exactly the meeting a term runs out. */
export function atTermEnd(institution: Institution, meetingIndex: number): boolean {
  return meetingIndex > 0 && meetingIndex % TENURE[institution].term === 0
}

/**
 * The reappointment hearing's bar, as a credibility floor.
 *
 * Deliberately *not* a pass mark on the scorecard. A reappointment is a
 * political act, and what the Senate Banking Committee is weighing is whether
 * the Chair is a liability — which in this engine is standing and conduct,
 * not the inflation print. A Chair handed 1973 and holding the line should be
 * reappointed; one handed calm water and whipsawing the rate should not.
 *
 * Political pressure raises the bar rather than setting it, which is the
 * mechanism the Fed half of the game turns on: pressure you ignored for three
 * years is a bill that arrives at the hearing.
 */
export const HEARING = {
  /** Credibility needed at the hearing with no political pressure at all. */
  baseCredibility: 42,
  /** How much a full head of political pressure adds to that bar. */
  pressureWeight: 26,
  /** Pressure below this is noise and does not count against you. */
  pressureFloor: 30,
} as const

/** The credibility a hearing demands, given the pressure that has built. */
export function hearingBar(politicalPressure: number): number {
  const over = Math.max(0, politicalPressure - HEARING.pressureFloor)
  const span = Math.max(1, 100 - HEARING.pressureFloor)
  return HEARING.baseCredibility + HEARING.pressureWeight * (over / span)
}

/**
 * The Governing Council's patience, which is the ECB's only failure mode.
 *
 * Dissent is read from the same member dispersion the area panel shows. The
 * run ends when the Council has been this far apart for this many consecutive
 * meetings — a slow loss of the room rather than a vote you can lose on the
 * day, because that is how it actually happens.
 */
/*
 * **These bars cannot be met, and nothing had measured them.**
 *
 * `council_lost` is the only way a fictional ECB presidency ends short of a
 * catastrophe, and it is the one structural difference between the two
 * institutions' survival. Measured in `dev/councilProbe.ts` over 360 ECB
 * mandates: the highest member inflation dispersion ever reached is **1.85**
 * against the 2.4 bar, and it is reached at ecb/hard under *competent* play,
 * which is where fragmentation is lowest because a competent rule uses the
 * anti-fragmentation instrument. The two quantities peak under opposite
 * conditions, so the conjunction is satisfied on **0.0 %** of meetings at every
 * difficulty under every play, and the ending fires 0 of 60 in every cell.
 *
 * It is the conjunction rather than the heights: at the loosest candidate pair
 * measured, the condition is still held long enough in 2-3 % of passive runs
 * and 0 % of competent ones.
 *
 * `watchDispersion` at 1.8 *is* reached at hard, so the game tells the player
 * "you can lose the room" and then cannot take it.
 *
 * Not repaired here, because the repair is a decision about how an ECB
 * presidency ends rather than a threshold: see docs/QUESTIONS.md **#23**, which
 * carries three options, the measurements behind each, and the exact edit for
 * the recommended one — gating on the blended cohesion penalty, which is one
 * number, is already on the player's scorecard, and is answerable with the
 * instrument `config/instruments.ts` now opens from easy.
 */
export const COUNCIL = {
  /** Member inflation dispersion, in points, above which the room strains. */
  fractureDispersion: 2.4,
  /** And the fragmentation that goes with it. */
  fractureFragmentation: 290,
  /** Consecutive meetings of both before the presidency is untenable. */
  meetingsToFail: 5,
  /** The warning tier, which fires first. */
  watchDispersion: 1.8,
} as const
