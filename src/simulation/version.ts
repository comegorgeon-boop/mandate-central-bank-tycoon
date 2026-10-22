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
export const SIMULATION_VERSION = '1.3.0'

/**
 * Version of the scoring formula only.
 *
 * Kept separate from SIMULATION_VERSION so the post-mandate report can state
 * which formula produced a stored score even if the engine itself moved on.
 *
 * **2.0.0: the score is the banked total.** It was `calculateScore`'s graded
 * total, which under a survival structure rewards an early exit — see
 * `scoring/theScore.ts` for the decision and the numbers behind it. A major
 * bump because a stored 1,741 and a stored 5,437 are now the same mandate
 * measured two different ways, and a records page that compared them would be
 * a leaderboard of which build each run happened to be played on.
 */
export const SCORING_VERSION = '2.0.0'
