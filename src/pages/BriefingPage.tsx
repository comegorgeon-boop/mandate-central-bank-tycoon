import { Navigate, useNavigate } from 'react-router-dom'
import {
  getInstitution,
  tutorialProgress,
  type SeriesId,
} from '../simulation/index.ts'
import { useRun } from '../features/game/runContext.ts'
import { formatMeetings, transmissionLag } from '../features/policy/lag.ts'
import { Mascot } from '../components/Mascot.tsx'
import { openingLine } from '../features/meeting/mascotLine.ts'

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
  // Null at every difficulty but easy. See `scoring/tutorialGoal.ts`.
  const tutorial = tutorialProgress(session.state)
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
        {tutorial === null ? (
          <p className="mt-2 text-sm text-onwood-soft">
            You will chair {config.meetingCount} scheduled meetings. At each one you
            set the policy rate. The inflation objective is{' '}
            {institution.inflationTarget.toFixed(1)} %, and the employment side of the
            mandate is judged against how far unemployment sits from its sustainable
            level.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-onwood-soft">
              This mandate has no fixed number of meetings. You inherit an economy
              running hot, and it ends when you have brought it back — not when a
              clock runs out.
            </p>
            <div className="mt-3 rounded-lg border-l-4 border-edge-accent bg-inset p-3">
              <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-accent-onwood">
                What ends it
              </p>
              <ul className="mt-1 space-y-0.5 text-sm text-onwood">
                <li>
                  Inflation below{' '}
                  <span className="font-semibold tabular-nums">
                    {tutorial.inflationBelow.toFixed(1)} %
                  </span>
                </li>
                <li>
                  Unemployment below{' '}
                  <span className="font-semibold tabular-nums">
                    {tutorial.unemploymentBelow.toFixed(1)} %
                  </span>
                </li>
                <li>
                  Both at once, for {tutorial.meetingsNeeded} consecutive meetings
                </li>
              </ul>
              <p className="mt-1.5 text-xs text-onwood-soft">
                Unemployment already sits under its bar; the tightening that brings
                inflation down is what will push it up. Holding both is the job. If
                it is still not done by meeting {tutorial.maxMeetings}, the mandate
                ends anyway.
              </p>
            </div>
          </>
        )}
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

      {/* The one piece of whimsy in the room, and it carries a point: the
          tortoise exists because the lag does. See `mascotLine.ts`. */}
      <aside className="mt-8 flex items-start gap-3 rounded-lg border border-edge-room bg-room p-4">
        <Mascot size={92} className="shrink-0" />
        <p className="text-sm leading-relaxed text-onwood-soft">
          {openingLine(config.difficulty)}
        </p>
      </aside>

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
