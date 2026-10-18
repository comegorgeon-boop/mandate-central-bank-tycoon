import type { DiagnosticEvent } from '../types/core.ts'
import type { PendingEventEffect, ResolvedEventRecord } from '../types/events.ts'
import type { SimulationState } from '../types/state.ts'
import { clampLatentState } from '../config/bounds.ts'
import { applyEffects } from '../engine/advanceTrueState.ts'
import { scenarioOf } from './scenarios.ts'

/**
 * The events that happened on a date.
 *
 * Applied before the procedural draw and without consuming any randomness,
 * because they are not chances: the Credit Control Act was invoked in March
 * 1980 on every seed, and a 1980 without it is not 1980.
 *
 * They land in `eventLog` in the ordinary shape, which matters for more than
 * tidiness: the counterfactual arms and the doctrine trials replay a meeting's
 * events *verbatim* from that log, so a scripted event carried in a parallel
 * structure would simply vanish from every alternative world the game computes
 * and every comparison drawn from them would be wrong.
 *
 * Severity is **not** scaled by difficulty. A difficulty multiplier on a dated
 * historical event would be making the past worse to make the game harder,
 * which is the one thing a scenario must not do.
 */
export function applyScheduledEvents(state: SimulationState): {
  readonly state: SimulationState
  readonly resolved: readonly ResolvedEventRecord[]
} {
  const scenario = scenarioOf(state.config)
  if (scenario === null) return { state, resolved: [] }

  const due = scenario.events.filter(
    (event) => event.meetingIndex === state.meetingIndex,
  )
  if (due.length === 0) return { state, resolved: [] }

  const diagnostics: DiagnosticEvent[] = [...state.diagnostics]
  const pending: PendingEventEffect[] = []
  const resolved: ResolvedEventRecord[] = []
  let latent = state.latent

  for (const event of due) {
    latent = clampLatentState(
      applyEffects(latent, event.immediate),
      state.stepIndex,
      diagnostics,
    )

    const queued: PendingEventEffect[] = event.delayed.map((spec) => ({
      eventId: event.id,
      fireAtStep: state.stepIndex + spec.delaySteps,
      effects: spec.effects,
    }))
    pending.push(...queued)

    resolved.push({
      eventId: event.id,
      family: event.family,
      meetingIndex: state.meetingIndex,
      title: event.title,
      newswire: event.newswire,
      immediate: event.immediate,
      delayedStepDelays: event.delayed.map((spec) => spec.delaySteps),
      delayed: queued.map((entry) => ({
        fireAtStep: entry.fireAtStep,
        effects: entry.effects,
      })),
      members: [],
    })
  }

  return {
    state: {
      ...state,
      latent,
      diagnostics,
      pendingEffects: [...state.pendingEffects, ...pending],
      eventLog: [...state.eventLog, ...resolved],
    },
    resolved,
  }
}

/** Whether a resolved record belongs to a scenario event marked major. */
export function isScheduledMajor(
  state: SimulationState,
  eventId: string,
): boolean {
  const scenario = scenarioOf(state.config)
  return (
    scenario?.events.some((event) => event.id === eventId && event.major) ?? false
  )
}
