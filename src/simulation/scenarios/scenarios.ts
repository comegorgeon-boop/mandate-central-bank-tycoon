import type { DifficultyConfig } from '../config/difficulty.ts'
import type { ThresholdSet } from '../config/thresholds.ts'
import type { RunConfig } from '../types/core.ts'
import type { Scenario, ScenarioId } from '../types/scenario.ts'
import { getDifficulty } from '../config/difficulty.ts'
import { getInstitution } from '../config/institutions.ts'
import { THRESHOLDS } from '../config/thresholds.ts'
import { GREAT_CONTRACTION_1929 } from './greatContraction.ts'
import { VOLCKER_1979 } from './volcker.ts'
import { LEHMAN_2008 } from './lehman.ts'
import { EURO_CRISIS_2010 } from './euroCrisis.ts'
import { TRANSITORY_ECB_2021, TRANSITORY_FED_2021 } from './transitory.ts'

/**
 * The scenario registry, and the two places a scenario reaches the engine.
 *
 * Deliberately two and no more. A scenario replaces the **opening state**,
 * which becomes a sourced table rather than a seeded draw, and the
 * **measurement regime**, which becomes what was knowable in that year rather
 * than a difficulty setting. Everything else it inherits from the difficulty
 * profile it names, so a new scenario is a data file and not a second copy of
 * the balance sheet of constants.
 */

/**
 * In chronological order, which is also the order they appear on the setup
 * screen.
 *
 * Not in order of difficulty, deliberately — these are not rungs. 1929 is the
 * hardest of them and comes first because it happened first, and a player who
 * opens it and loses has learned the thing it teaches.
 */
export const SCENARIOS: readonly Scenario[] = [
  GREAT_CONTRACTION_1929,
  VOLCKER_1979,
  LEHMAN_2008,
  EURO_CRISIS_2010,
  TRANSITORY_FED_2021,
  TRANSITORY_ECB_2021,
]

export function getScenario(id: ScenarioId): Scenario {
  const scenario = SCENARIOS.find((entry) => entry.id === id)
  if (scenario === undefined) {
    throw new Error(`Unknown scenario: ${id}`)
  }
  return scenario
}

/** The scenario a run is playing, if it is playing one. */
export function scenarioOf(config: RunConfig): Scenario | null {
  return config.scenario === null ? null : getScenario(config.scenario)
}

/**
 * The measurement regime in force: the difficulty's, or the year's.
 *
 * This is the whole of "difficulty is what was known at the time". The
 * scenario overrides the five measurement scales and nothing else; the
 * instrument ranges, the information ladder and the scoring weights still come
 * from the difficulty profile the scenario names, because those are rules of
 * the game rather than facts about the statistical system of 1979.
 */
export function measurementRegime(config: RunConfig): DifficultyConfig {
  const difficulty = getDifficulty(config.difficulty)
  const scenario = scenarioOf(config)
  if (scenario === null) return difficulty
  const { measurement } = scenario
  return {
    ...difficulty,
    observationNoiseScale: measurement.observationNoiseScale,
    revisionScale: measurement.revisionScale,
    missingObservationProbability: measurement.missingObservationProbability,
    publicationLagRelief: measurement.publicationLagRelief,
    forecastUncertaintyScale: measurement.forecastUncertaintyScale,
    // Not a measurement scale, but it travels with them: a scenario whose
    // weather the modern processes get wrong says so here. See
    // `Scenario.shockScale`.
    shockScale: scenario.shockScale ?? difficulty.shockScale,
    eventProbability: scenario.eventProbability ?? difficulty.eventProbability,
    eventSeverityScale:
      scenario.eventSeverityScale ?? difficulty.eventSeverityScale,
  }
}

