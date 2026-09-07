import type { Difficulty, Institution } from './core.ts'
import type { LatentState, MemberLatent } from './state.ts'
import type { MemberId } from '../config/members.ts'

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
  // ---- Currency-area families: shocks that fall on part of the area --------
  | 'sovereign'
  | 'labour'
  // ---- Major event families ------------------------------------------------
  | 'geopolitical_crisis'
  | 'domestic_political'
  | 'banking_failure'
  | 'housing_crash'
  | 'supply_rupture'
  | 'market_panic'

/**
 * The kind of *decision problem* an event sets, as distinct from its subject.
 *
 * The family says what happened; this says what it asks of the committee, and
 * it is the axis difficulty is built on. A demand shock moves prices and
 * activity the same way, so one instrument addresses both and there is no
 * trade-off to manage. A supply shock moves them opposite ways, so every
 * available move buys one half of the mandate by selling the other — which is
 * the hardest problem in monetary policy, and exactly what a tutorial must not
 * open with. A financial shock tightens conditions on its own, doing part of
 * policy's work uninvited. An institutional one moves standing, politics or the
 * measurements themselves rather than the economy under them.
 *
 * Declared per event rather than derived, because the derivation would have to
 * guess: a shock is identified by which variables it moves *and* by which way
 * it moves them together, and several events move three or four at once.
 * `events/character.test.ts` checks each declaration against the effects the
 * event actually delivers, so a declaration cannot quietly go stale.
 */
export type ShockCharacter = 'demand' | 'supply' | 'financial' | 'institutional'

export const SHOCK_CHARACTERS: readonly ShockCharacter[] = [
  'demand',
  'supply',
  'financial',
  'institutional',
]

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
  /** The currency area's members. Empty at a single-sovereign institution. */
  readonly members: readonly MemberLatent[]
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
  /**
   * What this asks of the committee. Difficulty is built on this axis: easy
   * suppresses `supply`, medium opens it, hard amplifies it and lets several
   * run at once. See `DifficultyConfig.shockMix`.
   */
  readonly shockCharacter: ShockCharacter
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
  /**
   * Effects that fall on one or two members of a currency area rather than on
   * the area as a whole.
   *
   * The thing that makes a single policy rate hard, and the reason it belongs
   * in the event catalog rather than in the dynamics: a common shock produces
   * a common problem with a common answer, and it is the *asymmetric* one —
   * a gas interruption that reaches the exposed economies and not the others,
   * a sovereign sell-off that finds the indebted one — that puts the chair in
   * the position of setting one rate for members who need different ones.
   *
   * Ignored where the institution has no members, so an event may carry both
   * and stay valid at both institutions.
   */
  readonly memberEffects?: (ctx: EventContext) => readonly MemberShock[]
}

/**
 * Which member a shock lands on.
 *
 * A structural selector wherever the event is *about* a structural property,
 * and an id only where it is genuinely about that member. "The most indebted
 * member" is a description of the economics and stays correct if the profiles
 * are ever retuned; naming a country to carry a story it has no structural
 * reason to carry would be characterising it rather than modelling it.
 */
export type MemberSelector =
  | MemberId
  | 'most_indebted'
  | 'most_industrial'
  | 'most_energy_exposed'
  | 'most_cyclical'
  | 'largest'

export interface MemberShock {
  readonly member: MemberSelector
  /**
   * Offsets are renormalised so the area aggregate moves by exactly this
   * member's weight times the shock; `spread` is a level and moves alone.
   */
  readonly field:
    | 'inflationOffset'
    | 'outputGapOffset'
    | 'unemploymentOffset'
    | 'spread'
  readonly magnitude: number
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
  /**
   * Members this event fell on, if it was asymmetric.
   *
   * Recorded so the press can report *which* member was hit. An asymmetric
   * event reported as an area-wide one is worse than no report: half the area
   * did not experience it, and the whole point of the mechanic is that the
   * chair has to notice who did.
   */
  readonly members?: readonly MemberId[]
}

/** Outcome of one call to resolveEvent. */
export interface EventResolution {
  readonly state: import('./state.ts').SimulationState
  readonly resolved: readonly ResolvedEventRecord[]
  /** Clues to publish for risks that may materialise at the next meeting. */
  readonly clues: readonly string[]
}
