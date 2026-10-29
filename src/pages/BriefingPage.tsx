import { Navigate, useNavigate } from 'react-router-dom'
import {
  getInstitution,
  tutorialProgress,
  type SeriesId,
} from '../simulation/index.ts'
import { useRun } from '../features/game/runContext.ts'
import { Mascot } from '../components/Mascot.tsx'
import { WhatYouAreFor } from '../features/meeting/WhatYouAreFor.tsx'
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
        {/*
            **The orientation replaces the mandate prose rather than joining
            it.** This section used to carry `institution.mandateSummary` and a
            tenure sentence, both of which `explain/orientation.ts` now says
            properly and in context — and the player's standing rule on this
            project is that an addition replaces rather than adds. Saying the
            mandate twice, once vaguely, is how a briefing becomes a thing
            people skip.

            Why it is here at all, in the player's words: *"il m'a demandé en
            boucle « c'est quoi le but, qu'est-ce que je dois faire ». Les trois
            réunions guidées ne règlent pas ça, parce qu'elles guident la
            DÉCISION et pas la DIRECTION."*
        */}
        <h2 id="mandate-heading" className="text-sm font-semibold uppercase tracking-wide text-onwood-soft">
          What you are trying to do
        </h2>
        <div className="mt-3">
          <WhatYouAreFor config={config} />
        </div>
        {tutorial === null ? null : (
          <>
            {/* The goal itself, as figures. Point 4 of the orientation above
                already says the tutorial ends on its objective rather than on
                a clock; this is the objective, which is a different thing and
                is worth having in numerals. */}
            <div className="mt-4 rounded-lg border-l-4 border-edge-accent bg-inset p-3">
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

      {/*
          **"How policy acts" is gone, because point 3 above is it.**

          Both said the lag, and they said it with *different numbers* — this
          panel read the built kernel and reported 3.5 meetings, the
          orientation divided `LAG_KERNEL.peakSubsteps` and reported 4. Two
          figures for one quantity, three inches apart, in the one text a
          player takes entirely on trust. The orientation now reads the same
          kernel, and one of the two statements had to go: this one, because
          the other is in the list a player actually reads.

          What this panel had and the point does not is the *span* — "mostly
          delivered within 7.8 meetings" — and the judged-on-the-whole-path
          line. The span is on the policy desk under every move, where it is
          needed for a decision rather than for orientation; the path line is
          in orientation point 4, which is where "how it ends" belongs.
      */}

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
