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
        // A wire report on the table: a light surface, so ink — never the
        // room's own light-on-dark text, which is how this paragraph became
        // invisible the moment the panel stopped being dark.
        <div className="rounded-lg border-l-4 border-bad bg-bad-surface p-4 shadow-panel">
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-bad">
            Breaking · fictional wire report
          </p>
          <h3 className="mt-1 font-display text-xl font-semibold text-bad-strong">
            {majorEvent.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink">{majorEvent.newswire}</p>
        </div>
      )}

      {dispatches.map(({ record, definition, lines, concluded }) => (
        <div
          key={record.eventId}
          className="rounded-lg border-l-4 border-edge-accent bg-room p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-onwood-soft">
            {concluded ? 'Developing story · concluded' : 'Developing story'}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-onwood">
            {definition.title}
            <span className="ml-2 font-normal text-onwood-faint">
              since meeting {record.meetingIndex + 1}
            </span>
          </h3>
          <ul className="mt-2 space-y-1.5">
            {lines.map((line) => (
              <li key={line} className="text-sm text-onwood-soft">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
