import type { Difficulty } from '../types/core.ts'
import type { ShockCharacter } from '../types/events.ts'
import { MEETING_COUNT } from './time.ts'

/**
 * Difficulty changes the decision problem, not just the damage multiplier.
 *
 * Easy gives the player a mostly visible state with short, legible lags.
 * Hard forces inference: noisier and later data, larger revisions, occasional
 * missing releases, longer and more dispersed transmission lags, bigger and
 * more frequent shocks, and a stricter credibility system.
 *
 * The axis added last is the most important one, and it is about *what problem
 * is set* rather than how well it can be seen. Before it existed, the six
 * mandate-opening crises were drawn uniformly and two of them were pure
 * cost-push, so a third of easy mandates opened on stagflation — the hardest
 * problem in monetary policy, served in the tutorial. Measured over 200 seeds
 * of competent play, the *draw* decided more than half the final score before
 * the player's first decision: on ecb/easy a supply opener scored 3117 against
 * 7039 for a political one, and beat doing nothing by only 300 points, because
 * under a cost-push shock there is genuinely almost nothing policy can do.
 * `shockMix`, `costPushCeiling` and `openingCrisisCharacters` below are what
 * make the *kind* of shock a property of the difficulty rather than of luck.
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
   * Multiplier on the selection weight of each kind of shock.
   *
   * Zero silences a character outright; one leaves the catalog's own weights
   * alone. This is the difficulty's answer to "what am I being asked to
   * solve", and it is deliberately a weight rather than a filter, so a rare
   * supply shock on easy is still possible — it is the *diet* of them that
   * changes, not their existence.
   */
  readonly shockMix: Readonly<Record<ShockCharacter, number>>
  /**
   * Outstanding cost-push pressure above which no further *adverse* supply
   * event may fire, in units of `latent.supplyShock`.
   *
   * The player's report was "massive energy inflation, then a simultaneous
   * supply shock, unemployment gone, no playable move". Measured, 35-38 % of
   * easy runs fired two cost-push events within two meetings — so simultaneity
   * was the modal outcome of an unconstrained draw, not bad luck. This is the
   * guard, and it is stated against the *economy* rather than against the
   * event log for the same reason every other eligibility rule is: whether an
   * event can happen must be a pure function of the state, so the same economy
   * always presents the same menu. It clears itself as the shock decays, and
   * it never blocks *relieving* supply news — good news that needs permission
   * to happen is not good news the player will ever meet.
   *
   * `Infinity` removes the guard, which is what hard mode wants: shocks that
   * pile onto one another are its whole subject.
   */
  readonly costPushCeiling: number
  /**
   * Which kinds of crisis may open the mandate, or null for no scripted
   * opener.
   *
   * Easy opens on a healthy economy broken by a named event (see
   * `events/openingCrisis.ts`) so the player sees the baseline, sees the
   * cause, and knows what to repair — but only from the characters where a
   * repair exists. The two supply majors are excluded here rather than
   * removed from the catalog: they can still be drawn later in an easy
   * mandate, once the player has had meetings to learn the instrument on a
   * problem it can actually solve.
   */
  readonly openingCrisisCharacters: readonly ShockCharacter[] | null
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
  /**
   * Whether the shock in progress is named outright.
   *
   * The evidence that identifies a shock is published at every difficulty; only
   * the name is withheld. That ordering is deliberate — a player who learned
   * the name without the evidence would have learned nothing transferable.
   */
  readonly namesShocks: boolean
  /**
   * Whether the staff put a recommendation to the committee before it decides.
   *
   * At easy the rule is reliable. When the higher difficulties are built it
   * stays on the same noisy published data as the player, so it becomes a
   * fallible colleague rather than an oracle that has to be taken away.
   */
  readonly showsStaffRecommendation: boolean
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
    // The mode where you learn that the instrument works. Demand shocks in a
    // large majority, because they are the ones a rate move addresses whole:
    // prices and activity move together, so there is a right answer and the
    // player can see it arrive. Supply is not removed — meeting one eventually
    // is the point of the ladder — but at a quarter weight it is a rare,
    // isolated visitor rather than the mandate's subject.
    shockMix: { demand: 1.6, supply: 0.25, financial: 1, institutional: 1 },
    // Roughly two thirds of a single minor energy spike's opening move (1.6):
    // one cost-push shock may be outstanding, a second may not land on top.
    costPushCeiling: 1.0,
    openingCrisisCharacters: ['demand', 'financial'],
    clueThreshold: 0.1,
    credibilitySensitivity: 0.7,
    thresholdLeniency: 1.45,
    breachPatience: 1,
    scoreMultiplier: 0.85,
    showsPolicyHints: true,
    namesShocks: true,
    showsStaffRecommendation: true,
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
    // The mode where you discover the trade-off. The catalog's own weights,
    // untouched, so the first real supply shock arrives here and the two
    // halves of the mandate pull against each other for the first time.
    shockMix: { demand: 1, supply: 1, financial: 1, institutional: 1 },
    // Well above a single spike, so a second cost-push shock can land while
    // the first is still working through — but not while the economy is
    // already carrying two. Stagflation is medium's lesson, not its diet.
    costPushCeiling: 3.0,
    openingCrisisCharacters: null,
    clueThreshold: 0.15,
    credibilitySensitivity: 1.0,
    thresholdLeniency: 1.0,
    breachPatience: 0,
    scoreMultiplier: 1.0,
    showsPolicyHints: false,
    namesShocks: false,
    showsStaffRecommendation: false,
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
    // The real job. Supply weighted above everything else and no ceiling on
    // how much cost-push can be outstanding at once, so shocks pile onto one
    // another and the mandate is decided on how the expectations anchor is
    // defended rather than on whether inflation was returned to target.
    shockMix: { demand: 1, supply: 1.5, financial: 1.2, institutional: 1.2 },
    costPushCeiling: Number.POSITIVE_INFINITY,
    openingCrisisCharacters: null,
    clueThreshold: 0.22,
    credibilitySensitivity: 1.35,
    thresholdLeniency: 0.82,
    breachPatience: 0,
    scoreMultiplier: 1.15,
    showsPolicyHints: false,
    namesShocks: false,
    showsStaffRecommendation: false,
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
