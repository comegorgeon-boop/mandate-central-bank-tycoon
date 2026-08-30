/**
 * Public API of the simulation engine.
 *
 * This module is framework-independent by contract: nothing under
 * src/simulation/ imports React, touches the DOM, or makes a network call.
 * The interface layer talks to the engine only through what is exported here.
 */

export { SCORING_VERSION, SIMULATION_VERSION } from './version.ts'

export type * from './types/index.ts'

export {
  createPrng,
  hashGaussian,
  hashSeed,
  hashUnit,
  restorePrng,
  type Prng,
  type PrngState,
} from './rng/prng.ts'

// ---- Configuration (read-only; the UI reads labels and bounds from here) ---
export {
  DIFFICULTIES,
  getDifficulty,
  meetsDifficulty,
  type DifficultyConfig,
} from './config/difficulty.ts'
export {
  INSTITUTIONS,
  getInstitution,
  type InstitutionConfig,
} from './config/institutions.ts'
export {
  COMMUNICATION_AVAILABILITY,
  INSTRUMENTS,
  POLICY_RATE_FLOOR,
  availableInstruments,
  getInstrument,
  getInstrumentRange,
} from './config/instruments.ts'
export { LATENT_BOUNDS, isWithinBounds } from './config/bounds.ts'
export {
  DT,
  LAG_KERNEL_LENGTH,
  MEETINGS_PER_YEAR,
  MEETING_COUNT,
  SUBSTEPS_PER_MEETING,
  YEARS_PER_MEETING,
} from './config/time.ts'
export { MAX_SCORE } from './config/scoring.ts'
export {
  GUIDANCE_DELIVERY_TOLERANCE,
  GUIDANCE_HORIZON_MEETINGS,
  THRESHOLDS,
} from './config/thresholds.ts'

// ---- Engine ---------------------------------------------------------------
export {
  createInitialState,
  createRunConfig,
  effectivePolicyRate,
  runSeedString,
} from './engine/initialState.ts'
export { advanceTrueState } from './engine/advanceTrueState.ts'
export {
  applyPolicyPackage,
  detectContradictions,
  validatePolicyPackage,
  type PolicyApplication,
} from './engine/applyPolicyPackage.ts'
export {
  financialConditionsIndex,
  purchaseEffectiveness,
  realPolicyRate,
  realRateGap,
  taylorBenchmark,
  transmissionEfficiency,
  unemploymentGap,
} from './engine/indices.ts'
export { buildLagKernel } from './engine/lags.ts'

// ---- Events ---------------------------------------------------------------
export { EVENT_CATALOG } from './events/catalog.ts'
export { buildEventContext, eligibleEvents, resolveEvent } from './events/resolveEvent.ts'

// ---- Observation ----------------------------------------------------------
export { generateObservation } from './observation/generateObservation.ts'
export { FORECAST_SERIES, SERIES, getSeries, seriesFor } from './observation/series.ts'
export { diagnoseShock } from './observation/diagnose.ts'
export {
  readStance,
  readStanceChange,
  stanceAfterMove,
  type StanceChange,
  type StanceLabel,
  type StanceReading,
} from './observation/stance.ts'

// ---- Policy ---------------------------------------------------------------
export {
  staffRecommendation,
  type StaffRecommendation,
} from './policy/staffRule.ts'

// ---- Scoring --------------------------------------------------------------
export { calculateScore, scoreBucketKey } from './scoring/calculateScore.ts'
export { evaluateEndConditions } from './scoring/endConditions.ts'

// ---- Replay ---------------------------------------------------------------
export {
  configFromLog,
  decodeDecisionLog,
  encodeChallenge,
  encodeDecisionLog,
  type DecisionLog,
  type DecisionLogEntry,
  type DecodeResult,
} from './replay/decisionLog.ts'
export {
  playRun,
  replayRun,
  startRun,
  submitMeeting,
  type MeetingResult,
  type ReplayResult,
  type RunSession,
} from './replay/replayRun.ts'
