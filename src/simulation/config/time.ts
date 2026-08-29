import type { Difficulty } from '../types/core.ts'

/**
 * Time structure of a run.
 *
 * Both institutions hold eight scheduled monetary-policy meetings per year,
 * so one meeting covers an eighth of a year for the Fed and the ECB alike and
 * scores stay comparable within an institution/difficulty bucket.
 *
 * Each inter-meeting interval is advanced in several smaller internal steps.
 * This is what stops a policy change from behaving like an instantaneous turn
 * bonus: the change enters the lag pipeline now and works through the economy
 * across many sub-steps before the player next sits at the table.
 */
export const MEETINGS_PER_YEAR = 8

/** Internal sub-steps simulated between two consecutive meetings. */
export const SUBSTEPS_PER_MEETING = 4

/** Simulated years covered by one meeting interval. */
export const YEARS_PER_MEETING = 1 / MEETINGS_PER_YEAR

/** Simulated years covered by one internal sub-step. Roughly 11 days. */
export const DT = YEARS_PER_MEETING / SUBSTEPS_PER_MEETING

/** Sub-steps of history retained for the distributed-lag convolution. */
export const LAG_KERNEL_LENGTH = 72

/** Mandate length in scheduled meetings, per the difficulty design. */
export const MEETING_COUNT: Readonly<Record<Difficulty, number>> = {
  easy: 8, // one-year training mandate
  medium: 16, // two-year mandate
  hard: 32, // four-year full mandate
}

/**
 * Shape of the policy transmission kernel, per difficulty.
 *
 * `peakSubsteps` is where the impulse response to a rate change peaks, and
 * `scale` controls how spread out the response is.
 *
 * These are calibrated on the *ratio* between the mandate and the lag, not on
 * the lag alone. What matters for playability is how many
 * decision -> effect -> correction loops a player can close before the mandate
 * ends:
 *
 *     loops ~= meetingCount / (peak lag in meetings + publication lag)
 *
 * Below three or four loops, skill stops being legible: the consequence of a
 * decision lands after the mandate is over. The values below hold that count
 * at roughly three to four across all three difficulties.
 *
 * So difficulty does not change how many chances the player gets. It changes
 * whether they can react or must anticipate: at a meeting and a half, easy is
 * a reacting game; at seven meetings, hard is realistic and the only workable
 * strategy is to act on the forecast rather than on the published present.
 *
 * See docs/BALANCE.md for the derivation and the loop-count table.
 */
export const LAG_KERNEL: Readonly<
  Record<Difficulty, { readonly peakSubsteps: number; readonly scale: number }>
> = {
  // 1.5 meetings, about 10 weeks. 8 meetings / 2.5 ~= 3.2 loops.
  easy: { peakSubsteps: 6, scale: 2 },
  // 3.5 meetings, about 5 months. 16 meetings / 4.5 ~= 3.6 loops.
  medium: { peakSubsteps: 14, scale: 4.5 },
  // 7 meetings, about 10 months: the realistic figure. 32 / 8 = 4 loops.
  hard: { peakSubsteps: 28, scale: 9 },
}
