import type {
  EventContext,
  EventEffect,
  EventResolution,
  GameEvent,
  PendingEventEffect,
  ResolvedEventRecord,
} from '../types/events.ts'
import type { SimulationState } from '../types/state.ts'
import type { DiagnosticEvent } from '../types/core.ts'
import { restorePrng } from '../rng/prng.ts'
import { clampLatentState } from '../config/bounds.ts'
import { DIFFICULTY_ORDER, getDifficulty, meetsDifficulty } from '../config/difficulty.ts'
import { applyEffects } from '../engine/advanceTrueState.ts'
import { EVENT_CATALOG } from './catalog.ts'
import { applyMemberShocks } from './memberShocks.ts'
import { NEUTRAL_BAND, immediateInflationImpulse } from './inflationImpulse.ts'

/**
 * Procedural event resolution.
 *
 * Called once per inter-meeting interval, after the player's package has been
 * applied and before the economy is advanced, so an event lands *between*
 * meetings rather than on top of a decision.
 *
 * Eligibility and weights are pure functions of the economy, so the menu of
 * possible events is a property of the state; only which one is drawn from
 * that menu consumes randomness.
 */

/** Assembles the read-only view handed to event predicates. */
export function buildEventContext(state: SimulationState): EventContext {
  const occurrences: Record<string, number> = {}
  const lastOccurrence: Record<string, number> = {}
  const unlocked = new Set<string>()

  for (const record of state.eventLog) {
    occurrences[record.eventId] = (occurrences[record.eventId] ?? 0) + 1
    lastOccurrence[record.eventId] = record.meetingIndex
    const definition = EVENT_CATALOG.find((event) => event.id === record.eventId)
    for (const followUp of definition?.followUps ?? []) unlocked.add(followUp)
  }

  return {
    latent: state.latent,
    members: state.members,
    institution: state.config.institution,
    difficulty: state.config.difficulty,
    meetingIndex: state.meetingIndex,
    meetingCount: state.config.meetingCount,
    stepIndex: state.stepIndex,
    occurrences,
    lastOccurrence,
    unlockedFollowUps: [...unlocked],
  }
}

/**
 * Whether a second cost-push shock may land on the one already running.
 *
 * Only *adverse* supply events are held back: a relief is the thing that ends
 * the episode, and gating it on the same ceiling would mean the worse the
 * shock the less able the economy is to recover from it. The reading is of
 * what the event delivers on the day, not over its whole arc — see
 * `immediateInflationImpulse`.
 */
function costPushBlocked(event: GameEvent, ctx: EventContext): boolean {
  const ceiling = getDifficulty(ctx.difficulty).costPushCeiling
  if (!Number.isFinite(ceiling)) return false
  if (event.shockCharacter !== 'supply') return false
  if (ctx.latent.supplyShock <= ceiling) return false
  return immediateInflationImpulse(event, ctx) > NEUTRAL_BAND
}

/** Events that could fire in this state, before any random draw. */
export function eligibleEvents(
  ctx: EventContext,
  catalog: readonly GameEvent[] = EVENT_CATALOG,
): readonly GameEvent[] {
  return catalog.filter((event) => {
    if (!event.institutions.includes(ctx.institution)) return false
    if (!meetsDifficulty(ctx.difficulty, event.minDifficulty)) return false
    if (costPushBlocked(event, ctx)) return false
    if (
      event.maxDifficulty !== undefined &&
      DIFFICULTY_ORDER[ctx.difficulty] > DIFFICULTY_ORDER[event.maxDifficulty]
    ) {
      return false
    }

    const seen = ctx.occurrences[event.id] ?? 0
    if (seen >= event.maxOccurrences) return false

    const last = ctx.lastOccurrence[event.id]
    if (last !== undefined && ctx.meetingIndex - last < event.cooldownMeetings) {
      return false
    }

    for (const required of event.requires) {
      if ((ctx.occurrences[required] ?? 0) === 0) return false
    }

    return event.isEligible(ctx)
  })
}

/**
 * Selection weights for a set of eligible events, in the same order.
 *
 * The difficulty's `shockMix` scales each event by what it *asks of the
 * committee* — a demand shock has a right answer, a supply shock has only a
 * choice of which half of the mandate to sacrifice — so the diet of problems
 * a mode serves is a property of the mode rather than of the draw.
 */
function selectionWeights(
  events: readonly GameEvent[],
  ctx: EventContext,
): readonly number[] {
  const mix = getDifficulty(ctx.difficulty).shockMix
  return events.map((event) => {
    const multiplier = event.weight(ctx) * mix[event.shockCharacter]
    return Number.isFinite(multiplier) && multiplier > 0
      ? event.baseWeight * multiplier
      : 0
  })
}

