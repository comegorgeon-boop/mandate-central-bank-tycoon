import { useMemo } from 'react'
import type {
  EndConditionResult,
  Institution,
  ObservationSet,
} from '../../../simulation/index.ts'
import { buildMeetingBrief, type BriefKind } from '../brief.ts'

/**
 * The five developments that matter most this meeting, and the questions the
 * committee has not settled. Assembled from the observation set only.
 */

const KIND_LABEL: Readonly<Record<BriefKind, string>> = {
  warning: 'Warning',
  news: 'Newswire',
  signal: 'Signal',
  data: 'Data',
}

const KIND_CLASS: Readonly<Record<BriefKind, string>> = {
  warning: 'border-accent text-accent-strong',
  news: 'border-edge text-ink-soft',
  signal: 'border-edge-accent text-accent-strong',
  data: 'border-edge text-ink-soft',
}

export function MeetingBriefPanel({
  observation,
  outcome,
  institution,
}: {
  readonly observation: ObservationSet
  readonly outcome: EndConditionResult
  readonly institution: Institution
}) {
  const brief = useMemo(
    () => buildMeetingBrief(observation, outcome, institution),
    [observation, outcome, institution],
  )

  return (
    <section aria-labelledby="brief-heading">
      <h2 id="brief-heading" className="text-lg font-semibold text-ink">
        Meeting Brief
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        What has changed since the last meeting, in order of importance.
      </p>

      {brief.developments.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">
          Nothing material has changed since the last meeting. The economy is running
          on the momentum of earlier decisions.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {brief.developments.map((item) => (
            <li key={item.id} className="border-l-2 border-edge pl-3">
              <span
                className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${KIND_CLASS[item.kind]}`}
              >
                {KIND_LABEL[item.kind]}
              </span>
              <p className="mt-1 font-medium text-ink">{item.headline}</p>
              <p className="mt-0.5 text-sm text-ink-soft">{item.detail}</p>
            </li>
          ))}
        </ol>
      )}

      {brief.questions.length > 0 && (
        <>
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-ink-soft">
            Unresolved questions
          </h3>
          <ul className="mt-2 space-y-2">
            {brief.questions.map((question) => (
              <li key={question} className="text-sm text-ink-soft">
                {question}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-6 text-xs text-ink-faint">
        All headlines and institutions in this brief are fictional.
      </p>
    </section>
  )
}
