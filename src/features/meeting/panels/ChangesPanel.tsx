import { useMemo } from 'react'
import type { Institution, ObservationSet } from '../../../simulation/index.ts'
import { buildChanges, type ChangeSource } from '../changes.ts'

/**
 * What changed since the last meeting, at the head of every meeting.
 *
 * Sits above the tabs because it answers the question the player arrives with,
 * and it has to be answerable in about five seconds. The decision entry leads
 * whenever there is one: "what did my last decision do" is the question that
 * made the previous playthrough feel inert when nothing on screen answered it.
 */

const SOURCE_LABEL: Readonly<Record<ChangeSource, string>> = {
  decision: 'Your decision',
  markets: 'Markets',
  expectations: 'Expectations',
  forecast: 'Staff forecast',
  data: 'Data',
  revision: 'Revision',
}

/**
 * This panel sits above the tabs, on the walnut of the room itself, so every
 * colour here is an *on-dark* one. `--good-strong` is viridian-800 in the
 * shipping direction — near-black, and 1.49:1 against walnut.
 */
const SOURCE_CLASS: Readonly<Record<ChangeSource, string>> = {
  decision: 'border-good text-good-onwood',
  markets: 'border-edge-accent text-accent-onwood',
  expectations: 'border-edge-accent text-onwood-soft',
  forecast: 'border-edge-accent text-accent-onwood',
  data: 'border-edge-room text-onwood-soft',
  revision: 'border-accent text-accent-onwood',
}

export function ChangesPanel({
  observation,
  previousObservation,
  institution,
}: {
  readonly observation: ObservationSet
  readonly previousObservation: ObservationSet | null
  readonly institution: Institution
}) {
  const changes = useMemo(
    () => buildChanges(observation, previousObservation, institution),
    [observation, previousObservation, institution],
  )

  return (
    <section
      aria-labelledby="changes-heading"
      className="mt-4 rounded border border-edge-room bg-room/60 p-4"
    >
      <h2
        id="changes-heading"
        className="text-sm font-semibold uppercase tracking-wide text-onwood-soft"
      >
        What changed since the last meeting
      </h2>

      <ol className="mt-3 space-y-3">
        {changes.map((item) => (
          <li key={item.id} className="border-l-2 border-edge-room pl-3">
            <span
              className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${SOURCE_CLASS[item.source]}`}
            >
              {SOURCE_LABEL[item.source]}
            </span>
            <p className="mt-1 font-medium text-onwood">{item.headline}</p>
            <p className="mt-0.5 text-sm text-onwood-soft">{item.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
