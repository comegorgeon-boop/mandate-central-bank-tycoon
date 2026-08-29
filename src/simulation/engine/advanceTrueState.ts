import type { DiagnosticEvent } from '../types/core.ts'
import type { EventEffect, PendingEventEffect } from '../types/events.ts'
import type { LatentState, SimulationState } from '../types/state.ts'
import { restorePrng } from '../rng/prng.ts'
import { clampLatentState } from '../config/bounds.ts'
import { getDifficulty } from '../config/difficulty.ts'
import { getInstitution } from '../config/institutions.ts'
import { DT, SUBSTEPS_PER_MEETING, YEARS_PER_MEETING } from '../config/time.ts'
import { advanceSubstep } from './dynamics.ts'
import { buildLagKernel } from './lags.ts'

/**
 * Advances the latent economy from one policy meeting to the next.
 *
 * The interval is integrated in several smaller internal sub-steps rather
 * than one jump. Delayed event consequences are queued against a specific
 * sub-step, so they land part-way between meetings instead of snapping into
 * place exactly when the player sits down again.
 */

/** Applies a set of additive effects to a latent state. */
export function applyEffects(
  latent: LatentState,
  effects: readonly EventEffect[],
): LatentState {
  if (effects.length === 0) return latent
  const next = { ...latent }
  for (const effect of effects) {
    next[effect.variable] = next[effect.variable] + effect.delta
  }
  return next
}

/** Splits the queue into effects due at or before `step` and the rest. */
function dueEffects(
  pending: readonly PendingEventEffect[],
  step: number,
): {
  readonly due: readonly EventEffect[]
  readonly remaining: readonly PendingEventEffect[]
} {
  if (pending.length === 0) return { due: [], remaining: pending }

  const due: EventEffect[] = []
  const remaining: PendingEventEffect[] = []
  for (const entry of pending) {
    if (entry.fireAtStep <= step) {
      due.push(...entry.effects)
    } else {
      remaining.push(entry)
    }
  }
  return { due, remaining: remaining.length === pending.length ? pending : remaining }
}

export function advanceTrueState(state: SimulationState): SimulationState {
  const institution = getInstitution(state.config.institution)
  const difficulty = getDifficulty(state.config.difficulty)
  const kernel = buildLagKernel(state.config.difficulty)
  const prng = restorePrng(state.rng)

  const diagnostics: DiagnosticEvent[] = []
  let latent = state.latent
  let lags = state.lags
  let pending = state.pendingEffects
  let stepIndex = state.stepIndex

  for (let substep = 0; substep < SUBSTEPS_PER_MEETING; substep += 1) {
    // Queued consequences land before the step that integrates them.
    const { due, remaining } = dueEffects(pending, stepIndex)
    if (due.length > 0) {
      latent = clampLatentState(applyEffects(latent, due), stepIndex, diagnostics)
      pending = remaining
    }

    const advanced = advanceSubstep(
      latent,
      lags,
      {
        institution,
        difficulty,
        stance: state.stance,
        guidance: state.guidance,
        kernel,
        dt: DT,
      },
      prng,
    )

    stepIndex += 1
    latent = clampLatentState(advanced.latent, stepIndex, diagnostics)
    lags = advanced.lags
  }

  const meetingIndex = state.meetingIndex + 1
  const timeYears = state.timeYears + YEARS_PER_MEETING

  return {
    ...state,
    meetingIndex,
    stepIndex,
    timeYears,
    latent,
    lags,
    rng: prng.getState(),
    pendingEffects: pending,
    diagnostics:
      diagnostics.length > 0
        ? [...state.diagnostics, ...diagnostics]
        : state.diagnostics,
    history: [...state.history, { meetingIndex, timeYears, latent }],
  }
}