/**
 * The failure thresholds in force: the calibrated ones, or the year's.
 *
 * Merged family by family, so a scenario overrides the two or three figures
 * that would otherwise describe its opening situation as already lost and
 * inherits every other catastrophe unchanged. A scenario that quietly relaxed
 * the banking or dismissal thresholds along with the inflation one would be
 * making the past safer in order to make its own crisis legible, which is the
 * opposite of the point.
 */
export function thresholdsFor(config: RunConfig): ThresholdSet {
  const scenario = scenarioOf(config)
  if (scenario === null) return THRESHOLDS
  const merged: Record<string, Record<string, number>> = {}
  for (const [family, values] of Object.entries(THRESHOLDS)) {
    const override = (scenario.thresholds as Record<string, Record<string, number>>)[
      family
    ]
    merged[family] = { ...values, ...override }
  }
  return merged as unknown as ThresholdSet
}

/**
 * The objective in force: the institution's, or the year's.
 *
 * Added for 1929-33, which needs it more than any other scenario needs
 * anything. **The Federal Reserve of 1929 had no inflation target**, and the
 * objective it did have was the opposite shape: a dollar convertible into a
 * fixed weight of gold, which is a commitment to a stable *price level* rather
 * than to a rate of change. Running that mandate against a 2 % target is not a
 * small anachronism — it is the difference between a policy that was
 * catastrophically tight and one that looks mildly loose, because every
 * expectations block in this engine pulls inflation toward the objective and a
 * 2 % objective in 1931 pulls it *up* out of a 10 % deflation.
 *
 * Measured before it existed: the 1929 scenario's model inflation ended the
 * mandate at +2.7 % against the -9.35 % that printed, and its peak was +4.0 %
 * against a historical maximum of 1.17 %. The sign was wrong, not the
 * magnitude.
 *
 * Every other scenario inherits its institution's 2 %, which is the right
 * answer for all five of them — the Federal Reserve of 1979 had no numerical
 * target either, but it had an unambiguous direction and 2 % is where the
 * disinflation was aimed.
 */
export function inflationTargetFor(config: RunConfig): number {
  const scenario = scenarioOf(config)
  if (scenario?.inflationTarget !== undefined) return scenario.inflationTarget
  return getInstitution(config.institution).inflationTarget
}

/**
 * The sustainable rate of unemployment this mandate is read against.
 *
 * The institution's, or — in a historical mandate — the one the scenario
 * opened on. Needed for the same reason `inflationTargetFor` is: half a dozen
 * screens quote "the sustainable rate" and every one of them was reading the
 * institution's own base value, so the 1929 mandate, which opens at a natural
 * rate of 3.2 %, told the player its sustainable rate was 4.2 % and drew the
 * dashed line there.
 *
 * It is the *opening* value rather than the live latent one on purpose: the
 * natural rate drifts with hysteresis during a long slump, and a reference
 * line that moved with it would quietly redefine success as the recession
 * deepened.
 */
export function sustainableRateFor(config: RunConfig): number {
  const scenario = scenarioOf(config)
  if (scenario !== null) return scenario.opening.naturalUnemployment
  return getInstitution(config.institution).initial.naturalUnemployment
}

/**
 * How the rate instrument is named in this mandate.
 *
 * Null outside a scenario. The Federal Reserve of 1929 did not have a federal
 * funds target range — the funds market barely existed and the rate it
 * announced was the discount rate — and the desk called it one, which is the
 * kind of error this whole document exists to stop.
 */
export function rateInstrumentLabel(config: RunConfig): string | null {
  return scenarioOf(config)?.rateLabel ?? null
}

/** Per-meeting move limits in force, if the year needs its own. */
export function instrumentRangesFor(
  config: RunConfig,
): Scenario['instrumentRanges'] | undefined {
  return scenarioOf(config)?.instrumentRanges
}

/** How a meeting is labelled: a real date in a scenario, a number otherwise. */
export function meetingLabel(config: RunConfig, meetingIndex: number): string | null {
  const scenario = scenarioOf(config)
  return scenario?.calendar[meetingIndex]?.label ?? null
}
