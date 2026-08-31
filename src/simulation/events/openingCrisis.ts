import type { DiagnosticEvent } from '../types/core.ts'
import type { GameEvent, PendingEventEffect, ResolvedEventRecord } from '../types/events.ts'
import type { SimulationState } from '../types/state.ts'
import { restorePrng } from '../rng/prng.ts'
import { clampLatentState } from '../config/bounds.ts'
import { getDifficulty } from '../config/difficulty.ts'
import { applyEffects } from '../engine/advanceTrueState.ts'
import { EVENT_CATALOG } from './catalog.ts'
import { buildEventContext, eligibleEvents, scaleEffects } from './resolveEvent.ts'

/**
 * The easy-mode opening crisis.
 *
 * docs/DIRECTION.md's decided-but-unbuilt opening design: easy starts on a
 * healthy economy (see `engine/initialState.ts`'s `OPENING_PERTURBATION_SCALE`)
 * and then a major, named event breaks it before the player's first decision.
 * The player sees the baseline, sees what broke it, and knows what to repair.
 *
 * This cannot be an ordinary event firing through `resolveEvent`, because
 * that only ever runs *between* meetings, inside `submitMeeting` — the
 * player's first meeting would already be over. So this applies a major
 * event's effects directly to the fresh initial state, using the same
 * `applyEffects`/`clampLatentState`/severity-scaling path `resolveEvent` uses
 * and producing the same `ResolvedEventRecord` shape, so everything
 * downstream — occurrences, cooldowns, diagnosis, dispatch lines — treats it
 * exactly like any other firing.
 *
 * Drawn from a *forked* substream (`Prng.fork`), which by design does not
 * consume from the parent. The run's own random sequence — every later
 * event draw, every shock innovation — is therefore completely unaffected by
 * whether an opener fires at all, which is what keeps
 * `testing/harness.ts`'s `playWithoutEvents` calibration tests, and every
 * difficulty other than easy, byte-identical to before this existed.
 */

const OPENING_CRISIS_STREAM = 'opening-crisis'

/** The major events eligible to open an easy mandate. */
export function openingCandidates(
  state: SimulationState,
  catalog: readonly GameEvent[] = EVENT_CATALOG,
): readonly GameEvent[] {
  const ctx = buildEventContext(state)
  return eligibleEvents(ctx, catalog).filter((event) => event.tier === 'major')
}

/**
 * Applies a randomly drawn major event's effects directly to a fresh state,
 * as though it had just fired at meeting 0. A no-op if no major event is
 * eligible (for instance, on a catalog with the majors filtered out).
 */
export function applyOpeningCrisis(
  state: SimulationState,
  catalog: readonly GameEvent[] = EVENT_CATALOG,
): SimulationState {
  const ctx = buildEventContext(state)
  const candidates = openingCandidates(state, catalog)
  if (candidates.length === 0) return state

  const prng = restorePrng(state.rng).fork(OPENING_CRISIS_STREAM)
  const event = prng.pick(candidates)
  if (event === undefined) return state

  const severity = getDifficulty(state.config.difficulty).eventSeverityScale
  const diagnostics: DiagnosticEvent[] = []

  const immediate = scaleEffects(event.immediate(ctx), severity)
  const latent = clampLatentState(
    applyEffects(state.latent, immediate),
    state.stepIndex,
    diagnostics,
  )

  const delayed = event.delayed(ctx)
  const pending: PendingEventEffect[] = delayed.map((spec) => ({
    eventId: event.id,
    fireAtStep: state.stepIndex + spec.delaySteps,
    effects: scaleEffects(spec.effects, severity),
  }))

  const record: ResolvedEventRecord = {
    eventId: event.id,
    family: event.family,
    meetingIndex: state.meetingIndex,
    title: event.title,
    newswire: event.newswire,
    immediate,
    delayedStepDelays: delayed.map((spec) => spec.delaySteps),
  }

  return {
    ...state,
    latent,
    // rng is deliberately left untouched: the draw came from a fork that
    // never consumed from the parent stream.
    pendingEffects: [...state.pendingEffects, ...pending],
    eventLog: [...state.eventLog, record],
    diagnostics:
      diagnostics.length > 0 ? [...state.diagnostics, ...diagnostics] : state.diagnostics,
  }
}
