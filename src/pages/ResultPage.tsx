import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { MAX_SCORE, getInstitution, tutorialProgress } from '../simulation/index.ts'
import { LineChart, type ChartSeries } from '../components/LineChart.tsx'
import { useRun } from '../features/game/runContext.ts'
import { buildMandateReport } from '../features/result/report.ts'
import { Mascot } from '../components/Mascot.tsx'
import { closingLine } from '../features/meeting/mascotLine.ts'
import { DoctrineMandatesPanel } from '../features/result/DoctrineMandatesPanel.tsx'

/**
 * The post-mandate report.
 *
 * The run is over, so this screen is allowed to show the realised path of the
 * true economy rather than the published statistics the player was working
 * from. That difference is itself part of the lesson.
 *
 * The written account leads, directly under the header: what happened, what
 * went well, what went wrong, why the score is what it is. The score and its
 * component breakdown come after, as the Scorecard — support for the
 * narrative, not the headline.
 */
export default function ResultPage() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const { finished, begin } = useRun()

  if (finished === null) return <Navigate to="/play/setup" replace />
  if (runId !== finished.runId) {
    return <Navigate to={`/play/result/${finished.runId}`} replace />
  }

  const { session, score, scoreboard } = finished
  const { config } = session.state
  const institution = getInstitution(config.institution)
  const outcome = session.outcome
  // Null at every difficulty but easy, which ends on a goal rather than a clock.
  const tutorial = tutorialProgress(session.state)
  const history = session.state.history
  const meetingsServed = session.state.meetingIndex
  const report = buildMandateReport(session.state, outcome, score)

  const line = (
    label: string,
    read: (index: number) => number,
    className: string,
    dash?: string,
  ): ChartSeries => ({
    label,
    values: history.map((_, index) => read(index)),
    className,
    dash,
  })

  const replaySameSeed = (): void => {
    begin({
      institution: config.institution,
      difficulty: config.difficulty,
      seed: config.seed,
    })
    navigate('/play/briefing')
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 text-onwood">
      <p className="text-2xs uppercase tracking-[0.14em] text-onwood-faint">
        {institution.name} · {config.difficulty} · seed {config.seed}
      </p>
      <h1
        className={`mt-1 font-display text-3xl font-semibold ${
          outcome.triggered === 'objective_met' ? 'text-good-onwood' : 'text-onwood'
        }`}
      >
        {outcome.triggered === 'objective_met'
          ? 'Objective met — well done'
          : (outcome.label ?? 'Mandate ended')}
      </h1>
      <p className="mt-1 text-sm text-onwood-soft">
        {/* A tutorial has no schedule, so "N of M scheduled meetings" would be
            reporting against a number it never promised. What it has is the
            number of meetings it took, which is the interesting figure. */}
        {tutorial === null
          ? `${meetingsServed} of ${config.meetingCount} scheduled meetings served.`
          : outcome.triggered === 'objective_met'
            ? `The economy was repaired and held in ${meetingsServed} meetings.`
            : `${meetingsServed} meetings served.`}
      </p>

      {outcome.triggered === 'objective_met' && (
        <section
          aria-labelledby="passed-heading"
          className="mt-4 rounded-lg border-l-4 border-good bg-good-surface p-4 shadow-panel"
        >
          <h2
            id="passed-heading"
            className="font-display text-xl font-semibold text-good-strong"
          >
            You brought it back.
          </h2>
          <p className="mt-1 text-sm text-ink">
            {outcome.summary}
          </p>
          <p className="mt-2 text-sm text-ink">
            That is the whole of monetary policy in one mandate: an economy
            running hot, an instrument that acts with a lag, and an objective
            you have to reach without breaking the other half of the mandate on
            the way. Medium adds the shock that makes those two halves pull
            against each other.
          </p>
        </section>
      )}

      {/* The postmortem is a document, so it sits on paper like everything
          else the player reads. The charts inside it draw in ink, which is
          what made them 1.04:1 while this section was on walnut. */}
      <div className="mt-6 rounded-lg border border-edge bg-panel p-4 text-ink shadow-panel sm:p-6">
      <section className="space-y-6" aria-labelledby="report-heading">
        <h2 id="report-heading" className="sr-only">
          The mandate, in full
        </h2>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
            What happened
          </h3>
          {report.whatHappened.map((paragraph) => (
            <p key={paragraph} className="mt-2 text-sm leading-relaxed text-ink">
              {paragraph}
            </p>
          ))}
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-good-strong">
            What went well
          </h3>
          {report.whatWentWell.map((paragraph) => (
            <p key={paragraph} className="mt-2 text-sm leading-relaxed text-ink">
              {paragraph}
            </p>
          ))}
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-accent-strong">
            What went wrong
          </h3>
          {report.whatWentWrong.map((paragraph) => (
            <p key={paragraph} className="mt-2 text-sm leading-relaxed text-ink">
              {paragraph}
            </p>
          ))}
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
            Why this score
          </h3>
          {report.whyThisScore.map((paragraph) => (
            <p key={paragraph} className="mt-2 text-sm leading-relaxed text-ink">
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="score-heading">
        <h2 id="score-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
          Scorecard
        </h2>
        <p className="mt-2 text-4xl font-semibold tabular-nums text-ink">
          {score.score.toLocaleString('en-US')}
          <span className="ml-2 text-base font-normal text-ink-faint">
            / {MAX_SCORE.toLocaleString('en-US')}
          </span>
        </p>

        <table className="mt-4 w-full border-collapse text-left text-sm">
          <caption className="sr-only">Score components</caption>
          <thead>
            <tr className="border-b border-edge text-xs uppercase tracking-wide text-ink-faint">
              <th scope="col" className="py-2 pr-2 font-medium">Component</th>
              <th scope="col" className="py-2 pr-2 text-right font-medium">Result</th>
              <th scope="col" className="py-2 text-right font-medium">Weight</th>
            </tr>
          </thead>
          <tbody>
            {score.components.map((component) => (
              <tr key={component.id} className="border-b border-edge align-top">
                <th scope="row" className="py-2 pr-2 font-medium text-ink">
                  {component.label}
                  <span className="block text-xs font-normal text-ink-faint">
                    {component.explanation}
                  </span>
                </th>
                <td className="py-2 pr-2 text-right tabular-nums text-ink">
                  {Math.round(component.raw * 100)} %
                </td>
                <td className="py-2 text-right tabular-nums text-ink-soft">
                  {Math.round(component.weight * 100)} %
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-3 text-xs text-ink-faint">
          Weighted total {Math.round(score.weightedTotal * 100)} %, difficulty
          multiplier ×{score.difficultyMultiplier.toFixed(2)}
          {score.priceStabilityGate < 1 &&
            `, price-stability gate ×${score.priceStabilityGate.toFixed(2)}`}
          {score.conductGate < 1 &&
            `, conduct gate ×${score.conductGate.toFixed(2)}`}
          . Scoring formula v{score.scoringVersion}, engine v{score.simulationVersion}.
        </p>
      </section>

      {outcome.causalChain.length > 0 && (
        <section className="mt-8" aria-labelledby="cause-heading">
          <h2 id="cause-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
            How it ended
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Several factors contributed, in this order of weight.
          </p>
          <ol className="mt-3 space-y-2">
            {outcome.causalChain.map((factor) => (
              <li key={factor.label} className="border-l-2 border-edge pl-3">
                <p className="text-sm font-medium text-ink">
                  {factor.label}
                  <span className="ml-2 font-normal tabular-nums text-ink-faint">
                    {Math.round(factor.contribution * 100)} %
                  </span>
                </p>
                <p className="text-sm text-ink-soft">{factor.detail}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-8" aria-labelledby="charts-heading">
        <h2 id="charts-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
          The mandate in four charts
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          The true path of the economy, one point per meeting. During the run you saw
          only the published version of this: later, noisier and revised.
        </p>

        <LineChart
          title="Inflation"
          unit="% per year"
          reference={{ label: 'objective', value: institution.inflationTarget }}
          series={[
            line('Headline', (i) => history[i].latent.inflationHeadline, 'stroke-ink'),
            line('Core', (i) => history[i].latent.inflationCore, 'stroke-good-strong', '5 3'),
          ]}
        />

        <LineChart
          title="Unemployment"
          unit="%"
          series={[
            line('Unemployment', (i) => history[i].latent.unemployment, 'stroke-ink'),
            line(
              'Sustainable rate',
              (i) => history[i].latent.naturalUnemployment,
              'stroke-accent-strong',
              '5 3',
            ),
          ]}
        />

        <LineChart
          title="Policy rate"
          unit="%"
          series={[
            line('Policy rate', (i) => history[i].latent.policyRate, 'stroke-ink'),
          ]}
        />

        <LineChart
          title="Output gap"
          unit="% of potential"
          reference={{ label: 'potential', value: 0 }}
          series={[
            line('Output gap', (i) => history[i].latent.outputGap, 'stroke-ink'),
          ]}
        />
      </section>

      <DoctrineMandatesPanel session={session} score={score} board={scoreboard} />

      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={replaySameSeed}
          className="rounded-md border border-edge-accent bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-panel transition-colors hover:bg-accent-onwood"
        >
          Replay the same seed
        </button>
        <Link
          to="/play/setup"
          className="rounded border border-edge-room px-4 py-2 text-sm text-onwood hover:bg-inset"
        >
          New economy
        </Link>
        <Link
          to="/"
          className="rounded border border-edge-room px-4 py-2 text-sm text-onwood hover:bg-inset"
        >
          Home
        </Link>
      </div>

      <aside className="mt-8 flex items-start gap-3 rounded-lg border border-edge-room bg-room p-4">
        <Mascot size={92} className="shrink-0" />
        <p className="text-sm leading-relaxed text-onwood-soft">
          {closingLine({
            completed: outcome.status === 'completed',
            objectiveMet: outcome.triggered === 'objective_met',
            objectiveMissed: outcome.triggered === 'objective_missed',
            score: score.score,
            maxScore: MAX_SCORE,
            conductGate: score.conductGate,
            supplyRegimeShare: score.supplyRegimeShare,
          })}
        </p>
      </aside>

      <p className="mt-6 text-xs text-onwood-faint">
        This build keeps no local records, so this report is not stored anywhere and
        is lost when you leave the page.
      </p>
    </main>
  )
}
