import { useMemo } from 'react'
import type { Institution, ObservationSet } from '../../../simulation/index.ts'
import { buildChanges, type ChangeSource } from '../changes.ts'
import type { CounterfactualLine } from '../counterfactualLine.ts'

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
  counterfactual,
}: {
  readonly observation: ObservationSet
  readonly previousObservation: ObservationSet | null
  readonly institution: Institution
  /**
   * What the policy has actually delivered, exactly.
   *
   * It *replaces* the derived "your decision" entry rather than joining it.
   * That entry read the stance decomposition and said what the decision did to
   * the real rate — true, useful, and one inference short of the question the
   * player was asking, which is what it did to the economy. This answers that
   * directly and there is no reason to print both.
   */
  readonly counterfactual: CounterfactualLine | null
}) {
  const changes = useMemo(
    () => buildChanges(observation, previousObservation, institution),
    [observation, previousObservation, institution],
  ).filter((item) => counterfactual === null || item.source !== 'decision')

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
        {counterfactual !== null && (
          <li className="border-l-2 border-good pl-3">
            <span
              className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${SOURCE_CLASS.decision}`}
            >
              {counterfactual.arrived ? 'What you did' : 'The lag'}
            </span>
            <p className="mt-1 font-medium text-ink">{counterfactual.headline}</p>
            <p className="mt-0.5 text-sm text-ink-soft">{counterfactual.detail}</p>
          </li>
        )}
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
