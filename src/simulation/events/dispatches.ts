import type { GameEvent, ResolvedEventRecord } from '../types/events.ts'
import { EVENT_CATALOG, EVENTS_BY_ID } from './catalog.ts'

/**
 * "Living news": the follow-up wire lines revealed so far for a major event
 * still inside its dispatch window.
 *
 * Purely derived from `eventLog`, which is already persisted state, so this
 * needs no new field on `SimulationState` and stays replay-safe: the same
 * eventLog and meetingIndex always reveal the same lines, whether read live
 * or reconstructed from a decision log.
 */

export interface RevealedDispatch {
  readonly record: ResolvedEventRecord
  readonly definition: GameEvent
  /** Dispatch lines revealed so far, oldest first. */
  readonly lines: readonly string[]
  /** True once every scripted line has been revealed. */
  readonly concluded: boolean
}

/**
 * Every major event in `eventLog` with at least one dispatch line revealed
 * by `meetingIndex`, oldest firing first.
 */
export function revealedDispatches(
  eventLog: readonly ResolvedEventRecord[],
  meetingIndex: number,
  catalog: readonly GameEvent[] = EVENT_CATALOG,
): readonly RevealedDispatch[] {
  const byId =
    catalog === EVENT_CATALOG
      ? EVENTS_BY_ID
      : new Map(catalog.map((event) => [event.id, event]))

  const revealed: RevealedDispatch[] = []
  for (const record of eventLog) {
    const definition = byId.get(record.eventId)
    const dispatchLines = definition?.dispatchLines
    if (definition === undefined || dispatchLines === undefined || dispatchLines.length === 0) {
      continue
    }

    const revealedCount = Math.max(
      0,
      Math.min(dispatchLines.length, meetingIndex - record.meetingIndex),
    )
    if (revealedCount === 0) continue

    revealed.push({
      record,
      definition,
      lines: dispatchLines.slice(0, revealedCount),
      concluded: revealedCount >= dispatchLines.length,
    })
  }

  return revealed
}
