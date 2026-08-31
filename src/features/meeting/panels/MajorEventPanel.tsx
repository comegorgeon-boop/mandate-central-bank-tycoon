import {
  revealedDispatches,
  type ResolvedEventRecord,
} from '../../../simulation/index.ts'

/**
 * Mandate-defining crises, given dedicated prominence.
 *
 * Shown above the tabs, alongside the stance strip, so it is visible
 * regardless of which panel is open — a major event is not tab content, it is
 * the reason this meeting is different from the last one. Two parts: a
 * "breaking" callout the meeting a major event actually fires, and a running
 * log of the scripted follow-up dispatches for any major still inside its
 * window, so the story keeps developing on the meetings after it breaks.
 */

export function MajorEventPanel({
  majorEvent,
  eventLog,
  meetingIndex,
}: {
  readonly majorEvent: ResolvedEventRecord | null
  readonly eventLog: readonly ResolvedEventRecord[]
  readonly meetingIndex: number
}) {
  const dispatches = revealedDispatches(eventLog, meetingIndex)

  if (majorEvent === null && dispatches.length === 0) return null

  return (
    <section aria-labelledby="major-event-heading" className="mt-5 space-y-3">
      <h2 id="major-event-heading" className="sr-only">
        Major developments
      </h2>

      {majorEvent !== null && (
        <div className="rounded border border-rose-800 bg-rose-950/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">
            Breaking · fictional wire report
          </p>
          <h3 className="mt-1 text-lg font-semibold text-rose-100">{majorEvent.title}</h3>
          <p className="mt-1 text-sm text-neutral-200">{majorEvent.newswire}</p>
        </div>
      )}

      {dispatches.map(({ record, definition, lines, concluded }) => (
        <div
          key={record.eventId}
          className="rounded border border-neutral-700 bg-neutral-900/60 p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {concluded ? 'Developing story · concluded' : 'Developing story'}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-neutral-100">
            {definition.title}
            <span className="ml-2 font-normal text-neutral-500">
              since meeting {record.meetingIndex + 1}
            </span>
          </h3>
          <ul className="mt-2 space-y-1.5">
            {lines.map((line) => (
              <li key={line} className="text-sm text-neutral-300">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
