import type { Difficulty, Institution } from './core.ts'
import type { LatentState } from './state.ts'

/** Every field of LatentState is a number, so any of them can be nudged. */
export type EffectTarget = keyof LatentState

export type EventFamily =
  | 'energy_commodity'
  | 'productivity'
  | 'supply_chain'
  | 'fiscal'
  | 'banking'
  | 'housing'
  | 'geopolitical'
  | 'exchange_rate'
  | 'wages'
  | 'data_revision'
  | 'communication'
  | 'market_cycle'
  | 'natural_disaster'
  | 'innovation'
  // ---- Major event families ------------------------------------------------
  | 'geopolitical_crisis'
  | 'domestic_political'
  | 'banking_failure'
  | 'housing_crash'
  | 'supply_rupture'
  | 'market_panic'

/** An additive nudge to one latent variable. */
export interface EventEffect {
  readonly variable: EffectTarget
  readonly delta: number
}

/**
 * Effects that land later.
 *
 * The delay is expressed in internal sub-steps, not meetings, so a delayed
 * consequence arrives part-way between two meetings rather than snapping into
 * place exactly when the player next sits down.
 */
export interface DelayedEffectSpec {
  readonly delaySteps: number
  readonly effects: readonly EventEffect[]
}

/**
 * Read-only view of the run handed to an event's eligibility and weight
 * functions. Deliberately contains no randomness: whether an event *can*
 * happen and how likely it is must be a pure function of the economy, so the
 * same state always presents the same menu of possibilities.
 */
export interface EventContext {
  readonly latent: LatentState
  readonly institution: Institution
  readonly difficulty: Difficulty
  readonly meetingIndex: number
  readonly meetingCount: number
  readonly stepIndex: number
  /** How many times each event has already fired in this run. */
  readonly occurrences: Readonly<Record<string, number>>
  /** Meeting index at which each event last fired, or -1. */
  readonly lastOccurrence: Readonly<Record<string, number>>
  /** Follow-up event ids unlocked by events that already fired. */
  readonly unlockedFollowUps: readonly string[]
}

/**
 * A procedural event template.
 *
 * Effects are functions of the context, not fixed constants, so the same
 * event interacts differently with a fragile economy and a resilient one.
 */
export interface GameEvent {
  readonly id: string
  readonly family: EventFamily
  readonly title: string
  /** Fictional newswire headline. Always labelled fictional in the UI. */
  readonly newswire: string
  /**
   * Visible clue published one meeting before the event can fire, when the
   * engine draws it as an upcoming risk. Null for genuinely unforeseeable
   * events.
   */
  readonly clue: string | null
  readonly institutions: readonly Institution[]
  readonly minDifficulty: Difficulty
  /**
   * Ceiling symmetric to `minDifficulty`: undefined means no ceiling. Used to
   * scope a batch of content to a single difficulty (the major events are
   * `minDifficulty: 'easy', maxDifficulty: 'easy'`) without touching the
   * catalog or balance of the difficulties either side of it.
   */
  readonly maxDifficulty?: Difficulty
  /** Base selection weight before the state-dependent multiplier. */
  readonly baseWeight: number
  /** Meetings that must pass before this event can fire again. */
  readonly cooldownMeetings: number
  readonly maxOccurrences: number
  /** Hard gate: false means the event cannot fire in this state at all. */
  readonly isEligible: (ctx: EventContext) => boolean
  /** Multiplier on baseWeight. Must be >= 0. */
  readonly weight: (ctx: EventContext) => number
  readonly immediate: (ctx: EventContext) => readonly EventEffect[]
  readonly delayed: (ctx: EventContext) => readonly DelayedEffectSpec[]
  /** Event ids unlocked for later selection once this one fires. */
  readonly followUps: readonly string[]
  /** Only fires if one of these events fired earlier. Empty means no gate. */
  readonly requires: readonly string[]
  /**
   * Marks a mandate-defining crisis rather than routine background noise:
   * rare, large, and given dedicated prominence in the UI instead of being
   * folded into the ordinary newswire list. Undefined means an ordinary
   * (minor) event.
   */
  readonly tier?: 'major'
  /**
   * Scripted follow-up wire lines for a major event, revealed one per meeting
   * after it fires: index 0 one meeting later, index 1 two meetings later,
   * and so on. Purely narrative — the mechanical arc is still carried by
   * `immediate`/`delayed` — so this needs no new engine state: it is derived
   * at read time from how long ago the event's own record fired.
   */
  readonly dispatchLines?: readonly string[]
}

/** An effect queued to fire at a future internal sub-step. */
export interface PendingEventEffect {
  readonly eventId: string
  readonly fireAtStep: number
  readonly effects: readonly EventEffect[]
}

/** What actually happened, kept for the newswire and the postmortem. */
export interface ResolvedEventRecord {
  readonly eventId: string
  readonly family: EventFamily
  readonly meetingIndex: number
  readonly title: string
  readonly newswire: string
  readonly immediate: readonly EventEffect[]
  readonly delayedStepDelays: readonly number[]
}

/** Outcome of one call to resolveEvent. */
export interface EventResolution {
  readonly state: import('./state.ts').SimulationState
  readonly resolved: readonly ResolvedEventRecord[]
  /** Clues to publish for risks that may materialise at the next meeting. */
  readonly clues: readonly string[]
}
