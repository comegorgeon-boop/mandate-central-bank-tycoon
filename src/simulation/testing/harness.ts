import type { Difficulty, Institution, RunConfig } from '../types/core.ts'
import type { SeriesId } from '../types/observation.ts'
import type { PolicyPackage } from '../types/policy.ts'
import type { LatentState, SimulationState } from '../types/state.ts'
import { SIMULATION_VERSION } from '../version.ts'
import { getDifficulty } from '../config/difficulty.ts'
import { advanceTrueState } from '../engine/advanceTrueState.ts'
import { applyPolicyPackage } from '../engine/applyPolicyPackage.ts'
import { createInitialState, createRunConfig } from '../engine/initialState.ts'
import { getSeries } from '../observation/series.ts'

/**
 * Shared helpers for the simulation test suite.
 *
 * Not imported by application code and not part of the shipped bundle.
 *
 * The important helper here is `playWithoutEvents`. Every sub-step consumes a
 * fixed number of random draws regardless of what the player did, so two runs
 * that share a seed and skip event resolution see *identical* shock
 * sequences. Differencing a treatment run against a control run therefore
 * isolates the effect of policy exactly, with no noise left over — which is
 * what makes the lag and shock-response tests sharp rather than statistical.
 */

/** A meeting at which the committee changes nothing and says nothing. */
export const HOLD: PolicyPackage = { actions: [], communication: null }

export function testConfig(
  institution: Institution,
  difficulty: Difficulty,
  seed: string,
): RunConfig {
  return createRunConfig({
    institution,
    difficulty,
    seed,
    simulationVersion: SIMULATION_VERSION,
  })
}

/** A package that moves the policy rate by `basisPoints` and nothing else. */
export function rateMove(basisPoints: number): PolicyPackage {
  return {
    actions: [{ instrument: 'policy_rate', magnitude: basisPoints }],
    communication: null,
  }
}

/** `count` consecutive meetings of holding. */
export function holds(count: number): PolicyPackage[] {
  return Array.from({ length: count }, () => HOLD)
}

/**
 * Plays a scripted sequence of meetings with procedural events switched off.
 *
 * Deliberately bypasses `submitMeeting`: event selection depends on the state,
 * so leaving events on would let a treatment run and its control diverge for
 * reasons unrelated to the mechanism under test.
 */
export function playWithoutEvents(
  config: RunConfig,
  packages: readonly PolicyPackage[],
  seedState?: (latent: LatentState) => LatentState,
): SimulationState {
  // { openingEvent: false }: this harness isolates a mechanism by keeping the
  // treatment and control identical apart from the packages played, so the
  // easy-mode opening crisis — a real but deliberately one-off, scripted
  // narrative beat — must stay out of it exactly like every other event.
  const initial = createInitialState(config, { openingEvent: false })
  let state = seedState
    ? {
        ...initial,
        latent: seedState(initial.latent),
        history: [
          {
            meetingIndex: 0,
            timeYears: 0,
            latent: seedState(initial.latent),
          },
        ],
      }
    : initial

  for (const pkg of packages) {
    const applied = applyPolicyPackage(state, pkg)
    if (!applied.ok) {
      throw new Error(
        `Test package rejected at meeting ${state.meetingIndex}: ` +
          applied.validation.rejections.map((r) => r.message).join(' '),
      )
    }
    state = advanceTrueState(applied.state)
  }

  return state
}

/** The latent value of one field at each meeting of a finished run. */
export function pathOf(
  state: SimulationState,
  field: keyof LatentState,
): number[] {
  return state.history.map((snapshot) => snapshot.latent[field])
}

/** Element-wise difference between a treatment path and its control. */
export function difference(
  treatment: readonly number[],
  control: readonly number[],
): number[] {
  return treatment.map((value, index) => value - control[index])
}

/**
 * Perceptibility: stating effect sizes in units of the noise they hide behind.
 *
 * An assertion like `expect(coreEffect[8]).toBeLessThan(-0.02)` looks like it
 * protects the player's ability to read their own policy. It does not. Core
 * inflation is published with a measurement error of 0.07pp on easy, so an
 * 0.02pp effect is invisible by construction: the test passes on an economy in
 * which the instrument does not work.
 *
 * That is not hypothetical — it is how the easy-mode transmission deadlock
 * survived review. See docs/BALANCE.md.
 *
 * So every assertion about whether an effect is visible or negligible is
 * written here in multiples of that series' own published error, and never as
 * a bare number.
 */

/**
 * Standard deviation of the error on the number the player actually reads.
 *
 * Combines the two errors a first print carries: measurement noise, scaled by
 * the difficulty, and the revision bias that a later vintage will correct.
 * `generateObservation` publishes the first of these to the panel as
 * `uncertainty`; the player reads a number carrying both.
 */
export function publishedNoiseSd(seriesId: SeriesId, difficulty: Difficulty): number {
  const series = getSeries(seriesId)
  if (!series) throw new Error(`unknown series: ${seriesId}`)
  const config = getDifficulty(difficulty)
  const noise = series.baseNoiseSd * config.observationNoiseScale
  const bias = series.baseRevisionSd * config.revisionScale
  return Math.sqrt(noise * noise + bias * bias)
}

/**
 * How many published standard deviations an effect must clear before a player
 * can tell it apart from measurement error.
 *
 * Three is the usual convention for a signal against a normal error, and it is
 * deliberately demanding: this is the number that decides whether a decision is
 * legible inside a mandate, which is the whole design question of this game.
 */
export const READABLE_MULTIPLE = 3

/** At or below one standard deviation, an effect is indistinguishable from noise. */
export const INVISIBLE_MULTIPLE = 1

/** The size an effect on `seriesId` must exceed for the player to read it. */
export function readableEffect(seriesId: SeriesId, difficulty: Difficulty): number {
  return READABLE_MULTIPLE * publishedNoiseSd(seriesId, difficulty)
}

/** The size below which an effect on `seriesId` is lost in the noise. */
export function invisibleEffect(seriesId: SeriesId, difficulty: Difficulty): number {
  return INVISIBLE_MULTIPLE * publishedNoiseSd(seriesId, difficulty)
}

/**
 * The series the readability rule governs.
 *
 * These are the numbers the player is expected to steer by, so a policy effect
 * that never clears their noise is an instrument that does not work.
 *
 * `output_gap_estimate` is deliberately **not** on this list. It is the one
 * series the design intends to be unreadable — potential output is inferred,
 * not measured, and drowning the real-time gap in noise is what reproduces the
 * Orphanides critique the engine is built around. Requiring a policy effect to
 * clear *its* noise would demand a 2.9pp move on easy and destroy the
 * information problem. `the output gap is deliberately unreadable` in
 * transmission.test.ts pins that exclusion so it stays a decision rather than
 * an oversight.
 */
export const STEERING_SERIES: readonly SeriesId[] = [
  'headline_inflation',
  'core_inflation',
  'unemployment',
]
