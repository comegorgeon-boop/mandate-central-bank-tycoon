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
 * `scale` controls how spread out the response is. Easy mode peaks early with
 * a narrow kernel so effects are legible; hard mode peaks about a year out
 * with a broad kernel, so the player must anticipate rather than react.
 */
export const LAG_KERNEL: Readonly<
  Record<Difficulty, { readonly peakSubsteps: number; readonly scale: number }>
> = {
  easy: { peakSubsteps: 14, scale: 5 }, // peak near 5 months
  medium: { peakSubsteps: 22, scale: 7 }, // peak near 8 months
  hard: { peakSubsteps: 30, scale: 9 }, // peak near 11 months
}
