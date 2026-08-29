import type { Difficulty, GameMode, Institution } from './core.ts'
import type { GameEvent, EventContext } from './events.ts'
import type { ObservationContext, ObservationSet } from './observation.ts'
import type { LatentState, SimulationState } from './state.ts'

/**
 * Future-mode extension points.
 *
 * These interfaces exist so curated historical scenarios and a local
 * alternate-history mode can be added later without rewriting the simulation
 * core. Nothing in the MVP implements anything other than the built-in
 * fictional provider.
 */

export interface ScenarioMetadata {
  readonly id: string
  readonly mode: GameMode
  readonly title: string
  readonly summary: string
  readonly institution: Institution
  readonly difficulty: Difficulty
  /** Sources shown on the credits page. Empty for fictional scenarios. */
  readonly sources: readonly string[]
}

export interface InitialSimulationState {
  readonly latent: LatentState
  readonly briefing: string
}

export interface ScenarioProvider {
  getScenarioMetadata(): ScenarioMetadata
  createInitialState(seed: string): InitialSimulationState
  getEligibleEvents(context: EventContext): readonly GameEvent[]
}

export interface ObservationProvider {
  getObservation(
    state: SimulationState,
    context: ObservationContext,
  ): ObservationSet
}
