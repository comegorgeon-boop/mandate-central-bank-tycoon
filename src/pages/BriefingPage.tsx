import { Navigate, useNavigate } from 'react-router-dom'
import { getInstitution, type SeriesId } from '../simulation/index.ts'
import { useRun } from '../features/game/runContext.ts'
import { formatMeetings, transmissionLag } from '../features/policy/lag.ts'

/**
 * The opening briefing: the mandate, and the economy as it stands before the
 * first decision. Short and skippable — one button leads into meeting one.
 */

const OPENING_SERIES: readonly SeriesId[] = [
  'headline_inflation',
  'core_inflation',
  'unemployment',
  'policy_rate',
]

export default function BriefingPage() {
  const navigate = useNavigate()
  const { active, finished } = useRun()

  if (finished !== null) return <Navigate to={`/play/result/${finished.runId}`} replace />
  if (active === null) return <Navigate to="/play/setup" replace />

  const { session } = active
  const { config } = session.state
  const institution = getInstitution(config.institution)
  const lag = transmissionLag(config.difficulty)

  const readings = OPENING_SERIES.map((id) => session.observation.indicators[id]).filter(
    (indicator) => indicator !== undefined,
  )

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8 text-neutral-200">
      <p className="text-xs uppercase tracking-wide text-neutral-500">
        Briefing · seed {config.seed}
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-neutral-50">
        {institution.name}
      </h1>

      <section className="mt-6" aria-labelledby="mandate-heading">
        <h2 id="mandate-heading" className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
          Your mandate
        </h2>
        <p className="mt-2 text-sm text-neutral-300">{institution.mandateSummary}</p>
        <p className="mt-2 text-sm text-neutral-400">
          You will chair {config.meetingCount} scheduled meetings. At each one you set
          the policy rate. The inflation objective is{' '}
          {institution.inflationTarget.toFixed(1)} %, and the employment side of the
          mandate is judged against how far unemployment sits from its sustainable
          level.
        </p>
      </section>

      <section className="mt-6" aria-labelledby="economy-heading">
        <h2 id="economy-heading" className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
          The economy you inherit
        </h2>
        <dl className="mt-2 divide-y divide-neutral-800 border-y border-neutral-800 text-sm">
          {readings.map((reading) => (
            <div key={reading.seriesId} className="flex justify-between gap-4 py-2">
              <dt className="text-neutral-400">{reading.label}</dt>
              <dd className="tabular-nums text-neutral-100">
                {reading.value === null ? '—' : reading.value.toFixed(2)} {reading.unit}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-neutral-500">
          These are published figures, not the true state of the economy. Statistics
          arrive late and are revised; market prices are exact but tell you only what
          others believe.
        </p>
      </section>

      <section className="mt-6" aria-labelledby="lag-heading">
        <h2 id="lag-heading" className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
          How policy acts
        </h2>
        <p className="mt-2 text-sm text-neutral-400">
          A rate change does not act on the day it is made. On this mandate its effect
          peaks around {formatMeetings(lag.peakMeetings)} later and is mostly delivered
          within {formatMeetings(lag.spanMeetings)}. You will be judged on the whole
          path of the economy across the mandate, not on where it ends up at the last
          meeting.
        </p>
      </section>

      <button
        type="button"
        onClick={() => navigate('/play/meeting/1')}
        className="mt-8 rounded border border-neutral-300 bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
      >
        Enter the first meeting
      </button>

      <p className="mt-8 text-xs text-neutral-600">
        The economy, its data and its news are fictional and generated locally from
        the seed above.
      </p>
    </main>
  )
}
