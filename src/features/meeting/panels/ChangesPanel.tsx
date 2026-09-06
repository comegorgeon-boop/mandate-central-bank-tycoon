import { useMemo } from 'react'
import type { Institution, ObservationSet } from '../../../simulation/index.ts'
import { buildChanges, type ChangeSource } from '../changes.ts'

/**
 * What changed since the last meeting.
 *
 * It answers the question the player arrives with, and it has to be answerable
 * in about five seconds. The decision entry leads whenever there is one: "what
 * did my last decision do" is the question that made an early playthrough feel
 * inert when nothing on screen answered it.
 *
 * It used to sit above the tabs, permanently, at five items of two lines each
 * — most of a screen of prose standing between the header and the charts. It
 * is the meeting brief's own subject and it now runs inside the brief.
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
 * Ink colours, because this panel is on paper.
 *
 * It was on the walnut of the room until the density pass moved it inside the
 * brief, and every colour in it was an *on-dark* one — `--onwood-soft` is a
 * warm off-white, which is 1.59:1 against cream. Moving a panel between the
 * room and the paper means re-picking every colour in it; nothing else does.
 * The contrast audit caught all thirteen of these before they shipped, which
 * is the whole reason it walks every tab at more than one difficulty.
 */
const SOURCE_CLASS: Readonly<Record<ChangeSource, string>> = {
  decision: 'border-good text-good-strong',
  markets: 'border-edge-accent text-accent-strong',
  expectations: 'border-edge text-ink-soft',
  forecast: 'border-edge-accent text-accent-strong',
  data: 'border-edge text-ink-soft',
  revision: 'border-accent text-accent-strong',
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
      className="rounded border border-edge bg-sunk p-4"
    >
      <h2
        id="changes-heading"
        className="text-sm font-semibold uppercase tracking-wide text-ink-soft"
      >
        What changed since the last meeting
      </h2>

      <ol className="mt-3 space-y-3">
        {changes.map((item) => (
          <li key={item.id} className="border-l-2 border-edge pl-3">
            <span
              className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${SOURCE_CLASS[item.source]}`}
            >
              {SOURCE_LABEL[item.source]}
            </span>
            <p className="mt-1 font-medium text-ink">{item.headline}</p>
            <p className="mt-0.5 text-sm text-ink-soft">{item.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
