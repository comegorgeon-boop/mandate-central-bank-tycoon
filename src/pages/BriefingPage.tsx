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
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8 text-onwood">
      <p className="text-xs uppercase tracking-wide text-onwood-faint">
        Briefing · seed {config.seed}
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-onwood">
        {institution.name}
      </h1>

      <section className="mt-6" aria-labelledby="mandate-heading">
        <h2 id="mandate-heading" className="text-sm font-semibold uppercase tracking-wide text-onwood-soft">
          Your mandate
        </h2>
        <p className="mt-2 text-sm text-onwood-soft">{institution.mandateSummary}</p>
        <p className="mt-2 text-sm text-onwood-soft">
          You will chair {config.meetingCount} scheduled meetings. At each one you set
          the policy rate. The inflation objective is{' '}
          {institution.inflationTarget.toFixed(1)} %, and the employment side of the
          mandate is judged against how far unemployment sits from its sustainable
          level.
        </p>
      </section>

      <section className="mt-6" aria-labelledby="economy-heading">
        <h2 id="economy-heading" className="text-sm font-semibold uppercase tracking-wide text-onwood-soft">
          The economy you inherit
        </h2>
        <dl className="mt-2 divide-y divide-edge-room border-y border-edge-room text-sm">
          {readings.map((reading) => (
            <div key={reading.seriesId} className="flex justify-between gap-4 py-2">
              <dt className="text-onwood-soft">{reading.label}</dt>
              <dd className="tabular-nums text-onwood">
                {reading.value === null ? '—' : reading.value.toFixed(2)} {reading.unit}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-onwood-faint">
          These are published figures, not the true state of the economy. Statistics
          arrive late and are revised; market prices are exact but tell you only what
          others believe.
        </p>
      </section>

      <section className="mt-6" aria-labelledby="lag-heading">
        <h2 id="lag-heading" className="text-sm font-semibold uppercase tracking-wide text-onwood-soft">
          How policy acts
        </h2>
        <p className="mt-2 text-sm text-onwood-soft">
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
        className="mt-8 rounded-md border border-edge-accent bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-panel transition-colors hover:bg-accent-onwood"
      >
        Enter the first meeting
      </button>

      <p className="mt-8 text-xs text-onwood-faint">
        The economy, its data and its news are fictional and generated locally from
        the seed above.
      </p>
    </main>
  )
}
