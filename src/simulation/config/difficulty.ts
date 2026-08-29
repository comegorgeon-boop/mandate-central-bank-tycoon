import type { Difficulty } from '../types/core.ts'
import { MEETING_COUNT } from './time.ts'

/**
 * Difficulty changes the decision problem, not just the damage multiplier.
 *
 * Easy gives the player a mostly visible state with short, legible lags.
 * Hard forces inference: noisier and later data, larger revisions, occasional
 * missing releases, longer and more dispersed transmission lags, bigger and
 * more frequent shocks, and a stricter credibility system.
 */
export interface DifficultyConfig {
  readonly id: Difficulty
  readonly meetingCount: number
  /** Multiplier on every stochastic shock innovation. */
  readonly shockScale: number
  /** Multiplier on observation measurement noise. */
  readonly observationNoiseScale: number
  /** Multiplier on the size of data revisions. */
  readonly revisionScale: number
  /** Probability that a lagged statistical release is simply missing. */
  readonly missingObservationProbability: number
  /** Multiplier on the width of forecast fan charts. */
  readonly forecastUncertaintyScale: number
  /** Meetings subtracted from every publication lag. Never below zero. */
  readonly publicationLagRelief: number
  /** Probability that an event fires in a given inter-meeting interval. */
  readonly eventProbability: number
  /** Multiplier on event effect sizes. */
  readonly eventSeverityScale: number
  /**
   * Share of the total event probability mass an upcoming risk must carry
   * before its warning clue is published. Lower means more warnings.
   */
  readonly clueThreshold: number
  /** Multiplier on credibility and trust penalties. */
  readonly credibilitySensitivity: number
  /**
   * Multiplier on failure thresholds. Above 1 means catastrophes need a more
   * extreme economy before they trigger, so easy mode is forgiving.
   */
  readonly thresholdLeniency: number
  /** Extra consecutive meetings a breach must hold before ending the run. */
  readonly breachPatience: number
  /** Modest score multiplier. */
  readonly scoreMultiplier: number
  /** Whether estimated direction-of-effect hints are shown during the run. */
  readonly showsPolicyHints: boolean
  /** Whether a communication package is required at each meeting. */
  readonly requiresCommunication: boolean
}

export const DIFFICULTIES: Readonly<Record<Difficulty, DifficultyConfig>> = {
  easy: {
    id: 'easy',
    meetingCount: MEETING_COUNT.easy,
    shockScale: 0.6,
    observationNoiseScale: 0.35,
    revisionScale: 0.3,
    missingObservationProbability: 0,
    forecastUncertaintyScale: 0.6,
    publicationLagRelief: 1,
    eventProbability: 0.35,
    eventSeverityScale: 0.65,
    clueThreshold: 0.1,
    credibilitySensitivity: 0.7,
    thresholdLeniency: 1.45,
    breachPatience: 1,
    scoreMultiplier: 0.85,
    showsPolicyHints: true,
    requiresCommunication: false,
  },
  medium: {
    id: 'medium',
    meetingCount: MEETING_COUNT.medium,
    shockScale: 1.0,
    observationNoiseScale: 1.0,
    revisionScale: 1.0,
    missingObservationProbability: 0.04,
    forecastUncertaintyScale: 1.0,
    publicationLagRelief: 0,
    eventProbability: 0.55,
    eventSeverityScale: 1.0,
    clueThreshold: 0.15,
    credibilitySensitivity: 1.0,
    thresholdLeniency: 1.0,
    breachPatience: 0,
    scoreMultiplier: 1.0,
    showsPolicyHints: false,
    requiresCommunication: true,
  },
  hard: {
    id: 'hard',
    meetingCount: MEETING_COUNT.hard,
    shockScale: 1.45,
    observationNoiseScale: 1.7,
    revisionScale: 1.8,
    missingObservationProbability: 0.1,
    forecastUncertaintyScale: 1.5,
    publicationLagRelief: 0,
    eventProbability: 0.7,
    eventSeverityScale: 1.35,
    clueThreshold: 0.22,
    credibilitySensitivity: 1.35,
    thresholdLeniency: 0.82,
    breachPatience: 0,
    scoreMultiplier: 1.15,
    showsPolicyHints: false,
    requiresCommunication: true,
  },
}

export function getDifficulty(id: Difficulty): DifficultyConfig {
  return DIFFICULTIES[id]
}

/** Ordering used by instrument availability gates. */
export const DIFFICULTY_ORDER: Readonly<Record<Difficulty, number>> = {
  easy: 0,
  medium: 1,
  hard: 2,
}

/** True when `available` unlocks at or below `current`. */
export function meetsDifficulty(
  current: Difficulty,
  available: Difficulty,
): boolean {
  return DIFFICULTY_ORDER[current] >= DIFFICULTY_ORDER[available]
}
