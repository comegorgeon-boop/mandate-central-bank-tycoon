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
  warning: 'border-amber-700 text-amber-300',
  news: 'border-neutral-700 text-neutral-300',
  signal: 'border-sky-800 text-sky-300',
  data: 'border-neutral-700 text-neutral-400',
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
      <h2 id="brief-heading" className="text-lg font-semibold text-neutral-50">
        Meeting Brief
      </h2>
      <p className="mt-1 text-sm text-neutral-400">
        What has changed since the last meeting, in order of importance.
      </p>

      {brief.developments.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-400">
          Nothing material has changed since the last meeting. The economy is running
          on the momentum of earlier decisions.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {brief.developments.map((item) => (
            <li key={item.id} className="border-l-2 border-neutral-800 pl-3">
              <span
                className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${KIND_CLASS[item.kind]}`}
              >
                {KIND_LABEL[item.kind]}
              </span>
              <p className="mt-1 font-medium text-neutral-100">{item.headline}</p>
              <p className="mt-0.5 text-sm text-neutral-400">{item.detail}</p>
            </li>
          ))}
        </ol>
      )}

      {brief.questions.length > 0 && (
        <>
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-neutral-300">
            Unresolved questions
          </h3>
          <ul className="mt-2 space-y-2">
            {brief.questions.map((question) => (
              <li key={question} className="text-sm text-neutral-400">
                {question}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-6 text-xs text-neutral-600">
        All headlines and institutions in this brief are fictional.
      </p>
    </section>
  )
}
