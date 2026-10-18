import type { DiagnosticEvent } from '../types/core.ts'
import type { EventEffect, PendingEventEffect } from '../types/events.ts'
import type { LatentState, SimulationState } from '../types/state.ts'
import { restorePrng } from '../rng/prng.ts'
import { LATENT_BOUNDS, clamp, clampLatentState } from '../config/bounds.ts'
import { getInstitution } from '../config/institutions.ts'
import { DT, SUBSTEPS_PER_MEETING, YEARS_PER_MEETING } from '../config/time.ts'
import { advanceSubstep } from './dynamics.ts'
import { IS_CURVE, LABOR, PHILLIPS } from '../config/model.ts'
import {
  inflationTargetFor,
  measurementRegime,
  scenarioOf,
} from '../scenarios/scenarios.ts'
import { realRateGap } from './indices.ts'
import { buildLagKernel } from './lags.ts'
import { advanceMembers } from './members.ts'

/**
 * Advances the latent economy from one policy meeting to the next.
 *
 * The interval is integrated in several smaller internal sub-steps rather
 * than one jump. Delayed event consequences are queued against a specific
 * sub-step, so they land part-way between meetings instead of snapping into
 * place exactly when the player sits down again.
 */

/**
 * Applies a set of additive effects to a latent state.
 *
 * Each result is held inside the range of the variable it touches. An event
 * that adds twelve points of stress to a system already at ninety-five is
 * behaving normally, not producing an arithmetic failure, so it should not
 * end up in the diagnostics that exist to report the latter.
 */
export function applyEffects(
  latent: LatentState,
  effects: readonly EventEffect[],
): LatentState {
  if (effects.length === 0) return latent
  const next = { ...latent }
  for (const effect of effects) {
    const [min, max] = LATENT_BOUNDS[effect.variable]
    next[effect.variable] = clamp(next[effect.variable] + effect.delta, min, max)
  }
  return next
}

/** Splits the queue into effects due at or before `step` and the rest. */
function dueEffects(
  pending: readonly PendingEventEffect[],
  step: number,
): {
  readonly due: readonly EventEffect[]
  /** Which events those consequences belonged to, for the interval trace. */
  readonly dueEventIds: readonly string[]
  readonly remaining: readonly PendingEventEffect[]
} {
  if (pending.length === 0) return { due: [], dueEventIds: [], remaining: pending }

  const due: EventEffect[] = []
  const dueEventIds: string[] = []
  const remaining: PendingEventEffect[] = []
  for (const entry of pending) {
    if (entry.fireAtStep <= step) {
      due.push(...entry.effects)
      if (!dueEventIds.includes(entry.eventId)) dueEventIds.push(entry.eventId)
    } else {
      remaining.push(entry)
    }
  }
  return {
    due,
    dueEventIds,
    remaining: remaining.length === pending.length ? pending : remaining,
  }
}

/**
 * One internal sub-step of the interval, as the engine actually computed it.
 *
 * Produced so the interface can show the quarter *passing* rather than cutting
 * to its end. Nothing here is interpolated or invented: these are the states
 * the integrator went through, and the alternative — tweening between two
 * meetings — would be an animation that shows the player something the model
 * never computed.
 */
export interface IntervalStep {
  readonly stepIndex: number
  readonly latent: LatentState
  /** Events whose queued consequences landed immediately before this step. */
  readonly landedEventIds: readonly string[]
}

export interface AdvanceResult {
  readonly state: SimulationState
  readonly steps: readonly IntervalStep[]
}

export function advanceTrueState(state: SimulationState): SimulationState {
  return advanceTrueStateTraced(state).state
}

/**
 * The same advance, keeping the sub-steps it passed through.
 *
 * `advanceTrueState` is this with the trace discarded, so there is exactly one
 * implementation and the animation can never drift from the simulation.
 */
export function advanceTrueStateTraced(state: SimulationState): AdvanceResult {
  const institution = getInstitution(state.config.institution)
  // `measurementRegime`, not `getDifficulty`: a scenario may carry its own
  // ambient shock scale, and the substep reads `difficulty.shockScale` for
  // every stochastic draw. Everything else in the profile is identical.
  const difficulty = measurementRegime(state.config)
  const kernel = buildLagKernel(state.config.difficulty)
  // 1 in an ordinary mandate; a historical scenario says how hard its own
  // economy was to move. See `Scenario.rateTransmission`.
  const scenario = scenarioOf(state.config)
  const rateTransmission = scenario?.rateTransmission ?? 1
  const phillipsGapSlope = scenario?.phillipsGapSlope ?? PHILLIPS.gapSlope
  const gapMeanReversion = scenario?.gapMeanReversion ?? IS_CURVE.meanReversion
  const okun = scenario?.okun ?? LABOR.okun
  const inflationTarget = inflationTargetFor(state.config)
  // The economy this mandate opened on, read off its own first snapshot — so
  // a replay, a counterfactual arm and a doctrine trial all judge the
  // institution against the same inheritance the player was handed.
  const opening = state.history[0]?.latent ?? state.latent
  const inheritedMiss = Math.abs(opening.inflationHeadline - inflationTarget)
  const mandateElapsed = Math.min(
    1,
    state.meetingIndex / Math.max(1, state.config.meetingCount),
  )
  const prng = restorePrng(state.rng)

  const diagnostics: DiagnosticEvent[] = []
  let latent = state.latent
  let members = state.members
  let lags = state.lags
  let pending = state.pendingEffects
  let stepIndex = state.stepIndex

  const steps: IntervalStep[] = []

  for (let substep = 0; substep < SUBSTEPS_PER_MEETING; substep += 1) {
    // Queued consequences land before the step that integrates them.
    const { due, dueEventIds, remaining } = dueEffects(pending, stepIndex)
    let landedEventIds: readonly string[] = []
    if (due.length > 0) {
      latent = clampLatentState(applyEffects(latent, due), stepIndex, diagnostics)
      pending = remaining
      landedEventIds = dueEventIds
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
        rateTransmission,
        phillipsGapSlope,
        gapMeanReversion,
        okun,
        inflationTarget,
        inheritedMiss,
        mandateElapsed,
        dt: DT,
      },
      prng,
    )

    stepIndex += 1
    latent = clampLatentState(advanced.latent, stepIndex, diagnostics)
    // The area's members move on the same sub-step and off the same
    // restriction the aggregate just responded to, so dispersion and the
    // aggregate can never describe different quarters.
    members = advanceMembers(members, latent, realRateGap(latent), DT)
    lags = advanced.lags
    steps.push({ stepIndex, latent, landedEventIds })
  }

  const meetingIndex = state.meetingIndex + 1
  const timeYears = state.timeYears + YEARS_PER_MEETING

  return {
    state: {
      ...state,
      meetingIndex,
      stepIndex,
      timeYears,
      latent,
      members,
      lags,
      rng: prng.getState(),
      pendingEffects: pending,
      diagnostics:
        diagnostics.length > 0
          ? [...state.diagnostics, ...diagnostics]
          : state.diagnostics,
      history: [...state.history, { meetingIndex, timeYears, latent, members }],
    },
    steps,
  }
}
