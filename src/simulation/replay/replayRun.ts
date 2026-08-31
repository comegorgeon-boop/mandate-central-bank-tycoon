import type { RunConfig } from '../types/core.ts'
import type { ResolvedEventRecord } from '../types/events.ts'
import type { ObservationSet } from '../types/observation.ts'
import type { PolicyPackage, PolicyValidation } from '../types/policy.ts'
import type { EndConditionResult } from '../types/scoring.ts'
import type { SimulationState } from '../types/state.ts'
import { applyPolicyPackage } from '../engine/applyPolicyPackage.ts'
import { advanceTrueState } from '../engine/advanceTrueState.ts'
import { createInitialState } from '../engine/initialState.ts'
import { isMajorEvent } from '../events/catalog.ts'
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
  /**
   * What the player saw at the previous meeting. Null at the first.
   *
   * Kept rather than recomputed, so "what changed since last time" is a
   * comparison against the numbers actually on the table then, including the
   * measurement error they carried.
   */
  readonly previousObservation: ObservationSet | null
  /**
   * The economy an instant after the last decision was confirmed, before any
   * time passed. Null at the first meeting.
   *
   * Markets, the press and the institution's standing respond within the same
   * turn, while inflation and unemployment take quarters. Publishing this
   * snapshot is what makes that first channel visible: differencing it against
   * `previousObservation` isolates what the decision itself moved, with none of
   * the intervening economy mixed in.
   */
  readonly onTheDay: ObservationSet | null
  readonly outcome: EndConditionResult
  /** Ordered decisions so far, ready to be serialised. */
  readonly decisions: readonly DecisionLogEntry[]
  /**
   * Headlines published since the previous meeting, from *minor* events only.
   * Major events are excluded here and carried instead in `majorEvent`, which
   * gets dedicated, prominent treatment rather than being folded into this
   * list.
   */
  readonly newswire: readonly string[]
  /**
   * The major event resolved since the previous meeting, if any — or, at the
   * first meeting of an easy mandate, the crisis the run opened on. Null
   * otherwise. `events/dispatches.ts` derives the unfolding "story so far"
   * for this and any earlier major event from `state.eventLog` directly, so
   * nothing beyond the most recent firing needs to be carried here.
   */
  readonly majorEvent: ResolvedEventRecord | null
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

/**
 * Rewrites the current meeting's history snapshot from the live latent state.
 *
 * Used only to observe an intra-meeting moment — between the decision and the
 * passage of time — and never fed back into the run: the state that advances is
 * always the untouched one, so this cannot alter the trajectory or the replay.
 */
function withRestatedSnapshot(state: SimulationState): SimulationState {
  const last = state.history.at(-1)
  if (last === undefined || last.meetingIndex !== state.meetingIndex) return state

  return {
    ...state,
    history: [...state.history.slice(0, -1), { ...last, latent: state.latent }],
  }
}

/** Opens a run at its first meeting. */
export function startRun(config: RunConfig): RunSession {
  const state = createInitialState(config)
  const outcome = evaluateEndConditions(state)

  // The easy-mode opener (if any) is already baked into `state` by
  // `createInitialState`, recorded at `meetingIndex: 0`. Surfaced through
  // `majorEvent`, not the plain newswire — majors get the dedicated banner,
  // exactly as at every later meeting.
  const opener = state.eventLog.find((record) => record.meetingIndex === 0) ?? null

  return {
    state,
    observation: observe(state, [], []),
    previousObservation: null,
    onTheDay: null,
    outcome,
    decisions: [],
    newswire: [],
    majorEvent: opener,
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

  // Captured before any time passes, so it holds the decision's own same-day
  // effect on markets and nothing else.
  //
  // The observation layer reads `history`, not `latent` — a published figure
  // describes a reference period, and the period it describes is the snapshot.
  // `applyPolicyPackage` moves `latent` without touching `history`, so observing
  // the applied state directly would report every zero-lag series at its
  // pre-decision value and the reaction would always look inert. Restating the
  // current meeting's snapshot from the post-decision latent is what makes the
  // same-day channel observable at all.
  const onTheDay = observe(withRestatedSnapshot(applied.state), [], [])

  // Events happen between meetings, on top of the confirmed decision.
  const resolution = resolveEvent(applied.state)
  const advanced = advanceTrueState(resolution.state)
  const outcome = evaluateEndConditions(advanced, session.outcome.breachCounters)

  // Majors get the dedicated banner, not the generic newswire list — see
  // `RunSession.majorEvent`.
  const majorEvent = resolution.resolved.find((record) => isMajorEvent(record.eventId)) ?? null
  const newswire = resolution.resolved
    .filter((record) => !isMajorEvent(record.eventId))
    .map((record: ResolvedEventRecord) => record.newswire)

  return {
    ok: true,
    validation: applied.validation,
    session: {
      state: advanced,
      observation: observe(advanced, newswire, resolution.clues),
      previousObservation: session.observation,
      onTheDay,
      outcome,
      decisions: [...session.decisions, { meetingIndex, package: pkg }],
      newswire,
      majorEvent,
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

  // Replay by meeting index rather than by walking the decisions array. A log
  // with a gap in it — hand-edited, or truncated in transit — would otherwise
  // slide every later decision onto an earlier meeting and silently produce a
  // different run. A missing entry means the meeting was held and nothing was
  // decided, so it replays as a hold.
  const byMeeting = new Map(
    log.decisions.map((entry) => [entry.meetingIndex, entry.package]),
  )
  const lastMeeting = log.decisions.reduce(
    (highest, entry) => Math.max(highest, entry.meetingIndex),
    -1,
  )

  for (let meeting = 0; meeting <= lastMeeting; meeting += 1) {
    if (session.outcome.status !== 'active') break

    const pkg = byMeeting.get(meeting) ?? { actions: [], communication: null }
    const result = submitMeeting(session, pkg)
    if (!result.ok) {
      const reason = result.validation.rejections[0]?.message ?? 'unknown reason'
      return {
        ok: false,
        error: `Decision for meeting ${meeting} was rejected: ${reason}`,
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
