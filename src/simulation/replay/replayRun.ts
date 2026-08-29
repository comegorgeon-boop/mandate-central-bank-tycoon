import type { RunConfig } from '../types/core.ts'
import type { ResolvedEventRecord } from '../types/events.ts'
import type { ObservationSet } from '../types/observation.ts'
import type { PolicyPackage, PolicyValidation } from '../types/policy.ts'
import type { EndConditionResult } from '../types/scoring.ts'
import type { SimulationState } from '../types/state.ts'
import { applyPolicyPackage } from '../engine/applyPolicyPackage.ts'
import { advanceTrueState } from '../engine/advanceTrueState.ts'
import { createInitialState } from '../engine/initialState.ts'
import { resolveEvent } from '../events/resolveEvent.ts'
import { generateObservation } from '../observation/generateObservation.ts'
import { evaluateEndConditions } from '../scoring/endConditions.ts'
import type { DecisionLog, DecisionLogEntry } from './decisionLog.ts'
import { configFromLog } from './decisionLog.ts'

/**
 * The run loop, and deterministic replay on top of it.
 *
 * A meeting is: apply the confirmed package, resolve whatever happens between
 * meetings, advance the economy through its internal sub-steps, re-evaluate
 * the end conditions, and publish a fresh observation set.
 *
 * Because every random draw comes from the state's own generator and the
 * observation layer is a pure function of the run seed, replaying the same
 * ordered decisions against the same configuration reproduces the run exactly.
 */

export interface RunSession {
  readonly state: SimulationState
  /** What the player can see at the current meeting. */
  readonly observation: ObservationSet
  readonly outcome: EndConditionResult
  /** Ordered decisions so far, ready to be serialised. */
  readonly decisions: readonly DecisionLogEntry[]
  /** Headlines published since the previous meeting. */
  readonly newswire: readonly string[]
  /** Warning signals for risks that may materialise. */
  readonly clues: readonly string[]
}

export type MeetingResult =
  | { readonly ok: true; readonly session: RunSession; readonly validation: PolicyValidation }
  | { readonly ok: false; readonly validation: PolicyValidation }

function observe(
  state: SimulationState,
  newswire: readonly string[],
  clues: readonly string[],
): ObservationSet {
  return generateObservation(state, {
    meetingIndex: state.meetingIndex,
    newswire,
    clues,
  })
}

/** Opens a run at its first meeting. */
export function startRun(config: RunConfig): RunSession {
  const state = createInitialState(config)
  const outcome = evaluateEndConditions(state)
  return {
    state,
    observation: observe(state, [], []),
    outcome,
    decisions: [],
    newswire: [],
    clues: [],
  }
}

/**
 * Plays one meeting.
 *
 * A package that fails validation is not applied at all: the session is
 * returned untouched so the player can correct it.
 */
export function submitMeeting(
  session: RunSession,
  pkg: PolicyPackage,
): MeetingResult {
  if (session.outcome.status !== 'active') {
    return {
      ok: false,
      validation: {
        ok: false,
        rejections: [
          {
            instrument: null,
            code: 'unavailable_at_difficulty',
            message: 'This mandate has already ended.',
          },
        ],
        contradictions: [],
      },
    }
  }

  const applied = applyPolicyPackage(session.state, pkg)
  if (!applied.ok) return { ok: false, validation: applied.validation }

  const meetingIndex = session.state.meetingIndex

  // Events happen between meetings, on top of the confirmed decision.
  const resolution = resolveEvent(applied.state)
  const advanced = advanceTrueState(resolution.state)
  const outcome = evaluateEndConditions(advanced, session.outcome.breachCounters)

  const newswire = resolution.resolved.map(
    (record: ResolvedEventRecord) => record.newswire,
  )

  return {
    ok: true,
    validation: applied.validation,
    session: {
      state: advanced,
      observation: observe(advanced, newswire, resolution.clues),
      outcome,
      decisions: [...session.decisions, { meetingIndex, package: pkg }],
      newswire,
      clues: resolution.clues,
    },
  }
}

export type ReplayResult =
  | { readonly ok: true; readonly session: RunSession }
  | { readonly ok: false; readonly error: string; readonly session: RunSession }

/**
 * Replays an ordered decision log against a fresh run.
 *
 * Stops early and reports why if a decision no longer validates — which is
 * exactly what should happen when a log is replayed against an engine version
 * whose instrument bounds have changed.
 */
export function replayRun(log: DecisionLog): ReplayResult {
  const config = configFromLog(log)
  let session = startRun(config)

  for (const entry of log.decisions) {
    if (session.outcome.status !== 'active') break

    const result = submitMeeting(session, entry.package)
    if (!result.ok) {
      const reason = result.validation.rejections[0]?.message ?? 'unknown reason'
      return {
        ok: false,
        error: `Decision for meeting ${entry.meetingIndex} was rejected: ${reason}`,
        session,
      }
    }
    session = result.session
  }

  return { ok: true, session }
}

/** Plays a whole run from a policy chosen by a callback. Used by tooling. */
export function playRun(
  config: RunConfig,
  choose: (session: RunSession) => PolicyPackage,
): RunSession {
  let session = startRun(config)

  while (session.outcome.status === 'active') {
    const result = submitMeeting(session, choose(session))
    if (!result.ok) {
      throw new Error(
        `Policy rejected at meeting ${session.state.meetingIndex}: ` +
          result.validation.rejections.map((r) => r.message).join(' '),
      )
    }
    session = result.session
  }

  return session
}