/** Most warning signals published at one meeting. */
const MAX_CLUES = 2

/**
 * How far above a uniform share a risk must stand out before it is flagged.
 *
 * Without this, a meeting with ten roughly equal candidates would publish a
 * warning for every one of them, which is the same as publishing none.
 */
const CLUE_PROMINENCE = 1.6

/**
 * Warning signals for risks that carry enough probability mass to be worth
 * flagging. Deterministic: the player is warned about genuine risk, not by a
 * separate coin flip.
 */
function buildClues(ctx: EventContext, threshold: number): readonly string[] {
  const events = eligibleEvents(ctx)
  const weights = selectionWeights(events, ctx)
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) return []

  // An event has to be both absolutely likely and conspicuous relative to the
  // rest of the field, so a crowded menu of equal risks stays quiet.
  const bar = Math.max(threshold, CLUE_PROMINENCE / events.length)

  return events
    .map((event, index) => ({ clue: event.clue, share: weights[index] / total }))
    .filter((entry) => entry.clue !== null && entry.share >= bar)
    .sort((a, b) => b.share - a.share)
    .slice(0, MAX_CLUES)
    .map((entry) => entry.clue as string)
}

/** Scales an event's effects by the difficulty's severity multiplier. */
export function scaleEffects(
  effects: readonly EventEffect[],
  scale: number,
): readonly EventEffect[] {
  return effects.map((effect) => ({ ...effect, delta: effect.delta * scale }))
}

export function resolveEvent(
  state: SimulationState,
  catalog: readonly GameEvent[] = EVENT_CATALOG,
): EventResolution {
  const difficulty = getDifficulty(state.config.difficulty)
  const prng = restorePrng(state.rng)
  const ctx = buildEventContext(state)

  const candidates = eligibleEvents(ctx, catalog)

  // The draw is consumed unconditionally so that whether an event fires never
  // shifts the random sequence the rest of the run depends on.
  const fires = prng.bernoulli(difficulty.eventProbability)
  const weights = selectionWeights(candidates, ctx)
  const index = prng.weightedIndex(weights)

  if (!fires || index < 0) {
    return {
      state: { ...state, rng: prng.getState() },
      resolved: [],
      clues: buildClues(ctx, difficulty.clueThreshold),
    }
  }

  const event = candidates[index]
  const immediate = scaleEffects(event.immediate(ctx), difficulty.eventSeverityScale)
  const delayed = event.delayed(ctx)

  const diagnostics: DiagnosticEvent[] = []
  // Asymmetric effects first, because each one moves the aggregate too — by
  // exactly that member's weight — and the area-wide effects have to land on
  // top of an aggregate that already reflects them. See `engine/members.ts`
  // for the identity this preserves.
  const asymmetric = applyMemberShocks(
    state.members,
    event.memberEffects?.(ctx) ?? [],
    difficulty.eventSeverityScale,
  )
  const latent = clampLatentState(
    applyEffects(applyEffects(state.latent, asymmetric.aggregate), immediate),
    state.stepIndex,
    diagnostics,
  )

  const pending: PendingEventEffect[] = delayed.map((spec) => ({
    eventId: event.id,
    fireAtStep: state.stepIndex + spec.delaySteps,
    effects: scaleEffects(spec.effects, difficulty.eventSeverityScale),
  }))

  const record: ResolvedEventRecord = {
    eventId: event.id,
    family: event.family,
    meetingIndex: state.meetingIndex,
    title: event.title,
    newswire: event.newswire,
    immediate: [...asymmetric.aggregate, ...immediate],
    delayedStepDelays: delayed.map((spec) => spec.delaySteps),
    // The queue as scaled, so the same world can be replayed without the
    // player's policy in it. See `ResolvedEventRecord.delayed`.
    delayed: pending.map((entry) => ({
      fireAtStep: entry.fireAtStep,
      effects: entry.effects,
    })),
    // Named so the press can report *which* member was hit rather than
    // reporting an area-wide event that half the area did not experience.
    members: asymmetric.hit,
  }

  const nextState: SimulationState = {
    ...state,
    latent,
    members: asymmetric.members,
    rng: prng.getState(),
    pendingEffects: [...state.pendingEffects, ...pending],
    eventLog: [...state.eventLog, record],
    diagnostics:
      diagnostics.length > 0
        ? [...state.diagnostics, ...diagnostics]
        : state.diagnostics,
  }

  return {
    state: nextState,
    resolved: [record],
    clues: buildClues(buildEventContext(nextState), difficulty.clueThreshold),
  }
}
