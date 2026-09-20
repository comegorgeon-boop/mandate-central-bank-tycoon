import type { DifficultyConfig } from '../config/difficulty.ts'
import type { ThresholdSet } from '../config/thresholds.ts'
import type { RunConfig } from '../types/core.ts'
import type { Scenario, ScenarioId } from '../types/scenario.ts'
import { getDifficulty } from '../config/difficulty.ts'
import { THRESHOLDS } from '../config/thresholds.ts'
import { VOLCKER_1979 } from './volcker.ts'

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

export const SCENARIOS: readonly Scenario[] = [VOLCKER_1979]

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
