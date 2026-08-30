/**
 * Version of the simulation engine.
 *
 * Bump this whenever a change would make a previously recorded run replay
 * differently: model coefficients, the order in which random draws are
 * consumed, the state layout, event definitions, or end-condition thresholds.
 *
 * Local records are bucketed by this value, so runs produced by different
 * engine versions are never compared against each other.
 */
export const SIMULATION_VERSION = '1.1.0'

/**
 * Version of the scoring formula only.
 *
 * Kept separate from SIMULATION_VERSION so the post-mandate report can state
 * which formula produced a stored score even if the engine itself moved on.
 */
export const SCORING_VERSION = '1.0.0'
