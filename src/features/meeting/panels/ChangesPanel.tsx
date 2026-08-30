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

const SOURCE_CLASS: Readonly<Record<ChangeSource, string>> = {
  decision: 'border-emerald-800 text-emerald-300',
  markets: 'border-sky-800 text-sky-300',
  expectations: 'border-violet-800 text-violet-300',
  forecast: 'border-sky-800 text-sky-300',
  data: 'border-neutral-700 text-neutral-400',
  revision: 'border-amber-800 text-amber-300',
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
      className="mt-4 rounded border border-neutral-800 bg-neutral-900/60 p-4"
    >
      <h2
        id="changes-heading"
        className="text-sm font-semibold uppercase tracking-wide text-neutral-300"
      >
        What changed since the last meeting
      </h2>

      <ol className="mt-3 space-y-3">
        {changes.map((item) => (
          <li key={item.id} className="border-l-2 border-neutral-800 pl-3">
            <span
              className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${SOURCE_CLASS[item.source]}`}
            >
              {SOURCE_LABEL[item.source]}
            </span>
            <p className="mt-1 font-medium text-neutral-100">{item.headline}</p>
            <p className="mt-0.5 text-sm text-neutral-400">{item.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
