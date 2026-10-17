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

/**
 * Hard's mandate length, which is most of hard's difficulty.
 *
 * Measured, not chosen, and the measurement is the reason this is a named
 * constant instead of a literal in the table below: a longer mandate is more
 * chances to meet a catastrophe, so length and shock severity are two settings
 * of the same dial and moving one without the other silently retunes the mode.
 * `src/simulation/dev/hardLength.ts` re-measures the whole table in a minute.
 *
 * | scheduled meetings | fed completes | ecb completes |
 * | --- | --- | --- |
 * | 32 | 57 % | 61 % |
 * | 28 | 63 % | 71 % |
 * | 24 | 69 % | 74 % |
 * | 20 | 80 % | 81 % |
 * | 16 | 86 % | 87 % |
 *
 * Four years was the realistic figure and the player's reason for not playing
 * it: *"it's too long."* Twenty-four meetings is three years — still a full
 * term, still four decision-to-effect-to-correction loops at hard's seven
 * meeting transmission lag, and twelve fewer screens of it. The twelve points
 * of completion that cutting it buys are given back in
 * `config/difficulty.ts`, where hard's events are correspondingly more frequent
 * and more severe: at 24 meetings with that compensation, the fed completes
 * 63 % and the ecb 62 %, against 57 % and 61 % over the old four years.
 *
 * So: shorter, and as hard. **To put four years back, set this to 32 and
 * restore `eventProbability` to 0.7 and `eventSeverityScale` to 1.35.** The two
 * belong together and the revert is one line each.
 */
export const HARD_MANDATE_MEETINGS = 24

/** Mandate length in scheduled meetings, per the difficulty design. */
export const MEETING_COUNT: Readonly<Record<Difficulty, number>> = {
  // Eighteen months. Was one year, which was simply too short for a decision
  // problem about inflation: even with the transmission recalibrated, twelve
  // meetings is the point at which maximum tightening can just close a typical
  // opening miss. Easy is a tutorial and must be winnable, so the mandate has
  // to be at least as long as the instrument takes to work.
  easy: 12,
  medium: 16, // two-year mandate
  hard: HARD_MANDATE_MEETINGS, // three-year full term, with the shocks to match
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
  // 7 meetings, about 10 months: the realistic figure. 24 / 8 = 3 loops, the
  // bottom of the workable band — which is the price of the shorter term and
  // the reason hard is still the mode where the only strategy is to act on the
  // forecast rather than on the published present.
  hard: { peakSubsteps: 28, scale: 9 },
}
