/** The two playable institutions. They differ in mandate, tools and scoring. */
export type Institution = 'fed' | 'ecb'

/** Difficulty changes the decision problem, not just the damage multiplier. */
export type Difficulty = 'easy' | 'medium' | 'hard'

/**
 * Future-mode extension point. Only 'fictional' is implemented in the MVP;
 * the other members exist so scenario providers can be added without
 * reshaping the engine's public types.
 */
export type GameMode = 'fictional' | 'historical' | 'alternate_history'

/** Everything needed to reproduce a run, together with the ordered decisions. */
export interface RunConfig {
  readonly simulationVersion: string
  readonly institution: Institution
  readonly difficulty: Difficulty
  readonly seed: string
  readonly mode: GameMode
  /** Number of scheduled policy meetings in this mandate. */
  readonly meetingCount: number
}

/**
 * Recorded whenever a computed value had to be clamped back into its
 * documented safety bounds, or came out non-finite.
 *
 * Clamping keeps the simulation running, but instability is never hidden:
 * these entries are surfaced in the developer tooling and the postmortem.
 */
export interface DiagnosticEvent {
  /** Internal step index at which the clamp fired. */
  readonly step: number
  readonly variable: string
  readonly rawValue: number
  readonly clampedValue: number
  readonly kind: 'min' | 'max' | 'non_finite'
}

/** A discrete time position inside a run. */
export interface TimePosition {
  /** Number of policy meetings already held. */
  readonly meetingIndex: number
  /** Number of internal sub-steps elapsed since the start of the run. */
  readonly stepIndex: number
  /** Elapsed simulated time, in years. */
  readonly timeYears: number
}
