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
/**
 * Losing the Council: the ECB's own ending, and the only one it has.
 *
 * ## It could not happen, and that is why this is written out
 *
 * The first version gated on **member inflation dispersion at 2.4 points and
 * area fragmentation at 290 basis points, held for five consecutive
 * meetings.** Measured in `dev/councilProbe.ts` over 360 mandates, the
 * conjunction was satisfied on **0.0 %** of meetings at every difficulty under
 * every play, and the ending fired 0 times in 60 in every cell. The highest
 * dispersion ever reached was 1.85 against the 2.4 bar — and it was reached at
 * ecb/hard under *competent* play, which is precisely where fragmentation is
 * lowest, because a competent rule uses the anti-fragmentation instrument. The
 * two quantities peak under opposite conditions. It was not the heights: at the
 * loosest candidate pair measured the condition still held long enough in 2-3 %
 * of passive runs and 0 % of competent ones.
 *
 * So the game announced an ending to the player — *"You can lose the room"* —
 * that it had no mechanism to carry out, in the one place the two institutions
 * are structurally different from each other.
 *
 * ## What it is now, and why this is the faithful version
 *
 * > "Choisis l'option qui garde le sens historique : on perd le Conseil parce
 * > qu'on tient une politique qu'un bloc de membres ne peut plus accepter —
 * > Weber et Stark en 2011 — pas parce qu'un dé est tombé."
 *
 * Dispersion was the wrong quantity. It is a fact about the *economies* of the
 * member states, which a president inherits and only partly steers; nobody
 * resigned from the Executive Board in 2011 because Spanish and German
 * inflation had diverged. What happened is that a policy was adopted and held,
 * and a part of the Council could not accept it: Axel Weber left the
 * Bundesbank in February 2011 and Jürgen Stark the Executive Board in
 * September 2011, both over the Securities Markets Programme, and neither was
 * outvoted — the programme continued.
 *
 * That is **sustained dissent by a bloc**, and the engine already models every
 * part of it: `policy/committeeVote.ts` casts the ballots, publishes the
 * dissents under the wing that cast them, and charges credibility for a
 * committee that cannot hold a majority behind its own policy. What was
 * missing was a consequence beyond the charge.
 *
 * So: a third of the committee against the decision, for
 * `meetingsToFail` consecutive meetings, and the count resets the moment the
 * room comes back. It cannot be rolled: it is a policy the player chose and
 * kept choosing while being told, in the published record, that a bloc would
 * not follow. And it is *answerable* — the dissents name what they wanted
 * instead at every one of those meetings.
 *
 * ## The rate, measured
 *
 * The bar the player set is "frequent enough to be real, rare enough to stay
 * an event". Measured in `dev/councilProbe.ts`, 60 mandates a cell:
 *
 * | | ends on it | shown the warning | longest streak |
 * | --- | --- | --- | --- |
 * | ecb/medium, competent | **0 %** | 7 % | 2 |
 * | ecb/medium, passive | 92 % | 100 % | 6 |
 * | ecb/medium, stubborn | 87 % | 100 % | 6 |
 * | ecb/hard, competent | **0 %** | **43 %** | **4** |
 * | ecb/hard, passive | 65 % | 100 % | 6 |
 * | ecb/hard, stubborn | 53 % | 100 % | 6 |
 *
 * A competent chair never loses the Council — and at hard is *told* it is
 * straining in 43 % of mandates and gets within two meetings of losing it.
 * That is the shape worth having: a real threat that can be answered, rather
 * than either a tax or a decoration.
 *
 * **Six was chosen against five and eight, measured.** At five, the ending
 * arrives at meeting five for a chair who was opposed from the first, which is
 * quick for something a presidency ends on. At eight, a competent chair at
 * hard is shown the warning in 12 % of mandates instead of 43 % — the threat
 * stops being visible, and a consequence nobody is warned about is an ambush.
 * Six meetings is nine months at eight meetings a year, which also sits inside
 * the period it is drawn from: the Securities Markets Programme began in May
 * 2010, Weber went public in February 2011 and Stark resigned that September.
 *
 * **The tutorial is exempt, and that is deliberate.** `tutorialProgress`
 * returns before the survival block in `endConditions`, because easy ends on
 * its goal rather than on a term — the Fed tutorial has no reappointment
 * hearing either. Worth knowing because the probe shows a 28-meeting dissent
 * streak at ecb/easy under passive play: the accumulator runs there, and
 * nothing reads it. The first version of the probe counted the accumulator and
 * duly reported "100 % warned" for a mechanic that was not running.
 *
 * Re-measure after anything that moves the committee's views or the chair's
 * incentives.
 */
export const COUNCIL = {
  /**
   * Consecutive meetings with a dissenting bloc before the presidency is
   * untenable.
   *
   * Six, measured against five and eight — see the table above. Nine months
   * of holding a policy a third of the room has refused in public.
   */
  meetingsToFail: 6,
  /**
   * The warning tier, in consecutive meetings.
   *
   * Two, so the player is told while there is still time to do something —
   * which is the whole difference between a mechanic and an ambush, and the
   * reason the old version was worse than useless: its warning fired at a
   * dispersion the game reached and its failure did not.
   */
  meetingsToWarn: 2,
} as const
